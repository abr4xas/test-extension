// Reading and pressing the game's HTML interface, shared by the routines and content.js.
const MODAL_TIMEOUT_MS = 5000;

const log = (...args) => console.log('[OpenMU Auto Reset]', ...args);
const byId = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const formatTime = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function isVisible(el) {
  if (!el || el.getClientRects().length === 0) return false;
  const style = getComputedStyle(el);
  return style.visibility !== 'hidden' && style.opacity !== '0';
}

// Some game buttons listen to pointer/mouse events instead of click, so send the full sequence.
function press(btn) {
  if (!btn) return;
  const rect = btn.getBoundingClientRect();
  const init = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
    button: 0,
  };
  btn.dispatchEvent(new PointerEvent('pointerdown', { ...init, pointerType: 'mouse', isPrimary: true }));
  btn.dispatchEvent(new MouseEvent('mousedown', init));
  btn.dispatchEvent(new PointerEvent('pointerup', { ...init, pointerType: 'mouse', isPrimary: true }));
  btn.dispatchEvent(new MouseEvent('mouseup', init));
  btn.dispatchEvent(new MouseEvent('click', init));
}

async function waitFor(check, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return true;
    await sleep(200);
  }
  return false;
}
