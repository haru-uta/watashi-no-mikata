// 練習の記録と あいことば。記録は まず この端末に ためて、あいことばが あれば 置き場（会社の Google）へ おくる。
// 置き場へ おくるのは 練習の種類・回数・日時・こども/おとな だけ。ヘルプカードや 名前は おくらない。
import { STORE_URL } from './config.js';

const KEY = 'mikata-sync';
const PENDING_MAX = 3000;
const blank = () => ({ key: '', display: '', pending: [], state: null, lastOk: 0, err: '', dropped: 0 });
const load = () => { try { return { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return blank(); } };
const S = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* 保存できなくても つづける */ } };
const listeners = new Set();
const notify = () => listeners.forEach((f) => { try { f(); } catch { /* なし */ } });
// ほかの タブで かわったら 読みなおす（2つ ひらいても 記録を けしあわない）
addEventListener('storage', (e) => { if (e.key === KEY) { Object.assign(S, load()); notify(); } });

export const enabled = () => !!STORE_URL;
export const info = () => ({ key: S.key, display: S.display, pending: S.pending.length, lastOk: S.lastOk, err: S.err, state: S.state, dropped: S.dropped });
export const onChange = (f) => { listeners.add(f); return () => listeners.delete(f); };
let modeOf = () => null;
export const useMode = (f) => { modeOf = f; };

function newId() {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[b % 62]).join('');
}

// 練習が 1つ おわった ときに よぶ。k は 'r:tearai' のような 形
export function record(k) {
  Object.assign(S, load()); // ほかの タブの 分を とりこんでから たす
  S.pending.push({ id: newId(), t: Date.now(), k });
  if (S.pending.length > PENDING_MAX) { S.dropped += S.pending.length - PENDING_MAX; S.pending = S.pending.slice(-PENDING_MAX); }
  save(); notify();
  if (S.key) soon();
}

let timer = null;
function soon() { clearTimeout(timer); timer = setTimeout(() => sync().catch(() => {}), 2500); }

async function call(body) {
  if (!STORE_URL) throw new Error('off');
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const res = await fetch(STORE_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), signal: ctl.signal, redirect: 'follow' });
    return await res.json();
  } finally { clearTimeout(t); }
}

let running = null;
// ためた 記録を おくって、置き場の 中身を もらう。mode は こども/おとな
export function sync(mode) {
  if (!S.key || !STORE_URL) return Promise.resolve(false);
  if (running) return running;
  const key = S.key;
  const sending = S.pending.slice(0, 200);
  running = call({ a: 'sync', key, mode: mode || modeOf() || undefined, events: sending }).then((r) => {
    const sent = new Set(sending.map((e) => e.id));
    Object.assign(S, load());
    if (r && r.ok) S.pending = S.pending.filter((e) => !sent.has(e.id)); // 送れた 分は、とちゅうで あいことばが かわっても けす
    if (S.key !== key) { save(); notify(); return false; } // とちゅうで かわった: 前の 人の 中身を 次の 人に 出さない
    if (!r || !r.ok) { S.err = r && r.err === 'nokey' ? 'nokey' : 'server'; save(); notify(); return false; }
    S.state = r.state; S.lastOk = Date.now(); S.err = '';
    save(); notify();
    if (S.pending.length) soon();
    return true;
  }).catch(() => { if (S.key === key) { S.err = 'net'; save(); notify(); } return false; }).finally(() => { running = null; });
  return running;
}

// あいことばを いれて よびだす。うまく いったら この端末の あいことばに する
// keepPending: あいことば なしで した 練習を この あいことばに いれるか（よびだす 前に あった 分だけ）
export async function lookup(input, keepPending) {
  const before = new Set(S.pending.map((e) => e.id));
  const r = await call({ a: 'sync', key: input, events: [] });
  if (!r || !r.ok) return { ok: false, err: r && r.err ? r.err : 'server' };
  Object.assign(S, load());
  S.key = r.key; S.display = r.state.display; S.state = r.state; S.lastOk = Date.now(); S.err = '';
  if (!keepPending) S.pending = S.pending.filter((e) => !before.has(e.id));
  save(); notify();
  if (S.pending.length) soon();
  return { ok: true, state: r.state };
}

// あたらしい あいことばを つくる（支援者が 職員用コードを いれて つかう）
export async function create(code) {
  const r = await call({ a: 'new', code });
  if (!r || !r.ok) return { ok: false, err: r && r.err ? r.err : 'server' };
  return { ok: true, key: r.key, display: r.display };
}

// この端末から あいことばを はずす（まだ 送って いない 記録も けす。置き場の 記録は のこる）
export function forget() {
  Object.assign(S, blank());
  save(); notify();
}

// 置き場の 回数 ＋ まだ おくって いない 回数
export function totals() {
  const out = {};
  for (const [k, v] of Object.entries((S.state && S.state.totals) || {})) out[k] = { n: v.n, last: v.last };
  for (const e of S.pending) {
    const t = out[e.k] || (out[e.k] = { n: 0, last: 0 });
    t.n += 1; if (e.t > t.last) t.last = e.t;
  }
  return out;
}
export function recent(n = 20) {
  const all = [...S.pending, ...((S.state && S.state.recent) || [])];
  const seen = new Set();
  return all.filter((e) => !seen.has(e.id) && seen.add(e.id)).sort((a, b) => b.t - a.t).slice(0, n);
}

addEventListener('online', () => { if (S.key && S.pending.length) sync().catch(() => {}); });
