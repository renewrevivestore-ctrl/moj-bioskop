// Moja lista: sačuvani naslovi, nastavi gledanje, omiljeni kanali
const MyListView = {
  placeholder: 'Pretraži moju listu…',
  q: '',
  render(view) { this.q = $('#search').value.trim(); this.draw(view); },
  search(q) { this.q = q; this.draw($('#view')); },
  draw(view) {
    view.innerHTML = '';
    view.append(h('div', { class: 'page-head' }, h('h1', {}, 'Moja lista')));
    const qq = this.q.toLowerCase();
    const f = (t) => !qq || String(t || '').toLowerCase().includes(qq);

    const cont = Progress.list().filter((p) => p.ref && f(p.title)).map((p) => ({ ...p.ref, pct: p.d ? (p.t / p.d) * 100 : 0 }));
    if (cont.length) view.append(row('Nastavi gledanje', cont, (i) => Movies.card(i)));

    const saved = Object.values(MyList.all()).filter((i) => f(i.title)).sort((a, b) => b.added - a.added);
    view.append(h('h2', { class: 'cat-title' }, 'Sačuvani naslovi'));
    view.append(saved.length ? h('div', { class: 'grid' }, saved.map((i) => Movies.card(i))) : emptyMsg('Ovde će biti naslovi koje dodaš preko „+ Moja lista”.'));

    const favIds = TV.favs();
    if (favIds.length) {
      view.append(h('h2', { class: 'cat-title' }, 'Omiljeni TV kanali'));
      const box = h('div', { class: 'tv-grid' }, spinner()); view.append(box);
      TV.load().then((d) => {
        box.innerHTML = '';
        d.list.filter((c) => favIds.includes(c.id) && f(c.name)).forEach((c) => box.append(TV.tile(c)));
      }).catch(() => { box.innerHTML = ''; box.append(emptyMsg('Baza kanala nije dostupna.')); });
    }
  },
};
