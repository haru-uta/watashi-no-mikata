// ブラウザで 実際に 操作して、画面ごとに 写真と 点検（はみ出し・文字の重なり・絵の読みこみ失敗・エラー）。
// 使い方: node tools/e2e.mjs   → out/e2e/<日時>/ に 写真と report.md
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const OUT = path.join(ROOT, 'out', 'e2e', new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));
fs.mkdirSync(OUT, { recursive: true });
const BROWSER = process.env.E2E_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json' };

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const file = fs.existsSync(p) && fs.statSync(p).isDirectory() ? path.join(p, 'index.html') : p;
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(0);
const BASE = `http://127.0.0.1:${server.address().port}/`;

const problems = [];
const passed = [];
let shotNo = 0;

// 画面の 点検: 横はみ出し / 字が 箱から はみ出す / 文字どうしの 重なり / 絵の 失敗
async function audit(page, label) {
  const r = await page.evaluate(() => {
    const out = [];
    const W = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth > W + 1) out.push(`横に はみ出し（${document.documentElement.scrollWidth} > ${W}）`);
    const vis = (el) => { const s = getComputedStyle(el); const b = el.getBoundingClientRect(); return s.visibility !== 'hidden' && s.display !== 'none' && b.width > 0 && b.height > 0; };
    const txt = [...document.querySelectorAll('button, p, b, small, h1, h2, h3, span, label, li, a')].filter((el) => vis(el)
      && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
    for (const el of txt) {
      if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX !== 'auto' && el.clientWidth > 0) out.push(`字が はみ出す: 「${el.textContent.trim().slice(0, 24)}」`);
      const b = el.getBoundingClientRect();
      if (b.left < -1 || b.right > W + 1) out.push(`画面の そと: 「${el.textContent.trim().slice(0, 24)}」`);
    }
    // 文字の 行の 箱（Range）どうしで 重なりを みる
    const boxes = [];
    for (const el of txt) {
      for (const n of el.childNodes) {
        if (n.nodeType !== 3 || !n.textContent.trim()) continue;
        const rg = document.createRange(); rg.selectNodeContents(n);
        for (const b of rg.getClientRects()) if (b.width > 2 && b.height > 2) boxes.push({ el, b, t: n.textContent.trim().slice(0, 16) });
      }
    }
    const inModal = (el) => !!el.closest('.modal');
    const modalOpen = !!document.querySelector('.modal');
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const A = boxes[i], B = boxes[j];
      if (A.el === B.el || A.el.contains(B.el) || B.el.contains(A.el)) continue;
      if (modalOpen && inModal(A.el) !== inModal(B.el)) continue;
      // うごく 帯（sticky）の 下に もぐるのは よい
      if (!!A.el.closest('.bar') !== !!B.el.closest('.bar')) continue;
      const ov = Math.min(A.b.right, B.b.right) - Math.max(A.b.left, B.b.left);
      const oh = Math.min(A.b.bottom, B.b.bottom) - Math.max(A.b.top, B.b.top);
      if (ov > 3 && oh > 3) out.push(`文字が かさなる: 「${A.t}」と「${B.t}」`);
    }
    // 言葉の とちゅうで 改行（くぎりの 空白・、。 の あいだは 1つの 言葉）
    for (const el of txt) {
      for (const n of el.childNodes) {
        if (n.nodeType !== 3) continue;
        const re = /[^\s、。！？「」・（）]+[、。！？」）]*/g; let m;
        if (el.closest('.adult') || document.body.classList.contains('mode-a')) continue; // おとなの 文は ふつうの 改行で よい
        while ((m = re.exec(n.textContent))) {
          if ([...m[0]].length < 2) continue;
          const rg = document.createRange(); rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length);
          const tops = new Set([...rg.getClientRects()].filter((b) => b.width > 1).map((b) => Math.round(b.top / 4)));
          if (tops.size > 1) out.push(`言葉の とちゅうで 改行: 「${m[0]}」`);
        }
      }
    }
    // ボタンが ちいさすぎない か（指で おせる 40px 以上）
    for (const el of document.querySelectorAll('button')) {
      if (!vis(el) || el.closest('.modal') !== (modalOpen ? el.closest('.modal') : null)) continue;
      const b = el.getBoundingClientRect();
      if (b.height < 40 || b.width < 40) out.push(`ボタンが ちいさい: 「${el.textContent.trim().slice(0, 16)}」${Math.round(b.width)}×${Math.round(b.height)}`);
    }
    for (const img of document.querySelectorAll('img')) if (img.complete && img.naturalWidth === 0) out.push(`絵が ない: ${img.getAttribute('src')}`);
    out.push(...(window.__missing || []).map((s) => `絵が ない: ${s}`));
    window.__missing = [];
    return [...new Set(out)];
  });
  for (const p of r) problems.push(`[${label}] ${p}`);
}
async function shot(page, label) {
  await new Promise((r) => setTimeout(r, 250));
  await page.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; })))));
  await audit(page, label);
  const name = `${String(++shotNo).padStart(2, '0')}_${label}.png`;
  await page.screenshot({ path: path.join(OUT, name), fullPage: true });
}
async function click(page, text, sel = 'button') {
  const ok = await page.evaluate((text, sel) => {
    const els = [...document.querySelectorAll(sel)].filter((b) => b.textContent.replace(/\s+/g, ' ').includes(text) && !b.disabled);
    const modal = document.querySelector('.modal');
    const el = (modal ? els.filter((b) => modal.contains(b)) : els)[0] || els[0];
    if (!el) return false;
    el.scrollIntoView({ block: 'center' }); el.click(); return true;
  }, text, sel);
  if (!ok) throw new Error(`ボタン「${text}」が 見つからない`);
  await new Promise((r) => setTimeout(r, 120));
}
const state = (page) => page.evaluate(() => window.__app.S);
async function step(name, fn) {
  try { await fn(); passed.push(name); } catch (e) { problems.push(`[試験] ${name}: ${e.message}`); }
}

const browser = await puppeteer.launch({ executablePath: BROWSER, headless: 'new', args: ['--no-first-run', '--mute-audio'] });
const VIEWS = [
  { tag: 'se', width: 375, height: 667, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { tag: 'iphone', width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { tag: 'ipad', width: 820, height: 1180, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
];
const only = process.env.E2E_VIEW;
const screen = (page) => page.evaluate(() => document.getElementById('app').dataset.screen);
for (const v of VIEWS.filter((x) => !only || x.tag === only)) {
  for (const mode of ['k', 'a']) {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport(v);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|favicon/.test(m.text())) errors.push(m.text()); });
    // 音が 鳴ったら 記録する（聴覚過敏への 配慮: 自動で 鳴っては いけない）
    await page.evaluateOnNewDocument(() => {
      window.__sounds = [];
      const AC = window.AudioContext;
      window.AudioContext = function (...a) { const c = new AC(...a); const o = c.createOscillator.bind(c); c.createOscillator = () => { window.__sounds.push('osc'); return o(); }; return c; };
      const sp = window.speechSynthesis && window.speechSynthesis.speak.bind(window.speechSynthesis);
      if (sp) window.speechSynthesis.speak = (u) => { window.__sounds.push('speak:' + u.text); };
      Math.random = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
    });
    await page.goto(BASE, { waitUntil: 'networkidle0' });
    const T = (s) => `${v.tag}_${mode}_${s}`;
    const noAutoSound = async (where) => {
      const snd = await page.evaluate(() => { const s = window.__sounds.slice(); window.__sounds = []; return s; });
      if (snd.length) problems.push(`[${T(where)}] 自動で 音が 鳴った: ${snd.join(', ')}`);
    };

    await step(`${T('さいしょ')}`, async () => {
      if (mode === 'k') await shot(page, T('さいしょ'));
      await click(page, mode === 'k' ? 'こども' : 'おとな');
      if ((await screen(page)) !== 'title') throw new Error('タイトルに ならない');
      await shot(page, T('タイトル'));
    });
    await step(`${T('つたえる')}`, async () => {
      await page.evaluate(() => window.__app.go('tsutaeru')); await shot(page, T('つたえる_こたえ'));
      await page.$eval('.card.ans', (e) => e.click()); await shot(page, T('つたえる_おおきく'));
      await noAutoSound('つたえる_おおきく');
      await click(page, mode === 'k' ? 'こえで つたえる' : '声で伝える');
      const snd = await page.evaluate(() => { const s = window.__sounds.slice(); window.__sounds = []; return s; });
      if (!snd.some((x) => x.startsWith('speak:'))) throw new Error('こえで つたえる で よみあげない');
      await click(page, mode === 'k' ? 'とじる' : '閉じる');
      await click(page, mode === 'k' ? 'したい' : 'したい', '.tabs button'); await shot(page, T('つたえる_したい'));
      await click(page, mode === 'k' ? 'きもち' : '気持ち', '.tabs button'); await shot(page, T('つたえる_きもち'));
      await click(page, mode === 'k' ? 'からだ' : '体', '.tabs button'); await shot(page, T('つたえる_からだ'));
      await page.$eval('.grid3 .card:nth-child(7)', (e) => e.click()); await shot(page, T('いたさ'));
      await page.$eval('.pain-btn:nth-child(4)', (e) => e.click()); await shot(page, T('いたさ_カード'));
      const txt = await page.$eval('.show-text', (e) => e.textContent);
      if (!/おなか/.test(txt)) throw new Error(`いたい カードが ちがう: ${txt}`);
      await noAutoSound('いたさ');
    });
    await step(`${T('てじゅん')}`, async () => {
      await page.goto(BASE, { waitUntil: 'networkidle0' });
      await page.evaluate(() => window.__app.go('tejun')); await shot(page, T('てじゅん'));
      for (let i = 0; i < 5; i++) {
        await page.evaluate((i) => window.__app.go('steps', { kind: 'routine', i, k: 0 }), i);
        const n = await page.evaluate(() => document.querySelectorAll('.dots span').length);
        for (let k = 0; k < n; k++) { await audit(page, `${T('てじゅん')}${i}_${k + 1}`); if (v.tag === 'se' && mode === 'k') await shot(page, T(`てじゅん${i}_${k + 1}`)); await click(page, 'できた'); }
        if (i === 4) await shot(page, T('てじゅん_おわり'));
      }
      await noAutoSound('てじゅん');
    });
    await step(`${T('タイマー')}`, async () => {
      await page.goto(BASE, { waitUntil: 'networkidle0' });
      await page.evaluate(() => window.__app.go('timer')); await shot(page, T('タイマー'));
      await page.$eval('.mins .card:nth-child(1)', (e) => e.click());
      await page.$eval('.grid4:not(.mins) .card:nth-child(1)', (e) => e.click());
      await click(page, mode === 'k' ? 'はじめる' : '始める');
      await new Promise((r) => setTimeout(r, 600)); await shot(page, T('タイマー_うごく'));
      // 1ぷんを まつ かわりに おわりの 時こくを いまに する
      await page.evaluate(() => { window.__app.timer.end = Date.now() - 10; });
      await new Promise((r) => setTimeout(r, 600));
      if (!(await page.$('.timer-box.finished'))) throw new Error('おわりに ならない');
      await new Promise((r) => setTimeout(r, 3200)); await shot(page, T('タイマー_おわり'));
      await noAutoSound('タイマー_おわり');
    });
    await step(`${T('おかね')}`, async () => {
      await page.goto(BASE, { waitUntil: 'networkidle0' });
      await page.evaluate(() => window.__app.go('okane')); await shot(page, T('おかね'));
      await page.$eval('.level-card:nth-child(2)', (e) => e.click()); await shot(page, T('おかね_2'));
      const price = await page.$eval('.price', (e) => Number(e.textContent.replace(/[^0-9]/g, '')));
      // 100えんと 10えんで ぴったり だす（まず 1まい おおく だして もどす）
      const hundreds = Math.floor(price / 100), tens = (price % 100) / 10;
      for (let j = 0; j < hundreds; j++) await page.$eval('.wallet .coin-btn:nth-child(2)', (e) => e.click());
      for (let j = 0; j < tens + 1; j++) await page.$eval('.wallet .coin-btn:nth-child(1)', (e) => e.click());
      await click(page, mode === 'k' ? 'はらう' : '払う'); await shot(page, T('おかね_おおい'));
      await page.$$eval('.tray .coin-btn', (bs) => bs[bs.length - 1].click());
      await click(page, mode === 'k' ? 'はらう' : '払う'); await shot(page, T('おかね_ぴったり'));
      if (!(await page.$('.hint.good'))) throw new Error('ぴったりに ならない');
      await page.evaluate(() => window.__app.go('pay', { lv: 3, n: 0 })); await shot(page, T('おかね_おつり'));
      await page.evaluate(() => { const p = Number(document.querySelector('.price').textContent.replace(/[^0-9]/g, '')); const c = 1000 - p; [...document.querySelectorAll('.btn.answer')].find((b) => Number(b.textContent.replace(/[^0-9]/g, '')) === c).click(); });
      if (!(await page.$('.hint.good'))) throw new Error('おつりが ただしく ない');
      await shot(page, T('おかね_おつり_せいかい'));
      await page.evaluate(() => window.__app.go('pay', { lv: 2, n: 0 })); await shot(page, T('おかね_3'));
    });
    await step(`${T('あんぜん')}`, async () => {
      await page.goto(BASE, { waitUntil: 'networkidle0' });
      await page.evaluate(() => window.__app.go('anzen')); await shot(page, T('あんぜん'));
      for (let i = 0; i < 2; i++) {
        await page.evaluate((i) => window.__app.go('steps', { kind: 'safety', i, k: 0 }), i);
        const n = await page.evaluate(() => document.querySelectorAll('.dots span').length);
        for (let k = 0; k < n; k++) { await audit(page, `${T('あんぜん')}${i}_${k + 1}`); if (v.tag === 'se' && mode === 'k') await shot(page, T(`あんぜん${i}_${k + 1}`)); await click(page, mode === 'k' ? 'つぎ' : '次へ'); }
      }
      await page.evaluate(() => window.__app.go('calls')); await shot(page, T('でんわ'));
      await page.$eval('.call-card', (e) => e.click());
      for (const d of '18') await page.evaluate((d) => [...document.querySelectorAll('.key')].find((b) => b.textContent === d).click(), d);
      await shot(page, T('でんわ_まちがい'));
      await new Promise((r) => setTimeout(r, 1400));
      for (const d of '119') await page.evaluate((d) => [...document.querySelectorAll('.key')].find((b) => b.textContent === d).click(), d);
      await new Promise((r) => setTimeout(r, 700));
      if ((await screen(page)) !== 'callTalk') throw new Error('119 で すすまない');
      await shot(page, T('でんわ_はなす'));
    });
    await step(`${T('ヘルプカード')}`, async () => {
      await page.goto(BASE, { waitUntil: 'networkidle0' });
      await click(page, 'ヘルプカード', '.menu-btn'); await shot(page, T('ヘルプ_から'));
      await click(page, mode === 'k' ? 'かく' : '書く');
      const ins = await page.$$('.field input, .field textarea');
      const vals = ['はるうた たろう', 'はるうた はなこ（はは）', '090-0000-0000', 'ふくおかけん しんぐうまち', 'おおきな おと', 'ゆっくり はなして ください'];
      for (let j = 0; j < ins.length; j++) await ins[j].type(vals[j]);
      await shot(page, T('ヘルプ_かく'));
      await click(page, mode === 'k' ? 'ほぞん' : '保存');
      await new Promise((r) => setTimeout(r, 300));
      await shot(page, T('ヘルプ'));
      if (!(await page.$('.help-card'))) throw new Error('ヘルプカードが でない');
    });
    await step(`${T('せってい')}`, async () => {
      await page.goto(BASE, { waitUntil: 'networkidle0' });
      await page.$eval('.parent-btn', (e) => e.scrollIntoView({ block: 'center' }));
      const b = await (await page.$('.parent-btn')).boundingBox();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
      await new Promise((r) => setTimeout(r, 1700)); await page.mouse.up();
      if ((await screen(page)) !== 'parent') throw new Error('ながおしで ひらかない');
      await shot(page, T('せってい'));
      await noAutoSound('せってい');
    });
    if (mode === 'k') await step(`${T('大きい字')}`, async () => {
      await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('mikata-settings')); s.big = true; localStorage.setItem('mikata-settings', JSON.stringify(s)); });
      for (const [r, a] of [['title'], ['tsutaeru', 'want'], ['pain', 6], ['timer'], ['okane'], ['pay', { lv: 2, n: 0 }], ['helpShow'], ['steps', { kind: 'safety', i: 1, k: 1 }]]) {
        await page.goto(BASE, { waitUntil: 'networkidle0' });
        await page.evaluate((r, a) => window.__app.go(r, a), r, a); await shot(page, T(`大きい字_${r}`));
      }
      await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('mikata-settings')); s.big = false; localStorage.setItem('mikata-settings', JSON.stringify(s)); });
    });
    for (const e of errors) problems.push(`[${v.tag}_${mode} エラー] ${e}`);
    await ctx.close();
  }
}
await browser.close();
server.close();

const uniq = [...new Set(problems)];
const rep = `# 画面の試験 ${path.basename(OUT)}\n\n合格 ${passed.length} 件\n\n## 見つかったこと（${uniq.length}）\n${uniq.map((p) => `- ${p}`).join('\n') || '- なし'}\n`;
fs.writeFileSync(path.join(OUT, 'report.md'), rep);
console.log(rep);
console.log('写真:', OUT);
process.exit(uniq.some((p) => p.includes('[試験]') || p.includes('エラー')) ? 1 : 0);
