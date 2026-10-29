# OpenMU Auto Reset

A browser extension that plays the chores of open.mu for the player: resetting the character, keeping the game and the MU Helper running, claiming rewards, and watching for invasion monsters.

## The game

**Hero**:
The character in play, identified by its name. Nothing is known about it on the character selection screen.
_Avoid_: player, character, char

**Reset**:
Sending the Hero back to level 1 once the game offers it, in exchange for the reset's bonuses.

**Scope**:
The monsters the server reports in range of the Hero, about 12 tiles around it, more than what is on screen. NPCs are never part of it.
_Avoid_: viewport, visible monsters

**Invasion monster**:
A Golden monster or a Blue Dragon, the monsters worth an alert when they enter the Scope.
_Avoid_: boss, golden

**Warp**:
Moving the Hero to another map through the game's move list.
_Avoid_: teleport, move

## What the extension does

**Routine**:
One chore the extension runs on its own, switched on and off from the popup. The routines are, in priority order: Watchdog, Reset, Rewards, Missions and Helper. Only one acts at a time.
_Avoid_: task, job, handler

**Watchdog**:
The game's "stopped responding" screen, and the routine that restarts the game from it.

**MU Helper**:
The game's own auto-attack, which the Helper routine keeps running unless the player stopped it.
_Avoid_: auto attack, bot

**Rewards**:
The jewel granted every 2 hours online, claimed by its routine once its timer runs out.

**Missions**:
The game's mission rewards, claimed by their routine as missions finish.

**History**:
What the extension did for each Hero over the last day: Resets, Watchdog restarts, MU Helper restarts and claims.
_Avoid_: log, stats

**Summary panel**:
The on-screen tally of the Hero's History over the last 12 hours.
