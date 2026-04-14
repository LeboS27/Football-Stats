/**
 * Standings.mjs
 * Renders the league table with colour-coded position rows.
 * Positions are classified as: Champions League, Europa League,
 * Conference League, Relegation, or Promotion.
 */

import { renderListWithTemplate, showSkeleton, showError } from './utils.mjs';

// ── Templates ─────────────────────────────────────────────────────────────────

function standingsRowTemplate(entry, leagueId) {
  const [goalsFor, goalsAgainst] = (entry.scoresStr ?? '0-0').split('-').map(Number);
  const logo = `https://images.fotmob.com/image_resources/logo/teamlogo/${entry.id}_xsmall.png`;
  const qualStyle = entry.qualColor ? `style="border-left:3px solid ${entry.qualColor}"` : '';

  return `
    <tr class="standings-row" data-team-id="${entry.id}" ${qualStyle}>
      <td class="pos">${entry.idx}</td>
      <td class="team-cell">
        <a href="/team/?id=${entry.id}&league=${leagueId}" class="team-link">
          <img src="${logo}" alt="${entry.name}" width="20" height="20" loading="lazy" onerror="this.style.visibility='hidden'">
          <span>${entry.name}</span>
        </a>
      </td>
      <td class="num">${entry.played}</td>
      <td class="num win">${entry.wins}</td>
      <td class="num draw">${entry.draws}</td>
      <td class="num loss">${entry.losses}</td>
      <td class="num">${goalsFor}</td>
      <td class="num">${goalsAgainst}</td>
      <td class="num ${entry.goalConDiff >= 0 ? 'pos-diff' : 'neg-diff'}">
        ${entry.goalConDiff > 0 ? '+' : ''}${entry.goalConDiff}
      </td>
      <td class="num pts"><strong>${entry.pts}</strong></td>
    </tr>`;
}

// ── Public renderer ───────────────────────────────────────────────────────────

/**
 * Fetches and renders the league standings table.
 *
 * @param {FootballData} fd        - Configured FootballData instance
 * @param {number}       leagueId  - API-Football league ID
 * @param {Element}      container - Target DOM element
 * @param {string}       [season]
 */
export async function renderStandings(fd, leagueId, container, season) {
  showSkeleton(container, 8);

  try {
    const data = await fd.getStandings(leagueId, season);
    // API returns { status, response: { standing: [...] } }
    const tableData = data?.response?.standing ?? [];

    if (!Array.isArray(tableData) || !tableData.length) {
      showError(container, 'Standings not available for this league or season.');
      return;
    }

    if (!tableData.length) {
      showError(container, 'Standings not available for this league or season.');
      return;
    }

    container.innerHTML = `
      <div class="standings-wrapper">
        <table class="standings-table" role="table" aria-label="League standings">
          <thead>
            <tr>
              <th title="Position">#</th>
              <th>Club</th>
              <th title="Played">P</th>
              <th title="Won" class="win">W</th>
              <th title="Drawn" class="draw">D</th>
              <th title="Lost" class="loss">L</th>
              <th title="Goals For">GF</th>
              <th title="Goals Against">GA</th>
              <th title="Goal Difference">GD</th>
              <th title="Points">Pts</th>
            </tr>
          </thead>
          <tbody id="standings-body"></tbody>
        </table>
        <div class="standings-legend">
          <span class="legend-item row-ucl">Champions League</span>
          <span class="legend-item row-uel">Europa League</span>
          <span class="legend-item row-uecl">Conference League</span>
          <span class="legend-item row-rel">Relegation</span>
        </div>
      </div>`;

    const tbody = container.querySelector('#standings-body');
    renderListWithTemplate(entry => standingsRowTemplate(entry, leagueId), tbody, tableData, 'beforeend');

    // Row click → team page
    tbody.querySelectorAll('.standings-row').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('a')) return; // let link handle it
        const id = row.dataset.teamId;
        if (id) window.location.href = `/team/?id=${id}&league=${leagueId}`;
      });
    });

  } catch (err) {
    console.error('renderStandings:', err);
    showError(container);
  }
}
