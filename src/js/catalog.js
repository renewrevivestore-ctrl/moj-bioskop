// Katalog ostalih besplatnih sajtova — klik otvara sajt u pregledaču, pretraga se šalje direktno sajtu
const Catalog = {
  placeholder: 'Pretraži sajtove ili naslov na svim sajtovima…',
  data: null, q: '', cat: '',

  async load(force) {
    if (this.data && !force) return this.data;
    this.data = await window.api.catalog(Prefs.get('catalogUrl') || CONFIG.CATALOG_URL);
    return this.data;
  },

  searchUrl(site, q) {
    if (site.searchUrl) return site.searchUrl.replace('{q}', enc(q));
    const host = new URL(site.url).host.replace(/^www\./, '');
    return `https://duckduckgo.com/?q=${enc(q)}+site%3A${enc(host)}`;
  },

  favicon(site) { try { return `https://www.google.com/s2/favicons?domain=${new URL(site.url).host}&sz=128`; } catch { return ''; } },

  async render(view) {
    view.innerHTML = ''; view.append(spinner('Učitavam katalog…'));
    try { await this.load(); } catch (e) { view.innerHTML = ''; view.append(emptyMsg('Katalog nije učitan: ' + e.message)); return; }
    this.q = $('#search').value.trim();
    this.draw(view);
  },

  search(q) { this.q = q; this.draw($('#view')); },

  draw(view) {
    const d = this.data;
    view.innerHTML = '';
    const cats = d.categories || [];
    view.append(h('div', { class: 'page-head' },
      h('h1', {}, 'Katalog sajtova'),
      h('div', { class: 'filters' },
        h('button', { class: 'pill' + (!this.cat ? ' on' : ''), onclick: () => { this.cat = ''; this.draw(view); } }, 'Svi'),
        cats.map((c) => h('button', { class: 'pill' + (this.cat === c.id ? ' on' : ''), onclick: () => { this.cat = c.id; this.draw(view); } }, c.name)),
        h('span', { class: 'muted' }, `Katalog: ${d.source}${d.updated ? ', ažuriran ' + d.updated : ''}`))));

    let sites = (d.sites || []).filter((s) => !this.cat || s.category === this.cat);

    // Pretraga naslova na svim sajtovima odjednom
    if (this.q) {
      const all = (d.sites || []).filter((s) => s.searchable !== false);
      view.append(h('section', { class: 'search-all' },
        h('h2', {}, `Pretraži „${this.q}” direktno na sajtu:`),
        h('div', { class: 'search-all-btns' }, all.map((s) => h('button', { class: 'btn small ghost', onclick: () => window.api.open(this.searchUrl(s, this.q)) },
          h('img', { src: this.favicon(s), alt: '', onerror: (e) => e.target.remove() }), s.name)))));
      const qq = this.q.toLowerCase();
      const match = sites.filter((s) => [s.name, s.description, (s.tags || []).join(' ')].join(' ').toLowerCase().includes(qq));
      if (match.length) sites = match;
    }

    // Novi naslovi iz kataloga (dodaju se u catalog.json na GitHub-u i stižu svima automatski)
    const titles = (d.titles || []).filter((t) => !this.cat || (d.sites || []).find((s) => s.id === t.site)?.category === this.cat);
    if (titles.length && !this.q) {
      view.append(row('Novo u katalogu', titles, (t) => h('div', { class: 'card', onclick: () => window.api.open(t.url) },
        h('div', { class: 'poster' }, h('img', { src: t.poster || '', loading: 'lazy', alt: '', onerror: (e) => e.target.classList.add('noimg') }), h('div', { class: 'poster-fallback' }, t.title),
          t.srSubs ? h('span', { class: 'tag-sr' }, 'SR') : null),
        h('div', { class: 'card-title' }, t.title),
        h('div', { class: 'card-sub' }, [t.year, (d.sites || []).find((s) => s.id === t.site)?.name].filter(Boolean).join(' · ')))));
    }

    const groups = cats.filter((c) => sites.some((s) => s.category === c.id));
    for (const c of groups) {
      view.append(h('h2', { class: 'cat-title' }, c.name),
        h('div', { class: 'site-grid' }, sites.filter((s) => s.category === c.id).map((s) => this.siteCard(s))));
    }
    if (!sites.length) view.append(emptyMsg('Nema sajtova za ovaj filter.'));
  },

  siteCard(s) {
    const searchBox = h('input', { type: 'search', placeholder: 'Traži na ovom sajtu…', value: this.q || '' });
    const go = () => { const v = searchBox.value.trim(); window.api.open(v ? this.searchUrl(s, v) : s.url); };
    searchBox.addEventListener('keydown', (e) => e.key === 'Enter' && go());
    return h('div', { class: 'site-card' },
      h('div', { class: 'site-top' },
        h('img', { class: 'site-ico', src: this.favicon(s), alt: '', onerror: (e) => e.target.replaceWith(h('div', { class: 'site-ico letter' }, s.name[0])) }),
        h('div', {},
          h('div', { class: 'site-name' }, s.name, s.isNew ? h('span', { class: 'ribbon inline' }, 'NOVO') : null),
          h('div', { class: 'site-badges' },
            s.srLang ? h('span', { class: 'chip good' }, 'Na srpskom') : null,
            s.srSubs === true ? h('span', { class: 'chip good' }, 'Srpski titl') : s.srSubs ? h('span', { class: 'chip' }, 'Srpski titl: ' + s.srSubs) : null,
            s.account ? h('span', { class: 'chip' }, 'Besplatna registracija') : null,
            s.availability ? h('span', { class: 'chip warn' }, s.availability) : null))),
      h('p', { class: 'site-desc' }, s.description || ''),
      h('div', { class: 'site-actions' },
        h('button', { class: 'btn small', onclick: () => window.api.open(s.url) }, 'Otvori ↗'),
        s.searchable !== false ? h('div', { class: 'site-search' }, searchBox, h('button', { class: 'btn small ghost', onclick: go }, '🔍')) : null));
  },
};
