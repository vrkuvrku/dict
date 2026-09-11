# Dict — offline slovník EN·ES·FR·CS

Moderní slovníková PWA na https://sarfy.cz/dict. Angličtina, španělština, francouzština
a čeština ve všech 12 směrech, ~1,25 mil. hesel. Po prvním stažení dat (~21 MB) funguje
plně offline (IndexedDB + service worker).

## Featury

- jeden vyhledávací box napříč všemi jazyky (prefix, bez ohledu na diakritiku a velikost písmen)
- historie hledání a oblíbená slova (jen lokálně v zařízení)
- procvičování oblíbených slov — flashcards s Leitnerovým systémem
- výslovnost přes Web Speech API
- deep-linky (`#w/en-cs/dog`) a sdílení přes Web Share API
- klávesové zkratky: `/` hledání, `↑/↓` výběr, `Enter` otevřít, `Esc` zavřít
- dark mode podle systému

## Vývoj

```sh
npm install
# stáhni zdrojová data (viz níže) do data/raw/, pak:
npm run data     # vygeneruje public/data/*.tsv.gz + manifest.json
npm run icons    # vygeneruje ikony z tools/icon.svg
npm run dev      # vývojový server
npm run deploy   # build + scp na sarfy.cz:www/dict/
```

Stažení zdrojových dat:

```sh
mkdir -p data/raw && cd data/raw
for p in en-cs cs-en en-es es-en en-fr fr-en es-cs cs-es fr-cs cs-fr es-fr fr-es; do
  curl -sfLO "https://download.wikdict.com/dictionaries/sqlite/2/$p.sqlite3"
done
curl -sfLO "https://www.svobodneslovniky.cz/data/en-cs.txt.gz"
```

## Architektura

- Vite + vanilla TypeScript, žádný framework
- data se při buildu extrahují z SQLite do seřazených TSV (gzip), klient je dekomprimuje
  přes `DecompressionStream` a uloží do IndexedDB po blocích ~2000 hesel;
  hledání = binární hledání v indexu bloků + scan bloku
- PWA přes `vite-plugin-pwa` (precache app shellu; slovníková data žijí v IndexedDB)

## Licence dat

- [WikDict](https://www.wikdict.com) — CC BY-SA 4.0, data z Wiktionary přes DBnary
- [Svobodné slovníky](https://www.svobodneslovniky.cz) — GNU FDL 1.1+,
  „Založeno na svobodném anglicko-českém slovníku, https://www.svobodneslovniky.cz/"

Kód aplikace: MIT.
