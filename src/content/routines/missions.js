// Claims finished missions. The badge on the HUD rewards button counts missions ready to claim, but
// it is only refreshed when the game fetches missions, so the window is also checked every so often.
const missionsRoutine = (() => {
  const FIRST_CHECK_MS = 2 * 60 * 1000;
  const CHECK_MS = 30 * 60 * 1000;
  // Minimum time between checks triggered by the badge, in case a claim keeps failing.
  const RETRY_MS = 5 * 60 * 1000;
  const LOAD_TIMEOUT_MS = 15000;
  const DELIVERY_TIMEOUT_MS = 20000;
  // Guards against pressing forever if a claim keeps failing.
  const MAX_CLAIMS = 20;
  let nextCheck = Date.now() + FIRST_CHECK_MS;
  let lastCheck = 0;

  const ready = () => {
    const badge = byId('mu-missions-badge');
    return !!badge && !badge.classList.contains('hidden') && Number(badge.textContent) > 0;
  };

  // Each finished mission shows a "Claim" button (.mission-claim) in the Missions list; while it is
  // being delivered the button turns disabled, and once paid it is replaced by a "Claimed" label.
  async function claimAll() {
    const modal = await openFromRewardsMenu('mu-rewards-launch-missions', 'mu-missions-modal', 'Missions');
    if (!modal) return;
    const tab = byId('mu-rewards-tab-missions');
    if (tab && !tab.classList.contains('is-active') && tab.getAttribute('aria-selected') !== 'true') press(tab);

    const claimable = () => [...modal.querySelectorAll('#mu-missions-list .mission-claim')].find((btn) => !btn.disabled);
    const list = byId('mu-missions-list');
    // Wait for the list to load: a claim button, mission cards or the "taking a break" note.
    await waitFor(() => claimable() || list?.children.length, LOAD_TIMEOUT_MS);
    await sleep(1000);

    let claimed = 0;
    for (let btn = claimable(); btn && claimed < MAX_CLAIMS; btn = claimable()) {
      press(btn);
      await waitFor(() => !btn.isConnected || btn.disabled, MODAL_TIMEOUT_MS);
      // Wait for the delivery to finish before claiming the next one.
      await waitFor(() => !modal.querySelector('#mu-missions-list .mission-claim[disabled]'), DELIVERY_TIMEOUT_MS);
      if (btn.isConnected && !btn.disabled) {
        log('Mission claim did not go through, will retry');
        break;
      }
      claimed++;
      record('mission');
    }
    if (claimed) log(`Claimed ${claimed} mission reward${claimed > 1 ? 's' : ''}`);

    const close = byId('mu-missions-close');
    if (isVisible(close)) press(close);
  }

  return {
    setting: 'autoMissions',
    async run() {
      const badgeDue = ready() && Date.now() - lastCheck > RETRY_MS;
      if (Date.now() < nextCheck && !badgeDue) return false;
      lastCheck = Date.now();
      nextCheck = Date.now() + CHECK_MS;
      if (!byId('mu-web-rewards-btn')) return false;
      await withHiddenWindow('mu-missions-modal', claimAll);
      return true;
    },
  };
})();
