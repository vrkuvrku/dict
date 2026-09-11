import { h, clear } from './dom';
import { getAllMeta, clearHistory } from '../db';
import { fetchManifest, getDataVersion, importAll } from '../data';
import { loadMeta } from '../search';
import { showOnboarding } from './onboarding';

export async function renderSettings(main: HTMLElement): Promise<void> {
  const meta = await getAllMeta();
  const total = meta.reduce((a, m) => a + m.count, 0);
  const version = await getDataVersion();

  const updateStatus = h('p', {});
  clear(main).append(
    h('div', { class: 'sectionhead' }, h('h2', {}, 'Settings')),
    h('div', { class: 'settings' },
      h('section', {},
        h('h3', {}, '📚 Dictionary data'),
        h('p', {}, `${total.toLocaleString('en')} entries in 12 directions (EN·ES·FR·CS), version ${version ?? '—'}. Everything is stored on your device — works offline.`),
        h('button', {
          class: 'btn',
          onclick: async (e: Event) => {
            const btn = e.target as HTMLButtonElement;
            btn.disabled = true;
            updateStatus.textContent = 'Checking…';
            try {
              const manifest = await fetchManifest();
              if (manifest.version === version) {
                updateStatus.textContent = `Data is up to date (${manifest.version}).`;
              } else {
                await showOnboarding(true);
                await loadMeta(true);
                renderSettings(main);
                return;
              }
            } catch {
              updateStatus.textContent = 'Check failed — are you online?';
            }
            btn.disabled = false;
          },
        }, 'Check for updates'),
        updateStatus),
      h('section', {},
        h('h3', {}, '🗑 Privacy'),
        h('p', {}, 'Your history and favorite words never leave your device.'),
        h('button', {
          class: 'btn danger',
          onclick: async (e: Event) => {
            await clearHistory();
            (e.target as HTMLElement).textContent = '✓ History cleared';
          },
        }, 'Clear search history')),
      h('section', {},
        h('h3', {}, 'ℹ️ About & data licenses'),
        h('p', {}, 'Sarfy Dict — an offline dictionary PWA. Install it via “Add to Home Screen” in your browser.'),
        h('p', {},
          'Dictionary data: ',
          h('a', { href: 'https://www.wikdict.com', target: '_blank', rel: 'noopener' }, 'WikDict'),
          ' (CC BY-SA 4.0, data from Wiktionary/DBnary) and ',
          h('a', { href: 'https://www.svobodneslovniky.cz', target: '_blank', rel: 'noopener' }, 'Svobodné slovníky'),
          ' (GNU FDL 1.1+, “Based on the free English-Czech dictionary”).'),
        h('p', {},
          h('a', { href: 'https://github.com/vrkuvrku/dict', target: '_blank', rel: 'noopener' }, 'Source code on GitHub'))),
    ),
  );
}

export { importAll };
