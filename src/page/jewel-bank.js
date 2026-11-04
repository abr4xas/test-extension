// The jewel bank's side in the page's world. The game draws the inventory on the canvas, so whether
// it is full is learned from the bank: every reply of the bank lists, for each jewel, how many are
// in the inventory and how many free inventory slots there are. Those replies are read here and
// published on <html> for the jewel bank routine (content.js), together with a way to open the
// bank window, which the game only opens from the canvas.
globalThis.__openmuJewelBank = (() => {
  const JEWEL_KINDS = 12;

  // Reads one bank reply line ("_JB <nonce> row <kind> <bank> <have> <free> <packed>"), or null.
  function parseRow(message) {
    const parts = String(message).trim().split(' ');
    if (parts[0] !== '_JB' || parts[2] !== 'row') return null;
    const [kind, , have, free] = parts.slice(3).map(Number);
    if (!Number.isInteger(kind) || kind < 0 || kind >= JEWEL_KINDS) return null;
    if (!Number.isInteger(have) || !Number.isInteger(free)) return null;
    return { nonce: parts[1], kind, have, free };
  }

  // Collects the rows of each reply and publishes them once all jewels have been listed.
  function createReader(dataset, now = () => Date.now()) {
    const replies = new Map();
    return (message) => {
      const row = parseRow(message);
      if (!row) return;
      const rows = replies.get(row.nonce) ?? [];
      rows[row.kind] = row;
      replies.set(row.nonce, rows);
      if (rows.filter(Boolean).length < JEWEL_KINDS) return;
      replies.delete(row.nonce);
      dataset.openmuInventoryFree = String(Math.min(...rows.map((r) => r.free)));
      dataset.openmuInventoryJewels = String(rows.reduce((sum, r) => sum + r.have, 0));
      dataset.openmuInventoryCheckedAt = String(now());
    };
  }

  return { parseRow, createReader };
})();

if (typeof window !== 'undefined' && window.document) {
  (() => {
    const CHECK_EVERY_MS = 60000;
    const read = __openmuJewelBank.createReader(document.documentElement.dataset);
    const enabled = () => {
      try {
        return JSON.parse(document.documentElement.dataset.openmuSettings || '{}').autoJewelBank !== false;
      } catch {
        return true;
      }
    };

    // The game hands every bank reply to window.muJewelBankNotice, defined by its bank.js, which
    // loads after this script.
    const wrap = setInterval(() => {
      const notice = window.muJewelBankNotice;
      if (typeof notice !== 'function') return;
      clearInterval(wrap);
      window.muJewelBankNotice = (message) => {
        read(message);
        return notice(message);
      };
    }, 1000);

    // Asks the bank for its status the same way the bank window does, without opening it. The bank
    // window ignores replies to nonces it did not send.
    setInterval(() => {
      if (!enabled() || !__openmuGame.heroName() || document.getElementById('mu-jewel-bank')?.open) return;
      const nonce = crypto.randomUUID().replaceAll('-', '');
      __openmuGame.chat(`/jbank s 0 1 0 v1 ${nonce}`);
    }, CHECK_EVERY_MS);

    document.addEventListener('openmu:open-jewel-bank', () => window.muJewelBankOpen?.());
  })();
}
