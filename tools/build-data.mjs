// Generuje public/data/{pair}.tsv.gz + manifest.json.
// Vstup: data/raw/*.sqlite3, data/raw/en-cs.txt.gz, data/raw/dict/ (WordNet 3.1)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';

const RAW = new URL('../data/raw/', import.meta.url).pathname;
const OUT = new URL('../public/data/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const PAIRS = ['en-cs', 'cs-en', 'es-cs', 'cs-es', 'fr-cs', 'cs-fr'];

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const clean = (s) => (s ?? '').replace(/[\t\n\r]+/g, ' ').trim();

const POS_MAP = {
  noun: 'n', propernoun: 'n', nom: 'n', sustantivo: 'n', substantivo: 'n', podstatnejmeno: 'n',
  verb: 'v', verbe: 'v', verbo: 'v', sloveso: 'v',
  adjective: 'adj', adjectif: 'adj', adjetivo: 'adj', pridavnejmeno: 'adj',
  adverb: 'adv', adverbe: 'adv', adverbio: 'adv', prislovce: 'adv',
  pronoun: 'pron', pronom: 'pron', pronombre: 'pron', zajmeno: 'pron',
  preposition: 'prep', preposicion: 'prep',
  interjection: 'interj', interjeccion: 'interj', citoslovce: 'interj',
  conjunction: 'conj', conjonction: 'conj', conjuncion: 'conj', spojka: 'conj',
  numeral: 'num', number: 'num', cislovka: 'num', particle: 'part',
};
function posFromLexentry(lexentry) {
  const m = /__([^_]+(?:_[^_]+)*)__\d+$/.exec(lexentry || '');
  if (!m) return '';
  const whole = norm(m[1]).replace(/[^a-z]/g, '');
  const first = norm(m[1].split('_')[0]).replace(/[^a-z]/g, '');
  return POS_MAP[whole] ?? POS_MAP[first] ?? first.slice(0, 6);
}

// ---- WordNet 3.1 ----
function loadWordNet() {
  const posFiles = { n: 'noun', v: 'verb', adj: 'adj', adv: 'adv' };
  // synset_offset → definition (first sentence, without quoted examples)
  const synsets = new Map();
  for (const [abbr, name] of Object.entries(posFiles)) {
    const lines = readFileSync(`${RAW}dict/data.${name}`, 'utf8').split('\n');
    for (const line of lines) {
      if (line.startsWith('  ') || !line.trim()) continue;
      const bar = line.indexOf(' | ');
      if (bar < 0) continue;
      const offset = line.slice(0, 8);
      let gloss = line.slice(bar + 3).trim();
      // odstraň příklady v uvozovkách ale zachovej definici
      gloss = gloss.replace(/;\s*"[^"]*"/g, '').replace(/\s+/g, ' ').trim();
      synsets.set(`${abbr}:${offset}`, gloss);
    }
  }
  // lemma → [{pos, definitions[]}]
  const words = new Map();
  for (const [abbr, name] of Object.entries(posFiles)) {
    const posLabel = { n: 'n', v: 'v', adj: 'adj', adv: 'adv' }[abbr];
    const lines = readFileSync(`${RAW}dict/index.${name}`, 'utf8').split('\n');
    for (const line of lines) {
      if (line.startsWith('  ') || !line.trim()) continue;
      const parts = line.trim().split(' ');
      const lemma = parts[0].replace(/_/g, ' ');
      // offsets začínají po: lemma pos synset_cnt p_cnt [ptrs] sense_cnt tagsense_cnt offsets
      const pCnt = parseInt(parts[3]);
      const offsetStart = 4 + pCnt + 2; // přeskoč ptr symbols + sense_cnt + tagsense_cnt
      const offsets = parts.slice(offsetStart);
      const defs = offsets
        .map(o => synsets.get(`${abbr}:${o}`))
        .filter(Boolean)
        .slice(0, 4); // max 4 definice na slovo
      if (!defs.length) continue;
      if (!words.has(lemma)) words.set(lemma, []);
      words.get(lemma).push({ pos: posLabel, defs });
    }
  }
  console.log('WordNet loaded:', words.size, 'lemmas');
  return words;
}

function wikdictEntries(pair) {
  const json = execFileSync('sqlite3', ['-json', `${RAW}${pair}.sqlite3`,
    'SELECT lexentry, written_rep, sense_list, trans_list, score FROM translation_grouped'],
    { maxBuffer: 1 << 29 }).toString();
  return JSON.parse(json).map(r => ({
    w: clean(r.written_rep),
    p: posFromLexentry(r.lexentry),
    s: clean(r.sense_list),
    t: clean(r.trans_list),
    i: Math.round((r.score ?? 0) * 10) / 10,
  })).filter(e => e.w && e.t);
}

// svobodneslovniky: word \t trans \t pos \t note \t author
function svobodneEntries() {
  const txt = gunzipSync(readFileSync(`${RAW}en-cs.txt.gz`)).toString('utf8');
  const fwd = [], rev = [];
  for (const line of txt.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const [w, t, pos, note] = line.split('\t');
    if (!w || !t) continue;
    const p = clean(pos).replace(/:$/, '');
    const s = clean(note);
    fwd.push({ w: clean(w), t: clean(t), p, s, i: 1 });
    rev.push({ w: clean(t), t: clean(w), p, s, i: 1 });
  }
  return { fwd, rev };
}

// Obohať sense pole WordNet definicemi (pro en-cs: anglická hesla)
function enrichWithWordNet(entries, wordnet, srcIsEn) {
  if (!srcIsEn) return entries;
  return entries.map(e => {
    if (e.s) return e; // už má gloss z WikDictu/svobodných slovníků
    const wn = wordnet.get(e.w.toLowerCase()) ?? wordnet.get(norm(e.w));
    if (!wn) return e;
    // hledej shodu pos
    const match = wn.find(x => x.pos === e.p) ?? wn[0];
    const def = match.defs[0] ?? '';
    return { ...e, s: def };
  });
}

// Přidej čistě výkladové (en→en) záznamy z WordNetu jako pseudo-pár en-cs
// s trans = '' a bohatou sense – slouží jako embedded vykladovy slovnik
function wordNetOnlyEntries(wordnet, existingWords) {
  const entries = [];
  for (const [lemma, senses] of wordnet) {
    if (existingWords.has(norm(lemma))) continue; // už je z překladu, nepřidávat
    for (const { pos, defs } of senses) {
      if (!defs.length) continue;
      entries.push({ w: lemma, p: pos, s: defs.join(' | '), t: '', i: 0.1 });
    }
  }
  return entries;
}

function writePair(pair, entries) {
  const seen = new Set();
  const uniq = [];
  for (const e of entries) {
    const key = norm(e.w) + '|' + norm(e.t || '·');
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(e);
  }
  uniq.sort((a, b) => {
    const na = norm(a.w), nb = norm(b.w);
    return na < nb ? -1 : na > nb ? 1 : b.i - a.i;
  });
  const tsv = uniq.map(e => [e.w, e.p, e.s, e.t, e.i || ''].join('\t')).join('\n');
  const gz = gzipSync(Buffer.from(tsv, 'utf8'), { level: 9 });
  writeFileSync(`${OUT}${pair}.tsv.gz`, gz);
  return { count: uniq.length, bytes: gz.length };
}

const wordnet = loadWordNet();
const svobodne = svobodneEntries();
const manifest = { version: new Date().toISOString().slice(0, 10), pairs: {} };

for (const pair of PAIRS) {
  const [src] = pair.split('-');
  let entries = wikdictEntries(pair);
  if (pair === 'en-cs') entries = entries.concat(svobodne.fwd);
  if (pair === 'cs-en') entries = entries.concat(svobodne.rev);

  // obohaťme WordNet sensemi
  entries = enrichWithWordNet(entries, wordnet, src === 'en');

  // pro en-cs přidej i výkladové záznamy pro slova bez překladu
  if (pair === 'en-cs') {
    const existing = new Set(entries.map(e => norm(e.w)));
    entries = entries.concat(wordNetOnlyEntries(wordnet, existing));
  }

  manifest.pairs[pair] = writePair(pair, entries);
  console.log(pair, manifest.pairs[pair]);
}

writeFileSync(`${OUT}manifest.json`, JSON.stringify(manifest, null, 1));
const total = Object.values(manifest.pairs).reduce((a, p) => a + p.bytes, 0);
console.log('total gz:', (total / 1e6).toFixed(1), 'MB,',
  Object.values(manifest.pairs).reduce((a, p) => a + p.count, 0), 'entries');
