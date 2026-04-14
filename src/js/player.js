/**
 * player.js
 * Player profile page entry point.
 * URL params: id (required), team (optional — FotMob team ID for squad lookup).
 */

import { loadHeaderFooter, getParam, qs, registerSearchHandler } from './utils.mjs';
import { FootballData } from './FootballData.mjs';
import { renderPlayerStats } from './PlayerStats.mjs';

const fd = new FootballData();

async function init() {
  await loadHeaderFooter();
  registerSearchHandler(fd);

  const playerId  = getParam('id');
  const teamId    = getParam('team');
  const name      = getParam('name');      // from search result link
  const teamName  = getParam('teamName');  // from search result link

  if (!playerId) {
    qs('#player-container').innerHTML =
      '<p class="error-state" style="padding:var(--sp-xl);text-align:center">No player ID supplied. <a href="/">← Back</a></p>';
    return;
  }

  await renderPlayerStats(fd, playerId, qs('#player-container'), null, teamId, name, teamName);
}

init();
