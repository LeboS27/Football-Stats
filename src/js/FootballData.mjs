/**
 * FootballData.mjs
 * Central data-access class for Free API Live Football Data (via RapidAPI).
 * All responses are cached in localStorage with per-endpoint TTLs to
 * respect the free-tier quota.
 *
 * Host: free-api-live-football-data.p.rapidapi.com
 *
 * Endpoints used:
 *   /football-get-matches-by-date-and-league — fixtures by date + league
 *   /football-get-all-matches-by-league      — all matches for a league
 *   /football-current-live                   — live scores (no params)
 *   /football-get-standing-all               — league standings
 *   /football-players-search                 — player + team search
 *   /football-get-trendingnews               — trending football news
 *   /football-get-player-news                — news for a specific player
 *   /football-get-list-player                — player list for a team
 */

const BASE_URL = 'https://free-api-live-football-data.p.rapidapi.com';
const API_KEY  = import.meta.env.VITE_FOOTBALL_API_KEY;
const SEASON   = import.meta.env.VITE_DEFAULT_SEASON ?? '2024';

/** Cache TTL constants (milliseconds).
 *  Kept long to stay within the free-tier quota (limited daily requests).
 */
const TTL = {
  LIVE:        5 * 60_000,      // 5 minutes  — live match data
  FIXTURES:    30 * 60_000,     // 30 minutes — today's fixtures
  STANDINGS:   6 * 3_600_000,   // 6 hours    — standings
  LEADERBOARD: 6 * 3_600_000,   // 6 hours    — top scorers / assists
  PLAYER:      24 * 3_600_000,  // 24 hours   — player profiles
  TEAM:        24 * 3_600_000,  // 24 hours   — team stats
  HISTORICAL:  24 * 3_600_000,  // 24 hours   — H2H, past fixtures
};

export class FootballData {
  constructor() {
    this._headers = {
      'x-rapidapi-host': 'free-api-live-football-data.p.rapidapi.com',
      'x-rapidapi-key': API_KEY ?? '',
    };
  }

  // ── Cache helpers ──────────────────────────────────────────────────────────

  _cacheGet(key) {
    try {
      const raw = localStorage.getItem(`fsd::${key}`);
      if (!raw) return null;
      const { data, ts, ttl } = JSON.parse(raw);
      if (Date.now() - ts > ttl) { localStorage.removeItem(`fsd::${key}`); return null; }
      return data;
    } catch { return null; }
  }

  _cacheSet(key, data, ttl) {
    try {
      localStorage.setItem(`fsd::${key}`, JSON.stringify({ data, ts: Date.now(), ttl }));
    } catch { /* storage full — evict oldest */ this._evictOldest(); }
  }

  _evictOldest() {
    const fsdKeys = Object.keys(localStorage)
      .filter(k => k.startsWith('fsd::'))
      .map(k => { try { return { k, ts: JSON.parse(localStorage.getItem(k)).ts }; } catch { return { k, ts: 0 }; } })
      .sort((a, b) => a.ts - b.ts);
    if (fsdKeys.length) localStorage.removeItem(fsdKeys[0].k);
  }

  // ── Core request ──────────────────────────────────────────────────────────

  /**
   * Makes a GET request to the API-Football v3 endpoint.
   * Returns cached data when available and not expired.
   *
   * @param {string} endpoint  e.g. '/fixtures'
   * @param {Object} params    Query parameters as a plain object
   * @param {number} ttl       Cache TTL in milliseconds
   * @returns {Promise<Object>} Parsed API response
   */
  async request(endpoint, params = {}, ttl = TTL.HISTORICAL) {
    const qs  = new URLSearchParams(params).toString();
    const key = `${endpoint}?${qs}`;

    const cached = this._cacheGet(key);
    if (cached) return cached;

    if (!API_KEY) {
      console.warn('FootballData: VITE_FOOTBALL_API_KEY is not set. Using mock data fallback.');
      return this._mockResponse(endpoint, params);
    }

    const res = await fetch(`${BASE_URL}${endpoint}?${qs}`, {
      method: 'GET',
      headers: this._headers,
    });

    if (res.status === 429) {
      throw new Error('RATE_LIMIT');
    }

    if (!res.ok) {
      throw new Error(`API error ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();
    this._cacheSet(key, json, ttl);
    return json;
  }

  // ── Public API methods ────────────────────────────────────────────────────

  /**
   * Get fixtures for a league and date range, or live fixtures.
   * @param {number|string} leagueId
   * @param {string}        [season]
   * @param {string}        [date]     YYYY-MM-DD; today if omitted
   * @returns {Promise<Object>}
   */
  async getFixtures(leagueId, season = SEASON, date) {
    const raw   = date ?? new Date().toISOString().slice(0, 10);
    const today = raw.replace(/-/g, ''); // YYYYMMDD — no hyphens
    return this.request('/football-get-matches-by-date-and-league', { date: today, leagueid: leagueId }, TTL.FIXTURES);
  }

  /**
   * Get live fixtures (all leagues — no params accepted by this endpoint).
   * @param {number|string} leagueId  (ignored — endpoint has no params)
   * @returns {Promise<Object>}
   */
  async getLiveFixtures(leagueId) {
    return this.request('/football-current-live', {}, TTL.LIVE);
  }

  /**
   * Workaround: no by-ID endpoint exists — fetch all matches for the league.
   * @param {number|string} fixtureId   (unused — kept for API compat)
   * @param {number|string} leagueId
   * @returns {Promise<Object>}
   */
  async getFixtureById(fixtureId, leagueId) {
    if (!leagueId) return Promise.resolve({ response: [] });
    return this.request('/football-get-all-matches-by-league', { leagueid: leagueId }, TTL.LIVE);
  }

  /**
   * Get all matches for a league (workaround — no team-specific endpoint).
   * @param {number|string} teamId    (unused — kept for API compat)
   * @param {number|string} leagueId
   * @returns {Promise<Object>}
   */
  async getTeamFixtures(teamId, leagueId) {
    return this.request('/football-get-all-matches-by-league', { leagueid: leagueId }, TTL.HISTORICAL);
  }

  async getLeagueMatches(leagueId) {
    return this.request('/football-get-all-matches-by-league', { leagueid: leagueId }, TTL.STANDINGS);
  }

  /**
   * Match statistics — not available on this API.
   * @returns {Promise<Object>}
   */
  async getMatchStats(fixtureId) {
    return Promise.resolve({ response: [] });
  }

  /**
   * Match events (goals, cards, substitutions) — not available on this API.
   * @returns {Promise<Object>}
   */
  async getMatchEvents(fixtureId) {
    return Promise.resolve({ response: [] });
  }

  /**
   * Get player list for a team.
   * @param {number|string} teamId
   * @returns {Promise<Object>}
   */
  async getTeamPlayers(teamId) {
    return this.request('/football-get-list-player', { teamid: teamId }, TTL.PLAYER);
  }

  /**
   * Head-to-head — not available on this API.
   * @returns {Promise<Object>}
   */
  async getHeadToHead(team1Id, team2Id) {
    return Promise.resolve({ response: [] });
  }

  /**
   * Get league standings table.
   * @param {number|string} leagueId
   * @param {string}        [season]
   * @returns {Promise<Object>}
   */
  async getStandings(leagueId, season = SEASON) {
    return this.request('/football-get-standing-all', { leagueid: leagueId }, TTL.STANDINGS);
  }

  /**
   * Get news articles for a player.
   * @param {number|string} playerId
   * @returns {Promise<Object>}
   */
  async getPlayerNews(playerId) {
    return this.request('/football-get-player-news', { playerid: playerId, page: 1 }, TTL.PLAYER);
  }

  /**
   * Top scorers — not available on this API.
   * @returns {Promise<Object>}
   */
  async getTopScorers(leagueId, season = SEASON) {
    return Promise.resolve({ response: [] });
  }

  /**
   * Top assists — not available on this API.
   * @returns {Promise<Object>}
   */
  async getTopAssists(leagueId, season = SEASON) {
    return Promise.resolve({ response: [] });
  }

  /**
   * Team season statistics — not available on this API.
   * @returns {Promise<Object>}
   */
  async getTeamStats(teamId, leagueId, season = SEASON) {
    return Promise.resolve({ response: null });
  }

  /**
   * Search teams (and players) by name — combined results from this API.
   * @param {string} query
   * @returns {Promise<Object>}
   */
  async searchTeams(query) {
    return this.request('/football-players-search', { search: query }, TTL.HISTORICAL);
  }

  /**
   * Search players by name.
   * @param {string} query
   * @returns {Promise<Object>}
   */
  async searchPlayers(query) {
    return this.request('/football-players-search', { search: query }, TTL.HISTORICAL);
  }

  /**
   * Get trending football news.
   * @returns {Promise<Object>}
   */
  async getTrendingNews() {
    return this.request('/football-get-trendingnews', {}, TTL.HISTORICAL);
  }

  // ── Backward-compatible aliases ───────────────────────────────────────────

  /** @deprecated use getPlayerNews */
  async getPlayerStats(playerId, season) {
    return this.getPlayerNews(playerId);
  }

  /** @deprecated — no fixture-by-ID endpoint; returns empty without leagueId */
  async getFixturePlayers(fixtureId) {
    return Promise.resolve({ response: [] });
  }

  // ── Mock / fallback ───────────────────────────────────────────────────────

  /**
   * Returns lightweight mock data when no API key is configured so the UI
   * renders during development without consuming quota.
   * @private
   */
  _mockResponse(endpoint, params) {
    console.info(`[Mock] ${endpoint}`, params);
    const empty = { response: [], errors: [], results: 0 };

    if (endpoint === '/football-get-standing-all') {
      return {
        response: [{
          league: {
            standings: [[
              { rank: 1, team: { id: 33,  name: 'Manchester United', logo: 'https://media.api-sports.io/football/teams/33.png' },  points: 68, goalsDiff: 28, form: 'WWDWW', all: { played: 30, win: 20, draw: 8, lose: 2,  goals: { for: 60, against: 32 } }, description: 'Promotion - Champions League (Group Stage)' },
              { rank: 2, team: { id: 40,  name: 'Liverpool',          logo: 'https://media.api-sports.io/football/teams/40.png' },  points: 64, goalsDiff: 24, form: 'WDWWL', all: { played: 30, win: 19, draw: 7, lose: 4,  goals: { for: 55, against: 31 } }, description: 'Promotion - Champions League (Group Stage)' },
              { rank: 3, team: { id: 42,  name: 'Arsenal',            logo: 'https://media.api-sports.io/football/teams/42.png' },  points: 60, goalsDiff: 18, form: 'LWWWW', all: { played: 30, win: 17, draw: 9, lose: 4,  goals: { for: 50, against: 32 } }, description: 'Promotion - Champions League (Group Stage)' },
              { rank: 4, team: { id: 50,  name: 'Manchester City',    logo: 'https://media.api-sports.io/football/teams/50.png' },  points: 55, goalsDiff: 12, form: 'WDLWW', all: { played: 30, win: 15, draw: 10, lose: 5, goals: { for: 48, against: 36 } }, description: 'Promotion - Champions League (Group Stage)' },
              { rank: 5, team: { id: 49,  name: 'Chelsea',            logo: 'https://media.api-sports.io/football/teams/49.png' },  points: 50, goalsDiff:  8, form: 'WDWDL', all: { played: 30, win: 13, draw: 11, lose: 6, goals: { for: 42, against: 34 } }, description: 'Promotion - Europa League (Group Stage)' },
              { rank: 18, team: { id: 65, name: 'Sheffield Utd',      logo: 'https://media.api-sports.io/football/teams/65.png' },  points: 18, goalsDiff: -38, form: 'LLLLL', all: { played: 30, win: 4, draw: 6, lose: 20,  goals: { for: 22, against: 60 } }, description: 'Relegation - Championship' },
              { rank: 19, team: { id: 48, name: 'West Ham',           logo: 'https://media.api-sports.io/football/teams/48.png' },  points: 16, goalsDiff: -42, form: 'LLDLL', all: { played: 30, win: 3, draw: 7, lose: 20,  goals: { for: 18, against: 60 } }, description: 'Relegation - Championship' },
              { rank: 20, team: { id: 44, name: 'Burnley',            logo: 'https://media.api-sports.io/football/teams/44.png' },  points: 12, goalsDiff: -50, form: 'LLLLL', all: { played: 30, win: 2, draw: 6, lose: 22,  goals: { for: 15, against: 65 } }, description: 'Relegation - Championship' },
            ]]
          }
        }]
      };
    }

    if (endpoint === '/football-players-topscorers' || endpoint === '/football-players-topassists') {
      return {
        response: [
          { player: { id: 1100, name: 'Erling Haaland', photo: 'https://media.api-sports.io/football/players/1100.png', nationality: 'Norway' }, statistics: [{ team: { name: 'Manchester City', logo: '' }, goals: { total: 22, assists: 5 }, shots: { total: 80, on: 38 }, passes: { key: 20, accuracy: 70 }, dribbles: { attempts: 30, success: 18 } }] },
          { player: { id: 306,  name: 'Mohamed Salah',  photo: 'https://media.api-sports.io/football/players/306.png',  nationality: 'Egypt'   }, statistics: [{ team: { name: 'Liverpool',       logo: '' }, goals: { total: 18, assists: 10 }, shots: { total: 72, on: 35 }, passes: { key: 45, accuracy: 82 }, dribbles: { attempts: 55, success: 40 } }] },
          { player: { id: 2295, name: 'Ollie Watkins',  photo: 'https://media.api-sports.io/football/players/2295.png', nationality: 'England'  }, statistics: [{ team: { name: 'Aston Villa',    logo: '' }, goals: { total: 16, assists: 8  }, shots: { total: 65, on: 28 }, passes: { key: 30, accuracy: 74 }, dribbles: { attempts: 20, success: 12 } }] },
        ]
      };
    }

    if (endpoint === '/football-get-matches-by-date-and-league' || endpoint === '/football-current-live') {
      return {
        response: [
          {
            fixture: { id: 1001, date: new Date().toISOString(), status: { short: 'LIVE', elapsed: 74 }, venue: { name: 'Emirates Stadium' } },
            league:  { id: 39, name: 'Premier League', logo: '' },
            teams:   { home: { id: 42, name: 'Arsenal',    logo: 'https://media.api-sports.io/football/teams/42.png', winner: true  }, away: { id: 50, name: 'Manchester City', logo: 'https://media.api-sports.io/football/teams/50.png', winner: false } },
            goals:   { home: 2, away: 1 },
            score:   { halftime: { home: 1, away: 0 }, fulltime: { home: null, away: null } },
          },
          {
            fixture: { id: 1002, date: new Date().toISOString(), status: { short: 'LIVE', elapsed: 33 }, venue: { name: 'Stamford Bridge' } },
            league:  { id: 39, name: 'Premier League', logo: '' },
            teams:   { home: { id: 49, name: 'Chelsea', logo: 'https://media.api-sports.io/football/teams/49.png', winner: null }, away: { id: 47, name: 'Tottenham', logo: 'https://media.api-sports.io/football/teams/47.png', winner: null } },
            goals:   { home: 0, away: 0 },
            score:   { halftime: { home: 0, away: 0 }, fulltime: { home: null, away: null } },
          },
          {
            fixture: { id: 1003, date: (() => { const d = new Date(); d.setHours(d.getHours() + 2); return d.toISOString(); })(), status: { short: 'NS' }, venue: { name: 'Anfield' } },
            league:  { id: 39, name: 'Premier League', logo: '' },
            teams:   { home: { id: 40, name: 'Liverpool', logo: 'https://media.api-sports.io/football/teams/40.png' }, away: { id: 51, name: 'Brighton', logo: 'https://media.api-sports.io/football/teams/51.png' } },
            goals:   { home: null, away: null },
            score:   { halftime: { home: null, away: null }, fulltime: { home: null, away: null } },
          },
        ]
      };
    }

    return empty;
  }
}
