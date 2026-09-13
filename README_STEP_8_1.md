# PackNiti Website — Step 8.1

This folder contains the first real `/boxes` Box Finder build.

## Files

- `boxes.html` — U-Pack-inspired PackNiti box discovery page
- `boxes.css` — responsive visual system
- `boxes.js` — catalogue loading, dimension search, filters, sorting, quantity pricing and selection
- `data/catalogue.json` — copy the real PackNiti catalogue data into this folder

## Local testing

Because the page fetches `data/catalogue.json`, do not open `boxes.html` by double-clicking it.

From the website root, run:

`python -m http.server 8000`

Then open:

`http://localhost:8000/boxes.html`

The current page is intentionally a Step 8.1 build. Quote submission, AI backend, MIS and production checkout are not connected yet.
