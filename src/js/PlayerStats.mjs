/**
 * PlayerStats.mjs
 * Renders the player profile page using squad data and player news.
 * Data comes from /football-get-list-player (via team page link)
 * and /football-get-player-news.
 */

import { showSkeleton, showError } from './utils.mjs';

function teamLogo(id) {
  return `https://images.fotmob.com/image_resources/logo/teamlogo/${id}_xsmall.png`;
}
function playerPhoto(id) {
  return `https://images.fotmob.com/image_resources/playerimages/${id}.png`;
}

// ── News card ─────────────────────────────────────────────────────────────────

function newsCardTemplate(article) {
  const url  = article.page?.url ? `https://www.fotmob.com${article.page.url}` : '#';
  const date = article.gmtTime
    ? new Date(article.gmtTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
  return `
    <a href="${url}" target="_blank" rel="noopener" class="news-card">
      ${article.imageUrl
        ? `<img src="${article.imageUrl}" alt="" loading="lazy" class="news-img">`
        : `<div class="news-img-placeholder"></div>`}
      <div class="news-card-body">
        <p class="news-source">${article.sourceStr ?? ''}${date ? ' · ' + date : ''}</p>
        <h3 class="news-title">${article.title ?? ''}</h3>
        ${article.lead ? `<p class="news-description">${article.lead}</p>` : ''}
      </div>
    </a>`;
}

// ── Player profile card ───────────────────────────────────────────────────────

function playerProfileTemplate(player, teamName, teamId) {
  const pos    = player.positionIdsDesc ?? player.role?.fallback ?? '—';
  const rating = player.rating ? parseFloat(player.rating).toFixed(1) : null;
  const injuryBadge = player.injured
    ? `<span class="injury-badge">⚕ Injured${player.injury?.expectedReturn ? ' · ' + player.injury.expectedReturn : ''}</span>`
    : '';

  return `
    <div class="player-profile-header card">
      <div class="player-profile-photo-wrap">
        <img src="${playerPhoto(player.id)}" alt="${player.name}"
             width="100" height="100" loading="lazy" class="player-profile-photo"
             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2280%22>👤</text></svg>'">
      </div>
      <div class="player-profile-meta">
        <h1 class="player-full-name">${player.name}</h1>
        ${injuryBadge}
        <div class="player-profile-tags">
          ${pos !== '—' ? `<span class="tag">${pos}</span>` : ''}
          ${player.cname ? `<span class="tag">${player.cname}</span>` : ''}
          ${player.shirtNumber ? `<span class="tag">#${player.shirtNumber}</span>` : ''}
          ${teamName ? `<span class="tag team-tag">
            ${teamId ? `<img src="${teamLogo(teamId)}" alt="" width="16" height="16" loading="lazy" onerror="this.style.display='none'">` : ''}
            ${teamName}
          </span>` : ''}
        </div>
        <div class="player-profile-info-grid">
          ${player.age    ? `<div class="profile-info-item"><span>Age</span><strong>${player.age}</strong></div>` : ''}
          ${player.height ? `<div class="profile-info-item"><span>Height</span><strong>${player.height} cm</strong></div>` : ''}
          ${player.dateOfBirth ? `<div class="profile-info-item"><span>Born</span><strong>${player.dateOfBirth}</strong></div>` : ''}
          ${rating        ? `<div class="profile-info-item"><span>Rating</span><strong class="rating-badge">★ ${rating}</strong></div>` : ''}
        </div>
        <div class="player-season-stats">
          ${player.goals    !== undefined ? `<div class="pss-item"><span class="pss-val">${player.goals}</span><span class="pss-label">Goals</span></div>` : ''}
          ${player.assists  !== undefined ? `<div class="pss-item"><span class="pss-val">${player.assists}</span><span class="pss-label">Assists</span></div>` : ''}
          ${player.ycards   !== undefined ? `<div class="pss-item"><span class="pss-val">${player.ycards}</span><span class="pss-label">Yellow</span></div>` : ''}
          ${player.rcards   !== undefined ? `<div class="pss-item"><span class="pss-val">${player.rcards}</span><span class="pss-label">Red</span></div>` : ''}
        </div>
      </div>
    </div>`;
}

// ── Public renderer ───────────────────────────────────────────────────────────

/**
 * Renders the player profile page.
 * Expects playerId to be a FotMob player ID.
 * teamId is needed to fetch the squad to find the player's details.
 * name / teamName are URL param fallbacks when the player comes from search.
 *
 * @param {FootballData} fd
 * @param {number|string} playerId
 * @param {Element} container
 * @param {string}  [season]
 * @param {number|string} [teamId]
 * @param {string}  [fallbackName]     - from URL ?name= param
 * @param {string}  [fallbackTeamName] - from URL ?teamName= param
 */
export async function renderPlayerStats(fd, playerId, container, season, teamId, fallbackName, fallbackTeamName) {
  showSkeleton(container, 6);

  try {
    // Fetch news regardless (may return empty — that's fine)
    const newsData = await fd.getPlayerNews(playerId);
    const articles = newsData?.response?.news ?? [];

    // Try to find full player details from squad if teamId provided
    let player     = null;
    let resolvedTeamId = teamId;
    let resolvedTeamName = '';

    if (teamId) {
      try {
        const squadData = await fd.getTeamPlayers(teamId);
        const squad = squadData?.response?.list?.squad ?? [];
        for (const group of squad) {
          const found = (group.members ?? []).find(m => String(m.id) === String(playerId));
          if (found) { player = found; break; }
        }
        // Try to get team name from first member's parent context if not supplied
      } catch {
        // Squad fetch failed — continue with fallback
      }
    }

    // Build a minimal stub player object if we have fallback data but no squad data
    if (!player && (fallbackName || fallbackTeamName)) {
      player = {
        id:   playerId,
        name: fallbackName || `Player #${playerId}`,
      };
      resolvedTeamName = fallbackTeamName ?? '';
    }

    // teamName comes from squad lookup (group context) or fallback param
    const displayTeamName = resolvedTeamName || fallbackTeamName || '';

    container.innerHTML = `
      ${player
        ? playerProfileTemplate(player, displayTeamName, resolvedTeamId)
        : `
          <div class="card player-profile-header">
            <div class="player-profile-photo-wrap">
              <img src="${playerPhoto(playerId)}" alt="Player photo"
                   width="100" height="100" loading="lazy" class="player-profile-photo"
                   onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2280%22>👤</text></svg>'">
            </div>
            <div class="player-profile-meta">
              <h1 class="player-full-name">Player #${playerId}</h1>
              <p class="no-data" style="margin-top:var(--sp-sm)">
                Visit this player from a team's squad page to see full details.
              </p>
            </div>
          </div>`}
      ${articles.length
        ? `
          <section class="card" style="margin-top:var(--sp-md)">
            <h2 class="section-title" style="padding:var(--sp-md) var(--sp-md) 0">Latest News</h2>
            <div class="news-grid" style="padding:var(--sp-md)">
              ${articles.slice(0, 6).map(newsCardTemplate).join('')}
            </div>
          </section>`
        : ''}`;

  } catch (err) {
    console.error('renderPlayerStats:', err);
    showError(container);
  }
}

// ── Squad browser ─────────────────────────────────────────────────────────────

function squadPlayerTemplate(p, teamId) {
  const pos    = p.positionIdsDesc ?? p.role?.fallback ?? '';
  const rating = p.rating ? parseFloat(p.rating).toFixed(1) : '—';
  const injIcon = p.injured ? ' ⚕' : '';
  return `
    <a href="/player/?id=${p.id}&team=${teamId}" class="squad-player-card">
      <img src="${playerPhoto(p.id)}" alt="${p.name}" width="56" height="56"
           loading="lazy" class="squad-player-photo"
           onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2280%22>👤</text></svg>'">
      <div class="squad-player-info">
        <span class="squad-player-name">${p.name}${injIcon}</span>
        <span class="squad-player-pos">${pos}</span>
      </div>
      <div class="squad-player-stats">
        ${p.goals !== undefined   ? `<span class="sp-stat">⚽ ${p.goals}</span>` : ''}
        ${p.assists !== undefined ? `<span class="sp-stat">🎯 ${p.assists}</span>` : ''}
        ${p.rating  ? `<span class="sp-stat rating-badge">★ ${rating}</span>` : ''}
      </div>
    </a>`;
}

/**
 * Renders the team squad browser.
 * @param {FootballData} fd
 * @param {number|string} teamId
 * @param {Element} container
 */
export async function renderSquad(fd, teamId, container) {
  showSkeleton(container, 8);
  try {
    const data  = await fd.getTeamPlayers(teamId);
    const squad = data?.response?.list?.squad ?? [];

    if (!squad.length) { showError(container, 'Squad not available.'); return; }

    const groups = squad
      .filter(g => g.members?.some(m => !m.excludeFromRanking))
      .map(g => `
        <div class="squad-group">
          <h3 class="squad-group-title">${g.title ?? ''}</h3>
          <div class="squad-group-list">
            ${g.members.filter(m => !m.excludeFromRanking).map(p => squadPlayerTemplate(p, teamId)).join('')}
          </div>
        </div>`).join('');

    container.innerHTML = `<div class="squad-browser">${groups}</div>`;
  } catch (err) {
    console.error('renderSquad:', err);
    showError(container);
  }
}
