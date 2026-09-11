// Flashcards s jednoduchým Leitnerem (3 krabičky)
import { h, clear } from './dom';
import { getDueCards, getCards, answerCard } from '../db';
import { speak } from '../tts';
import { srcLang } from '../types';
import type { CardItem } from '../types';

export async function renderPractice(main: HTMLElement): Promise<void> {
  const due = await getDueCards();
  clear(main).append(h('div', { class: 'sectionhead' }, h('h2', {}, 'Practice')));
  if (!due.length) {
    const all = await getCards();
    const next = all.length ? Math.min(...all.map(c => c.due)) : 0;
    const nextTxt = all.length
      ? `Next card ${next <= Date.now() ? 'now' : 'in ' + Math.ceil((next - Date.now()) / 3600e3) + ' h'}.`
      : 'Star words in search results to add them.';
    main.append(h('div', { class: 'hint' },
      h('div', { class: 'big' }, all.length ? '🎉' : '🃏'),
      all.length ? 'All done!' : 'No flashcards yet',
      h('div', { style: 'font-size:13px;margin-top:8px' }, nextTxt)));
    return;
  }
  showCard(main, due, 0, due.length);
}

function showCard(main: HTMLElement, queue: CardItem[], done: number, total: number): void {
  const card = queue[0];
  if (!card) { renderPractice(main); return; }
  const sl = srcLang(card.pair);

  const transEl = h('div', { class: 'trans', style: 'display:none' }, card.trans);
  const revealBtn = h('button', { class: 'pbtn', onclick: () => reveal() }, 'Show translation');
  const answerBtns = h('div', { style: 'display:none' },
    h('button', { class: 'pbtn no', onclick: () => answer(false) }, '✗ Didn’t know'),
    h('button', { class: 'pbtn yes', onclick: () => answer(true) }, '✓ Knew it'),
  );

  function reveal(): void {
    transEl.style.display = 'block';
    revealBtn.style.display = 'none';
    answerBtns.style.display = 'block';
  }
  async function answer(correct: boolean): Promise<void> {
    await answerCard(card, correct);
    showCard(main, queue.slice(1), done + 1, total);
  }

  clear(main).append(
    h('div', { class: 'sectionhead' }, h('h2', {}, 'Practice'),
      h('span', { style: 'color:var(--muted);font-size:14px' }, `${done + 1} / ${total}`)),
    h('div', { class: 'practice' },
      h('div', { class: 'flashcard' },
        h('div', { class: 'row1', style: 'justify-content:center;display:flex;gap:8px;align-items:center' },
          h('span', { class: `badge b-${sl}` }, sl.toUpperCase()),
          h('button', { class: 'iconbtn', onclick: () => speak(card.word, sl) }, '🔊')),
        h('div', { class: 'word', style: 'margin-top:10px' }, card.word),
        transEl),
      revealBtn, answerBtns,
      h('div', { class: 'stats' }, `box ${card.box} of 3`)),
  );
}
