Personal record of **Ahmad Andhika Haririe** — Informatics Engineering student at
Universitas Sriwijaya, Palembang.

Hand-written HTML, CSS and JavaScript. No framework, no bundler, no build step:
what is in `public/` is exactly what is served. In front of it sits a small
Cloudflare Worker that streams the page through `HTMLRewriter`, so the
proprietor can reset any word, list or photograph on it from the site itself
without touching the repository.

**Live:** <https://ahmadandhikaharirie.my.id>

---

## Design

An *old classic* editorial treatment — a printed broadsheet rather than a
dashboard. Double rules, roman numerals for the section numbers, small-caps
labels, drop caps, wax seals for the certificates, and a fleuron (`❦`) as the
section ornament. Running text is justified and hyphenated the way a compositor
would set it; anything centred, tabular or in the marginalia keeps its ragged
edge.

Over the whole page sits one moving element: a **plate**, cut in hand-written
WebGL. About nine hundred lines in `engraving.js`, with its own matrix maths,
its own minimal glTF reader, its own coastline reader and two four-line
shaders. No library is loaded and nothing is bundled.

It has two acts, and the scroll is what turns the page between them:

| | |
|---|---|
| **I.** | A classical **bust**, for the front matter — a real 3D model drawn as a hidden-line engraving. |
| **II.** | A terrestrial **globe**, from the education section onward: real coastlines on a fifteen-degree graticule, hung in a tilted meridian ring and turned so Sumatra faces the reader, with Jambi and Palembang marked and labelled the way a plate in an atlas would label them. |

In both acts the solid is drawn into the depth buffer alone, so only the edges
a burin would actually cut are inked. The plate is multiplied into the paper in
the day edition and screened over the ink at night, with the colour set from
`--engraving-ink` in `tokens.css`.

### Taking hold of it

The plate is not only scenery. It answers three things:

- **The page.** The pointer leans the stage; the scroll turns it. The loop
  stops as soon as the motion settles, and never starts on its own under
  `prefers-reduced-motion`.
- **The hand.** A pointer precise enough to aim gets a **grip**: a circle
  placed over the disc the solid actually occupies, and nothing else on the
  page, so no link or button ever loses a click to the backdrop. Drag it and
  the plate turns, with the weight carrying on after the hand lets go. A coarse
  pointer is given no grip at all — a thumb over the middle of the column would
  swallow taps meant for the text — and is sent to the examination instead.
- **The examination.** The instrument panel in the corner opens the plate out
  on its own: full strength, centred, on any screen. One finger turns it, two
  draw it closer, a double tap squares it, the arrow keys and `+ − 0` do the
  same from a keyboard, and `Esc` closes it. Tapping a marked place — or its
  button in the footer — brings that place round to face the reader and prints
  its card. A readout under the plate gives the latitude and longitude of
  whatever is at the centre of the disc.

The panel also holds a switch for the subject, so either act can be looked at
from anywhere on the page, and a toggle for letting the plate turn on its own.

The atlas labels are ordinary HTML. Every frame the module projects each
place's point through the same matrix the plate is drawn with, moves the label
there, and fades it out as the point turns away round the limb. The stepped
leader — a dot on the place, a stem, then an arm to the name — is pure CSS, so
the two labels can be separated by `--lift` and `--arm` without the dots moving
off their coordinates.

A draughtsman's compass point trails the pointer as well. It leaves the real
cursor alone, and hides itself on touch screens.

### Where the plate comes from

| Asset | Source |
|---|---|
| `assets/models/bust.glb` | *Bust* by Eric Wilson, [CC BY](https://creativecommons.org/licenses/by/3.0/), from <https://poly.pizza/m/eLjY6Zwl4uw>. Stripped to its POSITION accessor and triangle indices — the normals and materials are not needed, and dropping them halved it to 163 KB. |
| `assets/models/coastline.json` | [Natural Earth](https://www.naturalearthdata.com/) 110m coastline, public domain. Thinned to 0.3° and delta-encoded as hundredths of a degree, which keeps almost every number one or two characters long: 134 polylines, 4,888 points, 35 KB before compression. |

Welding, crease detection, the graticule, the rings, the place marks and the
depth shell are all computed in the browser at load.

---

## The composing room

`/admin` is the proprietor's entrance. Behind one password it can reset
anything printed on the front of the house — the wording, the lists, the
photographs — with no edit to the repository and no deploy.

**The page is still the source.** Nothing is duplicated anywhere:

- Every passage of running text carries `data-edit="<key>"`.
- Every list carries `data-collection="<name>"`, its entries carry
  `data-item`, and their parts carry `data-field="<name>"`.
- The Worker reads one document out of KV and, as the page streams past,
  sets the stored value into any element whose key it holds. Everything it
  does not hold is left exactly as the file in `public/` wrote it.

So an empty store and a fresh checkout render the same page, *Restore* on any
field is simply deleting a key, and the studio can start from the served
document rather than from a copy of the copy. The page also arrives finished:
no flash of the old wording, and nothing a crawler has to run scripts to see.

| | |
|---|---|
| **Words** | Every `data-edit` passage, grouped by the section it sets, in a small rich-text field that keeps only the inline elements the page is set in. |
| **Lists** | The craft cards, the education entries, the record of the university years, the certificates, the letters, the photographs, the facts in the margin, the direct-contact panel and the ribbon of tools. Add, remove, reorder, duplicate. |
| **Photographs** | Drop them in; they are shrunk to 1,600 pixels *in the browser* before being sent, and stored under the hash of their own bytes so `/media/<id>` can be cached forever. One of them can be hung in the portrait frame on the front page. |
| **Keys** | Changing the password, which signs every other device out. |

Signed in, the page itself gains a rule along its foot. Press **Set the type**
and every passage the studio knows about can be clicked and typed into where it
stands, then saved without leaving the page. Nobody else is served that script
at all.

### How it is held

- **Session.** A signed cookie and nothing else — `HttpOnly`, `SameSite=Lax`,
  `Secure` over HTTPS — carrying an epoch that lives in KV, so changing the
  password invalidates every cookie already issued. There is no session table.
- **Password.** PBKDF2-SHA256 over 210,000 rounds with a random salt, kept in
  KV once it has been changed from the studio, and compared against the
  `ADMIN_PASSWORD` secret until then. Failed attempts are counted and locked
  out for a quarter of an hour.
- **Writes.** Same-origin only, and everything submitted goes through an
  allow-list scrubber built on `HTMLRewriter` — a short list of inline
  elements, a shorter list of attributes, and no `javascript:` anywhere.
- **Caching.** The served document depends on the store as well as the file, so
  it is given a validator covering both. A conditional request is answered by
  the Worker rather than by the assets binding, which would only ever have been
  told about the file.

---

## Layout of the repository

```
src/                        the Worker in front of the folder
├── index.js                routing: /api, /media, and the page itself
├── render.js               HTMLRewriter — the store, set into the page
├── collections.js          every list: how it prints, and how it is cleaned
├── store.js                the content document and the photographs, in KV
├── auth.js                 password, session cookie, throttling
└── sanitize.js             the allow-list scrubber

public/
├── index.html              the whole page — seven numbered sections
├── admin.html              the composing room
├── 404.html
├── robots.txt · sitemap.xml · site.webmanifest
└── assets/
    ├── css/
    │   ├── fonts.css       generated @font-face blocks
    │   ├── tokens.css      colour, type scale, space, motion
    │   ├── base.css        reset, elements, typography, the measure
    │   ├── components.css  buttons, cards, forms, dialogs
    │   ├── layout.css      shell, top bar, drawer, sections, colophon
    │   ├── sections.css    each numbered section in order
    │   ├── plate.css       the grip, the instrument panel, the examination
    │   ├── studio.css      the composing room, and the rule along the foot
    │   └── print.css       the same page reset as an A4 résumé
    ├── js/
    │   ├── main.js         entry point; wires the modules below
    │   ├── studio.js       the composing room
    │   ├── studio-bridge.js  setting the type on the page itself
    │   └── modules/        one concern per file
    ├── fonts/              self-hosted woff2 subsets
    ├── models/             bust.glb, coastline.json — the plate's two subjects
    └── img/                favicon, social cover, app icons
wrangler.jsonc              Worker, static assets, KV, custom domains
```

Stylesheets are linked in cascade order, narrowest scope last:
`fonts → tokens → base → components → layout → sections → plate`.

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
| `engraving.js` | the plate: hidden-line 3D, the grip, the examination |
| `command-palette.js` | <kbd>Ctrl</kbd>+<kbd>K</kbd> search |
| `contact.js` | form validation, mail and WhatsApp composition, copy buttons |
| `studio-model.js` | what the studio knows about the page |

---

## Contents

Seven sections: about, craft, education, at the university, game jams,
letters, correspondence. Everything factual on the page — the two schools and
their dates, the two roles at Himpunan Mahasiswa Informatika, the three game
jam certificates — comes from the LinkedIn profile at
<https://www.linkedin.com/in/ahmad-andhika-haririe/>. Individual software
projects and their repositories are deliberately not listed here.

## Features

- A plate that can be turned by hand, examined full-screen on any device, and
  asked to bring a place round to face the reader.
- <kbd>Ctrl</kbd>+<kbd>K</kbd> command palette that indexes the page itself.
- Day / night editions, reading progress, scroll reveal, scrollspy navigation
  and a mobile drawer.
- A contact form that composes the message either in the reader's own mail
  client or in WhatsApp. Nothing is posted anywhere and nothing is stored.
- WhatsApp, Instagram, LinkedIn, GitHub and email, on the front page, in the
  correspondence panel, in the colophon and in the palette.
- Print stylesheet that reformats the page as an A4 résumé.
- SEO: Open Graph and Twitter cards, JSON-LD (`Person`, `WebSite`,
  `ProfilePage`), canonical URL, sitemap and robots.
- Accessibility: skip link, landmarks, visible focus, keyboard-operable
  dialogs and plate, live regions, and full `prefers-reduced-motion` support.

---

## Working on it

```bash
npm install
npm run dev       # wrangler dev on http://127.0.0.1:8787
npm run deploy    # publish to Cloudflare
```

There is still no build step. Edit a file in `public/` and reload.

Local runs need a `.dev.vars` — it is not in the repository:

```
ADMIN_PASSWORD=the password for /admin
SESSION_SECRET=any long random string
```

In production the same two are Wrangler secrets:

```bash
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put SESSION_SECRET
```

`SESSION_SECRET` is optional: without it the Worker mints one on first use and
keeps it in KV. `ADMIN_PASSWORD` is only the *initial* password — as soon as it
is changed from the studio's **Keys** tab, the PBKDF2 record in KV takes over
and the secret stops being consulted.

The store is one KV namespace, bound as `CONTENT` in `wrangler.jsonc`. To point
a fresh account at a new one:

```bash
npx wrangler kv namespace create CONTENT
```

### Adding a section

Copy a `<section class="section">` block in `index.html`, give it an `id`, and
add that `id` to the three navigation lists: `#section-nav` in the top bar,
`.drawer__list`, and the two `.colophon__nav` lists. The command palette and
the masthead issue number both count `.section[id]` themselves, so neither
needs touching.

### Making something editable

Put `data-edit="<section>.<name>"` on the element and add the key to the right
group in `WORD_GROUPS` in `studio-model.js`, with the label the studio should
call it. Nothing else is needed: the Worker will set an override into any
element carrying the attribute, and the studio reads the current wording out of
the served page.

For an attribute rather than the text — the typewriter's phrases, say — add
`data-edit-attr="<attribute>"` beside it.

### Adding a list

Give the container `data-collection="<name>"`, its entries `data-item`, and
their parts `data-field="<name>"`. Then write a renderer in `collections.js`
that prints exactly that markup, and a matching entry in `SHAPES` saying how
each field is cleaned; describe the fields once more in `LISTS` in
`studio-model.js` so the studio knows what controls to draw. The static markup
stays the default copy, and the renderer only ever replaces it wholesale.

### Changing what the plate draws

Drop any `.glb` with a single mesh into `public/assets/models/`, point `BUST` in
`engraving.js` at it, and re-credit it in the colophon. The module centres and
scales whatever it is given, so nothing else needs adjusting — but keep the
triangle count low: the crease pass is O(triangles) and runs on every load.

`ACT` sets where the two acts hand over, as fractions of the whole scroll.
`ZOOM` sets how far the plate can be drawn in under examination. `PLACES` sets
what the globe is marked and labelled with; each entry needs a matching
`[data-pin]` in `#engraving-pins`, and the buttons in the examination's footer
are built from the same list.

Note that a bare `.bin` is worth avoiding for the data: one was tried first and
never made it to the page in a browser with extensions installed. JSON costs
about 15 KB more before compression and always arrives.

### Adding a certificate, a recommendation, a photograph

All three are lists in the studio now — *Game jams & certificates*, *Letters*
and *Photographs*. The markup templates are still in `index.html` if you would
rather set one in type: an `<li class="landmark">` in `#gamejams`, an
`<li class="letter">` in `#letters` (the empty-state card prints while the
column is empty), and `<ul class="plates">` at the foot of `#campus`.

### Using a photograph as the portrait

Hang one from the studio's **Photographs** tab. The CSS hides the engraved
monogram whenever a photo is in the frame.

---

## Deployment

The site is a Worker with a static-assets binding. `wrangler.jsonc` declares
both custom domains, and Wrangler creates the DNS records on deploy — the apex
`MX` records for mail are untouched. `run_worker_first` is on, so the Worker
sees every request and can finish the document before it leaves the edge.

## Licence

MIT for the code. The written content is mine.
