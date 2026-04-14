/**
 * utils.mjs
 * Shared utility functions for Football Stats Dashboard.
 * Follows WDD 330 module conventions: getParam, loadHeaderFooter,
 * renderWithTemplate, renderListWithTemplate, fetchData.
 */

// ─── URL Parameters ─────────────────────────────────────────────────────────

/**
 * Returns the value of a URL search parameter, or null if not present.
 * @param {string} param
 * @returns {string|null}
 */
export function getParam(param) {
  return new URLSearchParams(window.location.search).get(param);
}

// ─── Header / Footer ─────────────────────────────────────────────────────────

/**
 * Fetches and injects the shared header and footer HTML partials.
 * Expects elements with id="header" and id="footer" in the calling page.
 * After injection, initialises the league selector, dark-mode toggle, and
 * the global search bar (all defined in the header partial).
 */
export async function loadHeaderFooter() {
  const [headerText, footerText] = await Promise.all([
    fetch('/partials/header.html').then(r => r.text()),
    fetch('/partials/footer.html').then(r => r.text()),
  ]);
  document.querySelector('#header').innerHTML = headerText;
  document.querySelector('#footer').innerHTML = footerText;

  initLeagueSelector();
  initDarkModeToggle();
  initSearch();
}

// ─── Template Rendering ──────────────────────────────────────────────────────

/**
 * Renders a single data item using a template function and inserts it into
 * the DOM.
 * @param {Function} templateFn   - (data) => HTML string
 * @param {Element}  parentEl     - Container element
 * @param {*}        data         - Data to pass to templateFn
 * @param {Function} [callback]   - Optional post-render callback
 * @param {string}   [position]   - insertAdjacentHTML position (default 'afterbegin')
 * @param {boolean}  [clear]      - Clear parentEl before insertion
 */
export function renderWithTemplate(templateFn, parentEl, data, callback, position = 'afterbegin', clear = false) {
  if (clear) parentEl.innerHTML = '';
  parentEl.insertAdjacentHTML(position, templateFn(data));
  if (callback) callback(data);
}

/**
 * Renders a list of items using a template function.
 * @param {Function} templateFn
 * @param {Element}  parentEl
 * @param {Array}    list
 * @param {string}   [position]
 * @param {boolean}  [clear]
 */
export function renderListWithTemplate(templateFn, parentEl, list, position = 'afterbegin', clear = false) {
  if (clear) parentEl.innerHTML = '';
  if (!list || list.length === 0) return;
  parentEl.insertAdjacentHTML(position, list.map(templateFn).join(''));
}

// ─── Fetch Wrapper ───────────────────────────────────────────────────────────

/**
 * Thin wrapper around fetch with error handling.
 * @param {string} url
 * @param {RequestInit} [options]
 * @returns {Promise<any>}
 */
export async function fetchData(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`fetchData failed: ${response.status} ${response.statusText} — ${url}`);
  }
  return response.json();
}

// ─── DOM Helpers ─────────────────────────────────────────────────────────────

/**
 * Shorthand querySelector.
 * @param {string} selector
 * @param {Element|Document} [scope]
 * @returns {Element|null}
 */
export const qs = (selector, scope = document) => scope.querySelector(selector);

/**
 * Shorthand querySelectorAll returned as an Array.
 * @param {string} selector
 * @param {Element|Document} [scope]
 * @returns {Element[]}
 */
export const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];

/**
 * Shows a loading skeleton inside an element.
 * @param {Element} el
 * @param {number}  [rows]
 */
export function showSkeleton(el, rows = 4) {
  el.innerHTML = Array(rows).fill('<div class="skeleton-row"></div>').join('');
}

/**
 * Shows an error message inside an element.
 * @param {Element} el
 * @param {string}  message
 */
export function showError(el, message = 'Unable to load data. Please try again later.') {
  el.innerHTML = `<div class="error-state"><span class="error-icon">⚠</span><p>${message}</p></div>`;
}

// ─── Formatting Helpers ──────────────────────────────────────────────────────

/**
 * Formats a date string to a short readable label.
 * e.g. "2024-04-14T15:00:00+00:00" → "Sun 14 Apr, 15:00"
 * @param {string} isoString
 * @returns {string}
 */
export function formatMatchDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Returns a form badge HTML string for a single result character.
 * @param {'W'|'D'|'L'} char
 * @returns {string}
 */
export function formBadge(char) {
  const cls = { W: 'form-w', D: 'form-d', L: 'form-l' }[char] ?? 'form-d';
  return `<span class="form-badge ${cls}">${char}</span>`;
}

/**
 * Renders a form string (e.g. "WWDLW") as a row of badges.
 * @param {string} formStr
 * @returns {string}
 */
export function renderFormString(formStr = '') {
  return [...formStr.slice(-5)].map(formBadge).join('');
}

/**
 * Returns a percentage string clamped between 0-100.
 * @param {number} value
 * @param {number} total
 * @returns {string}
 */
export function pct(value, total) {
  if (!total) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

// ─── League Selector ─────────────────────────────────────────────────────────

function initLeagueSelector() {
  const sel = qs('#league-select');
  if (!sel) return;

  const stored = localStorage.getItem('fsd_league') || '47';
  sel.value = stored;

  sel.addEventListener('change', () => {
    localStorage.setItem('fsd_league', sel.value);
    // Broadcast so any open page can react.
    window.dispatchEvent(new CustomEvent('leagueChange', { detail: sel.value }));
    // Reload if we are on homepage so standings + fixtures update.
    if (window.location.pathname === '/' || window.location.pathname.endsWith('index.html')) {
      window.location.reload();
    }
  });
}

// ─── Dark Mode ───────────────────────────────────────────────────────────────

function initDarkModeToggle() {
  const btn = qs('#dark-mode-toggle');
  if (!btn) return;

  const saved = localStorage.getItem('fsd_theme');
  if (saved === 'light') document.documentElement.classList.add('light');

  btn.addEventListener('click', () => {
    document.documentElement.classList.toggle('light');
    localStorage.setItem('fsd_theme',
      document.documentElement.classList.contains('light') ? 'light' : 'dark');
  });
}

// ─── Global Search ───────────────────────────────────────────────────────────

/**
 * Registers a search handler so that loadHeaderFooter callers can supply
 * their FootballData instance without creating a circular dependency.
 * Call registerSearchHandler(fd) from your page entry point after
 * loadHeaderFooter() resolves.
 * @param {Object} fd - FootballData instance
 */
export function registerSearchHandler(fd) {
  _searchFd = fd;
}

let _searchFd = null;

function initSearch() {
  const input = qs('#search-input');
  const resultsBox = qs('#search-results');
  if (!input || !resultsBox) return;

  let debounceTimer;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const q = input.value.trim();
    if (q.length < 3) { resultsBox.innerHTML = ''; resultsBox.hidden = true; return; }

    debounceTimer = setTimeout(async () => {
      if (!_searchFd) { resultsBox.innerHTML = '<p class="search-no-results">Search not ready.</p>'; resultsBox.hidden = false; return; }
      try {
        const fd = _searchFd;
        const [teams, players] = await Promise.all([
          fd.searchTeams(q),
          fd.searchPlayers(q),
        ]);

        const teamSuggestions   = (teams?.response?.suggestions   ?? []).filter(s => s.type === 'team');
        const playerSuggestions = (players?.response?.suggestions ?? []).filter(s => s.type === 'player' && !s.isCoach);

        const teamItems = teamSuggestions.slice(0, 4).map(t => `
          <a class="search-result-item" href="/team/?id=${t.id}">
            <span>${t.name}</span>
            <small>${t.teamName ?? ''}</small>
          </a>`).join('');

        const playerItems = playerSuggestions.slice(0, 4).map(p => `
          <a class="search-result-item" href="/player/?id=${p.id}&name=${encodeURIComponent(p.name ?? '')}&teamName=${encodeURIComponent(p.teamName ?? '')}">
            <span>${p.name}</span>
            <small>${p.teamName ?? ''}</small>
          </a>`).join('');

        if (!teamItems && !playerItems) {
          resultsBox.innerHTML = '<p class="search-no-results">No results found.</p>';
        } else {
          resultsBox.innerHTML =
            (teamItems ? `<p class="search-group-label">Teams</p>${teamItems}` : '') +
            (playerItems ? `<p class="search-group-label">Players</p>${playerItems}` : '');
        }
        resultsBox.hidden = false;
      } catch {
        resultsBox.innerHTML = '<p class="search-no-results">Search failed.</p>';
        resultsBox.hidden = false;
      }
    }, 400);
  });

  document.addEventListener('click', e => {
    if (!resultsBox.contains(e.target) && e.target !== input) {
      resultsBox.hidden = true;
    }
  });
}

// ─── Active Nav Link ─────────────────────────────────────────────────────────

/**
 * Highlights the nav link that corresponds to the current page path.
 */
export function setActiveNavLink() {
  const links = qsa('nav a[data-page]');
  const path  = window.location.pathname;
  links.forEach(a => {
    a.classList.toggle('active', path.includes(a.dataset.page));
  });
}
