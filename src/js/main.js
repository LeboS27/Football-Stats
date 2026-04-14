/**
 * main.js
 * Homepage entry point.
 * Loads: live + today's fixtures, league standings, top scorers, news feed.
 * Polls live fixtures every 60 seconds while live matches are active.
 */

import { loadHeaderFooter, showSkeleton, showError, formatMatchDate, qs, registerSearchHandler } from './utils.mjs';
import { FootballData } from './FootballData.mjs';
import { renderStandings } from './Standings.mjs';

const fd     = new FootballData();
const SEASON = import.meta.env.VITE_DEFAULT_SEASON ?? '2024';

// ── Fixture card template ─────────────────────────────────────────────────────

function teamLogo(id) {
  return `https://images.fotmob.com/image_resources/logo/teamlogo/${id}_xsmall.png`;
}

function fixtureCardTemplate(fix, leagueId) {
  const home    = fix.home;
  const away    = fix.away;
  const status  = fix.status ?? {};
  const isLive  = status.started && !status.finished;
  const isDone  = status.finished;
  const short   = status.reason?.short ?? '';

  let scoreHtml;
  if (!status.started && !status.finished) {
    const time = status.utcTime ? formatMatchDate(status.utcTime).split(',')[1]?.trim() ?? '' : fix.time ?? '';
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
  const title   = article.title ?? article.headline ?? article.name ?? '';
  const source  = article.source ?? article.provider ?? '';
  const url     = article.url ?? article.link ?? '#';
  const img     = article.image ?? article.urlToImage ?? article.imageUrl ?? '';
  const date    = article.date ?? article.publishedAt ?? '';
  const dateStr = date ? new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  return `
    <a href="${url}" target="_blank" rel="noopener" class="news-card">
      ${img ? `<img src="${img}" alt="" loading="lazy" class="news-img">` : `<div class="news-img-placeholder"></div>`}
      <div class="news-card-body">
        ${source || dateStr ? `<p class="news-source">${source}${source && dateStr ? ' · ' : ''}${dateStr}</p>` : ''}
        <h3 class="news-title">${title}</h3>
      </div>
    </a>`;
}

// ── Load fixtures ─────────────────────────────────────────────────────────────

async function loadFixtures(leagueId) {
  const container = qs('#fixtures-container');
  if (!container) return [];
  showSkeleton(container, 4);

  try {
    const [liveData, todayData] = await Promise.all([
      fd.getLiveFixtures(leagueId),
      fd.getFixtures(leagueId, SEASON),
    ]);

    // live: response.live[] — by-date-and-league: response[] (direct array)
    const liveFixtures  = Array.isArray(liveData?.response?.live) ? liveData.response.live : [];
    const todayFixtures = Array.isArray(todayData?.response)      ? todayData.response     : [];

    // Deduplicate: live fixtures take priority
    const liveIds = new Set(liveFixtures.map(f => f.id));
    const combined = [
      ...liveFixtures,
      ...todayFixtures.filter(f => !liveIds.has(f.id)),
    ].sort((a, b) => {
      const aLive = a.status?.started && !a.status?.finished;
      const bLive = b.status?.started && !b.status?.finished;
      if (aLive && !bLive) return -1;
      if (!aLive && bLive) return 1;
      return new Date(a.status?.utcTime ?? 0) - new Date(b.status?.utcTime ?? 0);
    });

    if (!combined.length) {
      container.innerHTML = '<p class="no-data">No fixtures scheduled for today in this league.</p>';
      return [];
    }

    container.innerHTML = combined.map(f => fixtureCardTemplate(f, leagueId)).join('');
    return combined;

  } catch (err) {
    console.error('loadFixtures:', err);
    showError(container);
    return [];
  }
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

// ── Recent results ────────────────────────────────────────────────────────────

function recentResultRowTemplate(fix, leagueId) {
  const hG = fix.home?.score ?? 0;
  const aG = fix.away?.score ?? 0;
  const date = fix.status?.utcTime ? new Date(fix.status.utcTime).toLocaleDateString('en-GB', { day:'numeric', month:'short' }) : '';
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

async function renderRecentResults(leagueId, container) {
  if (!container) return;
  showSkeleton(container, 6);
  try {
    const data    = await fd.getLeagueMatches(leagueId);
    const matches = data?.response?.matches ?? [];
    const recent  = matches
      .filter(m => m.status?.finished)
      .sort((a, b) => new Date(b.status.utcTime) - new Date(a.status.utcTime))
      .slice(0, 10);

    if (!recent.length) { container.innerHTML = '<p class="no-data">No results available.</p>'; return; }
    container.innerHTML = recent.map(fix => recentResultRowTemplate(fix, leagueId)).join('');
  } catch (err) {
    console.error('renderRecentResults:', err);
    showError(container);
  }
}

// ── Live polling ──────────────────────────────────────────────────────────────

let pollTimer = null;

function startPolling(leagueId, fixtures) {
  const isLiveMatch = f => f?.status?.started && !f?.status?.finished;
  if (!fixtures.some(isLiveMatch)) return;

  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    const updated = await loadFixtures(leagueId);
    if (!updated.some(isLiveMatch)) clearInterval(pollTimer);
  }, 60_000);
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  await loadHeaderFooter();
  registerSearchHandler(fd);

  const leagueId = parseInt(localStorage.getItem('fsd_league') ?? '47', 10);

  // Load all sections in parallel
  const [fixtures] = await Promise.all([
    loadFixtures(leagueId),
    renderStandings(fd, leagueId, qs('#standings-container'), SEASON),
    renderRecentResults(leagueId, qs('#leaderboard-container')),
    loadNews(),
  ]);

  startPolling(leagueId, fixtures);

  // React to league selector changes from the header
  window.addEventListener('leagueChange', async e => {
    const newLeague = parseInt(e.detail, 10);
    clearInterval(pollTimer);
    const newFixtures = await loadFixtures(newLeague);
    await Promise.all([
      renderStandings(fd, newLeague, qs('#standings-container'), SEASON),
      renderRecentResults(newLeague, qs('#leaderboard-container')),
    ]);
    startPolling(newLeague, newFixtures);
  });
}

init();
