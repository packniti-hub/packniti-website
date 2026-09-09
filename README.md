# PackNiti Website — Landing Page Prototype

This is the first UX prototype for the PackNiti website.

References used:
- U-Pack: box catalogue / dimension-finder interaction
- Parul Packaging: packaging catalogue + customisation / industry positioning

Design direction:
- Premium, minimal, product-led
- AI-first discovery without forcing AI on every visitor
- Dimension finder for buyers who know their size
- Product-description route for buyers who don't
- Catalogue route for browsing
- Actual PackNiti catalogue/pricing should be wired in during the backend phase

## Run locally

Open `index.html` in a browser.

## Production architecture

Static website (GitHub Pages / Cloudflare Pages)
        ↓
PackNiti Render backend
        ↓
Catalogue + pricing engine
        ↓
Google Sheets MIS / WhatsApp / AI provider

Do not put any AI API key in the frontend.
