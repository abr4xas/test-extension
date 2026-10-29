// Resets the character once the game offers it. Holds the tick while the reset button is on the HUD,
// even during its cooldown, so no other routine opens a window over it.
const resetRoutine = (() => {
  // The server can take a few seconds to apply the reset after the modal closes.
  const RESULT_TIMEOUT_MS = 10000;
  const COOLDOWN_MS = 15000;
  let lastAttempt = 0;
  let failures = 0;

  function currentLevel() {
    const match = byId('mu-web-current-level')?.textContent.match(/\d+/);
    return match ? Number(match[0]) : null;
  }

  // The game shows a "RESET" quick button on the HUD once the character can reset.
  // Pressing it opens the "Are you sure?" confirmation modal.
  function readyButton() {
    return ['mu-web-ready-reset-btn', 'mu-mobile-ready-reset-btn']
      .map(byId)
      .find((btn) => btn && !btn.disabled && !btn.classList.contains('is-unavailable'));
  }

  // "Yes, reset" of the confirmation modal, only while it is on screen. Visibility is checked on the
  // button itself because the modal is not necessarily shown by removing its .hidden class.
  function confirmYes() {
    const byIdBtn = byId('mu-web-reset-confirm-yes');
    if (isVisible(byIdBtn)) return byIdBtn;
    return [...document.querySelectorAll('button')].find(
      (btn) => /^(yes|s[ií])\b.*reset/i.test(btn.textContent.trim()) && isVisible(btn),
    );
  }

  function describeModal() {
    const modal = byId('mu-web-reset-confirm');
    const yes = byId('mu-web-reset-confirm-yes');
    return `modal class="${modal?.className}" display=${modal && getComputedStyle(modal).display}, ` +
      `yes rects=${yes?.getClientRects().length}`;
  }

  // The game sometimes closes the modal without resetting; retrying a few times gets it through.
  function failed(reason) {
    failures++;
    log(`${reason}, will retry (attempt ${failures})`);
  }

  async function confirmReset(yes) {
    log(`Pressing "${yes.textContent.trim()}"`);
    press(yes);
    const done = await waitFor(() => !readyButton() && !confirmYes(), RESULT_TIMEOUT_MS);
    if (done) {
      log(failures ? `Reset done after ${failures + 1} attempts` : 'Reset done');
      failures = 0;
      record('reset');
    } else {
      failed(`Reset not done yet (${describeModal()})`);
    }
  }

  return {
    setting: 'autoReset',
    async run() {
      // The modal may already be open, e.g. from an earlier attempt. With auto reset off, a modal the
      // player opened is left to the player.
      const openYes = confirmYes();
      if (openYes) {
        await confirmReset(openYes);
        return true;
      }

      const button = readyButton();
      if (!button) return false;
      if (Date.now() - lastAttempt < COOLDOWN_MS) return true;
      lastAttempt = Date.now();

      log(`Reset available (level ${currentLevel() ?? '?'}), pressing #${button.id}`);
      press(button);
      let yes = null;
      await waitFor(() => (yes = confirmYes()), MODAL_TIMEOUT_MS);
      if (!yes) {
        failed(`Confirmation modal not found (${describeModal()})`);
        return true;
      }
      await confirmReset(yes);
      return true;
    },
  };
})();
