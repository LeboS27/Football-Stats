/**
 * main.js
 * Homepage entry point.
 * Loads: live + today's fixtures, league standings, recent results, news feed.
 *
 * API-call budget (free tier is limited):
 *  1. getLiveFixtures()    — live scores (5-min cache)
 *  2. getLeagueMatches()   — all matches, used for BOTH fixtures + recent results (6-hr cache)
 *  3. getStandings()       — standings table (6-hr cache)
 *  4. getTrendingNews()    — news feed (24-hr cache)
 * Total: 4 calls per cold load, then served from cache for hours.
 * Live polling is intentionally disabled to stay within free-tier quota.
 */

import { loadHeaderFooter, showSkeleton, showError, formatMatchDate, qs, registerSearchHandler } from './utils.mjs';
import { FootballData } from './FootballData.mjs';
import { renderStandings } from './Standings.mjs';

const fd     = new FootballData();
const SEASON = import.meta.env.VITE_DEFAULT_SEASON ?? '2025';

// ── Helpers ───────────────────────────────────────────────────────────────────

function teamLogo(id) {
  return `https://images.fotmob.com/image_resources/logo/teamlogo/${id}_xsmall.png`;
}

function isToday(utcTime) {
  if (!utcTime) return false;
  const d   = new Date(utcTime);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
         d.getMonth()    === now.getMonth()    &&
         d.getDate()     === now.getDate();
}

// ── Fixture card template ─────────────────────────────────────────────────────

function fixtureCardTemplate(fix, leagueId) {
  const home   = fix.home;
  const away   = fix.away;
  const status = fix.status ?? {};
  const isLive = status.started && !status.finished;
  const isDone = status.finished;
  const short  = status.reason?.short ?? '';

  let scoreHtml;
  if (!status.started && !status.finished) {
    const time = status.utcTime
      ? new Date(status.utcTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      : fix.time ?? '';
    scoreHtml = `<span class="ko-time">${time}</span>`;
  } else {
    const hG = home.score ?? 0;
    const aG = away.score ?? 0;
    scoreHtml = `
      <span class="score-display ${hG > aG ? 'winner' : ''}">${hG}</span>
      <span class="score-sep">–</span>
      <span class="score-display ${aG > hG ? 'winner' : ''}">${aG}</span>`;
  }

  const statusBadge = isLive
    ? `<span class="status-badge live pulse">LIVE</span>`
    : isDone
      ? `<span class="status-badge done">${short}</span>`
      : `<span class="status-badge upcoming">NS</span>`;

  return `
    <a href="/match/?id=${fix.id}&league=${leagueId ?? ''}" class="fixture-card ${isLive ? 'fixture-live' : isDone ? 'fixture-done' : ''}">
      <div class="fixture-card-main">
        <div class="fixture-team home-team-fix">
          <img src="${teamLogo(home.id)}" alt="${home.name}" width="36" height="36" loading="lazy" onerror="this.style.visibility='hidden'">
          <span>${home.name}</span>
        </div>
        <div class="fixture-score-block">${scoreHtml}</div>
        <div class="fixture-team away-team-fix">
          <img src="${teamLogo(away.id)}" alt="${away.name}" width="36" height="36" loading="lazy" onerror="this.style.visibility='hidden'">
          <span>${away.name}</span>
        </div>
      </div>
      <div class="fixture-card-footer">${statusBadge}</div>
    </a>`;
}

// ── News card template ────────────────────────────────────────────────────────

function newsCardTemplate(article) {
  const title  = article.title ?? article.headline ?? article.name ?? '';
  const source = article.source ?? article.provider ?? '';
  const url    = article.url ?? article.link ?? '#';
  const img    = article.image ?? article.urlToImage ?? article.imageUrl ?? '';
  const date   = article.date ?? article.publishedAt ?? '';
  const dateStr = date
    ? new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
  return `
    <a href="${url}" target="_blank" rel="noopener" class="news-card">
      ${img ? `<img src="${img}" alt="" loading="lazy" class="news-img">` : `<div class="news-img-placeholder"></div>`}
      <div class="news-card-body">
        ${source || dateStr ? `<p class="news-source">${source}${source && dateStr ? ' · ' : ''}${dateStr}</p>` : ''}
        <h3 class="news-title">${title}</h3>
      </div>
    </a>`;
}

// ── Recent results row ────────────────────────────────────────────────────────

function recentResultRowTemplate(fix, leagueId) {
  const hG   = fix.home?.score ?? 0;
  const aG   = fix.away?.score ?? 0;
  const date = fix.status?.utcTime
    ? new Date(fix.status.utcTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : '';
  return `
    <a href="/match/?id=${fix.id}&league=${leagueId ?? ''}" class="recent-result-row">
      <div class="rr-team home">
        <img src="${teamLogo(fix.home?.id)}" width="20" height="20" loading="lazy" onerror="this.style.visibility='hidden'" alt="">
        <span class="${hG > aG ? 'rr-winner' : ''}">${fix.home?.name ?? ''}</span>
      </div>
      <div class="rr-score">
        <span class="${hG > aG ? 'rr-winner' : ''}">${hG}</span>
        <span class="rr-sep">–</span>
        <span class="${aG > hG ? 'rr-winner' : ''}">${aG}</span>
      </div>
      <div class="rr-team away">
        <img src="${teamLogo(fix.away?.id)}" width="20" height="20" loading="lazy" onerror="this.style.visibility='hidden'" alt="">
        <span class="${aG > hG ? 'rr-winner' : ''}">${fix.away?.name ?? ''}</span>
      </div>
      <span class="rr-date">${date}</span>
    </a>`;
}

// ── Load news ─────────────────────────────────────────────────────────────────

async function loadNews() {
  const container = qs('#news-container');
  if (!container) return;
  showSkeleton(container, 3);
  try {
    const data     = await fd.getTrendingNews();
    const articles = data?.response?.news ?? data?.response ?? [];
    if (!Array.isArray(articles) || !articles.length) {
      container.innerHTML = '<p class="no-data">No news available.</p>';
      return;
    }
    container.innerHTML = articles.map(newsCardTemplate).join('');
  } catch (err) {
    console.error('loadNews:', err);
    container.innerHTML = '<p class="no-data">No news available.</p>';
  }
}

// ── Main data loader ──────────────────────────────────────────────────────────
// Loads league matches ONCE and uses them for both the fixtures panel and
// the recent results panel — halving the number of API calls.

async function loadLeagueData(leagueId) {
  const fixturesEl = qs('#fixtures-container');
  const recentEl   = qs('#leaderboard-container');
  if (fixturesEl) showSkeleton(fixturesEl, 4);
  if (recentEl)   showSkeleton(recentEl, 6);

  try {
    // Fetch live scores + full league schedule in parallel (2 API calls)
    const [liveData, leagueData] = await Promise.all([
      fd.getLiveFixtures(leagueId),
      fd.getLeagueMatches(leagueId),
    ]);

    const allMatches = leagueData?.response?.matches ?? [];
    const liveList   = Array.isArray(liveData?.response?.live) ? liveData.response.live : [];
    const liveIds    = new Set(liveList.map(f => String(f.id)));

    // ── Today's fixtures ──────────────────────────────────────────
    const todayFromLeague = allMatches.filter(m => isToday(m.status?.utcTime));
    const combined = [
      ...liveList,
      ...todayFromLeague.filter(f => !liveIds.has(String(f.id))),
    ].sort((a, b) => {
      const aLive = a.status?.started && !a.status?.finished;
      const bLive = b.status?.started && !b.status?.finished;
      if (aLive && !bLive) return -1;
      if (!aLive && bLive) return 1;
      return new Date(a.status?.utcTime ?? 0) - new Date(b.status?.utcTime ?? 0);
    });

    if (fixturesEl) {
      fixturesEl.innerHTML = combined.length
        ? combined.map(f => fixtureCardTemplate(f, leagueId)).join('')
        : '<p class="no-data">No fixtures scheduled for today in this league.</p>';
    }

    // ── Recent results ────────────────────────────────────────────
    const recent = allMatches
      .filter(m => m.status?.finished)
      .sort((a, b) => new Date(b.status.utcTime) - new Date(a.status.utcTime))
      .slice(0, 10);

    if (recentEl) {
      recentEl.innerHTML = recent.length
        ? recent.map(fix => recentResultRowTemplate(fix, leagueId)).join('')
        : '<p class="no-data">No results available.</p>';
    }

  } catch (err) {
    console.error('loadLeagueData:', err);
    if (fixturesEl) showError(fixturesEl);
    if (recentEl)   showError(recentEl);
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  await loadHeaderFooter();
  registerSearchHandler(fd);

  const leagueId = parseInt(localStorage.getItem('fsd_league') ?? '47', 10);

  // 4 API calls total on a cold load, all cached aggressively after that
  await Promise.all([
    loadLeagueData(leagueId),
    renderStandings(fd, leagueId, qs('#standings-container'), SEASON),
    loadNews(),
  ]);

  // React to league selector changes
  window.addEventListener('leagueChange', async e => {
    const newLeague = parseInt(e.detail, 10);
    await Promise.all([
      loadLeagueData(newLeague),
      renderStandings(fd, newLeague, qs('#standings-container'), SEASON),
    ]);
  });
}

init();
