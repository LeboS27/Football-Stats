/**
 * match.js
 * Match detail page entry point.
 * Gets fixture ID + league ID from URL params, then delegates
 * to renderMatchDetail which fetches all league matches and
 * locates the specific fixture client-side.
 */

import { loadHeaderFooter, getParam, qs, registerSearchHandler } from './utils.mjs';
import { FootballData } from './FootballData.mjs';
import { renderMatchDetail } from './MatchStats.mjs';

const fd = new FootballData();

let pollTimer = null;

async function init() {
  await loadHeaderFooter();
  registerSearchHandler(fd);

  const fixtureId = getParam('id');
  const leagueId  = getParam('league') ?? localStorage.getItem('fsd_league') ?? '47';

  const container = qs('#match-container');

  if (!fixtureId) {
    container.innerHTML =
      '<p class="error-state">No fixture ID supplied. <a href="/">← Back to fixtures</a></p>';
    return;
  }

  // Hide the old betting / h2h sections — they rely on an API endpoint we don't have
  const bettingEl = qs('#betting-container');
  const h2hEl     = qs('#h2h-container');
  if (bettingEl) bettingEl.style.display = 'none';
  if (h2hEl)     h2hEl.style.display     = 'none';

  await renderMatchDetail(fd, fixtureId, leagueId, container);

  // Poll every 60 s while match is live (check by re-rendering)
  async function pollIfLive() {
    try {
      const data    = await fd.getLeagueMatches(leagueId);
      const matches = data?.response?.matches ?? [];
      const fix     = matches.find(m => String(m.id) === String(fixtureId));
      const isLive  = fix?.status?.started && !fix?.status?.finished;

      if (isLive) {
        clearInterval(pollTimer);
        pollTimer = setInterval(async () => {
          await renderMatchDetail(fd, fixtureId, leagueId, container);
          // Check again whether still live
          const refreshed = await fd.getLeagueMatches(leagueId);
          const updated   = (refreshed?.response?.matches ?? [])
            .find(m => String(m.id) === String(fixtureId));
          if (!updated?.status?.started || updated?.status?.finished) {
            clearInterval(pollTimer);
          }
        }, 60_000);
      }
    } catch (err) {
      console.error('match.js pollIfLive:', err);
    }
  }

  pollIfLive();
}

init();
