const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load');

const { createHistory } = load('src/content/history.js');

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

function memoryStorage() {
  const items = new Map();
  return { getItem: (key) => items.get(key) ?? null, setItem: (key, value) => items.set(key, value) };
}

function setup() {
  const clock = { now: 0 };
  const history = createHistory(memoryStorage(), () => clock.now);
  const at = (ms, type, hero) => {
    clock.now = ms;
    history.record(type, hero);
  };
  return { clock, history, at };
}

test('an empty history summarizes to zeros', () => {
  const { history } = setup();
  assert.deepEqual({ ...history.summarize('Hero', 12 * HOUR) }, {
    resets: 0,
    lastResetAt: null,
    minutesBetweenResets: null,
    gameRestarts: 0,
    helperRestarts: 0,
    rewardsClaimed: 0,
    missionsClaimed: 0,
  });
});

test('counts each kind of event for the hero', () => {
  const { history, at } = setup();
  ['reset', 'watchdog', 'helper', 'helper', 'reward', 'mission', 'mission', 'mission'].forEach((type, i) => at(i, type, 'Hero'));
  const summary = history.summarize('Hero', 12 * HOUR);
  assert.equal(summary.resets, 1);
  assert.equal(summary.gameRestarts, 1);
  assert.equal(summary.helperRestarts, 2);
  assert.equal(summary.rewardsClaimed, 1);
  assert.equal(summary.missionsClaimed, 3);
});

test('averages the time between the first and last reset', () => {
  const { history, at } = setup();
  at(0, 'reset', 'Hero');
  at(30 * MINUTE, 'reset', 'Hero');
  at(90 * MINUTE, 'reset', 'Hero');
  const summary = history.summarize('Hero', 12 * HOUR);
  assert.equal(summary.lastResetAt, 90 * MINUTE);
  assert.equal(summary.minutesBetweenResets, 45);
});

test('only the given hero is summarized, including the one before any hero entered', () => {
  const { history, at } = setup();
  at(0, 'reset', 'Hero');
  at(1, 'reset', 'Other');
  at(2, 'reset', null);
  assert.equal(history.summarize('Hero', 12 * HOUR).resets, 1);
  assert.equal(history.summarize(null, 12 * HOUR).resets, 1);
});

test('events outside the window are not summarized', () => {
  const { clock, history, at } = setup();
  at(0, 'reset', 'Hero');
  at(13 * HOUR, 'reset', 'Hero');
  clock.now = 13 * HOUR;
  assert.equal(history.summarize('Hero', 12 * HOUR).resets, 1);
});

test('events older than a day are dropped on the next record', () => {
  const storage = memoryStorage();
  const clock = { now: 0 };
  const history = createHistory(storage, () => clock.now);
  history.record('reset', 'Hero');
  clock.now = 25 * HOUR;
  history.record('reward', 'Hero');
  assert.deepEqual(JSON.parse(storage.getItem('openmu-auto-reset:history')).map((e) => e.type), ['reward']);
});

test('unreadable storage reads as an empty history', () => {
  const storage = memoryStorage();
  storage.setItem('openmu-auto-reset:history', '{not json');
  const history = createHistory(storage, () => 0);
  assert.equal(history.summarize('Hero', 12 * HOUR).resets, 0);
});
