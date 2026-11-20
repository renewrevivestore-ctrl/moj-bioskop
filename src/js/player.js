// Plejer: filmovi (MP4), TV uživo (HLS) i YouTube
const Player = {
  hls: null, item: null, srcIndex: 0, cues: null, offset: 0, track: null, saveTimer: null, yt: null,

  el: () => $('#pVideo'),

  init() {
    $('#pClose').onclick = () => this.close();
    $('#pSubs').onclick = () => this.toggleSubsPanel();
    $('#pAlt').onclick = () => this.nextSource(true);
    document.addEventListener('keydown', (e) => {
      if ($('#player').classList.contains('hidden')) return;
      if (e.key === 'Escape') this.close();
      if (e.target.tagName === 'INPUT') return;
      const v = this.el();
      if (e.key === ' ') { e.preventDefault(); v.paused ? v.play() : v.pause(); }
      if (e.key === 'ArrowRight') v.currentTime += 10;
      if (e.key === 'ArrowLeft') v.currentTime -= 10;
      if (e.key === 'f') document.fullscreenElement ? document.exitFullscreen() : $('#player').requestFullscreen();
    });
    const v = this.el();
    v.addEventListener('error', () => this.onError());
    v.addEventListener('playing', () => this.msg(null));
    v.addEventListener('waiting', () => { if (this.item?.live) this.msg('Učitavam strim…'); });
    v.addEventListener('ended', () => { if (this.item?.progressKey) Progress.remove(this.item.progressKey); });
    document.documentElement.style.setProperty('--sub-size', Prefs.get('subSize') + 'px');
  },

  msg(text) { const m = $('#pMsg'); if (!text) m.classList.add('hidden'); else { m.textContent = text; m.classList.remove('hidden'); } },

  open(item) {
    this.stop();
    this.item = item; this.srcIndex = 0; this.cues = null; this.offset = 0;
    $('#pTitle').textContent = item.title || '';
    $('#player').classList.remove('hidden');
    $('#subsPanel').classList.add('hidden');
    $('#pSubs').classList.toggle('hidden', !!item.live || !!item.youtube);
    $('#pAlt').classList.toggle('hidden', !(item.sources && item.sources.length > 1));
  },

  // Film / epizoda sa archive.org
  playVideo(item) {
    this.open(item);
    this.el().classList.remove('hidden');
    this.loadSource();
    // Automatski uključi najbolji titl prema redosledu jezika
    const subs = (item.subs || []).slice().sort((a, b) => Subs.rank(a.lang) - Subs.rank(b.lang));
    if (subs.length && Subs.rank(subs[0].lang) < 99) this.loadSubUrl(subs[0]);
    const pr = item.progressKey && Progress.get(item.progressKey);
    if (pr && pr.t > 30 && (!pr.d || pr.t < pr.d - 60)) {
      this.el().addEventListener('loadedmetadata', () => { this.el().currentTime = pr.t; toast('Nastavljam od ' + this.fmt(pr.t)); }, { once: true });
    }
    if (item.progressKey) {
      this.saveTimer = setInterval(() => {
        const v = this.el();
        if (!v.paused && v.currentTime > 5) Progress.set(item.progressKey, { t: v.currentTime, d: v.duration || 0, title: item.title, poster: item.poster, ref: item.ref });
      }, 5000);
    }
  },

  // TV kanal (HLS / m3u8)
  playLive(item) {
    this.open({ ...item, live: true });
    this.el().classList.remove('hidden');
    this.loadSource();
  },

  playYouTube(item) {
    this.open({ ...item, youtube: true });
    this.el().classList.add('hidden');
    const langs = Prefs.get('subLangs');
    const src = `https://www.youtube-nocookie.com/embed/${enc(item.videoId)}?autoplay=1&rel=0&cc_load_policy=1&cc_lang_pref=${langs[0]}&hl=${langs[0]}`;
    this.yt = h('iframe', { src, class: 'yt-frame', allow: 'autoplay; encrypted-media; fullscreen; picture-in-picture', allowfullscreen: true, referrerpolicy: 'strict-origin-when-cross-origin' });
    $('#pStage').append(this.yt);
  },

  async loadSource() {
    const s = this.item.sources[this.srcIndex];
    const v = this.el();
    if (this.hls) { this.hls.destroy(); this.hls = null; }
    this.msg(this.item.live ? 'Povezujem se na kanal…' : 'Učitavam…');
    await window.api.streamHeaders(s.url, s.referer || null, s.ua || null);
    const isHls = /\.m3u8(\?|$)/i.test(s.url) || s.hls;
    if (isHls && window.Hls && Hls.isSupported()) {
      this.hls = new Hls({ enableWorker: true, lowLatencyMode: true, manifestLoadingMaxRetry: 2, levelLoadingMaxRetry: 2 });
      this.hls.on(Hls.Events.ERROR, (_e, d) => { if (d.fatal) this.onError(); });
      this.hls.loadSource(s.url);
      this.hls.attachMedia(v);
      this.hls.on(Hls.Events.MANIFEST_PARSED, () => v.play().catch(() => {}));
    } else {
      v.src = s.url;
      v.play().catch(() => {});
    }
  },

  onError() {
    if (!this.item || this.item.youtube || !$('#pVideo').currentSrc && !this.hls) return;
    if (!this.nextSource(false)) {
      if (this.item.live && this.item.channelId) { TV.setHealth(this.item.channelId, false); TV.mark(this.item.channelId, 'bad'); }
      this.msg(this.item.live
        ? 'Kanal trenutno nije dostupan (možda je ograničen na zemlju emitovanja ili je ugašen). Probaj drugi kanal.'
        : 'Video ne može da se pusti. Otvori ga na izvornom sajtu iz detalja naslova.');
    }
  },

  nextSource(manual) {
    if (!this.item?.sources || this.srcIndex >= this.item.sources.length - 1) {
      if (manual && this.item?.sources?.length > 1) { this.srcIndex = -1; } else return false;
    }
    this.srcIndex++;
    toast(`Izvor ${this.srcIndex + 1} od ${this.item.sources.length}`);
    this.loadSource();
    return true;
  },

  stop() {
    clearInterval(this.saveTimer);
    if (this.hls) { this.hls.destroy(); this.hls = null; }
    const v = this.el();
    v.pause(); v.removeAttribute('src'); v.load();
    for (const t of v.textTracks) t.mode = 'disabled';
    if (this.yt) { this.yt.remove(); this.yt = null; }
    this.msg(null);
  },

  close() {
    const v = this.el();
    if (this.item?.progressKey && v.currentTime > 5) Progress.set(this.item.progressKey, { t: v.currentTime, d: v.duration || 0, title: this.item.title, poster: this.item.poster, ref: this.item.ref });
    this.stop();
    if (document.fullscreenElement) document.exitFullscreen();
    $('#player').classList.add('hidden');
    this.item = null;
    if (App.current === 'mylist') App.go('mylist');
  },

  fmt(s) { s = Math.floor(s); const hh = Math.floor(s / 3600), mm = Math.floor(s / 60) % 60, ss = s % 60; return (hh ? hh + ':' : '') + String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0'); },

  // ---------- Titlovi ----------
  applyCues(cues, label, lang) {
    this.cues = cues; this.offset = 0;
    this.curLabel = label; this.curLang = lang;
    this.renderTrack();
    toast(`Titl: ${label}`);
    this.renderSubsPanel();
  },

  renderTrack() {
    const v = this.el();
    for (const t of v.textTracks) t.mode = 'disabled';
    if (!this.cues) return;
    const tr = v.addTextTrack('subtitles', this.curLabel, this.curLang);
    for (const c of this.cues) {
      const s = Math.max(0, c.start + this.offset), e = Math.max(0.05, c.end + this.offset);
      try { tr.addCue(new VTTCue(s, e, c.text)); } catch {}
    }
    tr.mode = 'showing';
    this.track = tr;
  },

  async loadSubUrl(sub) {
    try {
      const bytes = await window.api.buffer(sub.url);
      this.applyCues(Subs.parse(Subs.decode(bytes)), sub.label, sub.lang);
    } catch (e) { toast('Titl nije učitan: ' + e.message); }
  },

  toggleSubsPanel() {
    const p = $('#subsPanel');
    p.classList.toggle('hidden');
    if (!p.classList.contains('hidden')) this.renderSubsPanel();
  },

  renderSubsPanel() {
    const p = $('#subsPanel');
    if (p.classList.contains('hidden') || !this.item) return;
    p.innerHTML = '';
    const subs = (this.item.subs || []).slice().sort((a, b) => Subs.rank(a.lang) - Subs.rank(b.lang));
    const osList = h('div', { class: 'os-list' });

    p.append(
      h('div', { class: 'sp-head' }, h('b', {}, 'Titlovi'), h('button', { class: 'icon-btn', onclick: () => p.classList.add('hidden') }, '✕')),
      this.cues ? h('div', { class: 'sp-cur' }, 'Aktivan: ', h('b', {}, this.curLabel),
        h('div', { class: 'sp-offset' },
          h('button', { class: 'btn small ghost', onclick: () => { this.offset -= 0.5; this.renderTrack(); this.renderSubsPanel(); } }, '−0.5s'),
          h('span', {}, `Pomeraj ${this.offset >= 0 ? '+' : ''}${this.offset.toFixed(1)}s`),
          h('button', { class: 'btn small ghost', onclick: () => { this.offset += 0.5; this.renderTrack(); this.renderSubsPanel(); } }, '+0.5s')),
        h('button', { class: 'btn small ghost', onclick: () => { this.cues = null; this.renderTrack(); this.renderSubsPanel(); } }, 'Isključi titl')) : null,
      h('div', { class: 'sp-sec' }, 'Uz video (' + subs.length + ')'),
      subs.length ? subs.map((s) => h('button', { class: 'sp-item', onclick: () => this.loadSubUrl(s) },
        h('span', { class: 'lang lang-' + s.lang }, Subs.LANG_NAMES[s.lang] || s.lang), s.label)) : h('div', { class: 'muted' }, 'Nema ugrađenih titlova.'),
      h('div', { class: 'sp-sec' }, 'Pretraga titlova'),
      h('button', { class: 'btn small', onclick: () => this.searchOS(osList) }, 'Traži srpski titl (OpenSubtitles)'),
      h('button', { class: 'btn small ghost', onclick: async () => {
        const f = await window.api.pickSubtitle();
        if (f) this.applyCues(Subs.parse(Subs.decode(f.data)), f.name, Subs.langFromName(f.name));
      } }, 'Učitaj titl sa računara'),
      osList,
      h('div', { class: 'sp-sec' }, 'Veličina slova'),
      h('input', { type: 'range', min: 16, max: 56, value: Prefs.get('subSize'), oninput: (e) => {
        Prefs.set('subSize', +e.target.value);
        document.documentElement.style.setProperty('--sub-size', e.target.value + 'px');
      } }),
    );
  },

  async searchOS(box) {
    box.innerHTML = ''; box.append(spinner('Tražim titlove…'));
    try {
      const m = this.item.meta || {};
      let res = await Subs.osSearch(m.title || this.item.title, m.year);
      if (!res.length && m.year) res = await Subs.osSearch(m.title || this.item.title);
      box.innerHTML = '';
      if (!res.length) { box.append(h('div', { class: 'muted' }, 'Nije pronađen titl na izabranim jezicima.')); return; }
      res.slice(0, 25).forEach((r) => box.append(h('button', { class: 'sp-item', onclick: async () => {
        toast('Preuzimam titl…');
        try { this.applyCues(Subs.parse(await Subs.osDownload(r.fileId)), r.release || r.fileName, r.lang); }
        catch (e) { toast('Greška: ' + e.message.slice(0, 120), 6000); }
      } }, h('span', { class: 'lang lang-' + r.lang }, Subs.LANG_NAMES[r.lang] || r.lang), r.release || r.fileName, h('small', {}, ` ⬇${r.downloads}`))));
    } catch (e) { box.innerHTML = ''; box.append(h('div', { class: 'muted' }, e.message.slice(0, 200))); }
  },
};
