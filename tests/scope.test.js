const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load');

const { __openmuCreateScope: createScope } = load('src/page/scope.js');

const hi = (n) => (n >> 8) & 0xff;
const lo = (n) => n & 0xff;
const c1 = (...body) => [0xc1, body.length + 2, ...body];
const c2 = (...body) => [0xc2, hi(body.length + 3), lo(body.length + 3), ...body];

// AddNpcsToScope with objects { id, type, x, y, effects }.
const spawn = (...objects) =>
  c2(0x13, objects.length, ...objects.flatMap(({ id, type, x, y, effects = [] }) =>
    [hi(id), lo(id), hi(type), lo(type), x, y, x, y, 0, effects.length, ...effects]));
const entered = (id) => c1(0xf1, 0x00, 0x01, hi(id), lo(id));
const walked = (id, x, y) => c1(0xd4, hi(id), lo(id), x, y);
const moved = (id, x, y) => c1(0x15, hi(id), lo(id), x, y);
const outOfScope = (...ids) => c1(0x14, ids.length, ...ids.flatMap((id) => [hi(id), lo(id)]));
const killed = (id) => c1(0x17, hi(id), lo(id), 0, 0);

const bytes = (...packets) => new Uint8Array(packets.flat());
const plain = (value) => JSON.parse(JSON.stringify(value));
const monstersOf = (scope) => plain(scope.snapshot().monsters);

test('spawned monsters enter the scope, with the fresh-spawn bit dropped from the id', () => {
  const scope = createScope();
  scope.openStream().feed(bytes(spawn({ id: 0x8005, type: 79, x: 120, y: 40 }, { id: 6, type: 703, x: 10, y: 11 })));
  assert.deepEqual(monstersOf(scope), [
    { id: 5, type: 79, x: 120, y: 40 },
    { id: 6, type: 703, x: 10, y: 11 },
  ]);
});

test('effects after a spawned object do not shift the next one', () => {
  const scope = createScope();
  scope.openStream().feed(bytes(spawn({ id: 1, type: 79, x: 1, y: 2, effects: [9, 9, 9] }, { id: 2, type: 44, x: 3, y: 4 })));
  assert.deepEqual(monstersOf(scope).map((m) => m.type), [79, 44]);
});

test('NPCs are reported as spawns but stay out of the scope', () => {
  const spawns = [];
  const scope = createScope({ isNpc: (type) => type === 236, onSpawn: (s) => spawns.push(s) });
  scope.setMap(3);
  scope.openStream().feed(bytes(spawn({ id: 1, type: 236, x: 5, y: 6 }, { id: 2, type: 79, x: 7, y: 8 })));
  assert.deepEqual(monstersOf(scope).map((m) => m.type), [79]);
  assert.deepEqual(plain(spawns), [
    { type: 236, x: 5, y: 6, map: 3 },
    { type: 79, x: 7, y: 8, map: 3 },
  ]);
});

test('a packet split across frames is parsed once complete', () => {
  const scope = createScope();
  const stream = scope.openStream();
  const all = bytes(spawn({ id: 1, type: 79, x: 1, y: 2 }), walked(1, 9, 9));
  stream.feed(all.slice(0, 2));
  stream.feed(all.slice(2, 9));
  assert.deepEqual(monstersOf(scope), []);
  stream.feed(all.slice(9));
  assert.deepEqual(monstersOf(scope), [{ id: 1, type: 79, x: 9, y: 9 }]);
});

test('each stream keeps its own partial packet', () => {
  const scope = createScope();
  const first = scope.openStream();
  const second = scope.openStream();
  const packet = bytes(spawn({ id: 1, type: 79, x: 1, y: 2 }));
  first.feed(packet.slice(0, 5));
  second.feed(bytes(killed(9)));
  first.feed(packet.slice(5));
  assert.equal(monstersOf(scope).length, 1);
});

test('garbage drops the partial packet and the next frame starts clean', () => {
  const scope = createScope();
  const stream = scope.openStream();
  stream.feed(new Uint8Array([0x00, 0x01, 0x02]));
  stream.feed(bytes(spawn({ id: 1, type: 79, x: 1, y: 2 })));
  assert.equal(monstersOf(scope).length, 1);
});

test('monsters walk, move, leave and die', () => {
  const scope = createScope();
  const stream = scope.openStream();
  stream.feed(bytes(spawn({ id: 1, type: 79, x: 1, y: 1 }, { id: 2, type: 44, x: 2, y: 2 }, { id: 3, type: 44, x: 3, y: 3 })));
  stream.feed(bytes(walked(1, 10, 11), moved(2, 20, 21)));
  assert.deepEqual(monstersOf(scope).map(({ x, y }) => [x, y]), [[10, 11], [20, 21], [3, 3]]);
  stream.feed(bytes(outOfScope(1, 3), killed(2)));
  assert.deepEqual(monstersOf(scope), []);
});

test('the hero is located by its first step after entering the game server', () => {
  const scope = createScope();
  const stream = scope.openStream();
  stream.feed(bytes(entered(0x8007)));
  assert.equal(scope.snapshot().hero, null);
  stream.feed(bytes(walked(7, 130, 140)));
  assert.deepEqual(plain(scope.snapshot().hero), { x: 130, y: 140 });
  assert.deepEqual(monstersOf(scope), []);
});

test('a new map clears monsters and the hero; the first map does not', () => {
  const scope = createScope();
  const stream = scope.openStream();
  assert.equal(scope.setMap(0), false);
  stream.feed(bytes(entered(7), walked(7, 1, 1), spawn({ id: 1, type: 79, x: 1, y: 2 })));
  assert.equal(scope.setMap(0), false);
  assert.equal(monstersOf(scope).length, 1);
  assert.equal(scope.setMap(2), true);
  assert.deepEqual(monstersOf(scope), []);
  assert.equal(scope.snapshot().hero, null);
});

test('closing a stream empties the scope', () => {
  const scope = createScope();
  const stream = scope.openStream();
  stream.feed(bytes(spawn({ id: 1, type: 79, x: 1, y: 2 })));
  stream.close();
  assert.deepEqual(monstersOf(scope), []);
});

test('the version only moves when the scope changes', () => {
  const scope = createScope();
  const stream = scope.openStream();
  const before = scope.snapshot().version;
  stream.feed(bytes(walked(99, 1, 1)));
  assert.equal(scope.snapshot().version, before);
  stream.feed(bytes(spawn({ id: 1, type: 79, x: 1, y: 2 })));
  assert.notEqual(scope.snapshot().version, before);
});

test('snapshots are copies', () => {
  const scope = createScope();
  scope.openStream().feed(bytes(spawn({ id: 1, type: 79, x: 1, y: 2 })));
  scope.snapshot().monsters[0].x = 50;
  assert.equal(scope.snapshot().monsters[0].x, 1);
});
