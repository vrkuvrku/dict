import type { Chunk, PairMeta, HistoryItem, FavItem, CardItem, Pair } from './types';

const DB_NAME = 'dict';
const DB_VER = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('chunks', { keyPath: ['pair', 'idx'] });
      db.createObjectStore('meta', { keyPath: 'pair' });
      const hist = db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
      hist.createIndex('ts', 'ts');
      db.createObjectStore('favs', { keyPath: 'id' });
      db.createObjectStore('cards', { keyPath: 'id' });
      db.createObjectStore('kv', { keyPath: 'k' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function reqAsync<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function getAll<T>(store: string): Promise<T[]> {
  const db = await openDB();
  return reqAsync(db.transaction(store).objectStore(store).getAll());
}

async function get<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDB();
  return reqAsync(db.transaction(store).objectStore(store).get(key));
}

async function put(store: string, value: unknown): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).put(value);
  return txDone(tx);
}

async function del(store: string, key: IDBValidKey): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).delete(key);
  return txDone(tx);
}

// --- slovníková data ---

const chunkCache = new Map<string, Chunk>();
const CHUNK_CACHE_MAX = 60;

export async function getChunk(pair: Pair, idx: number): Promise<Chunk | undefined> {
  const key = `${pair}:${idx}`;
  const cached = chunkCache.get(key);
  if (cached) {
    chunkCache.delete(key);
    chunkCache.set(key, cached); // LRU refresh
    return cached;
  }
  const chunk = await get<Chunk>('chunks', [pair, idx]);
  if (chunk) {
    chunkCache.set(key, chunk);
    if (chunkCache.size > CHUNK_CACHE_MAX) {
      const oldest = chunkCache.keys().next().value!;
      chunkCache.delete(oldest);
    }
  }
  return chunk;
}

export async function saveDictionary(meta: PairMeta, chunks: Chunk[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(['chunks', 'meta'], 'readwrite');
  const cs = tx.objectStore('chunks');
  // smaž staré chunky páru (při aktualizaci dat)
  cs.delete(IDBKeyRange.bound([meta.pair, 0], [meta.pair, Infinity]));
  for (const c of chunks) cs.put(c);
  tx.objectStore('meta').put(meta);
  chunkCache.clear();
  return txDone(tx);
}

export const getAllMeta = (): Promise<PairMeta[]> => getAll<PairMeta>('meta');

// --- historie ---

export async function addHistory(item: Omit<HistoryItem, 'id'>): Promise<number> {
  const db = await openDB();
  const tx = db.transaction('history', 'readwrite');
  const store = tx.objectStore('history');
  const id = await reqAsync(store.add(item)) as number;
  // drž max ~500 položek
  const count = await reqAsync(store.count());
  if (count > 500) {
    const cursor = await reqAsync(store.index('ts').openCursor());
    if (cursor) cursor.delete();
  }
  await txDone(tx);
  return id;
}

export async function deleteHistory(id: number): Promise<void> {
  return del('history', id);
}

export async function getHistory(limit = 200): Promise<HistoryItem[]> {
  const db = await openDB();
  const items: HistoryItem[] = [];
  const tx = db.transaction('history');
  return new Promise((resolve, reject) => {
    const req = tx.objectStore('history').index('ts').openCursor(null, 'prev');
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor && items.length < limit) { items.push(cursor.value); cursor.continue(); }
      else resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function clearHistory(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('history', 'readwrite');
  tx.objectStore('history').clear();
  return txDone(tx);
}

// --- oblíbené + kartičky ---

export const favId = (pair: Pair, word: string, trans: string) => `${pair}|${word}|${trans}`;

export async function toggleFav(item: Omit<FavItem, 'ts'>): Promise<boolean> {
  const existing = await get<FavItem>('favs', item.id);
  if (existing) {
    await del('favs', item.id);
    await del('cards', item.id);
    return false;
  }
  await put('favs', { ...item, ts: Date.now() });
  const card: CardItem = { id: item.id, word: item.word, pair: item.pair, trans: item.trans, box: 1, due: Date.now() };
  await put('cards', card);
  return true;
}

export const getFavs = async (): Promise<FavItem[]> =>
  (await getAll<FavItem>('favs')).sort((a, b) => b.ts - a.ts);

export async function getFavIds(): Promise<Set<string>> {
  return new Set((await getAll<FavItem>('favs')).map(f => f.id));
}

// --- procvičování (Leitner, 3 krabičky) ---

const BOX_INTERVALS = [0, 10 * 60e3, 24 * 3600e3, 4 * 24 * 3600e3]; // index = box

export const getCards = (): Promise<CardItem[]> => getAll<CardItem>('cards');

export async function getDueCards(): Promise<CardItem[]> {
  const now = Date.now();
  return (await getCards()).filter(c => c.due <= now).sort(() => Math.random() - 0.5);
}

export async function answerCard(card: CardItem, correct: boolean): Promise<void> {
  const box = correct ? Math.min(card.box + 1, 3) : 1;
  await put('cards', { ...card, box, due: Date.now() + BOX_INTERVALS[box] });
}

// --- kv ---

export async function kvGet<T>(k: string): Promise<T | undefined> {
  return (await get<{ k: string; v: T }>('kv', k))?.v;
}
export const kvSet = (k: string, v: unknown): Promise<void> => put('kv', { k, v });
