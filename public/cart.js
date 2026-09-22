const $ = id =>
  document.getElementById(id);

const CART_KEY =
  "packniti_checkout_items";

let items = [];


/* =========================================================
   HELPERS
========================================================= */

function esc(value) {

  return String(value ?? "")
    .replace(
      /[&<>"']/g,
      char =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        })[char]
    );
}


function money(value) {

  return (
    "₹" +
    Number(value || 0)
      .toLocaleString(
        "en-IN",
        {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        }
      )
  );
}


/* =========================================================
   PRODUCT TYPES
========================================================= */

function isMug(item) {

  return (
    item?.id ===
      "PACKNITI-MUG-PACKAGING-01" ||
    item?.slug ===
      "mug-packaging" ||
    item?.product_type ===
      "packaging_solution" ||
    item?.solution_type ===
      "premium_mug_packaging"
  );
}


function isLabel(item) {

  return (
    item?.id ===
      "PACKNITI-MUG-LABEL-01" ||
    item?.slug ===
      "custom-mug-label" ||
    item?.product_type ===
      "custom_label" ||
    item?.solution_type ===
      "custom_mug_label"
  );
}


/* =========================================================
   PRICING
========================================================= */

function mugPrice(qty) {

  qty =
    Math.max(
      1,
      Number(qty) || 1
    );


  if (qty <= 100) return 38;

  if (qty <= 500) return 34;

  if (qty <= 2000) return 29;

  return 25;
}


function labelPrice(qty) {

  qty =
    Math.max(
      1,
      Number(qty) || 1
    );


  return qty <= 500
    ? 3
    : 2;
}


function standardPrice(
  item,
  qty
) {

  const tiers =
    Array.isArray(item?.pricing)
      ? item.pricing
      : [];


  if (!tiers.length) {

    return Number(
      item?.price
    ) || 0;
  }


  qty =
    Math.max(
      1,
      Number(qty) || 1
    );


  if (qty <= 100) {

    return Number(
      tiers.find(
        t => t.range === "1-100"
      )?.price_inr ||
      tiers[0]?.price_inr ||
      0
    );
  }


  if (qty <= 500) {

    return Number(
      tiers.find(
        t => t.range === "101-500"
      )?.price_inr ||
      0
    );
  }


  if (qty <= 2000) {

    return Number(
      tiers.find(
        t => t.range === "501-2000"
      )?.price_inr ||
      0
    );
  }


  return Number(
    tiers.find(
      t => t.range === "2000+"
    )?.price_inr ??
    tiers.find(
      t => t.range === "2001+"
    )?.price_inr ??
    0
  );
}


function unitPrice(
  item,
  qty
) {

  if (isMug(item)) {
    return mugPrice(qty);
  }


  if (isLabel(item)) {
    return labelPrice(qty);
  }


  return standardPrice(
    item,
    qty
  );
}


/* =========================================================
   STANDARD BOX IMAGE
========================================================= */

function slugFor(item) {

  const d =
    item?.dimensions || {};


  if (
    d.length == null ||
    d.breadth == null ||
    d.width == null
  ) {

    return "";
  }


  return [
    d.length,
    d.breadth,
    d.width
  ]
    .map(
      value =>
        Number.isInteger(
          Number(value)
        )
          ? String(value)
          : String(value)
              .replace(
                /\.0+$/,
                ""
              )
    )
    .join("x");
}


function standardImage(
  item
) {

  const slug =
    slugFor(item);


  if (!slug) {
    return "";
  }


  return (
    `assets/product-gallery/${slug}.png`
  );
}


/* =========================================================
   MUG IMAGE
========================================================= */

function mugImage(item) {

  return (
    item?.image ||
    "assets/mug-packaging/v2/front-personalised-1.jpeg"
  );
}


/* =========================================================
   LOAD + CLEAN CART
========================================================= */

function loadCart() {

  try {

    const stored =
      JSON.parse(
        localStorage.getItem(
          CART_KEY
        ) || "[]"
      );


    if (!Array.isArray(stored)) {
      return [];
    }


    /*
      Keep standard boxes exactly as they are.
    */

    const standardBoxes =
      stored.filter(
        item =>
          !isMug(item) &&
          !isLabel(item)
      );


    /*
      There should only ever be ONE Mug item.
      If old cart data contains multiple copies,
      use the last one.
    */

    const mugs =
      stored.filter(
        isMug
      );


    const mug =
      mugs.length
        ? mugs[mugs.length - 1]
        : null;


    /*
      There should only ever be ONE label.
      Keep the first/last valid one.
    */

    const labels =
      stored.filter(
        isLabel
      );


    const label =
      labels.length
        ? labels[labels.length - 1]
        : null;


    const cleaned = [
      ...standardBoxes
    ];


    if (mug) {

      const qty =
        Math.max(
          1,
          Number(mug.qty) || 1
        );


      cleaned.push({

        ...mug,

        id:
          "PACKNITI-MUG-PACKAGING-01",

        product_type:
          "packaging_solution",

        solution_type:
          "premium_mug_packaging",

        title:
          "Premium Mug Packaging",

        qty,

        price:
          mugPrice(qty),

        box_price:
          mugPrice(qty),

        dimensions:
          "15 × 12 × 10 cm",

        mug_capacity:
          "300–500 ml",

        inserts:
          2,

        image:
          mugImage(mug)

      });


      /*
        If a label exists, it MUST belong to
        the Mug product only.
      */

      if (label) {

        cleaned.push({

          ...label,

          id:
            "PACKNITI-MUG-LABEL-01",

          product_type:
            "custom_label",

          solution_type:
            "custom_mug_label",

          title:
            "Custom Printed Labels",

          qty,

          price:
            labelPrice(qty),

          label_price:
            labelPrice(qty),

          label_qty:
            qty,

          label_area:
            "13.5 × 9.5 cm",

          parent_product_id:
            "PACKNITI-MUG-PACKAGING-01",

          parent_product_title:
            "Premium Mug Packaging"

        });
      }
    }


    /*
      Save the cleaned cart.
      This removes any old duplicate labels.
    */

    localStorage.setItem(
      CART_KEY,
      JSON.stringify(cleaned)
    );


    return cleaned;

  } catch (error) {

    console.error(
      "Could not load PackNiti cart:",
      error
    );


    return [];
  }
}


/* =========================================================
   SAVE
========================================================= */

function save() {

  localStorage.setItem(
    CART_KEY,
    JSON.stringify(items)
  );
}


/* =========================================================
   RENDER
========================================================= */

function render() {

  const container =
    $("cartItems");


  if (!container) {

    console.error(
      "cartItems element not found."
    );

    return;
  }


  if (!items.length) {

    container.innerHTML = `
      <div class="empty-cart">

        <h3>
          Your cart is empty.
        </h3>

        <p>
          Choose some ready-size boxes or
          packaging solutions to get started.
        </p>

        <a href="boxes.html">
          Find your box →
        </a>

      </div>
    `;


    $("subtotal").textContent =
      "₹0";

    $("summaryCount").textContent =
      "0";

    $("cartCount").textContent =
      "0";

    $("checkoutButton").disabled =
      true;


    return;
  }


  $("checkoutButton").disabled =
    false;


  let subtotal = 0;

  let totalQuantity = 0;


  const html =
    items.map(
      (item, index) => {

        const qty =
          Math.max(
            1,
            Number(item.qty) || 1
          );


        const price =
          unitPrice(
            item,
            qty
          );


        const lineTotal =
          price * qty;


        subtotal +=
          lineTotal;


        totalQuantity +=
          qty;


        /* =================================================
           PREMIUM MUG
        ================================================= */

        if (isMug(item)) {

          return `
            <article
              class="cart-item cart-item-mug"
            >

              <div class="cart-image">

                <img
                  src="${esc(
                    mugImage(item)
                  )}"
                  alt="Premium Mug Packaging"
                >

              </div>


              <div>

                <h3>
                  Premium Mug Packaging
                </h3>


                <div class="cart-meta">
                  15 × 12 × 10 cm ·
                  300–500 ml ·
                  1 corrugated outer box +
                  2 molded-pulp inserts
                </div>


                <div class="cart-meta">
                  ₹${price.toFixed(2)}
                  / packaging set
                </div>


                <div class="cart-controls">

                  <div class="qty-control">

                    <button
                      onclick="changeQty(${index}, -1)"
                    >
                      −
                    </button>


                    <input
                      value="${qty}"
                      inputmode="numeric"
                      onchange="
                        setQty(
                          ${index},
                          this.value
                        )
                      "
                    >


                    <button
                      onclick="changeQty(${index}, 1)"
                    >
                      +
                    </button>

                  </div>


                  <button
                    class="remove-btn"
                    onclick="
                      removeItem(${index})
                    "
                  >
                    Remove
                  </button>

                </div>

              </div>


              <div class="cart-price">

                <strong>
                  ${money(lineTotal)}
                </strong>

                <small>
                  ${qty.toLocaleString("en-IN")}
                  sets
                </small>

              </div>

            </article>
          `;
        }


        /* =================================================
           CUSTOM LABEL
        ================================================= */

        if (isLabel(item)) {

          return `
            <article
              class="cart-item cart-item-label"
            >

              <div
                class="cart-image label-cart-image"
              >

                <div
                  class="label-cart-icon"
                >
                  LABEL
                </div>

              </div>


              <div>

                <h3>
                  Custom Printed Labels
                </h3>


                <div class="cart-meta">
                  13.5 × 9.5 cm ·
                  Printed ready-to-paste labels
                </div>


                <div class="cart-meta">

                  ${
                    item.artwork_name
                      ? `Artwork: ${esc(
                          item.artwork_name
                        )}`
                      : item.label_asset_key
                        ? "Artwork uploaded"
                        : "Custom artwork"
                  }

                </div>


                <div class="cart-controls">

                  <div class="qty-control">

                    <button
                      onclick="changeQty(${index}, -1)"
                    >
                      −
                    </button>


                    <input
                      value="${qty}"
                      inputmode="numeric"
                      onchange="
                        setQty(
                          ${index},
                          this.value
                        )
                      "
                    >


                    <button
                      onclick="changeQty(${index}, 1)"
                    >
                      +
                    </button>

                  </div>


                  <button
                    class="remove-btn"
                    onclick="
                      removeItem(${index})
                    "
                  >
                    Remove
                  </button>

                </div>

              </div>


              <div class="cart-price">

                <strong>
                  ${money(lineTotal)}
                </strong>

                <small>
                  ${qty.toLocaleString("en-IN")}
                  labels
                </small>

              </div>

            </article>
          `;
        }


        /* =================================================
           STANDARD CORRUGATED BOX
        ================================================= */

        const d =
          item?.dimensions || {};


        const dims =
          `${d.length ?? ""} × ` +
          `${d.breadth ?? ""} × ` +
          `${d.width ?? ""} in`;


        const image =
          standardImage(
            item
          );


        return `
          <article
            class="cart-item"
          >

            <div class="cart-image">

              ${
                image
                  ? `
                    <img
                      src="${esc(image)}"
                      alt="${esc(
                        item.title ||
                        "PackNiti box"
                      )}"
                    >
                  `
                  : ""
              }

            </div>


            <div>

              <h3>
                ${esc(
                  item.title ||
                  "PackNiti box"
                )}
              </h3>


              <div class="cart-meta">

                ${esc(dims)}
                ·
                ${esc(
                  item.material ||
                  "3-Ply"
                )}
                ·
                ₹${price.toFixed(2)}/box

              </div>


              <div class="cart-controls">

                <div class="qty-control">

                  <button
                    onclick="
                      changeQty(${index}, -1)
                    "
                  >
                    −
                  </button>


                  <input
                    value="${qty}"
                    inputmode="numeric"
                    onchange="
                      setQty(
                        ${index},
                        this.value
                      )
                    "
                  >


                  <button
                    onclick="
                      changeQty(${index}, 1)
                    "
                  >
                    +
                  </button>

                </div>


                <button
                  class="remove-btn"
                  onclick="
                    removeItem(${index})
                  "
                >
                  Remove
                </button>

              </div>

            </div>


            <div class="cart-price">

              <strong>
                ${money(lineTotal)}
              </strong>

              <small>
                ${qty.toLocaleString("en-IN")}
                boxes
              </small>

            </div>

          </article>
        `;
      }
    ).join("");


  container.innerHTML =
    html;


  $("subtotal").textContent =
    money(subtotal);


  $("summaryCount").textContent =
    totalQuantity.toLocaleString(
      "en-IN"
    );


  $("cartCount").textContent =
    totalQuantity.toLocaleString(
      "en-IN"
    );
}


/* =========================================================
   QUANTITY CHANGE
========================================================= */

function changeQty(
  index,
  delta
) {

  const item =
    items[index];


  if (!item) {
    return;
  }


  const current =
    Math.max(
      1,
      Number(item.qty) || 1
    );


  /*
    Standard boxes = ±100
  */

  if (
    !isMug(item) &&
    !isLabel(item)
  ) {

    item.qty =
      Math.max(
        1,
        current +
        delta * 100
      );

  } else {

    /*
      Mug + Label = ±1
    */

    item.qty =
      Math.max(
        1,
        current + delta
      );
  }


  /*
    Mug controls label quantity.
  */

  if (isMug(item)) {

    item.price =
      mugPrice(
        item.qty
      );

    item.box_price =
      mugPrice(
        item.qty
      );


    const label =
      items.find(
        isLabel
      );


    if (label) {

      label.qty =
        item.qty;

      label.price =
        labelPrice(
          item.qty
        );

      label.label_price =
        labelPrice(
          item.qty
        );

      label.label_qty =
        item.qty;
    }
  }


  /*
    Label quantity can never diverge
    from the Mug quantity.
  */

  if (isLabel(item)) {

    const mug =
      items.find(
        isMug
      );


    if (mug) {

      item.qty =
        mug.qty;

      item.price =
        labelPrice(
          mug.qty
        );

      item.label_price =
        labelPrice(
          mug.qty
        );

      item.label_qty =
        mug.qty;

    } else {

      /*
        Never allow an orphan label.
      */

      items.splice(
        index,
        1
      );
    }
  }


  save();

  render();
}


/* =========================================================
   MANUAL QUANTITY
========================================================= */

function setQty(
  index,
  value
) {

  const item =
    items[index];


  if (!item) {
    return;
  }


  let qty =
    parseInt(
      String(value)
        .replace(/\D/g, ""),
      10
    );


  if (
    !Number.isFinite(qty) ||
    qty < 1
  ) {

    qty = 1;
  }


  item.qty =
    qty;


  /*
    Mug → update associated label.
  */

  if (isMug(item)) {

    item.price =
      mugPrice(qty);

    item.box_price =
      mugPrice(qty);


    const label =
      items.find(
        isLabel
      );


    if (label) {

      label.qty =
        qty;

      label.price =
        labelPrice(qty);

      label.label_price =
        labelPrice(qty);

      label.label_qty =
        qty;
    }
  }


  /*
    Label → force it to Mug quantity.
  */

  if (isLabel(item)) {

    const mug =
      items.find(
        isMug
      );


    if (mug) {

      item.qty =
        mug.qty;

      item.price =
        labelPrice(
          mug.qty
        );

      item.label_price =
        labelPrice(
          mug.qty
        );

      item.label_qty =
        mug.qty;

    } else {

      items.splice(
        index,
        1
      );
    }
  }


  save();

  render();
}


/* =========================================================
   REMOVE
========================================================= */

function removeItem(
  index
) {

  const item =
    items[index];


  if (!item) {
    return;
  }


  /*
    Removing Mug removes its label.
  */

  if (isMug(item)) {

    items =
      items.filter(
        x =>
          !isMug(x) &&
          !isLabel(x)
      );

  } else {

    items.splice(
      index,
      1
    );
  }


  save();

  render();
}


/* =========================================================
   CLEAR CART
========================================================= */

$("clearCart")?.addEventListener(
  "click",
  () => {

    if (!items.length) {
      return;
    }


    if (
      confirm(
        "Clear your cart?"
      )
    ) {

      items = [];

      save();

      render();
    }
  }
);


/* =========================================================
   CHECKOUT
========================================================= */

$("checkoutButton")?.addEventListener(
  "click",
  () => {

    if (!items.length) {
      return;
    }


    save();


    window.location.href =
      "checkout.html";
  }
);


/* =========================================================
   INITIAL LOAD
========================================================= */

items =
  loadCart();


render();