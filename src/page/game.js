// The game's own exports (window.Module._MuWeb*), read in one place. Runs in the page's world, where
// monsters.js uses it directly and the popup calls it through chrome.scripting. The name of the
// character in play is published on <html data-openmu-hero> for content.js, which cannot call into
// the game.
globalThis.__openmuGame = (() => {
  const HERO_CHECK_EVERY_MS = 2000;

  // Each export only exists once the game has loaded; until then every read returns null.
  const exported = (name) => (typeof window.Module?.[name] === 'function' ? window.Module[name] : null);
  const text = (pointer) => window.Module.UTF8ToString(pointer);

  const game = {
    // Empty on the character selection screen, which reads as null.
    heroName() {
      const read = exported('_MuWebGetHeroNameUtf8');
      return read ? text(read()).trim() || null : null;
    },
    mapIndex() {
      const read = exported('_MuWebGetMapIndex');
      return read ? read() : null;
    },
    // The full warp list; the game's own warp window cuts it short.
    moveList() {
      const count = exported('_MuWebGetMoveListCount');
      if (!count) return null;
      const m = window.Module;
      return Array.from({ length: count() }, (_, index) => ({
        index,
        // Names come as "DisplayName - InternalName".
        name: text(m._MuWebGetMoveListNameUtf8(index)).split(' - ')[0],
        level: m._MuWebGetMoveListReqLevel(index),
        zen: m._MuWebGetMoveListReqZen(index),
        canMove: m._MuWebGetMoveListCanMove(index) === 1,
      }));
    },
    // Requested through the same export the game's warp window uses.
    warp(index) {
      exported('_MuWebRequestWarp')?.(index);
    },
    // Sends a chat line, as the game's own windows do for their slash commands. Returns false when
    // nothing was sent, e.g. during the chat's one-second cooldown.
    chat(line) {
      const submit = exported('_MuWebSubmitChatUtf8');
      if (!submit || typeof window.muAllocateUtf8 !== 'function') return false;
      const pointer = window.muAllocateUtf8(line);
      try {
        return submit(pointer, 0, 0) === 1;
      } finally {
        window.Module._free(pointer);
      }
    },
  };

  // Keep the last character until another one enters.
  setInterval(() => {
    const name = game.heroName();
    if (name && document.documentElement.dataset.openmuHero !== name) {
      document.documentElement.dataset.openmuHero = name;
    }
  }, HERO_CHECK_EVERY_MS);

  return game;
})();
