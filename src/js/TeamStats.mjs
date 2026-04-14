/**
 * TeamStats.mjs
 * Renders the team profile page: standings position, season record,
 * recent results, upcoming fixtures, and squad.
 */

import { showSkeleton, showError, formatMatchDate } from './utils.mjs';
import { renderSquad } from './PlayerStats.mjs';

function teamLogo(id) {
  return `https://images.fotmob.com/image_resources/logo/teamlogo/${id}_xsmall.png`;
}

// ── Fixture row templates ─────────────────────────────────────────────────────

function matchRowTemplate(fix, teamId, leagueId) {
  const isHome  = String(fix.home?.id) === String(teamId);
  const opp     = isHome ? fix.away : fix.home;
  const myScore = isHome ? (fix.home?.score ?? 0) : (fix.away?.score ?? 0);
  const opScore = isHome ? (fix.away?.score ?? 0) : (fix.home?.score ?? 0);
  const done    = fix.status?.finished;
  const result  = done ? (myScore > opScore ? 'W' : myScore < opScore ? 'L' : 'D') : null;
  const badgeCls = result ? { W: 'form-w', D: 'form-d', L: 'form-l' }[result] : '';
  const dateStr = fix.status?.utcTime ? formatMatchDate(fix.status.utcTime) : fix.time ?? '';

  return `
    <a href="/match/?id=${fix.id}&league=${leagueId ?? ''}" class="fixture-item ${done ? 'past' : ''}">
      ${result
        ? `<span class="form-badge ${badgeCls}">${result}</span>`
        : `<span class="fixture-venue-badge ${isHome ? 'home' : 'away'}">${isHome ? 'H' : 'A'}</span>`}
      <img src="${teamLogo(opp?.id)}" alt="${opp?.name ?? ''}" width="24" height="24" loading="lazy" onerror="this.style.visibility='hidden'">
      <span class="fixture-opp">${opp?.name ?? '—'}</span>
      ${done ? `<span class="fixture-score">${myScore}–${opScore}</span>` : ''}
      <span class="fixture-date">${dateStr}</span>
    </a>`;
}

// ── Public renderer ───────────────────────────────────────────────────────────

export async function renderTeamStats(fd, teamId, leagueId, container, season) {
  showSkeleton(container, 10);

  try {
    const [standingsData, matchesData] = await Promise.all([
      fd.getStandings(leagueId, season),
      fd.getTeamFixtures(teamId, leagueId),
    ]);

    // Find this team in standings
    const standing = (standingsData?.response?.standing ?? [])
      .find(t => String(t.id) === String(teamId));

    const allMatches = matchesData?.response?.matches ?? [];

    const teamName = standing?.name
      ?? allMatches.find(m => String(m.home?.id) === String(teamId))?.home?.name
      ?? allMatches.find(m => String(m.away?.id) === String(teamId))?.away?.name
      ?? `Team #${teamId}`;

    const pastMatches = allMatches
      .filter(m => m.status?.finished)
      .sort((a, b) => new Date(b.status.utcTime) - new Date(a.status.utcTime))
      .slice(0, 10);

    const upcomingMatches = allMatches
      .filter(m => !m.status?.finished && !m.status?.started)
      .sort((a, b) => new Date(a.status?.utcTime ?? 0) - new Date(b.status?.utcTime ?? 0))
      .slice(0, 5);

    // Form string from last 5
    const formStr = pastMatches.slice(0, 5).map(m => {
      const isHome  = String(m.home?.id) === String(teamId);
      const my = isHome ? m.home?.score : m.away?.score;
      const op = isHome ? m.away?.score : m.home?.score;
      return my > op ? 'W' : my < op ? 'L' : 'D';
    });
    const formBadges = formStr.map(r => `<span class="form-badge form-${r.toLowerCase()}">${r}</span>`).join('');

    const [goalsFor, goalsAgainst] = standing
      ? (standing.scoresStr ?? '0-0').split('-').map(Number)
      : [0, 0];

    container.innerHTML = `
      <div class="team-profile-header card">
        <img src="${teamLogo(teamId)}" alt="${teamName}" width="80" height="80" loading="lazy"
             class="team-logo-lg" onerror="this.style.visibility='hidden'">
        <div class="team-header-info">
          <h1 class="team-name-lg">${teamName}</h1>
          ${standing ? `
          <div class="team-meta-tags">
            <span class="tag">#${standing.idx} in table</span>
            <span class="tag">${standing.pts} pts</span>
            <span class="tag">${standing.played} played</span>
          </div>
          <div class="team-record">
            <span class="record-item win">W ${standing.wins}</span>
            <span class="record-item draw">D ${standing.draws}</span>
            <span class="record-item loss">L ${standing.losses}</span>
            <span class="record-item">GF ${goalsFor}</span>
            <span class="record-item">GA ${goalsAgainst}</span>
            <span class="record-item">GD ${standing.goalConDiff >= 0 ? '+' : ''}${standing.goalConDiff}</span>
          </div>` : ''}
          ${formBadges ? `<div class="form-row">Form: ${formBadges}</div>` : ''}
        </div>
      </div>

      <div class="team-stats-content">
        <div class="team-fixtures-column">
          ${upcomingMatches.length ? `
          <section class="card fixture-section" aria-label="Upcoming fixtures">
            <h2 class="section-title">Next ${upcomingMatches.length} Fixtures</h2>
            <div class="fixtures-list">
              ${upcomingMatches.map(m => matchRowTemplate(m, teamId, leagueId)).join('')}
            </div>
          </section>` : ''}

          ${pastMatches.length ? `
          <section class="card fixture-section" aria-label="Recent results">
            <h2 class="section-title">Recent Results</h2>
            <div class="fixtures-list">
              ${pastMatches.map(m => matchRowTemplate(m, teamId, leagueId)).join('')}
            </div>
          </section>` : ''}
        </div>

        <section class="card squad-section" aria-label="Squad">
          <h2 class="section-title" style="padding:var(--sp-md) var(--sp-md) 0">Squad</h2>
          <div id="squad-container"></div>
        </section>
      </div>`;

    await renderSquad(fd, teamId, container.querySelector('#squad-container'));

  } catch (err) {
    console.error('renderTeamStats:', err);
    showError(container);
  }
}
