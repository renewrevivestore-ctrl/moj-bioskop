// TV kanali uživo — besplatni, javno dostupni strimovi (baza iptv-org, osvežava se svaka 24h)
const TV = {
  placeholder: 'Pretraži TV kanale…',
  data: null, country: 'home', category: '', q: '', limit: 120,

  async load(force) {
    if (this.data && !force) return this.data;
    const A = CONFIG.IPTV_API;
    const get = (n) => window.api.cached('iptv_' + n, `${A}/${n}.json`, 24, force);
    const [channels, streams, countries, categories, logos] = await Promise.all([
      get('channels'), get('streams'), get('countries'), get('categories'), get('logos').catch(() => []),
    ]);
    const logoMap = new Map();
    for (const l of logos || []) if (!logoMap.has(l.channel) || !l.feed) logoMap.set(l.channel, l.url);
    const chMap = new Map(channels.map((c) => [c.id, c]));
    const byId = new Map();
    for (const s of streams) {
      if (!s.url) continue;
      const c = s.channel ? chMap.get(s.channel) : null;
      if (c && (c.is_nsfw || c.closed)) continue;
      const id = s.channel || 'x:' + (s.title || s.url);
      let e = byId.get(id);
      if (!e) {
        e = {
          id, name: c?.name || s.title || 'Kanal', country: c?.country || '', categories: c?.categories || [],
          logo: logoMap.get(s.channel) || c?.logo || '', website: c?.website || '', alt: (c?.alt_names || []).join(' '), sources: [],
        };
        byId.set(id, e);
      }
      e.sources.push({ url: s.url, referer: s.referrer || s.http_referrer || null, ua: s.user_agent || null, quality: s.quality || '' });
    }
    const q = (x) => parseInt(x.quality) || 0;
    const list = [...byId.values()].filter((c) => c.country || c.sources.length);
    list.forEach((c) => c.sources.sort((a, b) => q(b) - q(a)));
    this.data = {
      list: list.sort((a, b) => a.name.localeCompare(b.name, 'sr')),
      countries: new Map((countries || []).map((c) => [c.code, c.name])),
      categories: new Map((categories || []).map((c) => [c.id, c.name])),
    };
    return this.data;
  },

  CAT_SR: { news: 'Vesti', sports: 'Sport', movies: 'Filmovi', series: 'Serije', music: 'Muzika', kids: 'Deca', documentary: 'Dokumentarni', entertainment: 'Zabava', general: 'Opšti', culture: 'Kultura', education: 'Obrazovanje', religious: 'Religija', lifestyle: 'Životni stil', comedy: 'Komedija', classic: 'Klasika', animation: 'Animacija', cooking: 'Kuvanje', travel: 'Putovanja', weather: 'Vreme', legislative: 'Skupština', business: 'Biznis', science: 'Nauka', family: 'Porodica', auto: 'Automobili', outdoor: 'Priroda', relax: 'Opuštanje', shop: 'Šoping' },
  COUNTRY_SR: { RS: 'Srbija', BA: 'Bosna i Hercegovina', ME: 'Crna Gora', HR: 'Hrvatska', MK: 'Severna Makedonija', SI: 'Slovenija' },
  cname(code) { return this.COUNTRY_SR[code] || this.data?.countries.get(code) || code; },
  catName(id) { return this.CAT_SR[id] || this.data?.categories.get(id) || id; },

  favs() { return Store.get('tvFavs', []); },
  toggleFav(id) { const f = this.favs(); const i = f.indexOf(id); i < 0 ? f.push(id) : f.splice(i, 1); Store.set('tvFavs', f); return i < 0; },

  async render(view) {
    view.innerHTML = '';
    view.append(spinner('Učitavam bazu TV kanala…'));
    try { await this.load(); } catch (e) { view.innerHTML = ''; view.append(emptyMsg('Baza TV kanala trenutno nije dostupna: ' + e.message)); return; }
    this.q = $('#search').value.trim();
    this.draw(view);
  },

  search(q) { this.q = q; this.limit = 120; this.draw($('#view')); },

  draw(view) {
    const d = this.data;
    const used = new Set(d.list.map((c) => c.country).filter(Boolean));
    const cats = new Set(d.list.flatMap((c) => c.categories));
    const sel = (opts, val, on) => { const s = h('select', { onchange: (e) => on(e.target.value) }, opts.map(([v, t]) => h('option', { value: v, selected: v === val }, t))); return s; };

    const countryOpts = [['home', 'Srbija i region'], ['fav', '★ Omiljeni'], ['all', 'Sve zemlje'],
      ...CONFIG.TV_HOME.filter((c) => used.has(c)).map((c) => [c, this.cname(c)]),
      ['-', '──────────'],
      ...[...used].filter((c) => !CONFIG.TV_HOME.includes(c)).map((c) => [c, this.cname(c)]).sort((a, b) => a[1].localeCompare(b[1], 'sr'))];
    const catOpts = [['', 'Sve kategorije'], ...[...cats].map((c) => [c, this.catName(c)]).sort((a, b) => a[1].localeCompare(b[1], 'sr'))];

    let list = d.list;
    const favs = this.favs();
    if (this.country === 'home') list = list.filter((c) => CONFIG.TV_HOME.includes(c.country));
    else if (this.country === 'fav') list = list.filter((c) => favs.includes(c.id));
    else if (this.country !== 'all' && this.country !== '-') list = list.filter((c) => c.country === this.country);
    if (this.category) list = list.filter((c) => c.categories.includes(this.category));
    if (this.q) {
      const qq = this.q.toLowerCase();
      list = (this.country === 'home' ? d.list : list).filter((c) => (c.name + ' ' + c.alt + ' ' + c.id).toLowerCase().includes(qq));
      if (this.category) list = list.filter((c) => c.categories.includes(this.category));
    }
    if (this.country === 'home' && !this.q) {
      const order = (c) => CONFIG.TV_HOME.indexOf(c.country);
      list = list.slice().sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name, 'sr'));
    }

    view.innerHTML = '';
    view.append(
      h('div', { class: 'page-head' },
        h('h1', {}, 'TV uživo'),
        h('div', { class: 'filters' },
          sel(countryOpts, this.country, (v) => { if (v !== '-') { this.country = v; this.limit = 120; this.draw(view); } }),
          sel(catOpts, this.category, (v) => { this.category = v; this.limit = 120; this.draw(view); }),
          h('span', { class: 'muted' }, `${list.length} kanala`),
          h('button', { class: 'btn small ghost', title: 'Preuzmi najnoviju bazu kanala', onclick: async () => { view.innerHTML = ''; view.append(spinner('Osvežavam bazu…')); this.data = null; await this.load(true); this.draw(view); toast('Baza kanala osvežena'); } }, '⟳ Osveži'))),
    );

    if (!list.length) { view.append(emptyMsg(this.country === 'fav' ? 'Još nemaš omiljene kanale. Klikni ☆ na kanalu da ga dodaš.' : 'Nema kanala za izabrani filter.')); return; }

    const grid = h('div', { class: 'tv-grid' });
    let lastCountry = null;
    const grouped = this.country === 'home' && !this.q;
    list.slice(0, this.limit).forEach((c) => {
      if (grouped && c.country !== lastCountry) { lastCountry = c.country; grid.append(h('h2', { class: 'tv-group' }, this.cname(c.country))); }
      grid.append(this.tile(c));
    });
    view.append(grid);
    if (list.length > this.limit) view.append(h('button', { class: 'btn ghost more', onclick: () => { this.limit += 240; this.draw(view); } }, `Prikaži još (${list.length - this.limit})`));
    view.append(h('div', { class: 'hint' }, 'Kanali su javno dostupni besplatni strimovi koje održava zajednica iptv-org. Neki rade samo u zemlji emitovanja ili povremeno nisu aktivni — tada probaj „Drugi izvor” u plejeru ili drugi kanal.'));
  },

  tile(c) {
    const fav = this.favs().includes(c.id);
    const star = h('button', { class: 'star' + (fav ? ' on' : ''), title: 'Omiljeni', onclick: (e) => { e.stopPropagation(); const on = this.toggleFav(c.id); star.classList.toggle('on', on); star.textContent = on ? '★' : '☆'; } }, fav ? '★' : '☆');
    return h('div', { class: 'tv-tile', tabindex: 0, onclick: () => this.play(c), onkeydown: (e) => e.key === 'Enter' && this.play(c) },
      star,
      h('div', { class: 'tv-logo' }, c.logo ? h('img', { src: c.logo, loading: 'lazy', alt: '', onerror: (e) => e.target.replaceWith(h('span', {}, c.name.slice(0, 2).toUpperCase())) }) : h('span', {}, c.name.slice(0, 2).toUpperCase())),
      h('div', { class: 'tv-name', title: c.name }, c.name),
      h('div', { class: 'tv-meta' }, [this.cname(c.country), c.categories.slice(0, 2).map((x) => this.catName(x)).join(', ')].filter(Boolean).join(' · ')));
  },

  play(c) {
    Player.playLive({ title: `${c.name}${c.country ? ' · ' + this.cname(c.country) : ''}`, sources: c.sources });
  },
};
