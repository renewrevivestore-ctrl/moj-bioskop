// Pokretanje i navigacija
const App = {
  views: { movies: Movies, tv: TV, catalog: Catalog, mylist: MyListView, settings: Settings },
  current: null,

  go(name) {
    const v = this.views[name]; if (!v) return;
    const changed = this.current !== name;
    this.current = name;
    document.querySelectorAll('[data-go]').forEach((b) => b.classList.toggle('active', b.dataset.go === name));
    const s = $('#search');
    if (changed) s.value = '';
    s.placeholder = v.placeholder || 'Pretraži…';
    s.parentElement.classList.toggle('hidden', name === 'settings');
    $('#view').scrollTop = 0;
    v.render($('#view'));
  },

  init() {
    document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => this.go(b.dataset.go)));
    const onSearch = debounce((q) => {
      const v = this.views[this.current];
      if (this.current === 'movies') { if (q.length >= 2) v.search(q); else if (!q) v.render($('#view')); }
      else v.search?.(q);
    }, 450);
    $('#search').addEventListener('input', (e) => onSearch(e.target.value.trim()));
    $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') Modal.close(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !$('#modal').classList.contains('hidden')) Modal.close();
      if (e.ctrlKey && e.key === 'f') { e.preventDefault(); $('#search').focus(); }
    });
    Player.init();

    // Obaveštenja o ažuriranju aplikacije
    const bar = $('#updateBar');
    window.api.onUpdate((s) => {
      if (s.state === 'available') { bar.textContent = `Preuzimam novu verziju ${s.version}…`; bar.classList.remove('hidden'); }
      else if (s.state === 'downloading') { bar.textContent = `Preuzimam ažuriranje… ${s.percent}%`; bar.classList.remove('hidden'); }
      else if (s.state === 'ready') {
        bar.innerHTML = '';
        bar.append(`Nova verzija ${s.version} je spremna.`, h('button', { class: 'btn small', onclick: () => window.api.installUpdate() }, 'Restartuj i instaliraj'),
          h('button', { class: 'btn small ghost', onclick: () => bar.classList.add('hidden') }, 'Kasnije'));
        bar.classList.remove('hidden');
      } else if (s.state === 'none') { bar.classList.add('hidden'); }
    });

    this.go('movies');
  },
};

App.init();
