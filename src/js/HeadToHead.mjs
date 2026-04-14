/**
 * HeadToHead.mjs
 * Renders the head-to-head historical record widget for two teams.
 * Shows: overall record (W/D/L), average goals, last N results with
 * scorelines and dates.
 */

import { showSkeleton, showError, formatMatchDate } from './utils.mjs';

// ── Templates ─────────────────────────────────────────────────────────────────

function h2hFixtureTemplate(fix, team1Id) {
  const home   = fix.teams.home;
  const away   = fix.teams.away;
  const hGoals = fix.goals.home ?? 0;
  const aGoals = fix.goals.away ?? 0;

  const result = hGoals > aGoals
    ? (home.id === team1Id ? 'W' : 'L')
    : hGoals < aGoals
      ? (away.id === team1Id ? 'W' : 'L')
      : 'D';

  const badgeCls = { W: 'form-w', D: 'form-d', L: 'form-l' }[result];

  return `
    <div class="h2h-result-row">
      <span class="h2h-date">${formatMatchDate(fix.fixture.date)}</span>
      <span class="h2h-home">${home.name}</span>
      <span class="h2h-score">
        <span class="score-chip">${hGoals} – ${aGoals}</span>
      </span>
      <span class="h2h-away">${away.name}</span>
      <span class="form-badge ${badgeCls}">${result}</span>
    </div>`;
}

// ── Summary stats ─────────────────────────────────────────────────────────────

function computeH2HSummary(fixtures, team1Id) {
  let wins = 0, draws = 0, losses = 0, totalGoals = 0;

  fixtures.forEach(fix => {
    const hGoals = fix.goals.home ?? 0;
    const aGoals = fix.goals.away ?? 0;
    totalGoals += hGoals + aGoals;

    const homeWon = hGoals > aGoals;
    const awayWon = aGoals > hGoals;
    const isHomeTeam = fix.teams.home.id === team1Id;

    if (homeWon && isHomeTeam || awayWon && !isHomeTeam) wins++;
    else if (!homeWon && !awayWon) draws++;
    else losses++;
  });

  return {
    played: fixtures.length,
    wins,
    draws,
    losses,
    avgGoals: fixtures.length ? (totalGoals / fixtures.length).toFixed(2) : '0.00',
  };
}

// ── Public renderer ───────────────────────────────────────────────────────────

/**
 * Renders head-to-head comparison section.
 *
 * @param {FootballData} fd
 * @param {number}       team1Id
 * @param {number}       team2Id
 * @param {string}       team1Name
 * @param {string}       team2Name
 * @param {Element}      container
 */
export async function renderHeadToHead(fd, team1Id, team2Id, team1Name, team2Name, container) {
  showSkeleton(container, 6);

  try {
    const data     = await fd.getHeadToHead(team1Id, team2Id);
    const fixtures = (data?.response ?? [])
      .filter(f => ['FT','AET','PEN'].includes(f.fixture.status.short))
      .sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date))
      .slice(0, 10);

    if (!fixtures.length) {
      container.innerHTML = '<p class="no-data">No head-to-head data available.</p>';
      return;
    }

    const summary = computeH2HSummary(fixtures, team1Id);

    container.innerHTML = `
      <h2 class="section-title">Head-to-Head</h2>

      <div class="h2h-summary">
        <div class="h2h-team-col">
          <span class="h2h-team-name">${team1Name}</span>
          <span class="h2h-wins">${summary.wins}</span>
          <span class="h2h-wins-label">Wins</span>
        </div>
        <div class="h2h-middle-col">
          <div class="h2h-bar-wrap">
            <div class="h2h-bar h2h-bar-w" style="flex:${summary.wins}"></div>
            <div class="h2h-bar h2h-bar-d" style="flex:${summary.draws}"></div>
            <div class="h2h-bar h2h-bar-l" style="flex:${summary.losses}"></div>
          </div>
          <span class="h2h-draws">${summary.draws} Draws</span>
          <span class="h2h-meta">${summary.played} matches · Avg ${summary.avgGoals} goals</span>
        </div>
        <div class="h2h-team-col">
          <span class="h2h-team-name">${team2Name}</span>
          <span class="h2h-wins">${summary.losses}</span>
          <span class="h2h-wins-label">Wins</span>
        </div>
      </div>

      <div class="h2h-results-list">
        ${fixtures.map(f => h2hFixtureTemplate(f, team1Id)).join('')}
      </div>`;

  } catch (err) {
    console.error('renderHeadToHead:', err);
    showError(container);
  }
}


//this is a comment