// Osnovna podešavanja aplikacije. Promeni GITHUB_NALOG kad napraviš GitHub repozitorijum.
window.CONFIG = {
  APP_NAME: 'Moj Bioskop',
  GITHUB_NALOG: 'TVOJ-GITHUB-NALOG',
  GITHUB_REPO: 'moj-bioskop',
  get CATALOG_URL() {
    return `https://raw.githubusercontent.com/${this.GITHUB_NALOG}/${this.GITHUB_REPO}/main/data/catalog.json`;
  },

  // Redosled jezika za titlove (prvi = najpoželjniji)
  SUB_LANGS: ['sr', 'hr', 'bs', 'en'],

  // TV: zemlje koje se prikazuju prve
  TV_HOME: ['RS', 'BA', 'ME', 'HR', 'MK', 'SI'],
  IPTV_API: 'https://iptv-org.github.io/api',
};
