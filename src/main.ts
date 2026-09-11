import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { h, clear } from './ui/dom';
import { isDataReady } from './data';
import { loadMeta } from './search';
import { showOnboarding } from './ui/onboarding';
import { initSearchView, runSearch, setQuery, focusSearch, moveSelection, activateSelection } from './ui/searchView';
import { renderHistory, renderFavs } from './ui/listViews';
import { renderPractice } from './ui/practiceView';
import { renderSettings } from './ui/settingsView';
import { PAIRS } from './types';
import type { Pair } from './types';

registerSW({ immediate: true });

type Tab = 'search' | 'history' | 'favs' | 'practice' | 'settings';
const TABS: { id: Tab; ico: string; label: string; hash: string }[] = [
  { id: 'search', ico: '🔍', label: 'Hledat', hash: '' },
  { id: 'history', ico: '🕘', label: 'Historie', hash: 'h' },
  { id: 'favs', ico: '⭐', label: 'Oblíbené', hash: 'f' },
  { id: 'practice', ico: '🃏', label: 'Procvičit', hash: 'p' },
  { id: 'settings', ico: '⚙️', label: 'Nastavení', hash: 's' },
];

const app = document.getElementById('app')!;
let header: HTMLElement;
let main: HTMLElement;
let nav: HTMLElement;
let currentTab: Tab = 'search';

function buildLayout(): void {
  header = h('header', { class: 'top' },
    h('div', { class: 'searchrow' },
      h('div', { class: 'searchbox' },
        svgSearch(),
        h('input', { id: 'q', type: 'search', placeholder: 'Hledat slovo…', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' }),
        h('button', { id: 'clearq', title: 'Vymazat' }, '✕')),
      h('span', { class: 'offline-badge' }, 'offline')),
    h('div', { class: 'chips' },
      h('button', { class: 'chip active' }, 'Vše'),
      h('button', { class: 'chip', 'data-lang': 'en' }, 'EN'),
      h('button', { class: 'chip', 'data-lang': 'es' }, 'ES'),
      h('button', { class: 'chip', 'data-lang': 'fr' }, 'FR'),
      h('button', { class: 'chip', 'data-lang': 'cs' }, 'CS')),
  );
  main = h('main', {});
  nav = h('nav', { class: 'tabs' },
    ...TABS.map(t => h('button', { 'data-tab': t.id, onclick: () => switchTab(t.id, true) },
      h('span', { class: 'ico' }, t.ico), t.label)),
  );
  app.append(header, main, nav);
}

function svgSearch(): SVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '18'); svg.setAttribute('height', '18');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', 'M21 21l-4.6-4.6m1.6-5.4a7 7 0 11-14 0 7 7 0 0114 0z');
  p.setAttribute('stroke', 'currentColor'); p.setAttribute('stroke-width', '2'); p.setAttribute('stroke-linecap', 'round');
  svg.append(p);
  return svg;
}

function switchTab(tab: Tab, pushHash = false): void {
  currentTab = tab;
  header.style.display = tab === 'search' ? '' : 'none';
  nav.querySelectorAll<HTMLElement>('button').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab));
  if (pushHash) {
    const t = TABS.find(t => t.id === tab)!;
    if (('#' + t.hash) !== location.hash && !(t.hash === '' && !location.hash)) {
      history.pushState(null, '', t.hash ? '#' + t.hash : location.pathname);
    }
  }
  const openWord = (word: string, pair: Pair) => {
    switchTab('search', true);
    setQuery(word, { pair, word });
  };
  clear(main);
  if (tab === 'search') runSearch();
  else if (tab === 'history') renderHistory(main, openWord);
  else if (tab === 'favs') renderFavs(main, openWord);
  else if (tab === 'practice') renderPractice(main);
  else renderSettings(main);
}

function route(): void {
  const hash = location.hash.slice(1);
  if (hash.startsWith('w/')) {
    const [, pair, word] = hash.split('/');
    if (PAIRS.includes(pair as Pair) && word) {
      switchTab('search');
      setQuery(decodeURIComponent(word), { pair, word: decodeURIComponent(word) });
      return;
    }
  }
  const tab = TABS.find(t => t.hash === hash)?.id ?? 'search';
  switchTab(tab);
}

function setupKeyboard(): void {
  document.addEventListener('keydown', (e) => {
    const inInput = (e.target as HTMLElement).tagName === 'INPUT';
    if (e.key === '/' && !inInput) { e.preventDefault(); switchTab('search', true); focusSearch(); }
    else if (e.key === 'Escape' && inInput) (e.target as HTMLElement).blur();
    else if (e.key === 'ArrowDown' && currentTab === 'search') { e.preventDefault(); moveSelection(1); }
    else if (e.key === 'ArrowUp' && currentTab === 'search') { e.preventDefault(); moveSelection(-1); }
    else if (e.key === 'Enter' && currentTab === 'search' && !inInput) activateSelection();
  });
}

function setupOffline(): void {
  const update = () => document.body.classList.toggle('offline', !navigator.onLine);
  addEventListener('online', update);
  addEventListener('offline', update);
  update();
}

async function start(): Promise<void> {
  buildLayout();
  setupOffline();
  if (!(await isDataReady())) {
    await showOnboarding();
  }
  await loadMeta();
  initSearchView(main, header);
  setupKeyboard();
  addEventListener('hashchange', route);
  route();
  if (currentTab === 'search' && matchMedia('(min-width: 700px)').matches) focusSearch();
}

start();
