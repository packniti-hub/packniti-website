const root = document.getElementById('productPage');


/* =========================================================
   PRODUCT URL / SLUG
   Supports:
   /boxes/4x3x3.html
   /boxes/4x3x3
   /product.html?id=PACKNITI-3PLY-4x3x3
========================================================= */

const slugFromPath = (() => {

  const m = location.pathname.match(
    /\/boxes\/([^/]+?)(?:\.html)?$/i
  );

  return m
    ? decodeURIComponent(m[1])
    : null;

})();


const queryId =
  new URLSearchParams(location.search).get('id');


/* =========================================================
   HELPERS
========================================================= */

const esc = s =>
  String(s ?? '').replace(
    /[&<>"']/g,
    c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c])
  );


const fmt = n =>
  Number.isInteger(Number(n))
    ? String(Number(n))
    : String(n).replace(/\.0+$/, '');


const slugOf = p =>
  [
    p?.dimensions?.length,
    p?.dimensions?.breadth,
    p?.dimensions?.width
  ]
    .map(fmt)
    .join('x');


const dimsOf = p =>
  `${fmt(p.dimensions.length)} × ${fmt(p.dimensions.breadth)} × ${fmt(p.dimensions.width)}`;


const isStock = p => {

  const s =
    String(p?.availability || '')
      .toLowerCase();

  return (
    s.includes('stock') &&
    !s.includes('not')
  );

};


/* =========================================================
   PRICING
========================================================= */

const tierPrice = (p, qty) => {

  const tiers =
    p.pricing || [];

  if (!tiers.length) {
    return null;
  }

  if (qty <= 100) {

    return (
      tiers.find(
        t => t.range === '1-100'
      )?.price_inr
      ??
      tiers[0]?.price_inr
    );

  }

  if (qty <= 500) {

    return (
      tiers.find(
        t => t.range === '101-500'
      )?.price_inr
      ??
      tiers[tiers.length - 1]?.price_inr
    );

  }

  if (qty <= 2000) {

    return (
      tiers.find(
        t => t.range === '501-2000'
      )?.price_inr
      ??
      tiers[tiers.length - 1]?.price_inr
    );

  }

  return (
    tiers.find(
      t => t.range === '2000+'
    )?.price_inr
    ??
    tiers[tiers.length - 1]?.price_inr
  );

};


const tierLabel = r =>

  r === '1-100'
    ? '≤100'

    : r === '101-500'
      ? '101–500'

      : r === '501-2000'
        ? '501–2,000'

        : '2,000+';


/* =========================================================
   PATHS
========================================================= */

const basePrefix = () =>
  location.pathname.includes('/boxes/')
    ? '../'
    : '';


const localPrimary = slug =>
  `${basePrefix()}assets/product-gallery/${slug}.png`;


const localCatalogueImage = slug =>
  `${basePrefix()}assets/catalogue/box_${slug}.${slug === '6.5x2.5x3' ? 'png' : 'jpg'}`;


const galleryManifestUrl =
  `${basePrefix()}data/product-gallery.json`;


const catalogueUrl =
  `${basePrefix()}data/catalogue.json`;


const cartUrl =
  `${basePrefix()}cart.html`;


const boxesUrl =
  `${basePrefix()}boxes.html`;


const contactUrl =
  `${basePrefix()}contact.html`;


/* =========================================================
   CART COUNT
========================================================= */

function updateCartCount() {

  let count = 0;

  try {

    const items =
      JSON.parse(
        localStorage.getItem(
          'packniti_checkout_items'
        ) || '[]'
      );

    count =
      items.reduce(
        (s, i) =>
          s + (Number(i.qty) || 0),
        0
      );

  } catch (e) {}

  document
    .querySelectorAll('[data-cart-count]')
    .forEach(el => {

      el.textContent =
        count.toLocaleString('en-IN');

      el.classList.toggle(
        'hidden',
        count === 0
      );

    });

}


/* =========================================================
   ADD TO CART
========================================================= */

function addToCart(p, qty) {

  const q =
    Math.max(
      1,
      parseInt(
        String(qty).replace(/\D/g, ''),
        10
      ) || 1
    );


  const price =
    Number(
      tierPrice(p, q) || 0
    );


  let items = [];

  try {

    items =
      JSON.parse(
        localStorage.getItem(
          'packniti_checkout_items'
        ) || '[]'
      );

  } catch (e) {}


  const existing =
    items.find(
      i => i.id === p.id
    );


  const payload = {
    ...p,
    qty: q,
    price
  };


  if (existing) {

    existing.qty = q;
    existing.price = price;

  } else {

    items.push(payload);

  }


  localStorage.setItem(
    'packniti_checkout_items',
    JSON.stringify(items)
  );


  updateCartCount();


  window.location.href =
    cartUrl;

}


/* =========================================================
   SEO META
========================================================= */

function setMeta(name, content) {

  let el =
    document.querySelector(
      `meta[name="${name}"]`
    );

  if (!el) {

    el =
      document.createElement('meta');

    el.name = name;

    document.head.appendChild(el);

  }

  el.content = content;

}


function setProperty(prop, content) {

  let el =
    document.querySelector(
      `meta[property="${prop}"]`
    );

  if (!el) {

    el =
      document.createElement('meta');

    el.setAttribute(
      'property',
      prop
    );

    document.head.appendChild(el);

  }

  el.content = content;

}


function setCanonical(url) {

  let el =
    document.querySelector(
      'link[rel="canonical"]'
    );

  if (!el) {

    el =
      document.createElement('link');

    el.rel = 'canonical';

    document.head.appendChild(el);

  }

  el.href = url;

}


/* =========================================================
   RELATED PRODUCT DISTANCE
========================================================= */

function distance(a, b) {

  const da =
    a.dimensions;

  const db =
    b.dimensions;


  const target = [
    db.length,
    db.breadth,
    db.width
  ];


  const perms = [

    [
      target[0],
      target[1],
      target[2]
    ],

    [
      target[0],
      target[2],
      target[1]
    ],

    [
      target[1],
      target[0],
      target[2]
    ],

    [
      target[1],
      target[2],
      target[0]
    ],

    [
      target[2],
      target[0],
      target[1]
    ],

    [
      target[2],
      target[1],
      target[0]
    ]

  ];


  return Math.min(
    ...perms.map(
      ([l, w, h]) =>

        Math.abs(
          da.length - l
        )

        +

        Math.abs(
          da.breadth - w
        )

        +

        Math.abs(
          da.width - h
        )
    )
  );

}


/* =========================================================
   PRODUCT STRUCTURED DATA
========================================================= */

function injectSchema(p, images) {

  const tiers =
    p.pricing || [];


  const low =
    tiers.length
      ? Math.min(
          ...tiers.map(
            t =>
              Number(t.price_inr) ||
              Infinity
          )
        )
      : null;


  const high =
    tiers.length
      ? Math.max(
          ...tiers.map(
            t =>
              Number(t.price_inr) ||
              0
          )
        )
      : null;


  const schema = {

    '@context':
      'https://schema.org',

    '@type':
      'Product',

    'name':
      p.title ||
      `3 Ply Brown Corrugated Box - ${dimsOf(p)} in`,

    'brand': {
      '@type':
        'Brand',

      'name':
        'PackNiti'
    },

    'sku':
      p.id,

    'category':
      'Corrugated packaging box',

    'description':
      String(
        p.description || ''
      )
        .replace(
          /BULK PRICING[\s\S]*/i,
          ''
        )
        .trim(),

    'image':
      images.map(
        x =>
          new URL(
            x,
            location.href
          ).href
      )

  };


  if (
    low !== null &&
    isFinite(low)
  ) {

    schema.offers = {

      '@type':
        'AggregateOffer',

      'priceCurrency':
        'INR',

      'lowPrice':
        low,

      'highPrice':
        high,

      'offerCount':
        tiers.length,

      'availability':
        isStock(p)
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',

      'url':
        location.href

    };

  }


  let el =
    document.getElementById(
      'productSchema'
    );


  if (!el) {

    el =
      document.createElement(
        'script'
      );

    el.id =
      'productSchema';

    el.type =
      'application/ld+json';

    document.head.appendChild(el);

  }


  el.textContent =
    JSON.stringify(schema);

}


/* =========================================================
   GALLERY
========================================================= */

function buildGallery(p, manifest) {

  const slug =
    slugOf(p);

  const paths = [];


  (
    manifest?.[slug] || []
  ).forEach(x => {

    paths.push(
      `${basePrefix()}${x}`
    );

  });


  paths.push(
    localCatalogueImage(slug)
  );


  return [
    ...new Set(paths)
  ];

}


/* =========================================================
   RELATED PRODUCTS
========================================================= */

function renderExtras(
  p,
  images,
  products
) {

  const extra =
    document.getElementById(
      'productExtras'
    );


  if (!extra) {
    return;
  }


  const use = [

    ...(p.use_case_tags || []),

    ...(p.product_tags || [])

  ]
    .filter(Boolean)
    .slice(0, 10);


  const related =
    products

      .filter(
        x =>
          x.id !== p.id &&
          isStock(x)
      )

      .sort(
        (a, b) =>
          distance(a, p) -
          distance(b, p)
      )

      .slice(0, 4);


  extra.className =
    'product-lower';


  extra.innerHTML = `

  <section class="product-info-sections">

    <div>

      <div class="section-kicker">
        GOOD FOR
      </div>

      <h2>
        Where this size fits.
      </h2>

      <div class="tag-cloud">

        ${
          use
            .map(
              t =>
                `<span>${esc(t)}</span>`
            )
            .join('')

          ||

          '<span>Shipping</span><span>Ecommerce</span><span>Retail packing</span>'
        }

      </div>

    </div>


    <div>

      <div class="section-kicker">
        WHY PACKNITI
      </div>

      <h2>
        Exact dimensions. Clear pricing.
      </h2>

      <p>
        Use this page when you already know the box size you need.
        PackNiti brings the physical dimensions, quantity pricing,
        availability and product views together so you can order
        the right ready-size box without guesswork.
      </p>

      <a
        class="text-link"
        href="${boxesUrl}"
      >
        Need a different size? Open Box Finder →
      </a>

    </div>

  </section>


  <section class="related-section">

    <div class="section-kicker">
      RELATED READY-SIZE BOXES
    </div>

    <h2>
      Compare nearby sizes before you order.
    </h2>

    <div class="related-grid">

      ${
        related
          .map(r => {

            const s =
              slugOf(r);

            return `

            <a
              class="related-card"
              href="${basePrefix()}boxes/${encodeURIComponent(s)}.html"
            >

              <img
                src="${esc(localPrimary(s))}"
                alt="${esc(
                  r.title ||
                  'PackNiti corrugated box'
                )}"
                loading="lazy"
              >

              <div>

                <strong>
                  ${esc(dimsOf(r))} in
                </strong>

                <span>
                  ${esc(
                    r.title ||
                    '3 Ply Brown Corrugated Box'
                  )}
                </span>

                <small>
                  View size →
                </small>

              </div>

            </a>

            `;

          })
          .join('')
      }

    </div>

  </section>

  `;

}


/* =========================================================
   MAIN INITIALIZATION
========================================================= */

async function init() {

  updateCartCount();


  const [
    catRes,
    manRes
  ] = await Promise.all([

    fetch(
      catalogueUrl
    ),

    fetch(
      galleryManifestUrl
    ).catch(
      () => null
    )

  ]);


  if (!catRes.ok) {

    throw new Error(
      'Catalogue unavailable'
    );

  }


  const data =
    await catRes.json();


  const products =
    data.products || [];


  const manifest =
    manRes?.ok
      ? await manRes.json()
      : {};


  let p = null;


  /* ---------------------------------------------------------
     FIRST: CLEAN PRODUCT URL
  --------------------------------------------------------- */

  if (slugFromPath) {

    p =
      products.find(
        x =>
          slugOf(x) ===
          slugFromPath
      );

  }


  /* ---------------------------------------------------------
     SECOND: OLD PRODUCT URL
  --------------------------------------------------------- */

  if (!p && queryId) {

    p =
      products.find(
        x =>
          x.id === queryId
      );

  }


  /* ---------------------------------------------------------
     LAST RESORT
     This should only happen if the URL is invalid.
  --------------------------------------------------------- */

  if (!p) {

    p =
      products[0];

  }


  const slug =
    slugOf(p);


  const dim =
    dimsOf(p);


  const title =
    p.title ||
    `3 Ply Brown Corrugated Box - ${dim} in`;


  /* ---------------------------------------------------------
     CANONICAL URL
  --------------------------------------------------------- */

  const cleanUrl =
    `https://packniti.co.in/boxes/${slug}`;


  const description =

    (
      p.description ||

      `Ready-size 3-ply brown corrugated box in ${dim} inches.`
    )

      .replace(
        /BULK PRICING[\s\S]*/i,
        ''
      )

      .replace(
        /\s+/g,
        ' '
      )

      .trim();


  document.title =
    `${title} | PackNiti`;


  setMeta(
    'description',

    `${description} View quantity pricing, availability, images and related sizes from PackNiti.`
      .slice(0, 160)
  );


  setMeta(
    'robots',
    'index,follow,max-image-preview:large'
  );


  setCanonical(
    cleanUrl
  );


  setProperty(
    'og:title',
    `${title} | PackNiti`
  );


  setProperty(
    'og:description',
    description
  );


  setProperty(
    'og:url',
    cleanUrl
  );


  const images =
    buildGallery(
      p,
      manifest
    );


  setProperty(
    'og:image',
    new URL(
      images[0],
      location.href
    ).href
  );


  injectSchema(
    p,
    images
  );


  const inStock =
    isStock(p);


  const tiers =
    p.pricing || [];


  /* =========================================================
     PRODUCT HTML
  ========================================================= */

  root.innerHTML = `

  <section class="product">


    <div class="crumb">

      <a href="${boxesUrl}">
        Boxes
      </a>

      /

      <strong>
        ${esc(dim)}
      </strong>

    </div>


    <div class="product-grid">


      <!-- GALLERY -->

      <div class="gallery-column">


        <div class="main-product-image">

          <span class="image-badge">
            READY-SIZE · 3 PLY
          </span>


          <img
            id="mainProductImage"
            src="${esc(images[0])}"
            alt="${esc(title)} — PackNiti corrugated box"
            fetchpriority="high"
          >

        </div>


        <div class="gallery-thumbs">

          ${
            images
              .map(
                (src, i) => `

                <button
                  class="gallery-thumb ${
                    i === 0
                      ? 'active'
                      : ''
                  }"
                  type="button"
                  data-gallery-src="${esc(src)}"
                  aria-label="View ${esc(title)} image ${i + 1}"
                >

                  <img
                    src="${esc(src)}"
                    alt="${esc(title)} — view ${i + 1}"
                    loading="${
                      i === 0
                        ? 'eager'
                        : 'lazy'
                    }"
                  >

                </button>

                `
              )
              .join('')
          }

        </div>


        <p class="image-caption">

          Product photography for the
          ${esc(dim)}
          ready-size box.

          Select another image to view the box
          from a different angle.

        </p>


      </div>


      <!-- PRODUCT INFORMATION -->

      <div class="info">


        <span class="eyebrow">
          PACKNITI · READY-SIZE CORRUGATED BOX
        </span>


        <h1>
          ${esc(title)}
        </h1>


        <p class="subtitle">
          ${esc(description)}
        </p>


        <span
          class="stock ${
            inStock
              ? ''
              : 'out'
          }"
        >
          ${
            inStock
              ? 'IN STOCK'
              : 'NOT IN STOCK'
          }
        </span>


        <!-- DIMENSIONS -->

        <div class="specs">


          <div>

            <b>
              ${esc(
                fmt(
                  p.dimensions.length
                )
              )}&quot;
            </b>

            <span>
              LENGTH
            </span>

          </div>


          <div>

            <b>
              ${esc(
                fmt(
                  p.dimensions.breadth
                )
              )}&quot;
            </b>

            <span>
              BREADTH
            </span>

          </div>


          <div>

            <b>
              ${esc(
                fmt(
                  p.dimensions.width
                )
              )}&quot;
            </b>

            <span>
              WIDTH
            </span>

          </div>


        </div>


        <!-- PRICING -->

        <div class="pricing">


          <div class="pricing-head">

            <h3>
              Quantity pricing
            </h3>

            <span class="pricing-note">
              Lower rates at higher quantities
            </span>

          </div>


          ${
            tiers
              .map(
                t => `

                <div class="tier">

                  <span>
                    ${esc(
                      tierLabel(
                        t.range
                      )
                    )}
                    boxes
                  </span>

                  <b>
                    ₹${Number(
                      t.price_inr
                    ).toFixed(2)}
                    / box
                  </b>

                </div>

                `
              )
              .join('')

            ||

            `

            <div class="tier">

              <span>
                Pricing
              </span>

              <b>
                On enquiry
              </b>

            </div>

            `
          }


          <!-- BUY AREA -->

          <div class="buy">


            ${
              inStock

                ?

                `

                <div class="buy-controls">


                  <!-- QUANTITY -->

                  <div class="qty">


                    <button
                      id="minus"
                      type="button"
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>


                    <input
                      id="qty"
                      value="250"
                      inputmode="numeric"
                      aria-label="Quantity"
                    >


                    <button
                      id="plus"
                      type="button"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>


                  </div>


                  <!-- ADD TO CART -->

                  <button
                    class="product-add"
                    id="addToCart"
                    type="button"
                  >
                    Add to cart →
                  </button>


                </div>


                <!-- LIVE PRICE -->

                <div
                  id="livePrice"
                  class="live-price"
                  aria-live="polite"
                >


                  <span class="live-price-label">
                    Estimated total
                  </span>


                  <strong
                    id="livePriceAmount"
                  >
                    ₹0.00
                  </strong>


                  <span
                    id="livePriceRate"
                  >
                    ₹0.00 / box
                  </span>


                </div>

                `

                :

                `

                <a
                  href="${contactUrl}"
                >
                  Ask about this size →
                </a>

                `

            }


          </div>


        </div>


        <!-- PRODUCT TAGS -->

        <div class="details">


          <h3>
            Good for
          </h3>


          <div class="tags">


            ${
              [

                ...(p.use_case_tags || []),

                ...(p.product_tags || [])

              ]

                .slice(0, 8)

                .map(
                  t =>
                    `<span>${esc(t)}</span>`
                )

                .join('')

              ||

              '<span>Shipping</span><span>Ecommerce</span>'

            }


          </div>


        </div>


        <a
          class="back"
          href="${boxesUrl}"
        >
          ← Back to Box Finder
        </a>


      </div>


    </div>


  </section>

  `;


  /* =========================================================
     GALLERY CLICK HANDLERS
  ========================================================= */

  const main =
    document.getElementById(
      'mainProductImage'
    );


  document
    .querySelectorAll(
      '[data-gallery-src]'
    )
    .forEach(btn => {

      btn.addEventListener(
        'click',
        () => {

          document
            .querySelectorAll(
              '.gallery-thumb'
            )
            .forEach(x =>
              x.classList.remove(
                'active'
              )
            );


          btn.classList.add(
            'active'
          );


          main.src =
            btn.dataset.gallerySrc;

        }
      );

    });


  /* =========================================================
     EXTRA PRODUCT CONTENT
  ========================================================= */

  const extra =
    document.createElement(
      'div'
    );


  extra.id =
    'productExtras';


  root.insertAdjacentElement(
    'afterend',
    extra
  );


  /* =========================================================
     QUANTITY + LIVE PRICE
  ========================================================= */

  const q =
    document.getElementById(
      'qty'
    );


  const livePriceAmount =
    document.getElementById(
      'livePriceAmount'
    );


  const livePriceRate =
    document.getElementById(
      'livePriceRate'
    );


  function updateLivePrice() {

    if (
      !q ||
      !livePriceAmount ||
      !livePriceRate
    ) {

      return;

    }


    let qty =
      parseInt(
        q.value,
        10
      );


    /* Invalid / empty quantity */

    if (
      !Number.isFinite(qty) ||
      qty < 1
    ) {

      qty = 1;

    }


    /* Maximum safety limit */

    if (
      qty > 100000
    ) {

      qty = 100000;

    }


    q.value =
      qty;


    /* Find correct tier */

    const unitPrice =
      Number(
        tierPrice(
          p,
          qty
        ) || 0
      );


    /* Calculate total */

    const total =
      qty * unitPrice;


    /* Display total */

    livePriceAmount.textContent =
      `₹${total.toLocaleString(
        'en-IN',
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }
      )}`;


    /* Display applicable rate */

    livePriceRate.textContent =
      `₹${unitPrice.toFixed(2)} / box`;

  }


  /* ---------------------------------------------------------
     MINUS = -100
  --------------------------------------------------------- */

  document
    .getElementById('minus')
    ?.addEventListener(
      'click',
      () => {

        q.value =
          Math.max(
            1,
            (
              parseInt(
                q.value,
                10
              ) || 1
            ) - 100
          );


        updateLivePrice();

      }
    );


  /* ---------------------------------------------------------
     PLUS = +100
  --------------------------------------------------------- */

  document
    .getElementById('plus')
    ?.addEventListener(
      'click',
      () => {

        q.value =
          Math.min(
            100000,
            (
              parseInt(
                q.value,
                10
              ) || 1
            ) + 100
          );


        updateLivePrice();

      }
    );


  /* ---------------------------------------------------------
     MANUAL QUANTITY ENTRY
  --------------------------------------------------------- */

  q?.addEventListener(
    'input',
    updateLivePrice
  );


  /* ---------------------------------------------------------
     INITIAL PRICE
  --------------------------------------------------------- */

  updateLivePrice();


  /* ---------------------------------------------------------
     ADD TO CART
  --------------------------------------------------------- */

  document
    .getElementById(
      'addToCart'
    )
    ?.addEventListener(
      'click',
      () =>
        addToCart(
          p,
          q.value
        )
    );


  /* =========================================================
     RELATED PRODUCTS
  ========================================================= */

  renderExtras(
    p,
    images,
    products
  );


  /* =========================================================
     FOOTER
  ========================================================= */

  if (
    !document.querySelector(
      'footer'
    )
  ) {

    document.body.insertAdjacentHTML(
      'beforeend',

      `

      <footer>


        <div class="footer-brand">


          <img
            src="/assets/packniti-header-logo.png"
            alt="PackNiti"
          >


          <p>
            Practical packaging. Smarter buying.
          </p>


        </div>


        <div class="footer-links">


          <a href="/boxes.html">
            Boxes
          </a>


          <a href="/custom.html">
            Custom Boxes
          </a>


          <a href="/contact.html">
            Contact
          </a>


          <a
            href="https://wa.me/919310706043"
            target="_blank"
            rel="noopener"
          >
            WhatsApp
          </a>


        </div>


        <div class="footer-bottom">
          © 2026 PackNiti · Brown corrugated packaging
        </div>


      </footer>

      `
    );

  }

}


/* =========================================================
   START
========================================================= */

init().catch(
  err => {

    console.error(
      err
    );


    root.innerHTML = `

      <div class="loading">

        We could not load that box.

        <a href="${boxesUrl}">
          Return to the catalogue →
        </a>

      </div>

    `;

  }
);