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

Over the whole page sits one moving element: a **plate**, cut in hand-written
WebGL. About five hundred lines in `engraving.js`, with its own matrix maths,
its own minimal glTF reader, its own coastline reader and two four-line
shaders. No library is loaded and nothing is bundled.

It has two acts, and the scroll is what turns the page between them:

| | |
|---|---|
| **I.** | A classical **bust**, for the front matter — a real 3D model drawn as a hidden-line engraving. |
| **II.** | A terrestrial **globe**, from the education section onward: real coastlines on a fifteen-degree graticule, hung in a tilted meridian ring and turned so Sumatra faces the reader, with Jambi and Palembang labelled the way a plate in an atlas would label them. |

In both acts the solid is drawn into the depth buffer alone, so only the edges
a burin would actually cut are inked. The pointer leans the stage; the scroll
turns it; the loop stops as soon as the motion settles, and never starts at all
under `prefers-reduced-motion`. The plate is multiplied into the paper in the
day edition and screened over the ink at night, with the colour set from
`--engraving-ink` in `tokens.css`.

The atlas labels are ordinary HTML. Every frame the module projects each
place's point through the same matrix the plate is drawn with, moves the label
there, and fades it out as the point turns away round the limb. The stepped
leader — a dot on the place, a stem, then an arm to the name — is pure CSS, so
the two labels can be separated by `--lift` and `--arm` without the dots
moving off their coordinates.

A draughtsman's compass point trails the pointer as well. It leaves the real
cursor alone, and hides itself on touch screens.

### Where the plate comes from

| Asset | Source |
|---|---|
| `assets/models/bust.glb` | *Bust* by Eric Wilson, [CC BY](https://creativecommons.org/licenses/by/3.0/), from <https://poly.pizza/m/eLjY6Zwl4uw>. Stripped to its POSITION accessor and triangle indices — the normals and materials are not needed, and dropping them halved it to 163 KB. |
| `assets/models/coastline.json` | [Natural Earth](https://www.naturalearthdata.com/) 110m coastline, public domain. Thinned to 0.3° and delta-encoded as hundredths of a degree, which keeps almost every number one or two characters long: 134 polylines, 4,888 points, 35 KB before compression. |

Welding, crease detection, the graticule, the rings and the depth shell are all
computed in the browser at load.

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
    ├── models/             bust.glb, coastline.json — the plate's two subjects
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
| `engraving.js` | the hidden-line 3D bust, in hand-written WebGL |
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

### Changing what the plate draws

Drop any `.glb` with a single mesh into `public/assets/models/`, point `BUST` in
`engraving.js` at it, and re-credit it in the colophon. The module centres and
scales whatever it is given, so nothing else needs adjusting — but keep the
triangle count low: the crease pass is O(triangles) and runs on every load.

`ACT` sets where the two acts hand over, as fractions of the whole scroll.
`PLACES` sets what the globe is labelled with; each entry needs a matching
`[data-pin]` in `#engraving-pins`, and the globe turns to whichever longitude
is hard-coded in the act II yaw.

Note that a bare `.bin` is worth avoiding for the data: one was tried first and
never made it to the page in a browser with extensions installed. JSON costs
about 15 KB more before compression and always arrives.

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
