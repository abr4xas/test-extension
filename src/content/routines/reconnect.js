// Brings the Hero back into the game after the connection drops. The game then shows "The game
// disconnected" with "Sign in again", which reloads the page; after the reload the server is chosen
// again and, with the account still signed in, the character selection screen follows. The Hero is
// remembered in sessionStorage, which survives the reload, so it can be picked there by name.
// "Your game continued somewhere else" is left alone: the account is in play on another device.
const reconnectRoutine = (() => {
  const KEY = 'openmu-auto-reset:reconnect';
  // The modal's title when the connection dropped, in each of the game's languages.
  const DROPPED_TITLES = ['The game disconnected', 'La partida se desconectó', 'A partida foi desconectada'];
  const SCENE_CHARACTER_SELECTION = '4';
  const SCENE_GAME = '5';
  // Gives up if the Hero is not back in the game by then, e.g. when the server is down.
  const GIVE_UP_MS = 5 * 60 * 1000;
  const ENTER_TIMEOUT_MS = 20000;
  const COOLDOWN_MS = 10000;
  let lastAttempt = 0;

  const load = () => {
    try {
      return JSON.parse(sessionStorage.getItem(KEY));
    } catch {
      return null;
    }
  };
  const save = (state) => sessionStorage.setItem(KEY, JSON.stringify(state));
  const clear = () => sessionStorage.removeItem(KEY);
  const scene = () => document.documentElement.dataset.openmuScene;

  function signInAgainButton() {
    const modal = byId('mu-session-handoff-modal');
    if (!isVisible(modal) || modal.classList.contains('hidden') || !modal.classList.contains('session-ended')) return null;
    const title = byId('mu-session-handoff-title')?.textContent.trim();
    if (!DROPPED_TITLES.includes(title)) return null;
    const button = byId('mu-session-handoff-confirm');
    return isVisible(button) && !button.disabled ? button : null;
  }

  async function enter(hero) {
    document.documentElement.dataset.openmuEnterHero = hero;
    document.dispatchEvent(new CustomEvent('openmu:enter-character'));
    if (await waitFor(() => scene() === SCENE_GAME && currentHero() === hero, ENTER_TIMEOUT_MS)) {
      log(`Back in the game with ${hero}`);
      clear();
      record('reconnect');
    } else {
      log(`${hero} did not enter the game, will retry`);
    }
  }

  return {
    setting: 'autoReconnect',
    async run() {
      const signInAgain = signInAgainButton();
      if (signInAgain) {
        const hero = currentHero();
        if (!hero) return false;
        if (!load()) save({ hero, since: Date.now() });
        log(`The game disconnected, signing in again with ${hero}`);
        press(signInAgain);
        return true;
      }

      const state = load();
      if (!state) return false;
      if (Date.now() - state.since > GIVE_UP_MS) {
        log(`Could not bring ${state.hero} back into the game, giving up`);
        clear();
        return false;
      }
      // A character entered the game some other way, e.g. by the player.
      if (scene() === SCENE_GAME && currentHero()) {
        clear();
        return false;
      }
      if (Date.now() - lastAttempt < COOLDOWN_MS) return true;

      const serverSelect = byId('mu-server-select');
      if (isVisible(serverSelect) && !serverSelect.classList.contains('hidden')) {
        lastAttempt = Date.now();
        log('Choosing the OpenMU Fast server');
        press(byId('mu-server-card-fast'));
        return true;
      }

      if (scene() === SCENE_CHARACTER_SELECTION) {
        lastAttempt = Date.now();
        log(`Entering the game with ${state.hero}`);
        await enter(state.hero);
        return true;
      }

      // Still loading: hold the tick so no other routine acts in between.
      return true;
    },
  };
})();
