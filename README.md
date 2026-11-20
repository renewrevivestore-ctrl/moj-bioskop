# Moj Bioskop

Lična aplikacija za Windows, nalik Netflixu, za besplatan i legalan sadržaj.

## Moduli

| Modul | Šta radi | Izvor | Pretraga |
|---|---|---|---|
| **Filmovi i serije** | Galerija sa redovima po žanrovima, detaljima, epizodama, nastavkom gledanja i srpskim titlovima | Internet Archive (javno dobro) i YouTube (uz API ključ) | Da, na oba izvora |
| **TV uživo** | Besplatni kanali uživo; prvo Srbija i region, pa ceo svet; omiljeni kanali | Baza iptv-org, osvežava se automatski svaka 24 h | Da, plus filter po zemlji i kategoriji |
| **Katalog sajtova** | RTS Planeta, HRTi, Tubi, Pluto TV, Plex, ARTE… Klik otvara sajt u pregledaču | `data/catalog.json` (online sa GitHub-a) | Da: po katalogu, na svakom sajtu posebno i na svim sajtovima odjednom |
| **Moja lista** | Sačuvani naslovi, nastavi gledanje, omiljeni kanali | lokalno | Da |

### Srpski titlovi
- Ako film na archive.org ima titl, aplikacija sama prepozna jezik i prvo uključi srpski, pa hrvatski, bosanski i engleski. Redosled se menja u Podešavanjima.
- **OpenSubtitles**: u plejeru, pod „Titlovi”, izaberi „Traži srpski titl” da nađeš titl za bilo koji film. Za to je potreban besplatan API ključ.
- Titl možeš da učitaš i sa računara (`.srt` / `.vtt`). Ćirilica i latinica (kodne strane 1250/1251) se prepoznaju same.
- Možeš da pomeriš vreme titla (±0,5 s) i da menjaš veličinu slova.
- YouTube videi se puštaju sa srpskim titlom kad on postoji.

## Ažuriranja

1. **Aplikacija** se ažurira sama. Pri pokretanju i na svaka 4 sata proverava GitHub Releases, preuzme novu verziju i ponudi „Restartuj i instaliraj”.
2. **Naslovi** stižu sami:
   - Internet Archive i YouTube se uvek pretražuju uživo. Red „Novo dodato” označava naslove dodate od tvoje poslednje posete.
   - TV kanali se osvežavaju svaka 24 h. Može i odmah, dugmetom ⟳.
   - **Katalog sajtova** se učitava sa GitHub-a. Kad u `data/catalog.json` dodaš sajt ili naslov i povećaš `"version"`, novi sadržaj se pojavljuje u svim instaliranim aplikacijama, bez nove verzije programa.

## Prvo pokretanje: pravljenje instalacije (jednom, oko 10 minuta)

Instalacija za Windows se pravi besplatno, na GitHub-u:

1. Napravi nalog na github.com i **javni** repozitorijum `moj-bioskop`. Mora biti javni da bi ažuriranja radila bez lozinke.
2. Pošalji ovaj folder u taj repozitorijum:
   ```bash
   git remote add origin https://github.com/TVOJ-NALOG/moj-bioskop.git
   git push -u origin main
   ```
3. Napravi prvo izdanje:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
4. Na GitHub-u, u kartici **Actions**, sačekaj oko 5 minuta da se završi „Izdanje za Windows”. Zatim u kartici **Releases** preuzmi `MojBioskop-Setup-1.0.0.exe` i instaliraj ga.

GitHub nalog se sam upisuje u aplikaciju tokom pravljenja, pa ništa ne moraš da menjaš ručno.

> Windows SmartScreen će pri prvoj instalaciji reći „nepoznat izdavač”, jer program nije digitalno potpisan. Klikni „More info”, pa „Run anyway”.

### Nova verzija aplikacije
1. Promeni `"version"` u `package.json`, na primer `1.0.1`.
2. Pošalji izmene i tag sa istim brojem:
   ```bash
   git commit -am "Verzija 1.0.1"
   git push
   git tag v1.0.1
   git push origin v1.0.1
   ```
3. Instalirane aplikacije same preuzmu novu verziju.

### Dodavanje sajta ili naslova u katalog
U `data/catalog.json`:
```json
{ "id": "novisajt", "category": "domace", "name": "Naziv", "url": "https://...",
  "searchUrl": "https://.../search?q={q}", "description": "Opis",
  "srLang": true, "srSubs": true, "isNew": true }
```
Naslov u redu „Novo u katalogu”:
```json
"titles": [ { "title": "Naziv filma", "year": "1979", "site": "rtsplaneta",
  "url": "https://...", "poster": "https://...jpg", "srSubs": true } ]
```
Povećaj `"version"` na vrhu fajla i pošalji izmenu (`git push`).

## API ključevi (opciono, besplatni; unose se u ⚙ Podešavanja)
- **YouTube Data API v3** (Google Cloud konzola): dodaje YouTube redove sa domaćim filmovima, serijama i crtaćima.
- **OpenSubtitles** (opensubtitles.com, deo „API consumers”): omogućava pretragu srpskih titlova za svaki film.

## Pokretanje iz koda (za razvoj)
```bash
npm install
npm start
```

## Prečice u plejeru
`Razmak`: pauza · `←` / `→`: 10 s nazad / napred · `F`: ceo ekran · `Esc`: zatvori · `Ctrl+F`: pretraga
