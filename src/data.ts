// Stažení a import slovníkových dat do IndexedDB (onboarding + aktualizace).
import { saveDictionary, getAllMeta, kvGet, kvSet } from './db';
import { PAIRS, normalize } from './types';
import type { Chunk, Entry, Pair, PairMeta, DataManifest } from './types';

const CHUNK_SIZE = 2000;
const BASE = import.meta.env.BASE_URL + 'data/';

export async function fetchManifest(): Promise<DataManifest> {
  const res = await fetch(BASE + 'manifest.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`manifest: HTTP ${res.status}`);
  return res.json();
}

/** true pokud jsou naimportované všechny páry */
export async function isDataReady(): Promise<boolean> {
  const meta = await getAllMeta();
  return PAIRS.every(p => meta.some(m => m.pair === p && m.count > 0));
}

export const getDataVersion = (): Promise<string | undefined> => kvGet<string>('dataVersion');

export type Progress = { pair: Pair; pairIdx: number; pairCount: number; phase: 'download' | 'import' };

async function importPair(pair: Pair, manifest: DataManifest, onProgress: (p: Progress) => void, pairIdx: number): Promise<void> {
  const version = manifest.version;
  onProgress({ pair, pairIdx, pairCount: PAIRS.length, phase: 'download' });
  const res = await fetch(`${BASE}${pair}.tsv.gz`, { cache: 'no-cache' });
  if (!res.ok || !res.body) throw new Error(`${pair}: HTTP ${res.status}`);
  const stream = res.body.pipeThrough(new DecompressionStream('gzip'));
  const text = await new Response(stream).text();

  onProgress({ pair, pairIdx, pairCount: PAIRS.length, phase: 'import' });
  const entries: Entry[] = [];
  for (const line of text.split('\n')) {
    if (!line) continue;
    const f = line.split('\t');
    entries.push({ w: f[0], p: f[1] ?? '', s: f[2] ?? '', t: f[3] ?? '', i: +(f[4] || 0) });
  }
  const chunks: Chunk[] = [];
  const index: string[] = [];
  for (let i = 0; i * CHUNK_SIZE < entries.length; i++) {
    const slice = entries.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    index.push(normalize(slice[0].w));
    chunks.push({ pair, idx: i, first: index[i], entries: slice });
  }
  const bytes = manifest.pairs[pair]?.bytes ?? 0;
  const meta: PairMeta = { pair, version, count: entries.length, bytes, index };
  await saveDictionary(meta, chunks);
}

export async function importAll(onProgress: (p: Progress) => void): Promise<void> {
  const manifest = await fetchManifest();
  for (let i = 0; i < PAIRS.length; i++) {
    await importPair(PAIRS[i], manifest, onProgress, i);
  }
  await kvSet('dataVersion', manifest.version);
}
