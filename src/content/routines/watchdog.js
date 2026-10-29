// The game shows "The game stopped responding" with Wait / Reload / Restart. Restart recovers the
// game loop without reloading the page.
const watchdogRoutine = (() => {
  const COOLDOWN_MS = 60000;
  let lastRestart = 0;

  return {
    setting: 'autoRestart',
    async run() {
      const restart = byId('mu-mobile-watchdog-retry');
      if (!isVisible(restart) || Date.now() - lastRestart < COOLDOWN_MS) return false;
      lastRestart = Date.now();
      log('Game stopped responding, pressing Restart');
      press(restart);
      record('watchdog');
      return true;
    },
  };
})();
