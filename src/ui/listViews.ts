// Historie + Oblíbené — dva podobné seznamy
import { h, clear, relTime } from './dom';
import { getHistory, clearHistory, getFavs, toggleFav } from '../db';
import { srcLang } from '../types';
import type { Pair } from '../types';

export type OpenWord = (word: string, pair: Pair) => void;

function itemRow(word: string, pair: Pair, trans: string, right: Node, onOpen: () => void): HTMLElement {
  const sl = srcLang(pair);
  return h('div', { class: 'listitem', onclick: onOpen },
    h('span', { class: `badge b-${sl}` }, sl.toUpperCase()),
    h('span', { class: 'word' }, word),
    h('span', { class: 'trans' }, trans),
    right,
  );
}

export async function renderHistory(main: HTMLElement, openWord: OpenWord): Promise<void> {
  const items = await getHistory();
  clear(main).append(
    h('div', { class: 'sectionhead' },
      h('h2', {}, 'History'),
      items.length ? h('button', {
        onclick: async () => { await clearHistory(); renderHistory(main, openWord); },
      }, 'Clear all') : null),
  );
  if (!items.length) {
    main.append(h('div', { class: 'hint' }, h('div', { class: 'big' }, '🕘'), 'No searches yet'));
    return;
  }
  for (const it of items) {
    main.append(itemRow(it.word, it.pair, it.trans,
      h('span', { class: 'time' }, relTime(it.ts)),
      () => openWord(it.word, it.pair)));
  }
}

export async function renderFavs(main: HTMLElement, openWord: OpenWord): Promise<void> {
  const items = await getFavs();
  clear(main).append(h('div', { class: 'sectionhead' }, h('h2', {}, 'Favorite words')));
  if (!items.length) {
    main.append(h('div', { class: 'hint' }, h('div', { class: 'big' }, '⭐'),
      'Star a search result to save it here', h('br'), 'and practice it as a flashcard'));
    return;
  }
  for (const it of items) {
    const unfav = h('button', {
      class: 'iconbtn faved', style: 'margin-left:auto', title: 'Remove',
      onclick: async (e: Event) => {
        e.stopPropagation();
        await toggleFav({ id: it.id, word: it.word, pair: it.pair, trans: it.trans });
        renderFavs(main, openWord);
      },
    }, '★');
    main.append(itemRow(it.word, it.pair, it.trans, unfav, () => openWord(it.word, it.pair)));
  }
}
