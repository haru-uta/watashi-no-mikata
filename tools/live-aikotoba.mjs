// 公開版で あいことばを 本物の 置き場まで 通す 試験（CORS・保存・べつの 端末での よびだし）。
// 使い方: STAFF_CODE=<職員用コード> node tools/live-aikotoba.mjs
// 置き場に「試験用」の あいことばが 1つ のこる（中身は 練習の 数字だけ）。作った あいことばを 表示する。
import puppeteer from 'puppeteer-core';

const BASE = process.env.E2E_BASE || 'https://haru-uta.github.io/watashi-no-mikata/';
const BROWSER = process.env.E2E_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CODE = process.env.STAFF_CODE;
if (!CODE) { console.log('STAFF_CODE を つけて ください'); process.exit(2); }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: BROWSER, headless: 'new', args: ['--no-first-run', '--mute-audio'] });
const errors = [];
async function device() {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|favicon/.test(m.text())) errors.push(m.text()); });
  await page.goto(BASE + '?t=' + Date.now(), { waitUntil: 'networkidle0' });
  await page.evaluate(() => { window.__app.SET.mode = 'k'; });
  return { ctx, page };
}
let ok = true;
const check = (name, cond, info) => { console.log(cond ? 'OK ' : 'NG ', name, cond ? '' : JSON.stringify(info)); if (!cond) ok = false; };

const A = await device();
check('置き場の URL が入っている', await A.page.evaluate(() => window.__app.Sync.enabled()));
const bad = await A.page.evaluate(() => window.__app.Sync.create('000000'));
check('違う職員用コードは断られる', bad.ok === false && bad.err === 'code', bad);
const made = await A.page.evaluate((c) => window.__app.Sync.create(c), CODE);
check('あいことばを作れる（CORS が通る）', made.ok === true, made);
const lk = await A.page.evaluate((k) => window.__app.Sync.lookup(k, false), made.key);
check('作った端末に登録できる', lk.ok === true, lk);
await A.page.evaluate(() => { window.__app.Sync.record('r:tearai'); window.__app.Sync.record('c:119'); });
for (let i = 0; i < 40 && (await A.page.evaluate(() => window.__app.Sync.info().pending)); i++) await wait(500);
const ia = await A.page.evaluate(() => window.__app.Sync.info());
check('記録が置き場に届く', ia.pending === 0 && ia.state.totals['r:tearai']?.n === 1 && ia.state.totals['c:119']?.n === 1, ia);

const B = await device();
const lb = await B.page.evaluate((d) => window.__app.Sync.lookup(d.replace(/・/g, ' '), false), made.display);
check('べつの 端末で 呼び出せる', lb.ok === true && lb.state.totals['r:tearai']?.n === 1, lb);
const wrong = await B.page.evaluate(() => window.__app.Sync.lookup('さくらさくらさくらさくら', false));
check('違うあいことばは見つからない', wrong.ok === false && wrong.err === 'nokey', wrong);
check('画面のエラーなし', errors.length === 0, errors);
console.log('試験用のあいことば:', made.display);
await browser.close();
process.exit(ok ? 0 : 1);
