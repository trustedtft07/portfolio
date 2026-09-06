Personal record of **Ahmad Andhika Haririe** — Informatics Engineering student at
Universitas Sriwijaya, Palembang.

Hand-written HTML, CSS and JavaScript. No framework, no bundler, no build step:
what is in `public/` is exactly what is served. It runs as a static-assets
Cloudflare Worker on the apex domain.

**Live:** <https://ahmadandhikaharirie.my.id>

---

## Design

An *old classic* editorial treatment — a printed broadsheet rather than a
dashboard. Double rules, roman numerals for the section numbers, small-caps
labels, drop caps, wax seals for the certificates, and a fleuron (`❦`) as the
section ornament.

| Role | Face |
|---|---|
| Display headings | Playfair Display |
| Body text | EB Garamond |
| Labels, tags, meta | Courier Prime |

All three are self-hosted from `assets/fonts/` (latin and latin-ext subsets
only) so the page makes no third-party requests at all.

Two editions share one set of tokens: a **day** edition printed on aged paper
and a **night** edition printed on ink. The choice is stored in
`localStorage` and applied before first paint by an inline script, so the page
never flashes the wrong one.

---

## Layout of the repository

```
public/
├── index.html              the whole page — seven numbered sections
├── 404.html
├── robots.txt · sitemap.xml · site.webmanifest
└── assets/
    ├── css/
    │   ├── fonts.css       generated @font-face blocks
    │   ├── tokens.css      colour, type scale, space, motion
    │   ├── base.css        reset, elements, typography, utilities
    │   ├── components.css  buttons, cards, forms, dialogs
    │   ├── layout.css      shell, top bar, drawer, sections, colophon
    │   ├── sections.css    each numbered section in order
    │   └── print.css       the same page reset as an A4 résumé
    ├── js/
    │   ├── main.js         entry point; wires the modules below
    │   └── modules/        one concern per file
    ├── fonts/              self-hosted woff2 subsets
    └── img/                favicon, social cover, app icons
wrangler.jsonc              Cloudflare Worker + custom domains
```

Stylesheets are linked in cascade order, narrowest scope last:
`fonts → tokens → base → components → layout → sections`. Layout is loaded
after components so a breakpoint can override a component default.

Each JavaScript module exports a single `init` that is safe to call when the
markup it looks for is absent, and `main.js` calls them inside a `try`, so one
broken feature never takes the page down.

| Module | Concern |
|---|---|
| `theme.js` | day / night edition, storage, browser chrome colour |
| `navigation.js` | running head, drawer, section highlighting, back to top |
| `scroll-effects.js` | reading progress, reveal on scroll |
| `dateline.js` | masthead date, issue number, copyright year |
| `typewriter.js` | the strapline that types itself |
| `counters.js` | statistics that count up in view |
| `command-palette.js` | <kbd>Ctrl</kbd>+<kbd>K</kbd> search |
| `contact.js` | form validation, mail composition, copy buttons |

---

## Contents

Seven sections: about, craft, education, at the university, game jams,
letters, correspondence. Everything factual on the page — the two schools and
their dates, the two roles at Himpunan Mahasiswa Informatika, the three game
jam certificates — comes from the LinkedIn profile at
<https://www.linkedin.com/in/ahmad-andhika-haririe/>. Individual software
projects and their repositories are deliberately not listed here.

## Features

- <kbd>Ctrl</kbd>+<kbd>K</kbd> command palette that indexes the page itself.
- Day / night editions, reading progress, scroll reveal, animated counters,
  scrollspy navigation and a mobile drawer.
- A contact form that composes a message in the reader's own mail client.
  Nothing is posted anywhere and nothing is stored.
- Print stylesheet that reformats the page as an A4 résumé.
- SEO: Open Graph and Twitter cards, JSON-LD (`Person`, `WebSite`,
  `ProfilePage`), canonical URL, sitemap and robots.
- Accessibility: skip link, landmarks, visible focus, keyboard-operable
  dialogs, live regions, and full `prefers-reduced-motion` support.

---

## Working on it

```bash
npm install
npm run dev       # wrangler dev on http://127.0.0.1:8787
npm run deploy    # publish to Cloudflare
```

There is no build step. Edit a file in `public/` and reload.

### Adding a section

Copy a `<section class="section">` block in `index.html`, give it an `id`, and
add that `id` to the three navigation lists: `#section-nav` in the top bar,
`.drawer__list`, and the two `.colophon__nav` lists. The command palette and
the masthead issue number both count `.section[id]` themselves, so neither
needs touching.

### Adding a certificate

Copy an `<li class="landmark">` in `#gamejams`. The `.seal__inner` holds the
roman numeral.

### Adding a recommendation

`#letters` contains a commented-out `<li class="letter">` block. Fill it in,
drop it into `<ul class="letters">`, and remove the empty-state card.

### Using a photograph

Save it as `public/assets/img/portrait.jpg` and uncomment the `<img
class="portrait__photo">` line in `index.html`. The CSS hides the engraved
monogram whenever that photo is present.

---

## Deployment

The site is a static-assets Worker. `wrangler.jsonc` declares both custom
domains, and Wrangler creates the DNS records on deploy — the apex `MX` records
for mail are untouched.

## Licence

MIT for the code. The written content is mine.
