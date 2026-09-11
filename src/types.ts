export type Lang = 'en' | 'es' | 'fr' | 'cs';
export const LANGS: Lang[] = ['en', 'es', 'fr', 'cs'];
export const PAIRS = [
  'en-cs', 'cs-en', 'en-es', 'es-en', 'en-fr', 'fr-en',
  'es-cs', 'cs-es', 'fr-cs', 'cs-fr', 'es-fr', 'fr-es',
] as const;
export type Pair = (typeof PAIRS)[number];

/** Jedno heslo: word, pos, sense (gloss), trans, importance */
export interface Entry { w: string; p: string; s: string; t: string; i: number }

export interface Chunk { pair: Pair; idx: number; first: string; entries: Entry[] }
export interface PairMeta { pair: Pair; version: string; count: number; index: string[] }

export interface HistoryItem { id?: number; word: string; pair: Pair; trans: string; ts: number }
export interface FavItem { id: string; word: string; pair: Pair; trans: string; ts: number }
export interface CardItem { id: string; word: string; pair: Pair; trans: string; box: number; due: number }

export interface DataManifest { version: string; pairs: Record<string, { count: number; bytes: number }> }

export const srcLang = (p: Pair): Lang => p.slice(0, 2) as Lang;
export const dstLang = (p: Pair): Lang => p.slice(3, 5) as Lang;

export const LANG_NAME: Record<Lang, string> = { en: 'angličtina', es: 'španělština', fr: 'francouzština', cs: 'čeština' };
export const TTS_LANG: Record<Lang, string> = { en: 'en-US', es: 'es-ES', fr: 'fr-FR', cs: 'cs-CZ' };

export const normalize = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
