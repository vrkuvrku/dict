// Headless smoke test proti produkci: onboarding import → hledání → historie.
// Spuštění: node tools/e2e-smoke.mjs [url]
import { chromium } from 'playwright';

const URL = process.argv[2] ?? 'https://sarfy.cz/dict/';
const browser = await chromium.launch({
  executablePath: process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-x64/chrome-headless-shell',
});
const page = await browser.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 200)); });

console.log('open', URL);
await page.goto(URL, { waitUntil: 'load' });

// onboarding: čekej na dokončení importu (zmizení overlay), max 4 min
const onboarding = page.locator('.onboarding');
if (await onboarding.isVisible().catch(() => false)) {
  console.log('onboarding běží, čekám na import…');
  const t0 = Date.now();
  await onboarding.waitFor({ state: 'detached', timeout: 240_000 });
  console.log('import hotov za', ((Date.now() - t0) / 1000).toFixed(0), 's');
} else {
  console.log('onboarding se nezobrazil (data už jsou?)');
}

async function trySearch(q, expect) {
  await page.fill('#q', q);
  await page.waitForTimeout(600);
  const cards = await page.locator('.card').count();
  const first = cards ? await page.locator('.card').first().innerText() : '(nic)';
  const ok = first.toLowerCase().includes(expect.toLowerCase());
  console.log(`${ok ? 'OK ' : 'FAIL'} "${q}" → ${cards} výsledků; první: ${first.replace(/\n/g, ' · ').slice(0, 90)}`);
  return ok;
}

let pass = true;
pass &&= await trySearch('dog', 'pes');
pass &&= await trySearch('perro', 'pes');
pass &&= await trySearch('cestina', 'čeština');
pass &&= await trySearch('maison', 'dům');

// klik na kartu → historie
await page.locator('.card').first().click();
await page.waitForTimeout(300);
console.log('deep-link hash:', await page.evaluate(() => location.hash));
await page.locator('nav.tabs button[data-tab=history]').click();
await page.waitForTimeout(400);
const histCount = await page.locator('.listitem').count();
console.log(histCount > 0 ? 'OK historie:' : 'FAIL historie:', histCount, 'položek');
pass &&= histCount > 0;

// service worker
const swState = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? (reg.active ? 'active' : 'registered') : 'none';
});
console.log('service worker:', swState);

// reload → appka musí naběhnout bez onboardingu (data v IDB)
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1500);
const onb2 = await page.locator('.onboarding').isVisible().catch(() => false);
console.log(onb2 ? 'FAIL: onboarding znovu po reloadu' : 'OK reload bez onboardingu');
pass &&= !onb2;

await browser.close();
console.log(pass ? 'SMOKE TEST PASSED' : 'SMOKE TEST FAILED');
process.exit(pass ? 0 : 1);
