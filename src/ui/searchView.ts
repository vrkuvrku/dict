import { h, clear } from './dom';
import { search } from '../search';
import type { Result } from '../search';
import { addHistory, toggleFav, getFavIds, favId } from '../db';
import { speak } from '../tts';
import { srcLang, dstLang, LANGS } from '../types';
import type { Lang } from '../types';

let container: HTMLElement;
let input: HTMLInputElement;
let clearBtn: HTMLElement;
let activeLang: Lang | null = null;
let debounceTimer = 0;
let lastQuery = '';
let selectedIdx = -1;
let favIds = new Set<string>();
const loggedThisSession = new Set<string>();

export function initSearchView(main: HTMLElement, header: HTMLElement): void {
  container = main;
  input = header.querySelector('#q')!;
  clearBtn = header.querySelector('#clearq')!;

  input.addEventListener('input', () => {
    clearBtn.style.display = input.value ? 'block' : 'none';
    clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => runSearch(), 120);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const cards = container.querySelectorAll<HTMLElement>('.card');
      (cards[Math.max(selectedIdx, 0)])?.click();
      input.blur();
    }
  });
  clearBtn.addEventListener('click', () => {
    input.value = '';
    clearBtn.style.display = 'none';
    input.focus();
    runSearch();
  });

  const chips = header.querySelectorAll<HTMLElement>('.chip');
  chips.forEach(chip => chip.addEventListener('click', () => {
    chips.forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    activeLang = (chip.dataset.lang as Lang) || null;
    runSearch();
  }));
}

export async function runSearch(expandWord?: { pair: string; word: string }): Promise<void> {
  const q = input.value;
  lastQuery = q;
  selectedIdx = -1;
  if (!q.trim()) {
    clear(container).append(
      h('div', { class: 'hint' },
        h('div', { class: 'big' }, '💬'),
        h('div', {}, 'Type a word in any language'),
        h('div', { style: 'font-size:13px;margin-top:6px' }, 'English · Spanish · French · Czech')),
    );
    return;
  }
  const [results] = await Promise.all([
    search(q, activeLang ? [activeLang] : LANGS),
    getFavIds().then(ids => { favIds = ids; }),
  ]);
  if (input.value !== lastQuery) return; // mezitím se psalo dál
  clear(container);
  if (!results.length) {
    container.append(h('div', { class: 'hint' }, h('div', { class: 'big' }, '🤷'), `Nothing for “${q.trim()}”`));
    return;
  }
  // zaloguj do historie nejlepší výsledek hned po vyhledání (ne až po kliknutí)
  const top = results[0];
  const logKey = `${top.pair}|${top.w}`;
  if (!loggedThisSession.has(logKey)) {
    loggedThisSession.add(logKey);
    addHistory({ word: top.w, pair: top.pair, trans: top.t, ts: Date.now() });
  }
  for (const r of results) container.append(renderCard(r, expandWord));
}

function renderCard(r: Result, expandWord?: { pair: string; word: string }): HTMLElement {
  const id = favId(r.pair, r.w, r.t);
  const sl = srcLang(r.pair), dl = dstLang(r.pair);
  const star = h('button', {
    class: `iconbtn ${favIds.has(id) ? 'faved' : ''}`,
    title: 'Favorite',
    onclick: async (e: Event) => {
      e.stopPropagation();
      const on = await toggleFav({ id, word: r.w, pair: r.pair, trans: r.t });
      star.textContent = on ? '★' : '☆';
      star.classList.toggle('faved', on);
    },
  }, favIds.has(id) ? '★' : '☆');

  const card = h('div', { class: 'card' },
    h('div', { class: 'row1' },
      h('span', { class: 'word' }, r.w),
      r.p ? h('span', { class: 'pos' }, r.p) : null,
      h('span', { class: 'spacer' }),
      h('span', { class: `badge b-${sl}` }, sl.toUpperCase()),
      h('span', { style: 'color:var(--muted);font-size:11px' }, '→'),
      h('span', { class: `badge b-${dl}` }, dl.toUpperCase()),
      star,
      h('button', {
        class: 'iconbtn', title: 'Pronounce',
        onclick: (e: Event) => { e.stopPropagation(); speak(r.w, sl); },
      }, '🔊'),
    ),
    h('div', { class: 'trans' }, r.t),
    r.s ? h('div', { class: 'sense' }, r.s) : null,
    h('div', { class: 'actions' },
      h('button', {
        onclick: (e: Event) => { e.stopPropagation(); speak(r.t.split('|')[0], dl); },
      }, '🔊 translation'),
      h('button', {
        onclick: async (e: Event) => {
          e.stopPropagation();
          const url = `${location.origin}${location.pathname}#w/${r.pair}/${encodeURIComponent(r.w)}`;
          if (navigator.share) await navigator.share({ title: `${r.w} — Dict`, url }).catch(() => {});
          else { await navigator.clipboard.writeText(url); (e.target as HTMLElement).textContent = '✓ copied'; }
        },
      }, '↗ share'),
    ),
  );
  card.addEventListener('click', () => {
    card.classList.toggle('expanded');
    if (card.classList.contains('expanded')) {
      history.replaceState(null, '', `#w/${r.pair}/${encodeURIComponent(r.w)}`);
    }
  });
  if (expandWord && r.pair === expandWord.pair && r.w === expandWord.word) {
    card.classList.add('expanded');
  }
  return card;
}

/** naviguj šipkami po výsledcích */
export function moveSelection(delta: number): void {
  const cards = [...container.querySelectorAll<HTMLElement>('.card')];
  if (!cards.length) return;
  selectedIdx = Math.max(0, Math.min(cards.length - 1, selectedIdx + delta));
  cards.forEach((c, i) => c.classList.toggle('selected', i === selectedIdx));
  cards[selectedIdx].scrollIntoView({ block: 'nearest' });
}

export function activateSelection(): void {
  const cards = container.querySelectorAll<HTMLElement>('.card');
  if (selectedIdx >= 0) cards[selectedIdx]?.click();
}

export function setQuery(q: string, expandWord?: { pair: string; word: string }): void {
  input.value = q;
  clearBtn.style.display = q ? 'block' : 'none';
  runSearch(expandWord);
}

export const focusSearch = (): void => input.focus();
