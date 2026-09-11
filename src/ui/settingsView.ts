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
    h('div', { class: 'sectionhead' }, h('h2', {}, 'Nastavení')),
    h('div', { class: 'settings' },
      h('section', {},
        h('h3', {}, '📚 Slovníková data'),
        h('p', {}, `${total.toLocaleString('cs')} hesel ve 12 směrech (EN·ES·FR·CS), verze ${version ?? '—'}. Vše uloženo v zařízení — funguje offline.`),
        h('button', {
          class: 'btn',
          onclick: async (e: Event) => {
            const btn = e.target as HTMLButtonElement;
            btn.disabled = true;
            updateStatus.textContent = 'Kontroluji…';
            try {
              const manifest = await fetchManifest();
              if (manifest.version === version) {
                updateStatus.textContent = `Data jsou aktuální (${manifest.version}).`;
              } else {
                await showOnboarding(true);
                await loadMeta(true);
                renderSettings(main);
                return;
              }
            } catch {
              updateStatus.textContent = 'Kontrola se nezdařila — jsi online?';
            }
            btn.disabled = false;
          },
        }, 'Zkontrolovat aktualizace'),
        updateStatus),
      h('section', {},
        h('h3', {}, '🗑 Soukromí'),
        h('p', {}, 'Historie i oblíbená slova zůstávají jen ve tvém zařízení.'),
        h('button', {
          class: 'btn danger',
          onclick: async (e: Event) => {
            await clearHistory();
            (e.target as HTMLElement).textContent = '✓ Historie smazána';
          },
        }, 'Smazat historii hledání')),
      h('section', {},
        h('h3', {}, 'ℹ️ O aplikaci a licence dat'),
        h('p', {}, 'Dict — offline slovník jako PWA. Nainstaluj si ji: v prohlížeči zvol „Přidat na plochu".'),
        h('p', {},
          'Slovníková data: ',
          h('a', { href: 'https://www.wikdict.com', target: '_blank', rel: 'noopener' }, 'WikDict'),
          ' (CC BY-SA 4.0, data z Wiktionary/DBnary) a ',
          h('a', { href: 'https://www.svobodneslovniky.cz', target: '_blank', rel: 'noopener' }, 'Svobodné slovníky'),
          ' (GNU FDL 1.1+, „Založeno na svobodném anglicko-českém slovníku").'),
        h('p', {},
          h('a', { href: 'https://github.com/vrkuvrku/dict', target: '_blank', rel: 'noopener' }, 'Zdrojový kód na GitHubu'))),
    ),
  );
}

export { importAll };
