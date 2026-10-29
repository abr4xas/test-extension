// Options shown in the toolbar popup, shared by the popup and content.js. Everything starts enabled.
const OPENMU_SETTINGS = [
  { key: 'autoReset', label: 'Auto reset at level 400' },
  { key: 'autoRestart', label: 'Restart the game when it hangs' },
  { key: 'autoHelper', label: 'Keep the MU Helper running' },
  { key: 'autoRewards', label: 'Claim the 2-hour reward' },
  { key: 'autoMissions', label: 'Claim mission rewards' },
  { key: 'summaryPanel', label: 'Show reset summary' },
  { key: 'monstersPanel', label: 'Show monsters in range' },
  { key: 'invasionAlert', label: 'Alert on Golden and Blue Dragon' },
];
const OPENMU_DEFAULTS = Object.fromEntries(OPENMU_SETTINGS.map(({ key }) => [key, true]));
