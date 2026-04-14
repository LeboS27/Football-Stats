/**
 * MatchStats.mjs
 * Renders the match detail page using the FotMob-powered API.
 * Shows: match header (teams, score, status), head-to-head record,
 * and recent form for both teams.
 */

import { showSkeleton, showError, formatMatchDate } from './utils.mjs';

// ── Helpers ───────────────────────────────────────────────────────────────────

function teamLogo(id) {
  return `https://images.fotmob.com/image_resources/logo/teamlogo/${id}_xsmall.png`;
}

function formBadge(result) {
  const cls = { W: 'form-w', D: 'form-d', L: 'form-l' }[result] ?? '';
  return `<span class="form-badge ${cls}">${result}</span>`;
}

function getResult(fix, teamId) {
  const isHome = String(fix.home?.id) === String(teamId);
  const my = isHome ? (fix.home?.score ?? 0) : (fix.away?.score ?? 0);
  const op = isHome ? (fix.away?.score ?? 0) : (fix.home?.score ?? 0);
  return my > op ? 'W' : my < op ? 'L' : 'D';
}

// ── Match header ──────────────────────────────────────────────────────────────

function matchHeaderTemplate(fix) {
  const home   = fix.home;
  const away   = fix.away;
  const status = fix.status ?? {};
  const isLive = status.started && !status.finished;
  const isDone = status.finished;
  const short  = status.reason?.short ?? '';

  let scoreHtml;
  if (!status.started && !status.finished) {
    const time = status.utcTime
      ? formatMatchDate(status.utcTime).split(',')[1]?.trim() ?? ''
      : fix.time ?? '';
    scoreHtml = `<span class="match-ko-time">${time}</span>`;
  } else {
    const hG = home.score ?? 0;
    const aG = away.score ?? 0;
    scoreHtml = `
      <span class="score-num ${hG > aG ? 'winner' : ''}">${hG}</span>
      <span class="score-sep">—</span>
      <span class="score-num ${aG > hG ? 'winner' : ''}">${aG}</span>`;
  }

  const statusLabel = isLive
    ? `<span class="status-badge live pulse">LIVE</span>`
    : isDone
      ? `<span class="status-badge done">${short}</span>`
      : `<span class="status-badge upcoming">Upcoming</span>`;

  const dateStr = status.utcTime
    ? formatMatchDate(status.utcTime)
    : '';

  return `
    <div class="match-header card">
      <div class="match-team home-team">
        <img src="${teamLogo(home.id)}" alt="${home.name}" width="64" height="64" loading="lazy"
             onerror="this.style.visibility='hidden'">
        <span class="match-team-name">${home.name}</span>
      </div>

      <div class="match-score-block">
        <div class="match-score">${scoreHtml}</div>
        <div class="match-status-row">${statusLabel}</div>
        ${dateStr ? `<div class="match-date-str">${dateStr}</div>` : ''}
      </div>

      <div class="match-team away-team">
        <img src="${teamLogo(away.id)}" alt="${away.name}" width="64" height="64" loading="lazy"
             onerror="this.style.visibility='hidden'">
        <span class="match-team-name">${away.name}</span>
      </div>
    </div>`;
}

// ── H2H row ───────────────────────────────────────────────────────────────────

function h2hRowTemplate(fix, homeId) {
  const hG = fix.home?.score ?? 0;
  const aG = fix.away?.score ?? 0;
  const isHomeTeam = String(fix.home?.id) === String(homeId);
  const result = hG > aG
    ? (isHomeTeam ? 'W' : 'L')
    : hG < aG
      ? (isHomeTeam ? 'L' : 'W')
      : 'D';

  const date = fix.status?.utcTime
    ? new Date(fix.status.utcTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
    : '';

  return `
    <div class="h2h-result-row">
      <span class="h2h-date">${date}</span>
      <span class="h2h-home ${hG > aG ? 'rr-winner' : ''}">${fix.home?.name ?? ''}</span>
      <span class="h2h-score">
        <span class="score-chip">${hG} – ${aG}</span>
      </span>
      <span class="h2h-away ${aG > hG ? 'rr-winner' : ''}">${fix.away?.name ?? ''}</span>
      ${formBadge(result)}
    </div>`;
}

// ── Recent form row ───────────────────────────────────────────────────────────

function formRowTemplate(fix, teamId) {
  const isHome = String(fix.home?.id) === String(teamId);
  const opp    = isHome ? fix.away : fix.home;
  const myG    = isHome ? (fix.home?.score ?? 0) : (fix.away?.score ?? 0);
  const opG    = isHome ? (fix.away?.score ?? 0) : (fix.home?.score ?? 0);
  const result = myG > opG ? 'W' : myG < opG ? 'L' : 'D';
  const date   = fix.status?.utcTime
    ? new Date(fix.status.utcTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : '';

  return `
    <div class="form-row-item">
      ${formBadge(result)}
      <img src="${teamLogo(opp?.id)}" width="18" height="18" loading="lazy"
           onerror="this.style.visibility='hidden'" alt="">
      <span class="form-opp-name">${opp?.name ?? '—'}</span>
      <span class="form-score">${myG}–${opG}</span>
      <span class="form-date">${date}</span>
    </div>`;
}

// ── Public renderer ───────────────────────────────────────────────────────────

/**
 * Fetches all league matches, finds the target fixture, then renders:
 * match header, H2H record, and recent form for both teams.
 *
 * @param {FootballData} fd
 * @param {string|number} fixtureId
 * @param {string|number} leagueId
 * @param {Element}       container
 */
export async function renderMatchDetail(fd, fixtureId, leagueId, container) {
  showSkeleton(container, 10);

  try {
    const data    = await fd.getLeagueMatches(leagueId);
    const matches = data?.response?.matches ?? [];

    if (!matches.length) {
      showError(container, 'Could not load match data for this league.');
      return;
    }

    // Find our fixture — IDs may be numbers or strings
    const fix = matches.find(m => String(m.id) === String(fixtureId));
    if (!fix) {
      container.innerHTML = `
        <div class="card error-state" style="text-align:center;padding:var(--sp-xl)">
          <p>Match not found.</p>
          <p style="margin-top:var(--sp-sm)"><a href="/" class="back-link">← Back to fixtures</a></p>
        </div>`;
      return;
    }

    const homeId = fix.home?.id;
    const awayId = fix.away?.id;

    // Finished matches only for H2H and form
    const finished = matches.filter(m => m.status?.finished);

    // H2H: matches where these two teams met (either direction)
    const h2hMatches = finished
      .filter(m => {
        const hid = String(m.home?.id);
        const aid = String(m.away?.id);
        const hStr = String(homeId);
        const aStr = String(awayId);
        return (hid === hStr && aid === aStr) || (hid === aStr && aid === hStr);
      })
      .sort((a, b) => new Date(b.status.utcTime) - new Date(a.status.utcTime))
      .slice(0, 8);

    // Recent form: last 5 finished matches for each team (excluding the current fixture)
    const recentHome = finished
      .filter(m => String(m.id) !== String(fixtureId) &&
        (String(m.home?.id) === String(homeId) || String(m.away?.id) === String(homeId)))
      .sort((a, b) => new Date(b.status.utcTime) - new Date(a.status.utcTime))
      .slice(0, 5);

    const recentAway = finished
      .filter(m => String(m.id) !== String(fixtureId) &&
        (String(m.home?.id) === String(awayId) || String(m.away?.id) === String(awayId)))
      .sort((a, b) => new Date(b.status.utcTime) - new Date(a.status.utcTime))
      .slice(0, 5);

    // H2H summary
    let hWins = 0, draws = 0, aWins = 0;
    h2hMatches.forEach(m => {
      const hG = m.home?.score ?? 0;
      const aG = m.away?.score ?? 0;
      if (hG > aG) {
        String(m.home?.id) === String(homeId) ? hWins++ : aWins++;
      } else if (aG > hG) {
        String(m.away?.id) === String(homeId) ? hWins++ : aWins++;
      } else {
        draws++;
      }
    });

    container.innerHTML = `
      ${matchHeaderTemplate(fix)}

      <div class="match-lower-grid">

        ${h2hMatches.length ? `
        <section class="card match-h2h-section" aria-label="Head to head">
          <h2 class="section-title">Head-to-Head</h2>

          <div class="h2h-summary">
            <div class="h2h-team-col">
              <img src="${teamLogo(homeId)}" width="28" height="28" loading="lazy"
                   onerror="this.style.visibility='hidden'" alt="">
              <span class="h2h-team-name">${fix.home?.name}</span>
              <span class="h2h-wins">${hWins}</span>
            </div>
            <div class="h2h-middle-col">
              <div class="h2h-bar-wrap">
                <div class="h2h-bar h2h-bar-w" style="flex:${hWins || 1}"></div>
                <div class="h2h-bar h2h-bar-d" style="flex:${draws || 1}"></div>
                <div class="h2h-bar h2h-bar-l" style="flex:${aWins || 1}"></div>
              </div>
              <span class="h2h-meta">${draws} draws · ${h2hMatches.length} played</span>
            </div>
            <div class="h2h-team-col">
              <img src="${teamLogo(awayId)}" width="28" height="28" loading="lazy"
                   onerror="this.style.visibility='hidden'" alt="">
              <span class="h2h-team-name">${fix.away?.name}</span>
              <span class="h2h-wins">${aWins}</span>
            </div>
          </div>

          <div class="h2h-results-list">
            ${h2hMatches.map(m => h2hRowTemplate(m, homeId)).join('')}
          </div>
        </section>` : ''}

        <div class="match-form-panels">
          ${recentHome.length ? `
          <section class="card match-form-section" aria-label="${fix.home?.name} recent form">
            <h2 class="section-title">${fix.home?.name} · Form</h2>
            <div class="form-rows-list">
              ${recentHome.map(m => formRowTemplate(m, homeId)).join('')}
            </div>
          </section>` : ''}

          ${recentAway.length ? `
          <section class="card match-form-section" aria-label="${fix.away?.name} recent form">
            <h2 class="section-title">${fix.away?.name} · Form</h2>
            <div class="form-rows-list">
              ${recentAway.map(m => formRowTemplate(m, awayId)).join('')}
            </div>
          </section>` : ''}
        </div>

      </div>`;

  } catch (err) {
    console.error('renderMatchDetail:', err);
    showError(container);
  }
}
