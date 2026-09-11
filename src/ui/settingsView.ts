import { h, clear } from './dom';
import { getAllMeta, clearHistory } from '../db';
import { fetchManifest, getDataVersion, importAll } from '../data';
import { loadMeta } from '../search';
import { showOnboarding } from './onboarding';
import { LANG_NAME, srcLang, dstLang } from '../types';
import type { PairMeta } from '../types';

const LANG_FLAG: Record<string, string> = { en: '🇬🇧', es: '🇪🇸', fr: '🇫🇷', cs: '🇨🇿' };
function pairTable(meta: PairMeta[]): HTMLElement {
  const table = h('table', { style: 'width:100%;border-collapse:collapse;font-size:13px;margin-top:8px' });
  const thead = h('tr', {},
    h('th', { style: 'text-align:left;padding:4px 0;color:var(--muted);font-weight:600' }, 'Direction'),
    h('th', { style: 'text-align:right;padding:4px 0;color:var(--muted);font-weight:600' }, 'Entries'),
    h('th', { style: 'text-align:right;padding:4px 0;color:var(--muted);font-weight:600' }, 'Size'),
  );
  table.append(thead);

  // seskup po zdrojovém jazyce
  const grouped = new Map<string, PairMeta[]>();
  for (const m of meta) {
    const sl = srcLang(m.pair);
    if (!grouped.has(sl)) grouped.set(sl, []);
    grouped.get(sl)!.push(m);
  }

  for (const [sl, pairs] of grouped) {
    const groupRow = h('tr', {},
      h('td', { colspan: '3', style: 'padding:8px 0 2px;font-weight:700;font-size:13px;border-top:1px solid var(--border)' },
        `${LANG_FLAG[sl]} ${LANG_NAME[sl as 'en'|'es'|'fr'|'cs']}`,
      ),
    );
    table.append(groupRow);
    for (const m of pairs) {
      const dl = dstLang(m.pair);
      table.append(h('tr', {},
        h('td', { style: 'padding:2px 0 2px 12px;color:var(--text)' },
          `${LANG_FLAG[sl]} → ${LANG_FLAG[dl]} ${LANG_NAME[dl as 'en'|'es'|'fr'|'cs']}`,
        ),
        h('td', { style: 'text-align:right;padding:2px 0;color:var(--text)' },
          m.count.toLocaleString('en'),
        ),
        h('td', { style: 'text-align:right;padding:2px 0 2px 10px;color:var(--muted)' },
          `${(m.bytes / 1e6).toFixed(1)} MB`,
        ),
      ));
    }
  }
  return table;
}

export async function renderSettings(main: HTMLElement): Promise<void> {
  const meta = await getAllMeta();
  const total = meta.reduce((a, m) => a + m.count, 0);
  const totalBytes = meta.reduce((a, m) => a + m.bytes, 0);
  const version = await getDataVersion();

  let manifest = await fetchManifest().catch(() => null);

  const updateStatus = h('p', {});
  clear(main).append(
    h('div', { class: 'sectionhead' }, h('h2', {}, 'Settings')),
    h('div', { class: 'settings' },

      // ---------- Data ----------
      h('section', {},
        h('h3', {}, '📚 Dictionary data'),
        h('div', { style: 'display:flex;gap:16px;flex-wrap:wrap;margin:8px 0' },
          h('div', {},
            h('div', { style: 'font-size:22px;font-weight:800;color:var(--accent)' }, total.toLocaleString('en')),
            h('div', { style: 'font-size:11px;color:var(--muted);margin-top:1px' }, 'total entries'),
          ),
          h('div', {},
            h('div', { style: 'font-size:22px;font-weight:800;color:var(--accent)' }, `${(totalBytes / 1e6).toFixed(1)} MB`),
            h('div', { style: 'font-size:11px;color:var(--muted);margin-top:1px' }, 'compressed on device'),
          ),
          h('div', {},
            h('div', { style: 'font-size:22px;font-weight:800;color:var(--accent)' }, version ?? '—'),
            h('div', { style: 'font-size:11px;color:var(--muted);margin-top:1px' }, 'data version'),
          ),
        ),
        meta.length ? pairTable(meta) : h('p', { style: 'color:var(--muted)' }, 'No data loaded yet.'),
        h('p', { style: 'margin-top:10px;font-size:12px;color:var(--muted)' },
          'EN→CS includes WordNet 3.1 explanatory entries (marked DEF) for words without a Czech translation. All data stored locally — fully offline.'),
        h('button', {
          class: 'btn', style: 'margin-top:8px',
          onclick: async (e: Event) => {
            const btn = e.target as HTMLButtonElement;
            btn.disabled = true;
            updateStatus.textContent = 'Checking…';
            try {
              manifest = await fetchManifest();
              if (manifest.version === version) {
                updateStatus.textContent = `Already up to date (${manifest.version}).`;
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
        updateStatus,
      ),

      // ---------- Sources ----------
      h('section', {},
        h('h3', {}, '🗂 Data sources'),
        h('table', { style: 'width:100%;border-collapse:collapse;font-size:13px' },
          h('tr', {},
            h('td', { style: 'padding:5px 0;font-weight:600' }, `${LANG_FLAG.en} English`),
            h('td', { style: 'padding:5px 0;color:var(--muted)' },
              h('a', { href: 'https://www.wikdict.com', target: '_blank', rel: 'noopener' }, 'WikDict'),
              ' · ',
              h('a', { href: 'https://www.svobodneslovniky.cz', target: '_blank', rel: 'noopener' }, 'Svobodné slovníky'),
              ' · ',
              h('a', { href: 'https://wordnet.princeton.edu', target: '_blank', rel: 'noopener' }, 'WordNet 3.1'),
            ),
          ),
          h('tr', {},
            h('td', { style: 'padding:5px 0;font-weight:600' }, `${LANG_FLAG.es} Spanish · ${LANG_FLAG.fr} French`),
            h('td', { style: 'padding:5px 0;color:var(--muted)' },
              h('a', { href: 'https://www.wikdict.com', target: '_blank', rel: 'noopener' }, 'WikDict'),
              ' (Wiktionary/DBnary)',
            ),
          ),
          h('tr', {},
            h('td', { style: 'padding:5px 0;padding-bottom:0;font-weight:600' }, `${LANG_FLAG.cs} Czech`),
            h('td', { style: 'padding:5px 0;padding-bottom:0;color:var(--muted)' },
              h('a', { href: 'https://www.wikdict.com', target: '_blank', rel: 'noopener' }, 'WikDict'),
              ' · ',
              h('a', { href: 'https://www.svobodneslovniky.cz', target: '_blank', rel: 'noopener' }, 'Svobodné slovníky'),
            ),
          ),
        ),
        h('p', { style: 'margin-top:10px;font-size:12px;color:var(--muted)' },
          'WikDict — CC BY-SA 4.0 · Svobodné slovníky — GNU FDL 1.1+ · WordNet — Princeton WordNet License'),
      ),

      // ---------- Privacy ----------
      h('section', {},
        h('h3', {}, '🗑 Privacy'),
        h('p', {}, 'Your history and favorites never leave your device.'),
        h('button', {
          class: 'btn danger',
          onclick: async (e: Event) => {
            await clearHistory();
            (e.target as HTMLElement).textContent = '✓ History cleared';
          },
        }, 'Clear search history'),
      ),

      // ---------- About ----------
      h('section', {},
        h('h3', {}, 'ℹ️ About'),
        h('p', {}, 'Sarfy Dict — an offline dictionary PWA. Install it via "Add to Home Screen" in your browser.'),
        h('p', {},
          h('a', { href: 'https://github.com/vrkuvrku/dict', target: '_blank', rel: 'noopener' }, 'Source code on GitHub')),
      ),
    ),
  );
}

export { importAll };
