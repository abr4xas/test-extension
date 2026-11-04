const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load');

// Loaded without a window, so only the reply reader is set up.
const { __openmuJewelBank: openmuJewelBank } = load('src/page/jewel-bank.js');

const reply = (nonce, rows) => [
  `_JB ${nonce} exchange 1 20 1 100000`,
  ...rows.map(([bank, have, free], kind) => `_JB ${nonce} row ${kind} ${bank} ${have} ${free} 1`),
  `_JB ${nonce} done ok`,
];

const twelve = (row) => Array.from({ length: 12 }, () => row);

test('reads a bank row', () => {
  assert.deepEqual({ ...openmuJewelBank.parseRow('_JB abc row 4 607 4 163 1') }, { nonce: 'abc', kind: 4, have: 4, free: 163 });
});

test('ignores lines that are not bank rows', () => {
  assert.equal(openmuJewelBank.parseRow('_JB abc done ok'), null);
  assert.equal(openmuJewelBank.parseRow('hello there'), null);
  assert.equal(openmuJewelBank.parseRow('_JB abc row 12 0 0 0 1'), null);
});

test('publishes the free slots and the jewels in the inventory once every jewel is listed', () => {
  const dataset = {};
  const read = openmuJewelBank.createReader(dataset, () => 1000);
  const rows = twelve([10, 0, 3]);
  rows[1] = [10, 5, 3];
  rows[4] = [10, 2, 3];
  const lines = reply('n1', rows);
  lines.slice(0, -2).forEach(read);
  assert.equal(dataset.openmuInventoryFree, undefined);
  lines.slice(-2).forEach(read);
  assert.deepEqual(dataset, { openmuInventoryFree: '3', openmuInventoryJewels: '7', openmuInventoryCheckedAt: '1000' });
});

test('keeps replies to different requests apart', () => {
  const dataset = {};
  const read = openmuJewelBank.createReader(dataset);
  const first = reply('a', twelve([0, 1, 0]));
  const second = reply('b', twelve([0, 0, 50]));
  first.slice(0, 6).forEach(read);
  second.forEach(read);
  assert.equal(dataset.openmuInventoryFree, '50');
  first.slice(6).forEach(read);
  assert.equal(dataset.openmuInventoryFree, '0');
  assert.equal(dataset.openmuInventoryJewels, '12');
});
