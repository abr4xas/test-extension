// Lists the monsters the server reports in range (about 12 tiles around the character, more than
// what is on screen) and alerts when a Golden monster or a Blue Dragon is among them.
// Runs in the page's world at document_start so it wraps WebSocket before the game creates it.
// Only incoming, unencrypted packets are read; nothing the client sends is touched.
(() => {
  const ALERT_NAME = /^Golden /;
  // Named "Golden" but not invasion monsters: the Rena exchange NPC and a reward box.
  const ALERT_EXCLUDED = new Set([236, 542]); // Golden Archer, Golden Compensation Box
  // Monsters missing from the name list; identified in game.
  const CUSTOM_NAMES = { 703: 'Blue Dragon' };
  const ALERT_CUSTOM = new Set([703]);
  const PANEL_ROWS = 10;
  const RENDER_EVERY_MS = 1000;
  const MAP_CHECK_EVERY_MS = 2000;

  const NAMES = { ...globalThis.__openmuMonsterNames, ...CUSTOM_NAMES };
  const NPC_NAMES = globalThis.__openmuNpcNames || {};
  const createScope = globalThis.__openmuCreateScope;
  delete globalThis.__openmuMonsterNames;
  delete globalThis.__openmuNpcNames;
  delete globalThis.__openmuCreateScope;

  const log = (...args) => console.log('[OpenMU Monsters]', ...args);
  const isNpc = (type) => type in NPC_NAMES;
  const nameOf = (type) => NAMES[type] || (isNpc(type) ? `${NPC_NAMES[type]} (NPC)` : `Monster #${type}`);
  const isAlert = (type) =>
    ALERT_CUSTOM.has(type) || (ALERT_NAME.test(NAMES[type] || '') && !ALERT_EXCLUDED.has(type));

  // Every monster type ever seen, kept in localStorage so unknown ones (e.g. the server's own invasion
  // monsters) can be identified later, even if nobody was watching when they showed up.
  const SEEN_TYPES_KEY = 'openmu-monsters:seen-types';
  let seenTypes;
  try {
    seenTypes = JSON.parse(localStorage.getItem(SEEN_TYPES_KEY)) || {};
  } catch {
    seenTypes = {};
  }

  function noteType({ type, x, y, map }) {
    if (seenTypes[type]) return;
    const entry = { name: nameOf(type), map, x, y, firstSeen: new Date().toLocaleString() };
    seenTypes[type] = entry;
    localStorage.setItem(SEEN_TYPES_KEY, JSON.stringify(seenTypes));
    log(`New monster type #${type} (${entry.name}) at (${x}, ${y}) on map ${map ?? '?'}`);
  }

  const scope = createScope({ isNpc, onSpawn: noteType });
  const alerted = new Set();

  // Screen calibration: walking towards lower Y moves the character down on screen, so +Y is up.
  // +X is assumed to be right; flip X_SCREEN to -1 if arrows point the wrong way sideways.
  const X_SCREEN = 1;
  const Y_SCREEN = 1;
  const ARROWS = ['→', '↗', '↑', '↖', '←', '↙', '↓', '↘'];

  // Distance in tiles (MU walks in 8 directions) and an arrow towards the target as seen on screen.
  function bearing(hero, target) {
    if (!hero) return null;
    const dx = target.x - hero.x;
    const dy = target.y - hero.y;
    const distance = Math.max(Math.abs(dx), Math.abs(dy));
    if (distance === 0) return { distance, arrow: '•' };
    const angle = Math.atan2(dy * Y_SCREEN, dx * X_SCREEN);
    return { distance, arrow: ARROWS[(Math.round(angle / (Math.PI / 4)) + 8) % 8] };
  }

  function watch(socket) {
    const stream = scope.openStream();
    let queue = Promise.resolve();
    socket.addEventListener('message', (event) => {
      queue = queue.then(async () => {
        const { data } = event;
        if (data instanceof ArrayBuffer) stream.feed(new Uint8Array(data));
        else if (data instanceof Blob) stream.feed(new Uint8Array(await data.arrayBuffer()));
        else if (ArrayBuffer.isView(data)) stream.feed(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
      }).catch((error) => log('parse error', error));
    });
    socket.addEventListener('close', () => stream.close());
  }

  window.WebSocket = new Proxy(window.WebSocket, {
    construct(target, args) {
      const socket = Reflect.construct(target, args);
      watch(socket);
      return socket;
    },
  });

  setInterval(() => {
    const map = globalThis.__openmuGame.mapIndex();
    if (map !== null && scope.setMap(map)) alerted.clear();
  }, MAP_CHECK_EVERY_MS);

  function beep() {
    try {
      const audio = new AudioContext();
      [0, 0.25, 0.5].forEach((start) => {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.frequency.value = 880;
        gain.gain.value = 0.15;
        osc.connect(gain).connect(audio.destination);
        osc.start(audio.currentTime + start);
        osc.stop(audio.currentTime + start + 0.15);
      });
      setTimeout(() => audio.close(), 1500);
    } catch {
      // Audio is optional.
    }
  }

  function element(id, css) {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      el.style.cssText = css.join(';');
      document.body.append(el);
    }
    return el;
  }

  // Options set by content.js from the extension popup; the defaults until it says otherwise.
  function readSettings() {
    const raw = document.documentElement.dataset.openmuSettings || '{}';
    try {
      return { raw, ...OPENMU_DEFAULTS, ...JSON.parse(raw) };
    } catch {
      return { raw, ...OPENMU_DEFAULTS };
    }
  }

  // What was last drawn, so a render is skipped while neither the scope nor the options changed.
  let shown = null;

  function render() {
    if (!document.body) return;
    const settings = readSettings();
    const { version, hero, monsters } = scope.snapshot();
    if (shown?.version === version && shown?.settings === settings.raw) return;
    shown = { version, settings: settings.raw };

    const targets = monsters.filter((m) => isAlert(m.type));
    const banner = element('openmu-monsters-alert', [
      'position:fixed', 'left:50%', 'top:64px', 'transform:translateX(-50%)', 'z-index:2147483647',
      'pointer-events:none', 'padding:10px 18px', 'border-radius:8px', 'border:2px solid #f4d795',
      'background:rgba(60,40,0,.85)', 'color:#fff0c4', 'font:bold 18px/1.4 system-ui,sans-serif',
      'text-align:center', 'white-space:pre',
    ]);
    if (targets.length && settings.invasionAlert) {
      const types = new Set(targets.map((m) => m.type));
      const title = types.size === 1 ? nameOf(targets[0].type) : 'Invasion monsters';
      const where = targets
        .map((m) => {
          const b = bearing(hero, m);
          const at = b ? `${b.distance} tiles ${b.arrow} (${m.x}, ${m.y})` : `(${m.x}, ${m.y})`;
          return types.size === 1 ? at : `${nameOf(m.type)} · ${at}`;
        })
        .join('\n');
      banner.textContent = `${title} in range ×${targets.length}\n${where}`;
      banner.style.display = 'block';
      const fresh = targets.filter((m) => !alerted.has(m.id));
      if (fresh.length) {
        fresh.forEach((m) => alerted.add(m.id));
        log('In range:', fresh.map((m) => `${nameOf(m.type)} (${m.x}, ${m.y})`).join(', '));
        beep();
      }
    } else {
      banner.style.display = 'none';
    }

    const counts = new Map();
    monsters.forEach(({ type }) => counts.set(type, (counts.get(type) || 0) + 1));
    const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const panel = element('openmu-monsters-panel', [
      'position:fixed', 'left:8px', 'top:132px', 'z-index:2147483647', 'pointer-events:none',
      'padding:6px 10px', 'border-radius:6px', 'background:rgba(0,0,0,.65)', 'color:#e8e8e8',
      'font:12px/1.4 system-ui,sans-serif', 'white-space:pre',
    ]);
    panel.style.display = settings.monstersPanel ? 'block' : 'none';
    if (!settings.monstersPanel) return;
    panel.replaceChildren();
    const line = (text, color) => {
      const div = document.createElement('div');
      div.textContent = text;
      if (color) div.style.color = color;
      panel.append(div);
    };
    line(`Monsters in range: ${monsters.length}`, '#f4d795');
    line(hero ? `You: (${hero.x}, ${hero.y})` : 'You: walk a step to locate', '#aaa');
    rows.slice(0, PANEL_ROWS).forEach(([type, count]) => {
      const name = nameOf(type);
      // Nearest monster of each type, so the direction arrows can be checked against the screen.
      const nearest = monsters
        .filter((m) => m.type === type)
        .map((m) => bearing(hero, m))
        .filter(Boolean)
        .sort((a, b) => a.distance - b.distance)[0];
      const near = nearest ? ` · ${nearest.distance} ${nearest.arrow}` : '';
      line(`${name} ×${count}${near}`, isAlert(type) ? '#ffd24a' : null);
    });
    if (rows.length > PANEL_ROWS) line(`+${rows.length - PANEL_ROWS} more types`, '#aaa');
  }

  setInterval(render, RENDER_EVERY_MS);
  log('Watching monsters in range');
})();
