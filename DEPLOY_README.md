# PackNiti SEO + Product Gallery Upgrade

This is a **drop-in overlay** for the existing PackNiti website repository.

## What this upgrade adds

- 39 crawlable product URLs: `/boxes/{size}.html`
- Unique product `<title>`, meta description, canonical URL and Open Graph metadata
- Product JSON-LD schema with dynamic quantity-price offers
- Product gallery framework using the new 39 uploaded product images plus the existing catalogue image
- Product detail sections: use cases, tags, related sizes and Box Finder links
- Add-to-cart flow on product pages using the existing `packniti_checkout_items` localStorage contract
- Homepage featured products now link directly to product pages
- A dedicated `/box-size-chart.html` linking all 39 sizes
- `/sitemap.xml` with the core pages + 39 product pages
- `/robots.txt`
- Updated image catalogue links to product pages
- A `seo-enhancements.js` script that adds crawlable product-detail links to dynamically rendered Box Finder rows without changing Box Finder logic

## Files to overwrite/add

### Overwrite
- `index.html`
- `index.js`
- `product.html`
- `product.js`
- `product.css`
- `gallery.js`

### Add
- `seo-enhancements.js`
- `box-size-chart.html`
- `robots.txt`
- `sitemap.xml`
- `data/product-gallery.json`
- `assets/product-gallery/*.png` (39 files)
- `boxes/*.html` (39 files)

## One small existing-file edit

Open the existing `boxes.html` and find:

```html
<script src="boxes.js"></script>
```

Immediately after it add:

```html
<script src="seo-enhancements.js"></script>
```

Do **not** remove or modify `boxes.js`.

## Why we are keeping `product.html`

The old `product.html?id=...` route remains as a compatibility path, but is marked `noindex,follow`. The new static pages are the canonical SEO pages. Existing old links should therefore continue to work while Google is directed toward the clean URLs.

## Important deployment note

The repository is connected to Cloudflare and the live site auto-deploys from GitHub. Make the upgrade in one controlled commit, then test before doing the next SEO phase.

## Test URLs after deployment

- `https://packniti.co.in/`
- `https://packniti.co.in/boxes.html`
- `https://packniti.co.in/box-size-chart.html`
- `https://packniti.co.in/gallery.html`
- `https://packniti.co.in/boxes/5x3x2.html`
- `https://packniti.co.in/boxes/6.5x2.5x3.html`
- `https://packniti.co.in/boxes/21x13x13.html`
- `https://packniti.co.in/sitemap.xml`
- `https://packniti.co.in/robots.txt`

## Search Console after deployment

1. Open the verified `packniti.co.in` Domain property.
2. Go to **Sitemaps**.
3. Submit `sitemap.xml`.
4. Inspect the homepage and two or three product URLs.
5. Use **Test Live URL** first; request indexing only after the live pages are confirmed correct.

## What we deliberately did NOT change

- Existing Box Finder matching algorithm
- Existing pricing data
- Existing cart storage contract
- Existing checkout flow
- Existing custom-box flow
- Existing Cloudflare deployment configuration
- Existing catalogue source of truth

The goal is to add an SEO/product layer without destabilising the working buying flow.
