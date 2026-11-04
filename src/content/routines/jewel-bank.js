// Empties the inventory's jewels into the jewel bank once the inventory is full, with the bank's own
// "Transfer all to bank" button. How full the inventory is comes from page/jewel-bank.js, which
// reads it from the bank every minute; the bank window is only opened from the page's world.
const jewelBankRoutine = (() => {
  // Free inventory slots at or below which the inventory counts as full.
  const FULL_AT_FREE_SLOTS = 4;
  // A status older than this is not trusted, e.g. when the bank stopped answering.
  const STALE_MS = 3 * 60 * 1000;
  const LOAD_TIMEOUT_MS = 10000;
  const TRANSFER_TIMEOUT_MS = 15000;
  const COOLDOWN_MS = 60000;
  let lastAttempt = 0;

  function inventory() {
    const { openmuInventoryFree: free, openmuInventoryJewels: jewels, openmuInventoryCheckedAt: at } =
      document.documentElement.dataset;
    if (free === undefined || Date.now() - Number(at) > STALE_MS) return null;
    return { free: Number(free), jewels: Number(jewels) };
  }

  async function transfer() {
    document.dispatchEvent(new CustomEvent('openmu:open-jewel-bank'));
    const modal = byId('mu-jewel-bank');
    const button = () => modal?.querySelector('[data-action="a"]');
    // The button stays disabled until the bank has listed every jewel.
    if (!(await waitFor(() => isVisible(button()) && !button().disabled, LOAD_TIMEOUT_MS))) {
      log('Jewel bank did not open, will retry');
    } else {
      press(button());
      await waitFor(() => button().disabled, MODAL_TIMEOUT_MS);
      const done = await waitFor(() => !button().disabled, TRANSFER_TIMEOUT_MS);
      const status = modal.querySelector('.jb-status');
      const message = status?.textContent.trim();
      if (done && status?.dataset.error !== 'true') {
        log(`Jewels transferred to the bank${message ? `: ${message}` : ''}`);
        record('jewelBank');
      } else {
        log(`Jewel transfer did not go through${message ? ` (${message})` : ''}, will retry`);
      }
    }
    const close = modal?.querySelector('.jb-close');
    if (isVisible(close)) press(close);
  }

  return {
    setting: 'autoJewelBank',
    async run() {
      const state = inventory();
      if (!state || state.free > FULL_AT_FREE_SLOTS || state.jewels === 0) return false;
      if (Date.now() - lastAttempt < COOLDOWN_MS) return false;
      lastAttempt = Date.now();
      log(`Inventory full (${state.free} free slots, ${state.jewels} jewels), transferring to the bank`);
      await withHiddenWindow('mu-jewel-bank', transfer);
      return true;
    },
  };
})();
