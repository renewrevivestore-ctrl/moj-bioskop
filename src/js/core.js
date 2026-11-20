// Zajedničke pomoćne funkcije
const $ = (s, el = document) => el.querySelector(s);

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

const Store = {
  get(k, d) { try { const v = localStorage.getItem('mb_' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('mb_' + k, JSON.stringify(v)); } catch {} },
};

const Prefs = {
  defaults: { ytKey: '', osKey: '', osUser: '', osPass: '', subLangs: CONFIG.SUB_LANGS, catalogUrl: '', subSize: 28 },
  get(k) { const p = Store.get('prefs', {}); return k in p ? p[k] : this.defaults[k]; },
  set(k, v) { const p = Store.get('prefs', {}); p[k] = v; Store.set('prefs', p); },
};

// Moja lista: { key: {type, id, title, poster, ...} }
const MyList = {
  all() { return Store.get('mylist', {}); },
  has(key) { return !!this.all()[key]; },
  toggle(key, item) {
    const l = this.all();
    if (l[key]) delete l[key]; else l[key] = { ...item, added: Date.now() };
    Store.set('mylist', l);
    return !!l[key];
  },
};

const Progress = {
  get(id) { return Store.get('progress', {})[id]; },
  set(id, data) { const p = Store.get('progress', {}); p[id] = { ...data, ts: Date.now() }; Store.set('progress', p); },
  remove(id) { const p = Store.get('progress', {}); delete p[id]; Store.set('progress', p); },
  list() { return Object.entries(Store.get('progress', {})).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.ts - a.ts); },
};

let toastTimer;
function toast(msg, ms = 3500) {
  const t = $('#toast');
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
}

function stripHtml(s) {
  const d = document.createElement('div'); d.innerHTML = String(s || ''); return (d.textContent || '').trim();
}
const first = (v) => Array.isArray(v) ? v[0] : v;
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const enc = encodeURIComponent;

function spinner(text = 'Učitavam…') { return h('div', { class: 'loading' }, h('div', { class: 'spin' }), text); }
function emptyMsg(text) { return h('div', { class: 'empty' }, text); }

// Modal
const Modal = {
  open(content) { const c = $('#modalCard'); c.innerHTML = ''; c.append(content); $('#modal').classList.remove('hidden'); },
  close() { $('#modal').classList.add('hidden'); $('#modalCard').innerHTML = ''; },
};

// Horizontalni red kartica (kao Netflix)
function row(title, items, renderCard, onMore) {
  const track = h('div', { class: 'row-track' }, items.map(renderCard));
  const scroll = (d) => track.scrollBy({ left: d * track.clientWidth * 0.85, behavior: 'smooth' });
  return h('section', { class: 'row' },
    h('div', { class: 'row-head' },
      h('h2', {}, title),
      onMore ? h('button', { class: 'link', onclick: onMore }, 'Prikaži sve ›') : null),
    h('div', { class: 'row-wrap' },
      h('button', { class: 'row-arrow left', onclick: () => scroll(-1) }, '‹'),
      track,
      h('button', { class: 'row-arrow right', onclick: () => scroll(1) }, '›')));
}
