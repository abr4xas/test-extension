const form = document.getElementById('settings');

chrome.storage.local.get(OPENMU_DEFAULTS).then((values) => {
  OPENMU_SETTINGS.forEach(({ key, label }) => {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = values[key];
    // The popup closes after each action.
    input.addEventListener('change', async () => {
      await chrome.storage.local.set({ [key]: input.checked });
      window.close();
    });
    const row = document.createElement('label');
    row.append(input, label);
    form.append(row);
  });
});

// The game's own warp window cuts the list short, so the full list is read from the game and the
// warp is requested through the same exports that window uses, both through game.js.
const warpForm = document.getElementById('warp');
const warpMap = document.getElementById('warp-map');
const warpStatus = document.getElementById('warp-status');

// Serialized into the tab's page world, so they can only reach game.js through the page's globals.
const readMoveList = () => globalThis.__openmuGame?.moveList() ?? null;
const requestWarp = (index) => globalThis.__openmuGame?.warp(index);

async function runInGame(tabId, func, args = []) {
  const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', func, args });
  return result;
}

(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url?.startsWith('https://open.mu/')) return;
  const maps = await runInGame(tab.id, readMoveList).catch(() => null);
  if (!maps?.length) {
    warpStatus.textContent = 'Enter the game with a character to warp.';
    return;
  }

  maps.forEach(({ index, name, level, zen, canMove }) => {
    const option = new Option(`${name} · lvl ${level} · ${zen.toLocaleString()} zen`, index);
    option.disabled = !canMove;
    warpMap.append(option);
  });
  warpForm.hidden = false;
  warpStatus.textContent = 'Greyed out maps need a higher level or more zen.';

  // Warps as soon as a map is picked.
  warpMap.addEventListener('change', async () => {
    const map = maps[warpMap.value];
    await runInGame(tab.id, requestWarp, [map.index]);
    window.close();
  });
})();
