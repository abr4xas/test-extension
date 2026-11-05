const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load');

// The hero publisher's interval is captured, not run, so each test drives it.
function loadGame(Module) {
  const intervals = [];
  const documentElement = { dataset: {} };
  const window = { Module };
  const context = load('src/page/game.js', {
    window,
    document: { documentElement },
    setInterval: (fn) => intervals.push(fn),
  });
  return { game: context.__openmuGame, publishHero: () => intervals.forEach((fn) => fn()), dataset: documentElement.dataset, window };
}

// Strings are passed as themselves instead of as pointers.
const fakeModule = (overrides = {}) => ({ UTF8ToString: (value) => value, ...overrides });

const plain = (value) => JSON.parse(JSON.stringify(value));

test('every read is null until the game has loaded', () => {
  const { game } = loadGame(undefined);
  assert.equal(game.heroName(), null);
  assert.equal(game.mapIndex(), null);
  assert.equal(game.moveList(), null);
  game.warp(3);
});

test('reads the map index', () => {
  const { game } = loadGame(fakeModule({ _MuWebGetMapIndex: () => 7 }));
  assert.equal(game.mapIndex(), 7);
});

test('the move list keeps only the display name', () => {
  const maps = [
    { name: 'Lorencia - lorencia', level: 0, zen: 0, canMove: 1 },
    { name: 'Devias - devias', level: 20, zen: 2000, canMove: 0 },
  ];
  const { game } = loadGame(fakeModule({
    _MuWebGetMoveListCount: () => maps.length,
    _MuWebGetMoveListNameUtf8: (i) => maps[i].name,
    _MuWebGetMoveListReqLevel: (i) => maps[i].level,
    _MuWebGetMoveListReqZen: (i) => maps[i].zen,
    _MuWebGetMoveListCanMove: (i) => maps[i].canMove,
  }));
  assert.deepEqual(plain(game.moveList()), [
    { index: 0, name: 'Lorencia', level: 0, zen: 0, canMove: true },
    { index: 1, name: 'Devias', level: 20, zen: 2000, canMove: false },
  ]);
});

test('warps through the game export', () => {
  const warps = [];
  const { game } = loadGame(fakeModule({ _MuWebRequestWarp: (i) => warps.push(i) }));
  game.warp(4);
  assert.deepEqual(warps, [4]);
});

test('publishes the hero and keeps it through the character selection screen', () => {
  let name = '';
  const { publishHero, dataset } = loadGame(fakeModule({ _MuWebGetHeroNameUtf8: () => name }));
  publishHero();
  assert.equal(dataset.openmuHero, undefined);
  name = ' Hero ';
  publishHero();
  assert.equal(dataset.openmuHero, 'Hero');
  name = '';
  publishHero();
  assert.equal(dataset.openmuHero, 'Hero');
});

test('publishes the scene', () => {
  let scene = 4;
  const { publishHero, dataset } = loadGame(fakeModule({ _MuWebGetSceneFlag: () => scene }));
  publishHero();
  assert.equal(dataset.openmuScene, '4');
  scene = 5;
  publishHero();
  assert.equal(dataset.openmuScene, '5');
});

// Slots 0 and 2 hold characters; the rest are empty.
const characterSelection = (calls) => fakeModule({
  _MuWebCharSelSlotUsed: (slot) => (slot === 0 || slot === 2 ? 1 : 0),
  _MuWebCharSelNameUtf8: (slot) => ['Kiran', '', 'SMMomo'][slot],
  _MuWebCharSelSelect: (slot) => calls.push(['select', slot]),
  _MuWebCharSelEnter: () => calls.push(['enter']),
});

test('lists the characters on the selection screen by slot', () => {
  const { game } = loadGame(characterSelection([]));
  assert.deepEqual(plain(game.characters()), [{ slot: 0, name: 'Kiran' }, { slot: 2, name: 'SMMomo' }]);
});

test('enters the game with a character picked by name', () => {
  const calls = [];
  const { game } = loadGame(characterSelection(calls));
  assert.equal(game.enterCharacter('SMMomo'), true);
  assert.deepEqual(calls, [['select', 2], ['enter']]);
});

test('does nothing for a character that is not on the selection screen', () => {
  const calls = [];
  const { game } = loadGame(characterSelection(calls));
  assert.equal(game.enterCharacter('Nobody'), false);
  assert.deepEqual(calls, []);
  assert.deepEqual(plain(loadGame(undefined).game.characters()), []);
});

test('the game loading later is picked up', () => {
  const { game, window } = loadGame(undefined);
  assert.equal(game.mapIndex(), null);
  window.Module = fakeModule({ _MuWebGetMapIndex: () => 2 });
  assert.equal(game.mapIndex(), 2);
});
