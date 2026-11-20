// Galerija filmova i serija: Internet Archive (javno dobro) + YouTube (opciono, uz API ključ)
const SAFE = ' AND mediatype:movies AND NOT subject:(adult OR porn OR xxx OR erotic OR erotica OR nsfw OR sex)';
const DOMACE = '(language:(srp OR hrv OR bos OR hbs OR scr OR scc OR serbian OR croatian OR bosnian OR "serbo-croatian" OR srpski) OR subject:(yugoslavia OR yugoslav OR jugoslavija OR jugoslovenski OR "domaći film" OR "domaci film" OR srpski OR serbia OR srbija))';
const SR_SUBS = '(subject:("srpski prevod" OR "serbian subtitles" OR "sa prevodom" OR "srpski titl" OR "prevod") OR description:("srpski prevod" OR "serbian subtitles" OR "srpski titl" OR "sa prevodom"))';

const IA = {
  ROWS: [
    { id: 'novo', title: 'Novo dodato', q: 'collection:(feature_films OR classic_tv OR classic_cartoons OR film_noir OR silent_films)', sort: 'addeddate desc', isNew: true },
    { id: 'domace', title: 'Domaće i ex-YU (na našem jeziku)', q: DOMACE, sort: 'downloads desc', sr: true },
    { id: 'srtitl', title: 'Sa srpskim prevodom', q: SR_SUBS, sort: 'downloads desc', sr: true },
    { id: 'popular', title: 'Najgledaniji klasici', q: 'collection:feature_films', sort: 'downloads desc' },
    { id: 'crtani', title: 'Crtani filmovi', q: 'collection:(classic_cartoons OR animationandcartoons)', sort: 'downloads desc' },
    { id: 'tv', title: 'Klasične TV serije', q: 'collection:classic_tv', sort: 'downloads desc' },
    { id: 'noir', title: 'Film noir', q: '(collection:film_noir OR (collection:feature_films AND subject:noir))', sort: 'downloads desc' },
    { id: 'horor', title: 'Horor i naučna fantastika', q: '(collection:SciFi_Horror OR (collection:feature_films AND subject:(horror OR "science fiction" OR sci-fi)))', sort: 'downloads desc' },
    { id: 'komedija', title: 'Komedije', q: '(collection:Comedy_Films OR (collection:feature_films AND subject:comedy))', sort: 'downloads desc' },
    { id: 'vestern', title: 'Vesterni', q: 'collection:feature_films AND subject:western', sort: 'downloads desc' },
    { id: 'akcija', title: 'Akcija i avantura', q: 'collection:feature_films AND subject:(action OR adventure OR war)', sort: 'downloads desc' },
    { id: 'nemi', title: 'Nemi filmovi', q: '(collection:silent_films OR (collection:feature_films AND subject:silent))', sort: 'downloads desc' },
    { id: 'dok', title: 'Dokumentarci', q: '(collection:documentaryandshortfilms OR (collection:(feature_films OR moviesandfilms) AND subject:documentary))', sort: 'downloads desc' },
  ],

  url(q, rows, page, sort) {
    const fl = ['identifier', 'title', 'year', 'language', 'addeddate', 'downloads', 'description'].map((f) => 'fl%5B%5D=' + f).join('&');
    return `https://archive.org/advancedsearch.php?q=${enc(q + SAFE)}&${fl}&rows=${rows}&page=${page}&sort%5B%5D=${enc(sort)}&output=json`;
  },

  async query(q, { rows = 30, page = 1, sort = 'downloads desc', cacheHours = 6 } = {}) {
    const url = this.url(q, rows, page, sort);
    const key = 'ia_' + btoa(unescape(enc(q + '|' + sort + '|' + page + '|' + rows))).replace(/[^a-z0-9]/gi, '').slice(-60);
    const r = cacheHours ? await window.api.cached(key, url, cacheHours) : await window.api.json(url);
    const docs = r?.response?.docs || [];
    return { total: r?.response?.numFound || 0, items: docs.map(this.toItem) };
  },

  toItem(d) {
    const lang = [].concat(d.language || []).join(' ').toLowerCase();
    return {
      type: 'ia', id: d.identifier, key: 'ia:' + d.identifier,
      title: stripHtml(first(d.title) || d.identifier),
      year: d.year ? String(first(d.year)).slice(0, 4) : '',
      poster: `https://archive.org/services/img/${d.identifier}`,
      added: d.addeddate || '',
      sr: /(srp|hrv|bos|hbs|scr|serb|croat|bosn)/.test(lang),
      desc: stripHtml(first(d.description) || '').slice(0, 600),
    };
  },

  dl(id, name) { return `https://archive.org/download/${enc(id)}/${name.split('/').map(enc).join('/')}`; },

  // Učitaj fajlove naslova: epizode (video) i titlove
  async details(id) {
    const m = await window.api.cached('meta_' + id.replace(/[^a-z0-9_.-]/gi, '_'), `https://archive.org/metadata/${enc(id)}`, 24);
    const files = m.files || [];
    const vidRe = /\.(mp4|m4v|webm|ogv|mkv)$/i;
    const subRe = /\.(srt|vtt)$/i;
    const base = (n) => n.replace(/\.(mp4|m4v|webm|ogv|mkv|avi|mpg|mpeg|mov|wmv|flv)$/i, '').replace(/(\.ia|_512kb|\.h264|_hd|\.hd|_edit)$/i, '');
    const rank = (f) => {
      const fmt = (f.format || '').toLowerCase(); const n = f.name.toLowerCase();
      if (n.endsWith('.mp4') || n.endsWith('.m4v')) return fmt === 'h.264 hd' ? 1 : fmt === 'h.264' ? 2 : fmt === 'mpeg4' ? 3 : fmt.includes('512kb') ? 4 : 5;
      return n.endsWith('.webm') ? 6 : n.endsWith('.ogv') ? 7 : 8;
    };
    const groups = new Map();
    for (const f of files) {
      if (!vidRe.test(f.name) || /sample|trailer/i.test(f.name) && files.length > 4) continue;
      const k = base(f.name);
      (groups.get(k) || groups.set(k, []).get(k)).push(f);
    }
    const subsAll = files.filter((f) => subRe.test(f.name)).map((f) => ({
      name: f.name, url: this.dl(id, f.name), lang: Subs.langFromName(f.name), label: f.name.split('/').pop(),
    }));
    const episodes = [...groups.entries()].map(([k, fs]) => {
      fs.sort((a, b) => rank(a) - rank(b));
      return {
        name: stripHtml(fs[0].title || k.split('/').pop().replace(/[_]+/g, ' ')),
        sources: fs.map((f) => ({ url: this.dl(id, f.name) })),
        subs: groups.size === 1 ? subsAll : subsAll.filter((s) => s.name.startsWith(k) || s.name.toLowerCase().startsWith(k.toLowerCase())),
      };
    }).sort((a, b) => a.name.localeCompare(b.name, 'sr', { numeric: true }));
    const md = m.metadata || {};
    return {
      episodes, subsAll,
      title: stripHtml(first(md.title) || id),
      year: String(first(md.year) || first(md.date) || '').slice(0, 4),
      desc: stripHtml(first(md.description) || ''),
      runtime: first(md.runtime) || '',
      subjects: [].concat(md.subject || []).slice(0, 8),
    };
  },
};

const YT = {
  ROWS: [
    { id: 'yt_domaci', title: 'YouTube · Domaći filmovi', q: 'domaći film ceo film' },
    { id: 'yt_prevod', title: 'YouTube · Filmovi sa prevodom', q: 'ceo film sa prevodom' },
    { id: 'yt_crtani', title: 'YouTube · Crtani sinhronizovani na srpski', q: 'crtani film sinhronizovano na srpski ceo' },
    { id: 'yt_serije', title: 'YouTube · Domaće serije', q: 'domaća serija cela epizoda' },
    { id: 'yt_dok', title: 'YouTube · Dokumentarci na srpskom', q: 'dokumentarni film srpski' },
  ],
  enabled() { return !!Prefs.get('ytKey'); },
  async search(q, cacheHours = 12, pageToken = '') {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=25&videoEmbeddable=true&safeSearch=moderate&regionCode=RS&relevanceLanguage=sr&videoDuration=long&q=${enc(q)}${pageToken ? '&pageToken=' + pageToken : ''}&key=${enc(Prefs.get('ytKey'))}`;
    const key = 'yt_' + btoa(unescape(enc(q + pageToken))).replace(/[^a-z0-9]/gi, '').slice(-50);
    const r = cacheHours ? await window.api.cached(key, url, cacheHours) : await window.api.json(url);
    return {
      next: r.nextPageToken || '',
      items: (r.items || []).filter((i) => i.id?.videoId).map((i) => ({
        type: 'yt', id: i.id.videoId, key: 'yt:' + i.id.videoId,
        title: stripHtml(i.snippet.title), year: (i.snippet.publishedAt || '').slice(0, 4),
        poster: i.snippet.thumbnails?.high?.url || i.snippet.thumbnails?.medium?.url, channel: i.snippet.channelTitle,
        desc: stripHtml(i.snippet.description), wide: true,
      })),
    };
  },
};

const Movies = {
  placeholder: 'Pretraži filmove i serije…',

  card(item, opts = {}) {
    const isNew = opts.lastSeen && item.added && item.added > opts.lastSeen;
    return h('div', { class: 'card' + (item.wide ? ' wide' : ''), tabindex: 0, onclick: () => Movies.openItem(item), onkeydown: (e) => e.key === 'Enter' && Movies.openItem(item) },
      h('div', { class: 'poster' },
        h('img', { src: item.poster, loading: 'lazy', alt: '', onerror: (e) => e.target.classList.add('noimg') }),
        h('div', { class: 'poster-fallback' }, item.title),
        isNew ? h('span', { class: 'ribbon' }, 'NOVO') : null,
        item.sr ? h('span', { class: 'tag-sr' }, 'SR') : null,
        item.type === 'yt' ? h('span', { class: 'tag-src' }, 'YouTube') : null,
        item.pct ? h('div', { class: 'pbar' }, h('i', { style: `width:${item.pct}%` })) : null),
      h('div', { class: 'card-title', title: item.title }, item.title),
      h('div', { class: 'card-sub' }, [item.year, item.channel].filter(Boolean).join(' · ')));
  },

  async render(view) {
    view.innerHTML = '';
    const lastSeen = Store.get('lastSeenAdded', '');
    const hero = h('div', { class: 'hero' });
    view.append(hero);

    // Nastavi gledanje
    const cont = Progress.list().filter((p) => p.ref).slice(0, 20).map((p) => ({ ...p.ref, pct: p.d ? Math.min(100, (p.t / p.d) * 100) : 0 }));
    if (cont.length) view.append(row('Nastavi gledanje', cont, (i) => this.card(i)));

    const rowsBox = h('div'); view.append(rowsBox);
    const all = [...IA.ROWS.slice(0, 3).map((r) => ({ ...r, src: 'ia' })),
      ...(YT.enabled() ? YT.ROWS.map((r) => ({ ...r, src: 'yt' })) : []),
      ...IA.ROWS.slice(3).map((r) => ({ ...r, src: 'ia' }))];

    const slots = all.map(() => { const s = h('div', { class: 'row-slot' }, h('div', { class: 'row skeleton' })); rowsBox.append(s); return s; });
    let heroSet = false;
    await Promise.all(all.map(async (r, i) => {
      try {
        const res = r.src === 'ia' ? await IA.query(r.q, { rows: 30, sort: r.sort }) : await YT.search(r.q);
        if (!res.items.length) { slots[i].remove(); return; }
        let title = r.title;
        if (r.isNew) {
          const n = lastSeen ? res.items.filter((x) => x.added > lastSeen).length : 0;
          if (n) title += ` · ${n} novih od poslednje posete`;
          if (res.items[0]?.added) setTimeout(() => Store.set('lastSeenAdded', res.items[0].added), 15000);
        }
        slots[i].replaceWith(row(title, res.items, (it) => this.card(it, { lastSeen: r.isNew ? lastSeen : '' }), () => this.grid(r)));
        if (!heroSet && r.id === 'popular') { heroSet = true; this.renderHero(hero, res.items[Math.floor(Math.random() * Math.min(10, res.items.length))]); }
      } catch (e) {
        slots[i].replaceWith(h('div', { class: 'row-error' }, `${r.title}: izvor trenutno nije dostupan (${String(e.message).slice(0, 80)})`));
      }
    }));
    if (!heroSet) hero.remove();
    if (!YT.enabled()) view.append(h('div', { class: 'hint' }, 'Savet: dodaj besplatan YouTube API ključ u Podešavanjima da bi se pojavili domaći filmovi, serije i crtaći sa YouTube-a (sa srpskim titlovima gde postoje).'));
  },

  async renderHero(el, item) {
    if (!item) return;
    el.style.backgroundImage = `linear-gradient(90deg, #0b0b0f 25%, rgba(11,11,15,.6) 60%, rgba(11,11,15,.1)), url("${item.poster}")`;
    el.append(h('div', { class: 'hero-body' },
      h('div', { class: 'hero-kicker' }, 'Preporuka'),
      h('h1', {}, item.title),
      h('p', {}, (item.desc || '').slice(0, 260) + ((item.desc || '').length > 260 ? '…' : '')),
      h('div', { class: 'hero-btns' },
        h('button', { class: 'btn', onclick: () => this.play(item) }, '▶ Pusti'),
        h('button', { class: 'btn ghost', onclick: () => this.openItem(item) }, 'Detalji'))));
  },

  // Mreža sa beskonačnim učitavanjem
  async grid(r, isSearch) {
    const view = $('#view');
    view.innerHTML = '';
    const grid = h('div', { class: 'grid' });
    const more = h('button', { class: 'btn ghost more' }, 'Učitaj još');
    view.append(h('div', { class: 'page-head' }, h('button', { class: 'link', onclick: () => App.go('movies') }, '‹ Nazad'), h('h1', {}, r.title)), grid, more);
    let page = 1, token = '', done = false;
    const load = async () => {
      if (done) return;
      more.disabled = true; more.textContent = 'Učitavam…';
      try {
        let items;
        if (r.src === 'yt') { const res = await YT.search(r.q, isSearch ? 1 : 12, token); token = res.next; items = res.items; done = !token; }
        else { const res = await IA.query(r.q, { rows: 48, page, sort: r.sort, cacheHours: isSearch ? 1 : 6 }); items = res.items; done = page * 48 >= res.total; page++; }
        items.forEach((i) => grid.append(this.card(i)));
        if (!grid.children.length) grid.append(emptyMsg('Nema rezultata.'));
      } catch (e) { grid.append(emptyMsg('Greška: ' + e.message)); done = true; }
      more.disabled = false; more.textContent = 'Učitaj još';
      more.classList.toggle('hidden', done);
    };
    more.onclick = load;
    await load();
  },

  async search(q) {
    const view = $('#view');
    view.innerHTML = '';
    view.append(h('div', { class: 'page-head' }, h('h1', {}, `Rezultati za „${q}”`)));
    const qq = q.replace(/[():"\\]/g, ' ').trim();
    const iaQ = `(title:(${qq}) OR subject:(${qq}) OR creator:(${qq}))`;
    const blocks = [
      { title: 'Internet Archive', src: 'ia', q: iaQ, sort: 'downloads desc' },
      ...(YT.enabled() ? [{ title: 'YouTube', src: 'yt', q: qq + ' ceo film' }] : []),
    ];
    for (const b of blocks) {
      const slot = h('div', {}, spinner(`Tražim na: ${b.title}…`)); view.append(slot);
      (async () => {
        try {
          const res = b.src === 'ia' ? await IA.query(b.q, { rows: 30, sort: b.sort, cacheHours: 1 }) : await YT.search(b.q, 1);
          slot.replaceWith(res.items.length ? row(`${b.title} (${res.total || res.items.length})`, res.items, (i) => this.card(i), () => this.grid({ ...b, title: `${b.title}: „${q}”` }, true)) : h('div', { class: 'row-error' }, `${b.title}: nema rezultata.`));
        } catch (e) { slot.replaceWith(h('div', { class: 'row-error' }, `${b.title}: greška (${e.message.slice(0, 80)})`)); }
      })();
    }
    view.append(h('div', { class: 'hint' }, 'Ne nalaziš naslov? Probaj karticu „Katalog sajtova” — pretraga se tamo šalje direktno na Tubi, Pluto TV, Plex, RTS Planetu i druge.'));
  },

  async openItem(item) {
    const fav = h('button', { class: 'btn ghost' }, MyList.has(item.key) ? '✓ U mojoj listi' : '+ Moja lista');
    fav.onclick = () => { const on = MyList.toggle(item.key, item); fav.textContent = on ? '✓ U mojoj listi' : '+ Moja lista'; };
    const body = h('div', { class: 'detail-body' }, spinner());
    const srcUrl = item.type === 'yt' ? `https://www.youtube.com/watch?v=${item.id}` : `https://archive.org/details/${item.id}`;
    Modal.open(h('div', { class: 'detail' },
      h('button', { class: 'icon-btn modal-x', onclick: () => Modal.close() }, '✕'),
      h('div', { class: 'detail-poster' + (item.wide ? ' wide' : '') }, h('img', { src: item.poster, alt: '' })),
      h('div', { class: 'detail-info' },
        h('h1', {}, item.title),
        h('div', { class: 'meta' }, [item.year, item.channel, item.type === 'yt' ? 'YouTube' : 'Internet Archive · javno dobro'].filter(Boolean).join(' · ')),
        body,
        h('div', { class: 'detail-btns' },
          h('button', { class: 'btn', id: 'dPlay', onclick: () => this.play(item) }, '▶ Pusti'),
          fav,
          h('button', { class: 'btn ghost', onclick: () => window.api.open(srcUrl) }, 'Otvori izvor ↗')))));
    if (item.type === 'yt') { body.innerHTML = ''; body.append(h('p', { class: 'desc' }, item.desc || '')); return; }
    try {
      const d = await IA.details(item.id);
      this._details = { id: item.id, d };
      body.innerHTML = '';
      const hasSr = d.subsAll.some((s) => ['sr', 'hr', 'bs'].includes(s.lang));
      body.append(
        h('div', { class: 'chips' },
          hasSr ? h('span', { class: 'chip good' }, 'Ima titl na našem jeziku') : null,
          d.subsAll.length ? h('span', { class: 'chip' }, `Titlova: ${d.subsAll.length}`) : h('span', { class: 'chip' }, 'Bez ugrađenih titlova — možeš ih tražiti u plejeru'),
          d.runtime ? h('span', { class: 'chip' }, d.runtime) : null,
          d.episodes.length > 1 ? h('span', { class: 'chip' }, `Epizoda/delova: ${d.episodes.length}`) : null),
        h('p', { class: 'desc' }, d.desc.slice(0, 900) + (d.desc.length > 900 ? '…' : '')),
        d.subjects.length ? h('div', { class: 'subjects' }, d.subjects.join(' · ')) : null);
      if (!d.episodes.length) { body.append(h('div', { class: 'row-error' }, 'Ovaj naslov nema video fajl koji može da se pusti u aplikaciji.')); $('#dPlay')?.remove(); }
      if (d.episodes.length > 1) {
        body.append(h('div', { class: 'episodes' }, d.episodes.map((ep, i) => h('button', { class: 'ep', onclick: () => this.play(item, i) },
          h('span', { class: 'ep-n' }, i + 1), ep.name, ep.subs.length ? h('small', {}, ' · titl') : null))));
      }
    } catch (e) { body.innerHTML = ''; body.append(h('div', { class: 'row-error' }, 'Detalji nisu učitani: ' + e.message)); }
  },

  async play(item, epIndex = 0) {
    if (item.type === 'yt') { Modal.close(); Player.playYouTube({ videoId: item.id, title: item.title }); return; }
    try {
      const d = this._details?.id === item.id ? this._details.d : await IA.details(item.id);
      this._details = { id: item.id, d };
      const ep = d.episodes[epIndex];
      if (!ep) { toast('Nema video fajla za puštanje.'); return; }
      Modal.close();
      const title = d.episodes.length > 1 ? `${item.title} — ${ep.name}` : item.title;
      Player.playVideo({
        title, sources: ep.sources, subs: ep.subs.length ? ep.subs : d.subsAll,
        meta: { title: d.title, year: d.year }, poster: item.poster,
        progressKey: `ia:${item.id}:${epIndex}`, ref: { ...item, desc: undefined },
      });
    } catch (e) { toast('Greška: ' + e.message); }
  },
};
