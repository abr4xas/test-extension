// The HUD rewards button opens a menu whose cards open the rewards and missions windows, shared by
// the rewards and missions routines.
const REWARDS_MENU_OPEN_TIMEOUT_MS = 30000; // The window waits for the server, sometimes for several seconds.

// While the extension works a rewards window it is clipped away, so it never covers the game.
// Clipping keeps its layout, so visibility checks and presses still work. The rewards menu stays
// visible for its second on screen, in case the game hit-tests its cards.
async function withHiddenWindow(id, work) {
  const style = document.createElement('style');
  style.textContent = `#${id} { clip-path: inset(100%) !important; }`;
  document.head.append(style);
  try {
    await work();
  } finally {
    style.remove();
  }
}

// HUD rewards button -> menu -> card, which opens the window. The game may only create the window
// the first time it is opened, so it is looked up by id after pressing the card. Returns the window,
// or null if it did not open.
async function openFromRewardsMenu(cardId, windowId, name) {
  const target = () => byId(windowId);
  if (isVisible(target())) return target();
  press(byId('mu-web-rewards-btn'));
  const card = byId(cardId);
  if (!(await waitFor(() => isVisible(card), MODAL_TIMEOUT_MS))) {
    log('Rewards menu did not open, will retry');
    return null;
  }
  await sleep(1000);
  press(card);
  if (await waitFor(() => isVisible(target()), REWARDS_MENU_OPEN_TIMEOUT_MS)) return target();
  log(`${name} window did not open, will retry`);
  const launcherClose = byId('mu-rewards-launcher-close');
  if (isVisible(launcherClose)) press(launcherClose);
  return null;
}
