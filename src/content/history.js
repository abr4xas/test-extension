// What the extension did for each hero, kept in the page's localStorage so it survives reloads.
// Events older than a day are dropped when the next one is recorded. Tests pass an in-memory
// storage and a fixed clock.
function createHistory(storage, now = () => Date.now()) {
  const KEY = 'openmu-auto-reset:history';
  const KEEP_MS = 24 * 60 * 60 * 1000;

  function load() {
    try {
      return JSON.parse(storage.getItem(KEY)) || [];
    } catch {
      return [];
    }
  }

  return {
    // type is one of 'reset', 'watchdog', 'helper', 'reward' or 'mission'.
    record(type, hero) {
      const at = now();
      const events = load().filter((event) => at - event.at < KEEP_MS);
      events.push({ type, at, hero });
      storage.setItem(KEY, JSON.stringify(events));
    },
    // Counts for one hero over the last windowMs.
    summarize(hero, windowMs) {
      const at = now();
      const recent = load().filter((event) => event.hero === hero && at - event.at < windowMs);
      const resets = recent.filter((event) => event.type === 'reset').map((event) => event.at);
      const count = (type) => recent.filter((event) => event.type === type).length;
      return {
        resets: resets.length,
        lastResetAt: resets.at(-1) ?? null,
        minutesBetweenResets: resets.length > 1 ? (resets.at(-1) - resets[0]) / (resets.length - 1) / 60000 : null,
        gameRestarts: count('watchdog'),
        helperRestarts: count('helper'),
        rewardsClaimed: count('reward'),
        missionsClaimed: count('mission'),
      };
    },
  };
}
