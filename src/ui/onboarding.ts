import { h } from './dom';
import { importAll } from '../data';
import { PAIRS, LANG_NAME, srcLang, dstLang } from '../types';

/** Fullscreen obrazovka se stahováním dat. Resolvne po úspěšném importu. */
export function showOnboarding(isUpdate = false): Promise<void> {
  return new Promise((resolve) => {
    const bar = h('div', {});
    const status = h('div', { class: 'status' }, 'Preparing…');
    const overlay = h('div', { class: 'onboarding' },
      h('img', { src: import.meta.env.BASE_URL + 'icons/icon-192.png', alt: 'Dict' }),
      h('h1', {}, isUpdate ? 'Updating dictionaries' : 'Welcome to Dict'),
      h('p', {}, isUpdate
        ? 'Downloading a new version of the dictionary data.'
        : 'A dictionary for English, Spanish, French and Czech. It downloads ~21 MB of data once, then works fully offline.'),
      h('div', { class: 'progress' }, bar),
      status,
    );
    document.body.append(overlay);

    const run = () => importAll(({ pair, pairIdx, pairCount, phase }) => {
      const frac = (pairIdx + (phase === 'import' ? 0.7 : 0.15)) / pairCount;
      bar.style.width = `${Math.round(frac * 100)}%`;
      status.textContent = `${LANG_NAME[srcLang(pair)]} → ${LANG_NAME[dstLang(pair)]} (${pairIdx + 1}/${PAIRS.length})`;
    }).then(() => {
      bar.style.width = '100%';
      overlay.remove();
      resolve();
    }).catch((err) => {
      status.textContent = `Download failed (${err?.message ?? 'network error'}).`;
      const retry = h('button', { class: 'btn', onclick: () => { retry.remove(); run(); } }, 'Try again');
      overlay.append(retry);
    });
    run();
  });
}
