// Prefixové hledání napříč páry: binární hledání v indexu chunků (meta.index),
// pak lineární scan seřazeného chunku.
import { getChunk, getAllMeta } from './db';
import { PAIRS, normalize, srcLang, dstLang } from './types';
import type { Entry, Lang, Pair, PairMeta } from './types';

export interface Result extends Entry { pair: Pair; exact: boolean }

let metaCache: Map<Pair, PairMeta> | null = null;

export async function loadMeta(force = false): Promise<Map<Pair, PairMeta>> {
  if (!metaCache || force) {
    metaCache = new Map((await getAllMeta()).map(m => [m.pair, m]));
  }
  return metaCache;
}

/** index posledního chunku s first <= q (chunky jsou seřazené dle first) */
function findStartChunk(index: string[], q: string): number {
  let lo = 0, hi = index.length - 1, ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (index[mid] <= q) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

const PER_PAIR_LIMIT = 40;

async function searchPair(pair: Pair, q: string): Promise<Result[]> {
  const meta = metaCache?.get(pair);
  if (!meta || !meta.index.length) return [];
  const qEnd = q + '￿';
  const results: Result[] = [];
  let idx = findStartChunk(meta.index, q);
  while (idx < meta.index.length && meta.index[idx] <= qEnd) {
    const chunk = await getChunk(pair, idx);
    if (!chunk) break;
    for (const e of chunk.entries) {
      const n = normalize(e.w);
      if (n > qEnd) return results;
      if (n.startsWith(q)) {
        results.push({ ...e, pair, exact: n === q });
        if (results.length >= PER_PAIR_LIMIT) return results;
      }
    }
    idx++;
  }
  return results;
}

export async function search(query: string, sourceLangs: Lang[] | null): Promise<Result[]> {
  const q = normalize(query.trim());
  if (!q) return [];
  await loadMeta();
  const pairs = PAIRS.filter(p => !sourceLangs || sourceLangs.includes(srcLang(p)));
  const perPair = await Promise.all(pairs.map(p => searchPair(p, q)));
  const all = perPair.flat();
  // překlady před čistě výkladovými záznamy (t=''), pak přesné shody, pak skóre
  all.sort((a, b) =>
    Number(!!b.t) - Number(!!a.t)
    || Number(b.exact) - Number(a.exact)
    || Number(dstLang(b.pair) === 'cs') - Number(dstLang(a.pair) === 'cs')
    || b.i - a.i
    || a.w.length - b.w.length
    || a.w.localeCompare(b.w));
  return all.slice(0, 80);
}
