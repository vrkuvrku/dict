// Vygeneruje public/data/{pair}.tsv.gz + manifest.json z WikDict SQLite a svobodneslovniky.cz.
// Vstup: data/raw/*.sqlite3, data/raw/en-cs.txt.gz (stažené předem, viz README).
// Formát řádku: word \t pos \t sense \t trans \t importance   (seřazeno dle norm(word))
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';

const RAW = new URL('../data/raw/', import.meta.url).pathname;
const OUT = new URL('../public/data/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const PAIRS = ['en-cs','cs-en','en-es','es-en','en-fr','fr-en','es-cs','cs-es','fr-cs','cs-fr','es-fr','fr-es'];

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const clean = (s) => (s ?? '').replace(/[\t\n\r]+/g, ' ').trim();

// sjednocení názvů slovních druhů napříč jazyky Wiktionary
const POS_MAP = {
  noun: 'n', propernoun: 'n', nom: 'n', sustantivo: 'n', substantivo: 'n', podstatnejmeno: 'n',
  verb: 'v', verbe: 'v', verbo: 'v', sloveso: 'v',
  adjective: 'adj', adjectif: 'adj', adjetivo: 'adj', pridavnejmeno: 'adj',
  adverb: 'adv', adverbe: 'adv', adverbio: 'adv', prislovce: 'adv',
  pronoun: 'pron', pronom: 'pron', pronombre: 'pron', zajmeno: 'pron',
  preposition: 'prep', preposition_: 'prep', preposicion: 'prep',
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

function wikdictEntries(pair) {
  const json = execFileSync('sqlite3', ['-json', `${RAW}${pair}.sqlite3`,
    'SELECT lexentry, written_rep, sense_list, trans_list, score FROM translation_grouped'],
    { maxBuffer: 1 << 29 }).toString();
  const rows = JSON.parse(json);
  // score = síla překladu z WikDictu; koreluje i s frekvencí slova → řadicí klíč
  return rows.map(r => ({
    w: clean(r.written_rep),
    p: posFromLexentry(r.lexentry),
    s: clean(r.sense_list),
    t: clean(r.trans_list),
    i: Math.round((r.score ?? 0) * 10) / 10,
  })).filter(e => e.w && e.t);
}

// svobodneslovniky.cz: word \t translation \t pos(n:/v:/…) \t note \t author
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

function writePair(pair, entries) {
  // dedup (word|trans), agregace překladů se stejným (word, pos, sense) neřešíme — řadí se k sobě
  const seen = new Set();
  const uniq = [];
  for (const e of entries) {
    const key = norm(e.w) + '|' + norm(e.t);
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

const svobodne = svobodneEntries();
const manifest = { version: new Date().toISOString().slice(0, 10), pairs: {} };
for (const pair of PAIRS) {
  let entries = wikdictEntries(pair);
  if (pair === 'en-cs') entries = entries.concat(svobodne.fwd);
  if (pair === 'cs-en') entries = entries.concat(svobodne.rev);
  manifest.pairs[pair] = writePair(pair, entries);
  console.log(pair, manifest.pairs[pair]);
}
writeFileSync(`${OUT}manifest.json`, JSON.stringify(manifest, null, 1));
const total = Object.values(manifest.pairs).reduce((a, p) => a + p.bytes, 0);
console.log('total gz:', (total / 1e6).toFixed(1), 'MB,',
  Object.values(manifest.pairs).reduce((a, p) => a + p.count, 0), 'entries');
