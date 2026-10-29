// Runs the routines every few seconds and shows what they did. Loaded after dom.js, history.js,
// rewards-menu.js and the routines.
const CHECK_EVERY_MS = 5000;
const SUMMARY_WINDOW_MS = 12 * 60 * 60 * 1000;

// In priority order. A routine's run() resolves true when it used the tick, which ends it.
const ROUTINES = [watchdogRoutine, resetRoutine, rewardsRoutine, missionsRoutine, helperRoutine];

let busy = false;
let settings = { ...OPENMU_DEFAULTS };
const extensionHistory = createHistory(localStorage);

// The page's world (monsters.js) has no access to chrome.storage, so the options are handed over
// through an attribute on <html>.
function applySettings(values) {
  settings = { ...settings, ...values };
  document.documentElement.dataset.openmuSettings = JSON.stringify(settings);
  renderSummary();
}

chrome.storage.local.get(OPENMU_DEFAULTS).then(applySettings);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  applySettings(Object.fromEntries(Object.entries(changes).map(([key, { newValue }]) => [key, newValue])));
});

// Name of the character in play, published by game.js; null until a character enters the game.
const currentHero = () => document.documentElement.dataset.openmuHero || null;

function record(type) {
  extensionHistory.record(type, currentHero());
  renderSummary();
}

function renderSummary() {
  let panel = byId('openmu-auto-reset-summary');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'openmu-auto-reset-summary';
    panel.style.cssText = [
      'position:fixed', 'left:8px', 'top:8px', 'z-index:2147483647', 'pointer-events:none',
      'padding:6px 10px', 'border-radius:6px', 'background:rgba(0,0,0,.65)', 'color:#f4d795',
      'font:12px/1.4 system-ui,sans-serif', 'white-space:pre',
    ].join(';');
    document.body.append(panel);
  }
  panel.style.display = settings.summaryPanel ? 'block' : 'none';
  if (!settings.summaryPanel) return;

  // Only the character in play is summarized.
  const hero = currentHero();
  const summary = extensionHistory.summarize(hero, SUMMARY_WINDOW_MS);
  const lines = [`Auto Reset · ${hero ?? 'no character yet'} · last 12 h`, `Resets: ${summary.resets}`];
  if (summary.lastResetAt) lines.push(`Last reset: ${formatTime(summary.lastResetAt)}`);
  if (summary.minutesBetweenResets !== null) {
    lines.push(`Avg between resets: ${Math.round(summary.minutesBetweenResets)} min`);
  }
  lines.push(
    `Game restarts: ${summary.gameRestarts}`,
    `Helper restarts: ${summary.helperRestarts}`,
    `Rewards claimed: ${summary.rewardsClaimed}`,
    `Missions claimed: ${summary.missionsClaimed}`,
  );
  panel.textContent = lines.join('\n');
}

async function tick() {
  if (busy) return;
  busy = true;
  try {
    renderSummary();
    for (const routine of ROUTINES) {
      if (settings[routine.setting] && (await routine.run())) return;
    }
  } finally {
    busy = false;
  }
}

setInterval(tick, CHECK_EVERY_MS);
log('Watching for the reset button');
