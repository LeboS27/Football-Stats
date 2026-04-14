/**
 * team.js
 * Team profile page entry point.
 * URL params: id (required), league (optional, falls back to stored), season (optional).
 */

import { loadHeaderFooter, getParam, qs, registerSearchHandler } from './utils.mjs';
import { FootballData } from './FootballData.mjs';
import { renderTeamStats } from './TeamStats.mjs';

const fd     = new FootballData();
const SEASON = import.meta.env.VITE_DEFAULT_SEASON ?? '2024';

async function init() {
  await loadHeaderFooter();
  registerSearchHandler(fd);

  const teamId   = getParam('id');
  const leagueId = getParam('league') ?? localStorage.getItem('fsd_league') ?? '47';
  const season   = getParam('season') ?? SEASON;

  if (!teamId) {
    qs('#team-container').innerHTML =
      '<p class="error-state">No team ID supplied. <a href="/">← Back</a></p>';
    return;
  }

  await renderTeamStats(fd, parseInt(teamId, 10), parseInt(leagueId, 10), qs('#team-container'), season);
}

init();
