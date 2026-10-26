import { MENU, ANSWERS, WANTS, FEELINGS, BODY, PAIN, ROUTINES, TIMER_MINUTES, NEXT_ITEMS, MONEY, MONEY_LEVELS, GOODS,
  SAFETY, CALLS } from './data.js';
import * as Sync from './sync.js';

// ---------- 設定（この端末だけ）----------
// 聴覚過敏の かたが いるので、音は ぜんぶ さいしょ OFF。読み上げは スピーカーの ボタンを おした ときだけ。
const SET_KEY = 'mikata-settings';
const SET = (() => {
  const d = { mode: null, volume: 0.6, sound: false, timerSound: false, vibrate: false, calm: false, big: false, voiceName: '' };
  try { return { ...d, ...JSON.parse(localStorage.getItem(SET_KEY) || '{}') }; } catch { return d; }
})();
const saveSet = () => { try { localStorage.setItem(SET_KEY, JSON.stringify(SET)); } catch { /* 保存できなくても つづける */ } };
const HELP_KEY = 'mikata-help';
const loadHelp = () => { try { return { name: '', contact: '', phone: '', address: '', hard: '', please: '', ...JSON.parse(localStorage.getItem(HELP_KEY) || '{}') }; } catch { return { name: '', contact: '', phone: '', address: '', hard: '', please: '' }; } };
const saveHelp = (v) => { try { localStorage.setItem(HELP_KEY, JSON.stringify(v)); return true; } catch { return false; } };
const app = document.getElementById('app');
const kid = () => SET.mode !== 'a';
// { k, a } の 文を いまの モードで 出す
const tx = (o) => (o == null ? '' : typeof o === 'string' ? o : kid() ? o.k : o.a);
const say2 = (k, a) => (kid() ? k : a);

// ---------- 小さな 道具 ----------
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(9)) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
  return el;
}
function pic(src, emoji, cls = '', alt = '') {
  const img = h('img', { src, alt, class: cls, draggable: 'false', decoding: 'async' });
  img.onerror = () => (window.__missing ||= []).push(src) && img.replaceWith(h('span', { class: cls + ' emoji', 'aria-hidden': 'true' }, emoji || '・'));
  return img;
}
const itemImg = (it, cls = 'icon') => pic(`art/items/${it.id}.png`, it.emoji, cls, '');

const ICONS = {
  speaker: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  back: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
  next: '<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.9 1.9M16.6 16.6l1.9 1.9M5.5 18.5l1.9-1.9M16.6 7.4l1.9-1.9"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  card: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><circle cx="8.5" cy="11" r="2"/><path d="M6 15.5c.6-1.4 1.6-2 2.5-2s1.9.6 2.5 2M14 10h4M14 13h3"/>',
  pause: '<path d="M8.5 6v12M15.5 6v12"/>',
  play: '<path d="M8 5.5v13l10-6.5z" fill="currentColor"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2"/>',
  phone: '<path d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 4.5 5.5a2 2 0 0 1 2-2z"/>',
  pencil: '<path d="M4.5 19.5l1-4.5L16 4.5l3.5 3.5L9 18.5z"/><path d="M13.5 7l3.5 3.5"/>',
  undo: '<path d="M9 8H5V4"/><path d="M5.5 8.5A7.5 7.5 0 1 1 6 16"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
};
function ic(name, cls = '') {
  const span = document.createElement('span');
  span.className = 'ic ' + cls;
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
  return span;
}

// ---------- 読み上げ（スピーカーを おした ときだけ。端末の 声） ----------
const VOICE_GOOD = /natural|neural|enhanced|premium|拡張|プレミアム/i;
const VOICE_FEMALE = /nanami|kyoko|o-ren|haruka|ayumi|mayu|aoi|shiori|nana|sayaka|google/i;
const VOICE_MALE = /otoya|hattori|ichiro|keita|daichi|naoki|takumi|kenji/i;
function jaVoices() {
  try { return speechSynthesis.getVoices().filter((v) => v.lang && v.lang.replace('_', '-').toLowerCase().startsWith('ja')); } catch { return []; }
}
const voiceScore = (v) => (VOICE_GOOD.test(v.name) ? 10 : 0) + (VOICE_FEMALE.test(v.name) ? 5 : 0) - (VOICE_MALE.test(v.name) ? 100 : 0) + (v.localService ? 1 : 0);
function pickVoice() {
  const vs = jaVoices();
  return vs.find((v) => v.name === SET.voiceName) || vs.slice().sort((x, y) => voiceScore(y) - voiceScore(x))[0] || null;
}
if ('speechSynthesis' in window) speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
function speak(text) {
  if (!('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/ /g, ''));
    u.lang = 'ja-JP'; u.rate = 0.88; u.pitch = 1.0; u.volume = SET.volume;
    const v = pickVoice();
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch { /* 声が でない 端末も ある */ }
}
const sayBtn = (text) => h('button', { class: 'say', 'aria-label': say2('よみあげる', '読み上げる'), onclick: () => speak(typeof text === 'function' ? text() : text) }, ic('speaker'));

// 音（設定で ON に した ときだけ。小さく、ゆっくり 大きく する）
let actx;
function chime(kind = 'ok') {
  if (!SET.sound && kind !== 'timer') return;
  if (kind === 'timer' && !SET.timerSound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const notes = kind === 'timer' ? [523, 659, 784] : [659, 880];
    const vol = 0.05 * SET.volume;
    notes.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + i * (kind === 'timer' ? 0.5 : 0.12);
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 1.3);
    });
  } catch { /* 音が でなくても つづける */ }
}

// ---------- 画面の きりかえ ----------
const ROUTES = {};
function go(name, arg, replace = false) {
  try { speechSynthesis.cancel(); } catch { /* なし */ }
  stopTimerView();
  const st = { name, arg };
  if (replace) history.replaceState(st, ''); else history.pushState(st, '');
  draw(name, arg);
}
function draw(name, arg) {
  document.body.classList.toggle('calm', SET.calm);
  document.body.classList.toggle('big', SET.big);
  document.body.classList.toggle('mode-a', !kid());
  document.documentElement.lang = 'ja';
  app.replaceChildren(ROUTES[name](arg));
  window.scrollTo(0, 0);
  app.dataset.screen = name;
}
addEventListener('popstate', (e) => {
  closeModal(); stopTimerView();
  const st = e.state || { name: 'title' };
  draw(st.name, st.arg);
});
function bar(title, back = () => history.back()) {
  return h('header', { class: 'bar' },
    h('button', { class: 'back', onclick: back }, ic('back'), say2('もどる', '戻る')),
    h('h1', {}, title),
    h('span', { class: 'bar-sp' }));
}
let modalEl = null;
function closeModal() { if (modalEl) { modalEl.remove(); modalEl = null; } }
function modal(...kids) {
  closeModal();
  modalEl = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' }, h('div', { class: 'sheet' }, ...kids));
  document.body.append(modalEl);
  return modalEl;
}
function longPress(fn) {
  let t = null, el = null;
  const start = (e) => { el = e.currentTarget; el.classList.add('holding'); t = setTimeout(() => { el.classList.remove('holding'); t = null; fn(); }, 1500); };
  const stop = () => { if (t) clearTimeout(t); t = null; el && el.classList.remove('holding'); };
  return { onpointerdown: start, onpointerup: stop, onpointerleave: stop, onpointercancel: stop, oncontextmenu: (e) => e.preventDefault() };
}

// ---------- さいしょ: こども / おとな ----------
ROUTES.first = () => h('div', { class: 'screen first' },
  h('h1', { class: 'logo' }, h('span', { class: 'logo-main' }, 'わたしの ミカタ')),
  pic('art/dogs/molly_happy.png', '🐶', 'dog greet-big', 'モリー'),
  h('p', { class: 'lead' }, 'どちらで つかいますか？'),
  h('div', { class: 'grid2' },
    h('button', { class: 'card big-choice', onclick: () => { SET.mode = 'k'; saveSet(); go('title', null, true); } },
      h('b', {}, 'こども'), h('small', {}, 'ひらがなで やさしく')),
    h('button', { class: 'card big-choice', onclick: () => { SET.mode = 'a'; saveSet(); go('title', null, true); } },
      h('b', {}, 'おとな'), h('small', {}, '漢字まじりで ていねいに'))),
  h('p', { class: 'muted center' }, 'あとから 設定で かえられます。'));

// ---------- タイトル ----------
ROUTES.title = () => {
  const hold = longPress(() => go('parent'));
  return h('div', { class: 'screen title' },
    h('header', { class: 'hero' }, pic('art/ui/hero.jpg', '', 'hero-img', '')),
    h('h1', { class: 'logo' },
      h('span', { class: 'logo-sub' }, say2('こまった ときの みかた', 'くらしを助けるアプリ')),
      h('span', { class: 'logo-main' }, 'わたしの ミカタ')),
    h('nav', { class: 'menu5' }, MENU.map((m, i) => h('button', { class: `menu-btn c${i + 1}`, onclick: () => go(m.id) },
      h('span', { class: 'mimg' }, pic(`art/ui/tile_${m.id}.jpg`, '', 'tile-img')),
      h('span', { class: 'ml' }, tx(m)), h('small', { class: 'ms' }, kid() ? m.sk : m.sa))),
      h('button', { class: 'menu-btn c6', onclick: () => go('helpShow') },
        h('span', { class: 'mimg help-tile' }, ic('card')),
        h('span', { class: 'ml' }, 'ヘルプカード'), h('small', { class: 'ms' }, say2('こまった ときに みせる', '困ったときに見せる')))),
    h('button', { class: 'parent-btn', ...hold }, ic('gear'), say2('おうちの ひと・しえんしゃ', '家族・支援者の設定'), h('small', {}, say2('（ながおし）', '（長押し）'))));
};

// ---------- つたえる ----------
const TABS = [
  { key: 'answer', k: 'こたえ', a: '返事' }, { key: 'want', k: 'したい', a: 'したい' },
  { key: 'feel', k: 'きもち', a: '気持ち' }, { key: 'body', k: 'からだ', a: '体' },
];
ROUTES.tsutaeru = (tab = 'answer') => {
  let grid;
  if (tab === 'answer') {
    grid = h('div', { class: 'grid2 answers' }, ANSWERS.map((x) => h('button', {
      class: 'card ans', style: `--c:${x.color}`, onclick: () => showCard(tx(x), h('span', { class: 'ans-mark big' }, x.mark), x.color),
    }, h('span', { class: 'ans-mark' }, x.mark), h('b', {}, tx(x)))));
  } else if (tab === 'body') {
    grid = h('div', {}, h('p', { class: 'lead small' }, say2('どこが いたい？', 'どこが痛いですか？')),
      h('div', { class: 'grid3' }, BODY.map((b) => h('button', { class: 'card tiny', onclick: () => go('pain', BODY.indexOf(b)) }, itemImg(b), h('small', {}, tx(b))))));
  } else {
    const list = tab === 'want' ? WANTS : FEELINGS;
    grid = h('div', { class: 'grid2' }, list.map((x) => h('button', { class: 'card pick', onclick: () => showCard(tx(x), itemImg(x, 'icon xl')) },
      itemImg(x), h('b', {}, tx(x)))));
  }
  return h('div', { class: 'screen' }, bar(say2('つたえる', '伝える')),
    h('div', { class: 'tabs', role: 'tablist' }, TABS.map((t) => h('button', {
      role: 'tab', 'aria-selected': t.key === tab ? 'true' : 'false', class: t.key === tab ? 'on' : '', onclick: () => go('tsutaeru', t.key, true),
    }, tx(t)))),
    h('p', { class: 'muted center' }, say2('えを おすと、おおきく でるよ。あいてに みせよう。', '絵を押すと大きく表示されます。相手に見せてください。')),
    grid);
};
ROUTES.pain = (bi) => {
  const b = BODY[bi];
  return h('div', { class: 'screen' }, bar(tx(b)),
    h('div', { class: 'pain-part' }, itemImg(b, 'icon xl'), h('p', { class: 'lead' }, say2(`${b.k}は どのくらい いたい？`, `${b.a}は、どのくらい痛いですか？`))),
    h('div', { class: 'pain-list' }, PAIN.map((p, i) => h('button', {
      class: 'pain-btn', style: `--c:${p.color}`,
      onclick: () => {
        const text = i === 0 ? say2(`${b.k}は いたくない`, `${b.a}は痛くありません`) : say2(`${b.k}が ${p.k}`, `${b.a}が${p.a.replace('です', '')}です`);
        showCard(text, h('span', { class: 'pain-face-wrap' }, pic(`art/items/pain${i}.png`, '😐', 'icon xl'), itemImg(b, 'icon xl')), p.color);
      },
    }, pic(`art/items/pain${i}.png`, '😐', 'icon'), h('b', {}, tx(p))))));
};
// 大きく みせる カード（声は ボタンを おした ときだけ）
function showCard(text, visual, color) {
  modal(
    h('div', { class: 'show-card', style: color ? `--c:${color}` : '' }, visual, h('p', { class: 'show-text' }, text)),
    h('div', { class: 'row center' },
      h('button', { class: 'btn', onclick: () => speak(text) }, ic('speaker'), say2('こえで つたえる', '声で伝える')),
      h('button', { class: 'btn primary', onclick: closeModal }, say2('とじる', '閉じる'))));
}

// ---------- てじゅん ----------
ROUTES.tejun = () => h('div', { class: 'screen' }, bar(say2('てじゅん', '手順')),
  h('p', { class: 'lead' }, say2('なにを する？', '何をしますか？')),
  h('div', { class: 'grid2' }, ROUTINES.map((r, i) => h('button', { class: 'card scene', onclick: () => go('steps', { kind: 'routine', i, k: 0 }) },
    pic(`art/steps/${r.id}_${r.thumb || 1}.jpg`, '🖼️', 'thumb'), h('b', {}, tx(r))))));

// 手順・安全の 場面を 1つずつ。「できた」を おして すすむ
ROUTES.steps = ({ kind, i, k }) => {
  const set = kind === 'routine' ? ROUTINES[i] : SAFETY[i];
  const n = set.steps.length;
  if (k >= n) {
    chime('ok');
    return h('div', { class: 'screen' }, bar(tx(set)),
      h('div', { class: 'done-box' }, pic('art/dogs/molly_happy.png', '🐶', 'dog large'),
        h('p', { class: 'lead big' }, kind === 'routine' ? say2('ぜんぶ できたね！', 'すべてできました。') : say2('さいごまで みたね！', '最後まで見ました。'))),
      h('div', { class: 'row center' },
        h('button', { class: 'btn', onclick: () => go('steps', { kind, i, k: 0 }, true) }, ic('undo'), say2('もう いちど', 'もう一度')),
        h('button', { class: 'btn primary', onclick: () => history.back() }, say2('おわる', '終わる'))));
  }
  const st = set.steps[k];
  const text = tx(st);
  return h('div', { class: 'screen' }, bar(tx(set)),
    set.note ? h('p', { class: 'note-box' }, tx(set.note)) : null,
    h('div', { class: 'dots', 'aria-label': `${k + 1} / ${n}` }, set.steps.map((_, j) => h('span', { class: j === k ? 'on' : j < k ? 'done' : '' }))),
    h('figure', { class: 'scene-pic' }, pic(`art/steps/${set.id}_${k + 1}.jpg`, '🖼️', 'photo', text)),
    h('div', { class: 'step-text' }, h('span', { class: 'step-no' }, String(k + 1)), h('p', {}, text), sayBtn(text)),
    h('div', { class: 'row between pager' },
      h('button', { class: 'btn', disabled: k === 0, onclick: () => go('steps', { kind, i, k: k - 1 }, true) }, ic('back'), say2('まえ', '前へ')),
      h('span', { class: 'count' }, `${k + 1} / ${n}`),
      h('button', { class: 'btn primary', onclick: () => {
        chime('ok');
        if (k + 1 === n) Sync.record((kind === 'routine' ? 'r:' : 's:') + set.id);
        go('steps', { kind, i, k: k + 1 }, true);
      } },
        kind === 'routine' ? [ic('check'), say2('できた', 'できた')] : [say2('つぎ', '次へ'), ic('next')])));
};

// ---------- タイマー ----------
let timerState = null; // { end, total, paused, left, next }
let timerTick = null, wakeLock = null;
function stopTimerView() { if (timerTick) { clearInterval(timerTick); timerTick = null; } }
ROUTES.timer = () => {
  let minutes = 5, next = -1;
  const minBtns = h('div', { class: 'grid4 mins' }, TIMER_MINUTES.map((m) => h('button', {
    class: 'card tiny' + (m === minutes ? ' on' : ''), onclick: (e) => { minutes = m; minBtns.querySelectorAll('.on').forEach((x) => x.classList.remove('on')); e.currentTarget.classList.add('on'); },
  }, h('b', { class: 'min-num' }, String(m)), h('small', {}, say2('ふん', '分')))));
  const nextBtns = h('div', { class: 'grid4' }, NEXT_ITEMS.map((it, i) => h('button', {
    class: 'card tiny', onclick: (e) => {
      const on = next === i; next = on ? -1 : i;
      nextBtns.querySelectorAll('.on').forEach((x) => x.classList.remove('on'));
      if (!on) e.currentTarget.classList.add('on');
    },
  }, itemImg(it), h('small', {}, tx(it)))));
  return h('div', { class: 'screen' }, bar(say2('タイマー', 'タイマー')),
    h('h2', { class: 'sub-h' }, say2('なんぷん？', '何分にしますか？')), minBtns,
    h('h2', { class: 'sub-h' }, say2('おわったら つぎは？（えらばなくても いい）', '終わったら次は？（選ばなくてもかまいません）')), nextBtns,
    h('button', { class: 'btn primary wide', onclick: () => {
      timerState = { total: minutes * 60000, end: Date.now() + minutes * 60000, paused: false, left: 0, next };
      go('timerRun', null, true);
    } }, ic('play'), say2('はじめる', '始める')));
};
function fmtLeft(ms) {
  const s = Math.ceil(ms / 1000);
  if (s >= 60) { const m = Math.ceil(s / 60); return say2(`あと ${m}ぷん`, `残り ${m}分`); }
  return say2(`あと ${s}びょう`, `残り ${s}秒`);
}
ROUTES.timerRun = () => {
  const T = timerState;
  if (!T) return ROUTES.timer();
  const R = 90, C = 2 * Math.PI * R;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 220 220'); svg.setAttribute('class', 'pie');
  svg.innerHTML = `<circle cx="110" cy="110" r="${R + 10}" fill="#fff"/><circle cx="110" cy="110" r="${R / 2}" fill="none" stroke="#e8e0cf" stroke-width="${R}"/>
    <circle class="pie-left" cx="110" cy="110" r="${R / 2}" fill="none" stroke="var(--sage)" stroke-width="${R}" stroke-dasharray="${C / 2} ${C / 2}" transform="rotate(-90 110 110)"/>`;
  const left = h('p', { class: 'left-text', role: 'timer' });
  const nextIt = T.next >= 0 ? NEXT_ITEMS[T.next] : null;
  const pauseBtn = h('button', { class: 'btn' });
  const box = h('div', { class: 'timer-box' }, svg, left,
    nextIt ? h('div', { class: 'next-chip' }, say2('つぎは', '次は'), itemImg(nextIt, 'icon s'), h('b', {}, tx(nextIt))) : null);
  const remaining = () => (T.paused ? T.left : Math.max(0, T.end - Date.now()));
  const paint = () => {
    const ms = remaining(), frac = ms / T.total;
    svg.querySelector('.pie-left').setAttribute('stroke-dasharray', `${(C / 2) * frac} ${C / 2}`);
    left.textContent = ms > 0 ? fmtLeft(ms) : say2('おわり！', '終わりです');
    pauseBtn.replaceChildren(T.paused ? ic('play') : ic('pause'), T.paused ? say2('つづける', '続ける') : say2('とめる', '一時停止'));
    if (ms <= 0) finish();
  };
  let done = false;
  const finish = () => {
    if (done) return; done = true;
    stopTimerView();
    box.classList.add('finished');
    chime('timer');
    Sync.record('t:' + Math.round(T.total / 60000));
    if (SET.vibrate && navigator.vibrate) navigator.vibrate([200, 300, 200]);
    try { wakeLock && wakeLock.release(); } catch { /* なし */ }
    pauseBtn.hidden = true;
    stopBtn.replaceChildren(ic('check'), say2('おわる', '終わる'));
    if (nextIt) box.append(h('p', { class: 'lead big' }, say2(`つぎは ${nextIt.k}`, `次は ${nextIt.a}です`)));
  };
  pauseBtn.onclick = () => {
    if (T.paused) { T.end = Date.now() + T.left; T.paused = false; } else { T.left = remaining(); T.paused = true; }
    paint();
  };
  const stopBtn = h('button', { class: 'btn primary', onclick: () => { timerState = null; history.back(); } }, ic('stop'), say2('やめる', 'やめる'));
  try { navigator.wakeLock?.request('screen').then((w) => { wakeLock = w; }).catch(() => {}); } catch { /* なし */ }
  stopTimerView();
  timerTick = setInterval(paint, 250);
  setTimeout(paint, 0);
  return h('div', { class: 'screen' }, bar(say2('タイマー', 'タイマー')), box, h('div', { class: 'row center' }, pauseBtn, stopBtn));
};

// ---------- おかね ----------
const coinEl = (m) => h('span', { class: `money ${m.kind} ${m.cls}` }, h('b', {}, String(m.v)), h('small', {}, say2('えん', '円')));
const yen = (v) => say2(`${v}えん`, `${v.toLocaleString('ja-JP')}円`);
ROUTES.okane = () => h('div', { class: 'screen' }, bar(say2('おかね', 'お金')),
  h('p', { class: 'lead' }, say2('どの れんしゅうを する？', 'どの練習をしますか？')),
  h('div', { class: 'levels' }, MONEY_LEVELS.map((L, i) => h('button', { class: 'card level-card', onclick: () => go('pay', { lv: i, n: 0 }) },
    h('span', { class: 'lv-no' }, String(i + 1)), h('b', {}, tx(L)),
    h('span', { class: 'lv-coins' }, MONEY.filter((m) => L.coins.includes(m.v)).map(coinEl))))),
  h('p', { class: 'muted center' }, say2('ほんものの おかねとは ちがう えだよ。', '本物のお金とは違う絵です。')));
const rnd = (a, b, step) => a + step * Math.floor(Math.random() * (Math.floor((b - a) / step) + 1));
ROUTES.pay = ({ lv, n }) => {
  const L = MONEY_LEVELS[lv];
  const good = GOODS[Math.floor(Math.random() * GOODS.length)];
  const price = rnd(L.min, L.max, L.step);
  const head = h('div', { class: 'goods' }, itemImg(good, 'icon xl'), h('div', {}, h('b', {}, tx(good)), h('p', { class: 'price' }, yen(price))));
  const msg = h('p', { class: 'hint', hidden: true });
  const nextBtn = h('button', { class: 'btn primary', hidden: true, onclick: () => go('pay', { lv, n: n + 1 }, true) }, say2('つぎの もんだい', '次の問題'), ic('next'));
  if (L.change) {
    // 1000えんで はらって、おつりは いくら？
    const change = 1000 - price;
    const opts = [...new Set([change, change + 10, Math.max(10, change - 10), change + 100].filter((v) => v > 0))].slice(0, 3).sort(() => Math.random() - 0.5);
    const btns = opts.map((v) => h('button', { class: 'btn answer', onclick: (e) => {
      if (v === change) {
        btns.forEach((b) => (b.disabled = true)); e.currentTarget.classList.add('right');
        msg.hidden = false; msg.className = 'hint good';
        msg.textContent = say2(`せいかい！ 1000えん − ${price}えん ＝ ${change}えん`, `正解です。1,000円 − ${price}円 ＝ ${change}円`);
        chime('ok'); nextBtn.hidden = false;
        Sync.record('m:' + lv);
      } else {
        e.currentTarget.disabled = true; e.currentTarget.classList.add('dim');
        msg.hidden = false; msg.className = 'hint';
        msg.textContent = say2(`もう いちど。1000えんから ${price}えんを ひくと？`, `もう一度考えます。1,000円から${price}円を引くと？`);
      }
    } }, yen(v)));
    return h('div', { class: 'screen' }, bar(tx(L)), head,
      h('div', { class: 'paid' }, say2('1000えんで はらったよ', '1,000円で払いました'), coinEl(MONEY[6])),
      h('p', { class: 'lead' }, say2('おつりは いくら？', 'おつりはいくらですか？')),
      h('div', { class: 'answers' }, btns), msg, nextBtn);
  }
  const tray = [];
  const trayEl = h('div', { class: 'tray', 'aria-label': say2('だした おかね', '出したお金') });
  const total = h('p', { class: 'total' });
  const paint = () => {
    const sum = tray.reduce((a, b) => a + b, 0);
    trayEl.replaceChildren(...(tray.length ? tray.map((v, j) => h('button', { class: 'coin-btn', 'aria-label': say2(`${v}えんを もどす`, `${v}円を戻す`), onclick: () => { tray.splice(j, 1); paint(); } }, coinEl(MONEY.find((m) => m.v === v)))) : [h('span', { class: 'muted' }, say2('したの おかねを おしてね', '下のお金を押して出します'))]));
    total.textContent = say2(`だした おかね ${sum}えん`, `出したお金 ${sum.toLocaleString('ja-JP')}円`);
  };
  paint();
  return h('div', { class: 'screen' }, bar(tx(L)), head,
    h('p', { class: 'lead small' }, say2(`${price}えん ぴったり だそう`, `${price}円ちょうどを出します`)),
    trayEl, total,
    h('div', { class: 'wallet' }, MONEY.filter((m) => L.coins.includes(m.v)).map((m) => h('button', { class: 'coin-btn', 'aria-label': yen(m.v), onclick: () => { if (tray.length < 20) { tray.push(m.v); tray.sort((a, b) => b - a); paint(); } } }, coinEl(m)))),
    h('button', { class: 'btn primary wide', onclick: () => {
      const sum = tray.reduce((a, b) => a + b, 0);
      msg.hidden = false;
      if (sum === price) { msg.className = 'hint good'; msg.textContent = say2('ぴったり！ よく できたね。', 'ちょうどです。よくできました。'); chime('ok'); if (nextBtn.hidden) Sync.record('m:' + lv); nextBtn.hidden = false; }
      else if (sum < price) { msg.className = 'hint'; msg.textContent = say2(`あと ${price - sum}えん たりないよ。`, `あと${price - sum}円足りません。`); }
      else { msg.className = 'hint'; msg.textContent = say2(`${sum - price}えん おおいよ。おかねを おすと もどせるよ。`, `${sum - price}円多いです。お金を押すと戻せます。`); }
    } }, say2('はらう', '払う')),
    msg, nextBtn);
};

// ---------- あんぜん ----------
ROUTES.anzen = () => h('div', { class: 'screen' }, bar(say2('あんぜん', '安全')),
  h('div', { class: 'grid2' },
    SAFETY.map((s, i) => h('button', { class: 'card scene', onclick: () => go('steps', { kind: 'safety', i, k: 0 }) }, pic(`art/steps/${s.id}_1.jpg`, '🖼️', 'thumb'), h('b', {}, tx(s)))),
    h('button', { class: 'card scene', onclick: () => go('calls') }, h('span', { class: 'thumb big-ic' }, ic('phone')), h('b', {}, say2('でんわの れんしゅう', '電話の練習'))),
    h('button', { class: 'card scene', onclick: () => go('helpShow') }, h('span', { class: 'thumb big-ic' }, ic('card')), h('b', {}, say2('ヘルプカード', 'ヘルプカード')))));
ROUTES.calls = () => h('div', { class: 'screen' }, bar(say2('でんわの れんしゅう', '電話の練習')),
  h('p', { class: 'practice-note' }, say2('れんしゅう です。ほんとうには かかりません。', '練習です。本当にはかかりません。')),
  h('div', { class: 'grid2' }, CALLS.map((c, i) => h('button', { class: 'card call-card', onclick: () => go('dial', { i, typed: '' }) },
    h('span', { class: 'call-num' }, c.num), h('b', {}, tx(c))))));
ROUTES.dial = ({ i, typed }) => {
  const c = CALLS[i];
  let t = typed;
  const disp = h('p', { class: 'dial-disp', 'aria-live': 'polite' });
  const hint = h('p', { class: 'muted center' });
  const paint = () => { disp.textContent = t || '—'; hint.textContent = say2(`「${c.num}」を おそう`, `「${c.num}」を押します`); };
  paint();
  const key = (d) => h('button', { class: 'key', onclick: () => {
    if (t.length >= 3) t = '';
    t += d; paint();
    if (t === c.num) setTimeout(() => go('callTalk', { i, k: 0 }, true), 400);
    else if (!c.num.startsWith(t)) { hint.textContent = say2(`ちがう ばんごうだよ。「${c.num}」を おそう`, `番号が違います。「${c.num}」を押します`); t = ''; setTimeout(paint, 1200); }
  } }, d);
  return h('div', { class: 'screen' }, bar(`${c.num} ${tx(c)}`),
    h('p', { class: 'practice-note' }, say2('れんしゅう です。ほんとうには かかりません。', '練習です。本当にはかかりません。')),
    disp, hint,
    h('div', { class: 'keypad' }, ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', ''].map((d) => (d ? key(d) : h('span', {})))));
};
ROUTES.callTalk = ({ i, k }) => {
  const c = CALLS[i];
  const line = c.lines[k];
  if (!line) {
    return h('div', { class: 'screen' }, bar(`${c.num} ${tx(c)}`),
      h('div', { class: 'done-box' }, pic('art/dogs/molly_happy.png', '🐶', 'dog large'), h('p', { class: 'lead big' }, say2('さいごまで できたね！', '最後まで練習できました。'))),
      h('p', { class: 'note-box' }, say2('あぶないと おもった ときや ひとりで できない ときは、おうちの ひと・しえんしゃ・おみせの ひと・けいさつに「たすけて ください」と いおう。', '危険を感じたときや一人で対応できないときは、家族、支援者、店員、警察などに助けを求めます。')),
      h('div', { class: 'row center' }, h('button', { class: 'btn primary', onclick: () => history.back() }, say2('おわる', '終わる'))));
  }
  const text = tx(line);
  return h('div', { class: 'screen' }, bar(`${c.num} ${tx(c)}`),
    h('p', { class: 'practice-note' }, say2('れんしゅう です。ほんとうには かかりません。', '練習です。本当にはかかりません。')),
    h('div', { class: 'call-line' }, h('span', { class: 'call-ic' }, ic('phone')), h('p', {}, text), sayBtn(text)),
    h('div', { class: 'row between pager' },
      h('button', { class: 'btn', disabled: k === 0, onclick: () => go('callTalk', { i, k: k - 1 }, true) }, ic('back'), say2('まえ', '前へ')),
      h('span', { class: 'count' }, `${k + 1} / ${c.lines.length}`),
      h('button', { class: 'btn primary', onclick: () => { if (k + 1 === c.lines.length) Sync.record('c:' + c.num); go('callTalk', { i, k: k + 1 }, true); } }, say2('つぎ', '次へ'), ic('next'))));
};

// ---------- ヘルプカード ----------
const HELP_FIELDS = [
  { key: 'name', k: 'なまえ', a: '名前' },
  { key: 'contact', k: 'れんらくする ひと', a: '連絡先の人' },
  { key: 'phone', k: 'でんわばんごう', a: '電話番号', type: 'tel' },
  { key: 'address', k: 'じゅうしょ', a: '住所' },
  { key: 'hard', k: 'にがてな こと', a: '苦手なこと', area: true },
  { key: 'please', k: 'こうして ほしい', a: 'してほしいこと', area: true },
];
ROUTES.helpShow = () => {
  const v = loadHelp();
  const empty = !HELP_FIELDS.some((f) => v[f.key]);
  return h('div', { class: 'screen' }, bar(say2('ヘルプカード', 'ヘルプカード')),
    empty ? h('div', { class: 'done-box' }, pic('art/dogs/molly_calm.png', '🐶', 'dog large'),
      h('p', { class: 'lead' }, say2('まだ かいて いないよ。おうちの ひとと いっしょに かこう。', 'まだ書かれていません。家族や支援者と一緒に書きます。')))
      : h('article', { class: 'help-card' },
        h('p', { class: 'help-title' }, say2('たすけて ください', '助けてください')),
        h('p', { class: 'help-sub' }, say2('この カードを よんで ください', 'このカードを読んでください')),
        HELP_FIELDS.filter((f) => v[f.key]).map((f) => h('div', { class: 'help-row' }, h('small', {}, f.a), h('p', { class: f.key === 'phone' ? 'help-phone' : '' }, v[f.key])))),
    h('div', { class: 'row center' }, h('button', { class: 'btn' + (empty ? ' primary' : ''), onclick: () => go('helpEdit') }, ic('pencil'), empty ? say2('かく', '書く') : say2('なおす', '直す'))),
    h('p', { class: 'muted center' }, say2('この カードは この たんまつの なかだけに あるよ。', 'このカードの内容は、この端末の中だけに保存されます。')));
};
ROUTES.helpEdit = () => {
  const v = loadHelp();
  const inputs = {};
  return h('div', { class: 'screen form' }, bar(say2('ヘルプカードを かく', 'ヘルプカードを書く')),
    h('p', { class: 'muted' }, say2('かける ところだけで いいよ。', '書けるところだけでかまいません。')),
    HELP_FIELDS.map((f) => h('label', { class: 'field' }, h('span', {}, kid() ? f.k : f.a),
      inputs[f.key] = f.area ? h('textarea', { rows: '2', maxlength: '120' }, v[f.key]) : h('input', { type: f.type || 'text', value: v[f.key], maxlength: '60', autocomplete: 'off' }))),
    h('div', { class: 'row center' },
      h('button', { class: 'btn', onclick: () => history.back() }, say2('やめる', 'やめる')),
      h('button', { class: 'btn primary', onclick: () => {
        const out = {};
        for (const f of HELP_FIELDS) out[f.key] = inputs[f.key].value.trim();
        saveHelp(out); history.back();
      } }, ic('check'), say2('ほぞん', '保存'))));
};

// ---------- 家族・支援者の 設定 ----------
function voicePicker() {
  const vs = jaVoices();
  if (!vs.length) return h('p', { class: 'muted' }, 'この端末には日本語の読み上げの声がありません。');
  const cur = pickVoice();
  return h('div', { class: 'voice-box' },
    h('label', {}, '声', h('select', { class: 'voice-sel', 'aria-label': '読み上げの声', onchange: (e) => { SET.voiceName = e.target.value; saveSet(); } },
      vs.slice().sort((x, y) => voiceScore(y) - voiceScore(x)).map((x) => h('option', { value: x.name, selected: cur && x.name === cur.name ? true : false }, x.name)))),
    h('button', { class: 'btn small', onclick: () => speak('こんにちは。いっしょに やって みましょう。') }, ic('speaker'), '試しに聞く'),
    h('p', { class: 'muted' }, 'iPhone・iPad は「設定 → アクセシビリティ → 読み上げコンテンツ → 声 → 日本語」で「Kyoko（拡張）」などを入れると、より自然な声になります。'));
}
ROUTES.parent = () => {
  const toggle = (key, label, note) => h('label', { class: 'switch' },
    h('input', { type: 'checkbox', checked: SET[key], onchange: (e) => { SET[key] = e.target.checked; saveSet(); draw('parent'); } }),
    h('span', {}, label, note ? h('small', { class: 'muted block' }, note) : null));
  return h('div', { class: 'screen adult' }, bar('家族・支援者の設定'),
    h('section', { class: 'panel' }, h('h2', {}, '使う人'),
      h('div', { class: 'row' },
        h('button', { class: 'btn small' + (kid() ? ' primary' : ''), onclick: () => { SET.mode = 'k'; saveSet(); draw('parent'); } }, 'こども'),
        h('button', { class: 'btn small' + (!kid() ? ' primary' : ''), onclick: () => { SET.mode = 'a'; saveSet(); draw('parent'); } }, 'おとな')),
      h('p', { class: 'muted' }, 'こども: ひらがなとやさしい言葉。おとな: 漢字まじりの丁寧な言葉と落ち着いた見た目。')),
    aikoPanel(),
    h('section', { class: 'panel' }, h('h2', {}, '音（最初はすべてオフです）'),
      h('p', { class: 'muted' }, '聴覚過敏のある方に配慮し、音は自動では鳴りません。読み上げは、スピーカーのボタンを押したときだけです。'),
      h('label', { class: 'slider' }, h('span', {}, '読み上げの音量'),
        h('input', { type: 'range', min: '0.2', max: '1', step: '0.1', value: String(SET.volume), onchange: (e) => { SET.volume = Number(e.target.value); saveSet(); speak('この大きさです。'); } })),
      voicePicker(),
      toggle('sound', '効果音（小さな音）'),
      toggle('timerSound', 'タイマーが終わったときの音', 'オフでも、画面の色が変わって知らせます。'),
      toggle('vibrate', 'タイマーが終わったときの振動（対応する端末のみ）')),
    h('section', { class: 'panel' }, h('h2', {}, '見た目'),
      toggle('calm', '動きを少なくする'),
      toggle('big', '文字を大きくする')),
    h('section', { class: 'panel' }, h('h2', {}, 'このアプリについて'),
      h('p', {}, '意思を伝える、生活の手順、時間の見通し、お金、安全の練習をするアプリです。診断や治療を目的としたものではありません。'),
      h('p', {}, '設定とヘルプカードの内容は、この端末の中だけに保存されます。インターネットには送信しません。'),
      h('p', {}, 'あいことばを入れた端末では、練習の記録（種類・回数・日時）と「こども／おとな」だけを会社の置き場に送ります。名前・ヘルプカードは送りません。'),
      h('p', {}, '電話の練習では、実際に電話はかかりません。'),
      h('p', { class: 'muted' }, '訪問看護ステーションはるうた')),
    h('section', { class: 'panel' }, h('h2', {}, 'ヘルプカードを消す'),
      h('button', { class: 'btn small danger', onclick: () => modal(h('h2', {}, 'ヘルプカードを消しますか？'),
        h('p', { class: 'adult' }, '書いた名前や電話番号がすべて消えます。'),
        h('div', { class: 'row center' },
          h('button', { class: 'btn', onclick: closeModal }, 'やめる'),
          h('button', { class: 'btn danger', onclick: () => { try { localStorage.removeItem(HELP_KEY); } catch { /* なし */ } closeModal(); draw('parent'); } }, '消す'))) }, '消す')));
};

// ---------- 練習の記録・あいことば（家族・支援者の設定の中）----------
// あいことばは 最初に 1回だけ 作って 変えない（支援者は 電子カルテに 書く）。2026-10-26 代表決定
const fmtWhen = (t) => {
  const d = new Date(t);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
function kindName(k) {
  const [g, id] = k.split(':');
  if (g === 'r') { const r = ROUTINES.find((x) => x.id === id); return ['手順', r ? r.a : id]; }
  if (g === 's') { const r = SAFETY.find((x) => x.id === id); return ['安全', r ? r.a : id]; }
  if (g === 'm') { const L = MONEY_LEVELS[Number(id)]; return ['お金', L ? `${Number(id) + 1}. ${L.a}` : id]; }
  if (g === 'c') { const c = CALLS.find((x) => x.num === id); return ['電話の練習', c ? `${c.num} ${c.a}` : id]; }
  if (g === 't') return ['タイマー', `${id}分`];
  return ['その他', k];
}
function syncStatus() {
  const I = Sync.info();
  if (I.err === 'nokey') return h('p', { class: 'hint' }, 'このあいことばは置き場に見つかりません。カルテの文字を確かめて、入れ直してください。');
  if (I.pending) return h('p', { class: 'muted' }, `まだ送っていない記録が ${I.pending} 件あります。電波がつながると自動で送ります。`, I.dropped ? `（たまりすぎたため、古い記録 ${I.dropped} 件は消えました）` : '');
  if (I.lastOk) return h('p', { class: 'muted' }, `記録は送ってあります（最後に確かめた日時 ${fmtWhen(I.lastOk)}）。`);
  return null;
}
// 言葉の とちゅうで 改行しない ように、言葉ごとに 包む
const keyBox = (display) => h('p', { class: 'aiko-key', 'aria-label': 'あいことば' },
  String(display || '').split('・').map((w, i) => [i ? h('span', { class: 'aiko-dot' }, '・') : null, h('span', { class: 'aiko-w' }, w)]));
function aikoPanel() {
  if (!Sync.enabled()) return h('section', { class: 'panel' }, h('h2', {}, '練習の記録・あいことば'), h('p', { class: 'muted' }, '準備中です。'));
  const I = Sync.info();
  if (!I.key) {
    return h('section', { class: 'panel' }, h('h2', {}, '練習の記録・あいことば'),
      h('p', {}, 'あいことばを入れると、この端末でした練習の記録（種類・回数・日時だけ）が会社の置き場に送られ、支援者がどの端末からでも見られます。'),
      I.pending ? h('p', { class: 'muted' }, `この端末には、あいことばを入れる前の練習の記録が ${I.pending} 件あります。`) : null,
      h('div', { class: 'row' },
        h('button', { class: 'btn small primary', onclick: () => go('aikotoba') }, 'あいことばを入れる'),
        h('button', { class: 'btn small', onclick: confirmCreate }, '新しく作る（はじめての人）')));
  }
  return h('section', { class: 'panel' }, h('h2', {}, '練習の記録・あいことば'),
    h('p', { class: 'muted' }, 'この端末のあいことば'), keyBox(I.display), syncStatus(),
    h('div', { class: 'row' },
      h('button', { class: 'btn small primary', onclick: () => go('records') }, '練習の記録を見る'),
      h('button', { class: 'btn small', onclick: confirmForget }, 'この端末から外す')));
}
const errText = (e) => ({
  nokey: 'このあいことばは見つかりません。電子カルテの文字を確かめてください。',
  code: '職員用コードが違います。',
  net: 'インターネットにつながりません。電波のある所で、もう一度ためしてください。',
  limit: '今日はこれ以上作れません。明日もう一度ためしてください。',
  busy: '混み合っています。少し待って、もう一度ためしてください。',
}[e] || 'うまくいきませんでした。少し待って、もう一度ためしてください。');
const okModal = (title, ...kids) => modal(h('h2', { class: 'adult' }, title), ...kids, h('div', { class: 'row center' }, h('button', { class: 'btn primary', onclick: closeModal }, '閉じる')));
function confirmCreate() {
  // 職員用コードは 職員だけが 知っている（利用者さんが うっかり 作りなおさない ように）
  const codeIn = h('input', { type: 'text', inputmode: 'numeric', maxlength: '8', autocomplete: 'off', class: 'code-input', 'aria-label': '職員用コード' });
  modal(h('h2', { class: 'adult' }, '新しいあいことばを作りますか？'),
    h('p', { class: 'adult' }, 'あいことばは1人に1つです。作ったら変えません。'),
    h('p', { class: 'adult' }, 'すでに持っている人は、作らずに「あいことばを入れる」から入れてください（電子カルテに書いてあります）。'),
    h('label', { class: 'field adult' }, h('span', {}, '職員用コード（6けた）'), codeIn),
    h('div', { class: 'row center' },
      h('button', { class: 'btn', onclick: closeModal }, 'やめる'),
      h('button', { class: 'btn primary', onclick: async (e) => {
        e.currentTarget.disabled = true;
        const r = await Sync.create(codeIn.value).catch(() => ({ ok: false, err: 'net' }));
        if (!r.ok) { okModal('作れませんでした', h('p', { class: 'adult' }, errText(r.err))); return; }
        const keep = Sync.info().pending > 0 ? await askKeep(Sync.info().pending) : false;
        const lk = await Sync.lookup(r.key, keep).catch(() => ({ ok: false, err: 'net' }));
        if (lk.ok) Sync.sync(SET.mode).catch(() => {});
        modal(h('h2', { class: 'adult' }, 'あいことばができました'), keyBox(r.display),
          h('p', { class: 'adult' }, '支援者は、このあいことばを電子カルテに書いてください。ご家族にも控えてもらってください。'),
          lk.ok ? null : h('p', { class: 'hint' }, `この端末への登録はまだです。「あいことばを入れる」から、上のあいことばを入れてください。`),
          h('div', { class: 'row center' }, h('button', { class: 'btn primary', onclick: () => { closeModal(); draw('parent'); } }, 'カルテに書いた')));
      } }, '作る')));
}
function confirmForget() {
  const I = Sync.info();
  modal(h('h2', { class: 'adult' }, 'この端末からあいことばを外しますか？'),
    h('p', { class: 'adult' }, '置き場の記録は消えません。あいことばを入れれば、また見られます。'),
    I.pending ? h('p', { class: 'hint' }, `まだ送っていない記録が ${I.pending} 件あります。外すと、この ${I.pending} 件は消えます。電波のある所で送ってから外すのがおすすめです。`) : null,
    h('div', { class: 'row center' },
      h('button', { class: 'btn', onclick: closeModal }, 'やめる'),
      h('button', { class: 'btn danger', onclick: () => { Sync.forget(); closeModal(); draw('parent'); } }, '外す')));
}
function askKeep(n) {
  return new Promise((resolve) => {
    modal(h('h2', { class: 'adult' }, 'あいことばを入れる前の記録'),
      h('p', { class: 'adult' }, `この端末には、あいことばを入れる前にした練習の記録が ${n} 件あります。この人の記録に入れますか？`),
      h('p', { class: 'muted adult' }, '支援者の端末で見本を見せたときの記録なら「入れない」を選んでください。'),
      h('div', { class: 'row center' },
        h('button', { class: 'btn', onclick: () => { closeModal(); resolve(false); } }, '入れない'),
        h('button', { class: 'btn primary', onclick: () => { closeModal(); resolve(true); } }, '入れる')));
  });
}
ROUTES.aikotoba = () => {
  const input = h('input', { type: 'text', class: 'aiko-input', placeholder: '例）さくら・みかん・つばめ・くじら', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
  const msg = h('p', { class: 'hint', hidden: true });
  const btn = h('button', { class: 'btn primary wide', onclick: async () => {
    msg.hidden = true;
    if (!input.value.trim()) { msg.hidden = false; msg.textContent = 'あいことばを入れてください。'; return; }
    btn.disabled = true;
    if (Sync.info().key && Sync.info().pending) await Sync.sync().catch(() => {});
    const left = Sync.info();
    if (left.key && left.pending) {
      btn.disabled = false;
      msg.hidden = false; msg.textContent = `前のあいことば（${left.display}）の、まだ送っていない記録が ${left.pending} 件あります。電波のある所で送ってから切り替えてください。`;
      return;
    }
    const keep = !left.key && left.pending > 0 ? await askKeep(left.pending) : false;
    const r = await Sync.lookup(input.value, keep).catch(() => ({ ok: false, err: 'net' }));
    btn.disabled = false;
    if (!r.ok) { msg.hidden = false; msg.textContent = errText(r.err); return; }
    if (r.state.mode && r.state.mode !== SET.mode) { SET.mode = r.state.mode; saveSet(); }
    go('records', null, true);
  } }, '呼び出す');
  return h('div', { class: 'screen adult form' }, bar('あいことばを入れる'),
    h('p', {}, '電子カルテに書いてあるあいことば（4つの言葉）を入れてください。区切りは「・」でも空白でも、なくてもかまいません。'),
    h('label', { class: 'field' }, h('span', {}, 'あいことば'), input), msg, btn,
    h('p', { class: 'muted' }, '置き場に送るのは、練習の種類・回数・日時と「こども／おとな」だけです。名前やヘルプカードは送りません。'));
};
ROUTES.records = () => {
  const I = Sync.info();
  const body = h('div', { class: 'records' });
  const st = h('div', {}, syncStatus());
  const paint = () => {
    const groups = {};
    for (const [k, v] of Object.entries(Sync.totals())) {
      const [g, name] = kindName(k);
      (groups[g] ||= []).push({ name, ...v });
    }
    const order = ['手順', 'お金', '安全', '電話の練習', 'タイマー', 'その他'].filter((g) => groups[g]);
    const recent = Sync.recent(20);
    body.replaceChildren(
      order.length ? '' : h('p', { class: 'muted center' }, 'まだ記録はありません。手順・お金・安全・電話・タイマーの練習を最後までやると記録されます。'),
      ...order.map((g) => h('section', { class: 'panel rec-group' }, h('h2', {}, g),
        h('ul', { class: 'rec-list' }, groups[g].sort((a, b) => b.last - a.last).map((x) => h('li', {},
          h('span', { class: 'rec-name' }, x.name), h('b', { class: 'rec-n' }, `${x.n}回`), h('small', { class: 'muted rec-when' }, `最後 ${fmtWhen(x.last)}`)))))),
      recent.length ? h('section', { class: 'panel' }, h('h2', {}, 'さいきんの記録'),
        h('ul', { class: 'rec-list recent' }, recent.map((e) => { const [g, name] = kindName(e.k); return h('li', {}, h('small', { class: 'muted rec-when' }, fmtWhen(e.t)), h('span', { class: 'rec-name' }, `${g}：${name}`)); }))) : '');
    st.replaceChildren(syncStatus() || '');
  };
  paint();
  const off = Sync.onChange(() => { if (app.dataset.screen === 'records' && body.isConnected) paint(); else off(); });
  if (I.key) Sync.sync(SET.mode).catch(() => {});
  return h('div', { class: 'screen adult' }, bar('練習の記録'),
    I.key ? h('div', { class: 'panel' }, h('p', { class: 'muted' }, 'あいことば'), keyBox(I.display), st)
      : h('p', { class: 'muted' }, 'あいことばが入っていないので、この端末の中の記録だけです。'),
    body);
};

// ---------- はじまり ----------
Sync.useMode(() => SET.mode);
if (Sync.info().key) Sync.sync().catch(() => {});
const startAt = SET.mode ? 'title' : 'first';
history.replaceState({ name: startAt }, '');
draw(startAt);
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
window.__app = { go, SET, Sync, get timer() { return timerState; } };
