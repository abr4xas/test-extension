// Keeps the MU Helper running. The HUD helper button reports the helper state in aria-pressed and
// gets .is-safezone in town, where the helper cannot run. Pressing it only opens the MU Helper
// window; "Start Helper" is inside.
const helperRoutine = (() => {
  // Only restart the helper after it has been stopped this long.
  const STOPPED_GRACE_MS = 15000;
  const COOLDOWN_MS = 30000;
  let lastStart = 0;
  let stoppedSince = null;
  let stoppedByPlayer = false;

  const isRunning = () => byId('mu-web-autoatk-btn')?.getAttribute('aria-pressed') === 'true';

  // A real click by the player (isTrusted; the extension's own presses are not) on any helper control
  // decides whether the helper may be restarted: stopped by the player stays stopped until the player
  // starts it again. Listens on window because the game stops these clicks before they reach document.
  window.addEventListener('click', (event) => {
    if (!event.isTrusted || !(event.target instanceof Element)) return;
    if (!event.target.closest('#mu-web-autoatk-btn, [id^="mu-mobile-helper"], #mu-mobile-autoatk-btn')) return;
    setTimeout(() => {
      const stoppedNow = !isRunning();
      if (stoppedNow !== stoppedByPlayer) {
        stoppedByPlayer = stoppedNow;
        log(stoppedNow ? 'MU Helper stopped by the player, leaving it off' : 'MU Helper started by the player');
      }
    }, 1000);
  }, true);

  return {
    setting: 'autoHelper',
    async run() {
      const hudButton = byId('mu-web-autoatk-btn');
      if (!hudButton || isRunning() || hudButton.classList.contains('is-safezone') || stoppedByPlayer) {
        stoppedSince = null;
        return false;
      }

      stoppedSince ??= Date.now();
      if (Date.now() - stoppedSince < STOPPED_GRACE_MS) return false;
      if (Date.now() - lastStart < COOLDOWN_MS) return false;
      lastStart = Date.now();

      log('MU Helper is stopped, opening its window');
      press(hudButton);
      const start = byId('mu-mobile-helper-start');
      if (!(await waitFor(() => isVisible(start), MODAL_TIMEOUT_MS))) {
        log('MU Helper window did not open, will retry');
        return true;
      }
      press(start);
      const started = await waitFor(isRunning, MODAL_TIMEOUT_MS);
      const close = byId('mu-mobile-helper-modal')?.querySelector('.helper-close');
      if (isVisible(close)) press(close);
      if (started) {
        log('MU Helper started');
        record('helper');
      } else {
        log('MU Helper did not start, will retry');
      }
      return true;
    },
  };
})();
