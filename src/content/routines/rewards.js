// "1 Jewel of Rare every 2 hours online": the Claim button is enabled once the timer reaches zero.
// The rewards window only refreshes its timer while open, so it is opened shortly after loading
// and then again when the timer it showed runs out.
const rewardsRoutine = (() => {
  const FIRST_CHECK_MS = 60000;
  const RETRY_MS = 2 * 60 * 1000;
  const MARGIN_MS = 30000;
  let nextCheck = Date.now() + FIRST_CHECK_MS;

  async function claim() {
    const dialog = await openFromRewardsMenu('mu-rewards-launch-time', 'mu-time-rewards', 'Rewards');
    if (!dialog) return;

    // Give the window time to fetch the current timer.
    const claimButton = dialog.querySelector('.time-claim');
    await waitFor(() => claimButton && !claimButton.disabled, 3000);
    if (claimButton && !claimButton.disabled) {
      press(claimButton);
      await waitFor(() => claimButton.disabled, MODAL_TIMEOUT_MS);
      const feedback = dialog.querySelector('.time-feedback')?.textContent.trim();
      log(`Reward claimed${feedback ? `: ${feedback}` : ''}`);
      record('reward');
      await sleep(1000);
    }

    // The timer reads hh:mm:ss; check again right after it runs out.
    const [hours, minutes, seconds] = (dialog.querySelector('.time-clock')?.textContent.match(/\d+/g) || []).map(Number);
    const remainingMs = ((hours * 60 + minutes) * 60 + seconds) * 1000;
    if (remainingMs > 0) nextCheck = Date.now() + remainingMs + MARGIN_MS;
    log(`Next reward check at ${formatTime(nextCheck)}`);

    const close = dialog.querySelector('.time-close');
    if (isVisible(close)) press(close);
  }

  return {
    setting: 'autoRewards',
    async run() {
      if (Date.now() < nextCheck) return false;
      nextCheck = Date.now() + RETRY_MS;
      if (!byId('mu-web-rewards-btn')) return false;
      await withHiddenWindow('mu-time-rewards', claim);
      return true;
    },
  };
})();
