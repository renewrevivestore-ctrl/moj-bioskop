// Titlovi: čitanje SRT/VTT, prepoznavanje jezika, OpenSubtitles pretraga
const Subs = {
  LANG_NAMES: { sr: 'Srpski', hr: 'Hrvatski', bs: 'Bosanski', me: 'Crnogorski', mk: 'Makedonski', sl: 'Slovenački', en: 'Engleski', de: 'Nemački', fr: 'Francuski', es: 'Španski', it: 'Italijanski', ru: 'Ruski', xx: 'Nepoznat' },

  // Srpski titlovi su često u windows-1250 (latinica) ili windows-1251 (ćirilica)
  decode(bytes) {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (u8[0] === 0xFF && u8[1] === 0xFE) return new TextDecoder('utf-16le').decode(u8);
    try { return new TextDecoder('utf-8', { fatal: true }).decode(u8); } catch {}
    // Heuristika: mnogo bajtova u opsegu 0xC0-0xFF -> ćirilica (1251)
    let hi = 0; for (let i = 0; i < Math.min(u8.length, 20000); i++) if (u8[i] >= 0xC0) hi++;
    const sample = Math.min(u8.length, 20000);
    return new TextDecoder(hi / sample > 0.15 ? 'windows-1251' : 'windows-1250').decode(u8);
  },

  toSec(t) {
    const m = t.trim().replace(',', '.').match(/(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d+)?)/);
    if (!m) return 0;
    return (+(m[1] || 0)) * 3600 + (+m[2]) * 60 + parseFloat(m[3]);
  },

  // Vraća [{start, end, text}] za SRT i WebVTT
  parse(text) {
    const cues = [];
    const blocks = text.replace(/\r/g, '').replace(/^﻿/, '').split(/\n{2,}/);
    for (const b of blocks) {
      const lines = b.split('\n').filter((l) => l.trim() !== '');
      const i = lines.findIndex((l) => l.includes('-->'));
      if (i < 0) continue;
      const [a, z] = lines[i].split('-->');
      const txt = lines.slice(i + 1).join('\n').replace(/<(?!\/?[ibu]>)[^>]+>/gi, '').replace(/\{\\[^}]*\}/g, '');
      if (!txt.trim()) continue;
      cues.push({ start: this.toSec(a), end: this.toSec(z.split(' ').filter(Boolean)[0] || z), text: txt });
    }
    return cues;
  },

  // Prepoznaj jezik iz naziva fajla
  langFromName(name) {
    const n = name.toLowerCase();
    const t = (re) => re.test(n);
    if (t(/(^|[._\-\s(\[])(sr|srp|scc|serb|serbian|srpski|srb|cyr|cir|lat)([._\-\s)\]]|$)/)) return 'sr';
    if (t(/(^|[._\-\s(\[])(hr|hrv|cro|croatian|hrvatski)([._\-\s)\]]|$)/)) return 'hr';
    if (t(/(^|[._\-\s(\[])(bs|bos|bosnian|bosanski)([._\-\s)\]]|$)/)) return 'bs';
    if (t(/(^|[._\-\s(\[])(en|eng|english)([._\-\s)\]]|$)/)) return 'en';
    if (t(/(^|[._\-\s(\[])(de|ger|deu|german)([._\-\s)\]]|$)/)) return 'de';
    if (t(/(^|[._\-\s(\[])(fr|fre|fra|french)([._\-\s)\]]|$)/)) return 'fr';
    if (t(/(^|[._\-\s(\[])(es|spa|spanish)([._\-\s)\]]|$)/)) return 'es';
    return 'xx';
  },

  rank(lang) { const i = Prefs.get('subLangs').indexOf(lang); return i < 0 ? 99 : i; },

  // ---------- OpenSubtitles (opciono, treba besplatan API ključ) ----------
  OS: 'https://api.opensubtitles.com/api/v1',
  osHeaders(extra = {}) {
    return { 'Api-Key': Prefs.get('osKey'), 'Content-Type': 'application/json', ...extra };
  },
  async osToken() {
    const cached = Store.get('osToken');
    if (cached && Date.now() - cached.at < 20 * 3600e3) return cached.token;
    if (!Prefs.get('osUser') || !Prefs.get('osPass')) return null;
    const r = await window.api.json(this.OS + '/login', {
      method: 'POST', headers: this.osHeaders(),
      body: JSON.stringify({ username: Prefs.get('osUser'), password: Prefs.get('osPass') }),
    });
    Store.set('osToken', { token: r.token, at: Date.now() });
    return r.token;
  },
  async osSearch(title, year) {
    if (!Prefs.get('osKey')) throw new Error('Unesi OpenSubtitles API ključ u Podešavanjima.');
    const langs = Prefs.get('subLangs').join(',');
    // Parametri moraju biti abecedno poređani (zahtev OpenSubtitles API-ja)
    let q = `languages=${enc(langs)}&query=${enc(title.toLowerCase())}`;
    if (year) q += `&year=${enc(year)}`;
    const r = await window.api.json(`${this.OS}/subtitles?${q}`, { headers: this.osHeaders() });
    return (r.data || []).map((d) => ({
      lang: d.attributes.language,
      release: d.attributes.release || d.attributes.feature_details?.title || '',
      downloads: d.attributes.download_count || 0,
      fileId: d.attributes.files?.[0]?.file_id,
      fileName: d.attributes.files?.[0]?.file_name || '',
    })).filter((x) => x.fileId)
      .sort((a, b) => this.rank(a.lang) - this.rank(b.lang) || b.downloads - a.downloads);
  },
  async osDownload(fileId) {
    let token = null;
    try { token = await this.osToken(); } catch {}
    const headers = this.osHeaders(token ? { Authorization: 'Bearer ' + token } : {});
    const r = await window.api.json(this.OS + '/download', { method: 'POST', headers, body: JSON.stringify({ file_id: fileId }) });
    const bytes = await window.api.buffer(r.link);
    return this.decode(bytes);
  },
};
