// Podešavanja
const Settings = {
  placeholder: 'Pretraži…',
  async render(view) {
    const ver = await window.api.version();
    const field = (label, key, type = 'text', help = '') => h('label', { class: 'field' },
      h('span', {}, label),
      h('input', { type, value: Prefs.get(key) || '', onchange: (e) => { Prefs.set(key, e.target.value.trim()); if (key.startsWith('os')) Store.set('osToken', null); toast('Sačuvano'); } }),
      help ? h('small', { html: help }) : null);
    const link = (t, u) => `<a href="#" data-ext="${u}">${t}</a>`;

    view.innerHTML = '';
    view.append(h('div', { class: 'settings' },
      h('h1', {}, 'Podešavanja'),

      h('section', {}, h('h2', {}, 'Titlovi'),
        h('label', { class: 'field' }, h('span', {}, 'Redosled jezika titlova'),
          h('input', { value: Prefs.get('subLangs').join(', '), onchange: (e) => { Prefs.set('subLangs', e.target.value.split(/[,\s]+/).filter(Boolean)); toast('Sačuvano'); } }),
          h('small', {}, 'Kodovi jezika odvojeni zarezom. Prvi ima prednost. Primer: sr, hr, bs, en')),
        field('OpenSubtitles API ključ', 'osKey', 'text', `Besplatan ključ: napravi nalog na ${link('opensubtitles.com', 'https://www.opensubtitles.com/en/consumers')}, pa u delu „API consumers” napravi novi ključ. Omogućava pretragu srpskih titlova za svaki film.`),
        field('OpenSubtitles korisničko ime (opciono)', 'osUser'),
        field('OpenSubtitles lozinka (opciono)', 'osPass', 'password', 'Uz prijavu dobijaš više preuzimanja titlova dnevno.')),

      h('section', {}, h('h2', {}, 'YouTube'),
        field('YouTube Data API ključ', 'ytKey', 'text', `Besplatan ključ sa ${link('Google Cloud konzole', 'https://console.cloud.google.com/apis/library/youtube.googleapis.com')}: uključi „YouTube Data API v3”, pa u delu „Credentials” napravi „API key”. Bez ključa se YouTube redovi ne prikazuju.`)),

      h('section', {}, h('h2', {}, 'Katalog i baze'),
        field('Adresa online kataloga (opciono)', 'catalogUrl', 'text', 'Ako je prazno, koristi se GitHub adresa iz podešavanja aplikacije. Ovde možeš staviti bilo koji URL do catalog.json fajla.'),
        h('button', { class: 'btn ghost', onclick: async () => { await window.api.clearCache(); TV.data = null; Catalog.data = null; toast('Keš obrisan — baze će se ponovo preuzeti.'); } }, 'Osveži sve baze (obriši keš)')),

      h('section', {}, h('h2', {}, 'Aplikacija'),
        h('p', {}, `Verzija ${ver}`),
        h('button', { class: 'btn', onclick: async () => {
          const r = await window.api.checkUpdate();
          if (r.state === 'dev') toast('Provera ažuriranja radi samo u instaliranoj verziji.');
          else if (r.state === 'error') toast('Greška pri proveri: ' + r.message, 6000);
          else toast('Proveravam ažuriranja…');
        } }, 'Proveri ažuriranja')),
    ));
    view.querySelectorAll('[data-ext]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); window.api.open(a.dataset.ext); }));
  },
  search() {},
};
