const ORDER_API_URL =
  "https://packniti-order-api.packniti.workers.dev/";

const REQUEST_TIMEOUT_MS = 30000;
const MAX_SUBMISSION_ATTEMPTS = 2;
const RETRY_DELAY_MS = 750;

const CART_KEY =
  "packniti_checkout_items";

const $ = (id) =>
  document.getElementById(id);

let items = [];
let submitting = false;


/* ============================================================
   MONEY
============================================================ */

function formatMoney(value) {
  return (
    "₹" +
    Math.round(
      Number(value) || 0
    ).toLocaleString("en-IN")
  );
}


/* ============================================================
   HTML ESCAPING
============================================================ */

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[char]
  );
}


/* ============================================================
   PRODUCT TYPE DETECTION
============================================================ */

function isMugPackaging(item) {
  return (
    item?.id ===
      "PACKNITI-MUG-PACKAGING-01" ||
    item?.slug === "mug-packaging" ||
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
    item?.product_type ===
      "custom_label" ||
    item?.solution_type ===
      "custom_mug_label"
  );
}


/* ============================================================
   MUG PRICING
============================================================ */

function mugBoxPrice(quantity) {

  const qty =
    Math.max(
      1,
      Number(quantity) || 1
    );

  if (qty <= 100) {
    return 38;
  }

  if (qty <= 500) {
    return 34;
  }

  if (qty <= 2000) {
    return 29;
  }

  return 25;
}


function mugLabelPrice(quantity) {

  const qty =
    Math.max(
      1,
      Number(quantity) || 1
    );

  return qty <= 500
    ? 3
    : 2;
}


/* ============================================================
   STANDARD BOX PRICING
============================================================ */

function standardBoxPrice(item, quantity) {

  const tiers =
    Array.isArray(item?.pricing)
      ? item.pricing
      : [];

  if (!tiers.length) {
    return Number(item?.price) || 0;
  }

  const qty =
    Math.max(
      1,
      Number(quantity) || 1
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


/* ============================================================
   UNIT PRICE
============================================================ */

function getUnitPrice(item) {

  const qty =
    Math.max(
      1,
      Number(item?.qty) || 1
    );


  if (isMugPackaging(item)) {
    return mugBoxPrice(qty);
  }


  if (isLabel(item)) {
    return mugLabelPrice(qty);
  }


  return standardBoxPrice(
    item,
    qty
  );
}


/* ============================================================
   IMAGE
============================================================ */

function imageUrl(item) {

  const raw =
    item?.image ||
    item?.image_url ||
    "";

  const s =
    String(raw).trim();


  if (!s) {
    return "";
  }


  if (
    s.startsWith("assets/") ||
    s.startsWith("./assets/") ||
    s.startsWith("../assets/") ||
    s.startsWith("http://") ||
    s.startsWith("https://") ||
    s.startsWith("data:")
  ) {

    return s;

  }


  const match =
    s.match(
      /drive\.google\.com\/.*[?&]id=([^&]+)/i
    ) ||
    s.match(
      /drive\.google\.com\/file\/d\/([^/]+)/i
    );


  return match
    ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(match[1])}&sz=w400`
    : s;
}


/* ============================================================
   DIMENSIONS / DESCRIPTION
============================================================ */

function itemDescription(item) {

  if (isMugPackaging(item)) {

    return (
      "15 × 12 × 10 cm · " +
      "300–500 ml · " +
      "1 corrugated outer box + " +
      "2 molded-pulp inserts"
    );

  }


  if (isLabel(item)) {

    return (
      "13.5 × 9.5 cm · " +
      "Printed custom labels"
    );

  }


  const d =
    item?.dimensions || {};


  return (
    `${d.length ?? ""} × ` +
    `${d.breadth ?? ""} × ` +
    `${d.width ?? ""} in`
  );
}


/* ============================================================
   CART
============================================================ */

function getCartItems() {

  try {

    const raw =
      localStorage.getItem(
        CART_KEY
      );

    const parsed =
      raw
        ? JSON.parse(raw)
        : [];


    return Array.isArray(parsed)
      ? parsed
      : [];

  } catch (error) {

    console.error(
      "Could not read checkout cart:",
      error
    );

    return [];
  }
}


/* ============================================================
   NORMALISE CHECKOUT ITEMS
============================================================ */

function normaliseItems(rawItems) {

  const result = [];


  for (
    const raw of
    Array.isArray(rawItems)
      ? rawItems
      : []
  ) {

    if (!raw) {
      continue;
    }


    /* --------------------------------------------------------
       PREMIUM MUG PACKAGING
    -------------------------------------------------------- */

    if (isMugPackaging(raw)) {

      const qty =
        Math.max(
          1,
          Number(raw.qty) || 1
        );


      const boxPrice =
        mugBoxPrice(qty);


      result.push({

        ...raw,

        id:
          "PACKNITI-MUG-PACKAGING-01",

        slug:
          "mug-packaging",

        product_type:
          "packaging_solution",

        solution_type:
          "premium_mug_packaging",

        title:
          "Premium Mug Packaging",

        qty,

        price:
          boxPrice,

        box_price:
          boxPrice,

        dimensions:
          "15 × 12 × 10 cm",

        mug_capacity:
          "300–500 ml",

        inserts:
          2,

        image:
          raw.image ||
          raw.image_url ||
          "assets/mug-packaging/v2/front-personalised-1.jpeg",

        shipping_extra:
          true

      });


      /*
        Legacy cart entries may still have the label
        embedded inside the Mug item.

        Convert that into a separate checkout item.
      */

      const hasLabel =
        raw.custom_label === true ||
        Number(raw.label_qty) > 0 ||
        Number(raw.label_price) > 0 ||
        Boolean(raw.label_asset_key);


      if (hasLabel) {

        const labelPrice =
          mugLabelPrice(qty);


        result.push({

          id:
            "PACKNITI-MUG-LABEL-01",

          slug:
            "custom-mug-label",

          product_type:
            "custom_label",

          solution_type:
            "custom_mug_label",

          title:
            "Custom Printed Labels",

          qty,

          price:
            labelPrice,

          label_price:
            labelPrice,

          label_qty:
            qty,

          label_area:
            raw.label_area ||
            "13.5 × 9.5 cm",

          parent_product_id:
            "PACKNITI-MUG-PACKAGING-01",

          parent_product_title:
            "Premium Mug Packaging",

          label_details:
            raw.label_details || "",

          label_notes:
            raw.label_notes || "",

          label_asset_key:
            raw.label_asset_key ||
            null,

          artwork_name:
            raw.artwork_name ||
            null,

          shipping_extra:
            true
        });
      }


      continue;
    }


    /* --------------------------------------------------------
       SEPARATE LABEL
    -------------------------------------------------------- */

    if (isLabel(raw)) {

      const qty =
        Math.max(
          1,
          Number(raw.qty) ||
          Number(raw.label_qty) ||
          1
        );


      const labelPrice =
        mugLabelPrice(qty);


      result.push({

        ...raw,

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
          labelPrice,

        label_price:
          labelPrice,

        label_qty:
          qty,

        label_area:
          raw.label_area ||
          "13.5 × 9.5 cm"

      });


      continue;
    }


    /* --------------------------------------------------------
       STANDARD BOX
    -------------------------------------------------------- */

    result.push({
      ...raw,

      product_type:
        raw.product_type ||
        "standard_box"
    });
  }


  return result;
}


/* ============================================================
   SUMMARY
============================================================ */

function renderSummary() {

  const summaryItems =
    $("summaryItems");

  const subtotalEl =
    $("subtotal");

  const totalEl =
    $("total");


  if (
    !summaryItems ||
    !subtotalEl ||
    !totalEl
  ) {
    return;
  }


  if (!items.length) {

    summaryItems.innerHTML = `
      <div class="summary-foot">
        No items selected.
        <a href="boxes.html">
          <u>Return to the catalogue</u>
        </a>
        and choose the packaging you need.
      </div>
    `;


    subtotalEl.textContent =
      "₹0";

    totalEl.textContent =
      "₹0";

    return;
  }


  let subtotal = 0;


  summaryItems.innerHTML =
    items.map(
      item => {

        const qty =
          Math.max(
            1,
            Number(item.qty) || 1
          );


        /*
          Recalculate the price from the current
          quantity so checkout never relies on
          a stale product-page price.
        */

        const price =
          getUnitPrice(item);


        item.price =
          price;


        if (isMugPackaging(item)) {
          item.box_price =
            price;
        }


        if (isLabel(item)) {
          item.label_price =
            price;

          item.label_qty =
            qty;
        }


        const lineTotal =
          price * qty;


        subtotal +=
          lineTotal;


        const img =
          imageUrl(item);


        const image =
          img
            ? `
              <img
                src="${escapeHtml(img)}"
                alt=""
                onerror="
                  this.style.display='none'
                "
              >
            `
            : "";


        /* ====================================================
           PREMIUM MUG
        ==================================================== */

        if (isMugPackaging(item)) {

          return `
            <div class="summary-item">

              <div class="summary-image">
                ${image}
              </div>

              <div>

                <h3>
                  Premium Mug Packaging
                </h3>

                <p>
                  ${itemDescription(item)}
                  ·
                  ${qty.toLocaleString("en-IN")}
                  sets
                  ·
                  ₹${price.toFixed(2)}/set
                </p>

              </div>

              <strong>
                ${formatMoney(lineTotal)}
              </strong>

            </div>
          `;
        }


        /* ====================================================
           CUSTOM LABEL
        ==================================================== */

        if (isLabel(item)) {

          const artwork =
            item.artwork_name
              ? `Artwork: ${escapeHtml(item.artwork_name)}`
              : item.label_asset_key
                ? "Artwork uploaded"
                : "Custom artwork";


          return `
            <div class="summary-item">

              <div class="summary-image label-summary-image">

                <div class="label-summary-placeholder">
                  LABEL
                </div>

              </div>

              <div>

                <h3>
                  Custom Printed Labels
                </h3>

                <p>
                  13.5 × 9.5 cm
                  ·
                  ${qty.toLocaleString("en-IN")}
                  labels
                  ·
                  ₹${price.toFixed(2)}/label
                </p>

                <p>
                  ${artwork}
                </p>

              </div>

              <strong>
                ${formatMoney(lineTotal)}
              </strong>

            </div>
          `;
        }


        /* ====================================================
           STANDARD BOX
        ==================================================== */

        return `
          <div class="summary-item">

            <div class="summary-image">
              ${image}
            </div>

            <div>

              <h3>
                ${escapeHtml(
                  item.title ||
                  "PackNiti box"
                )}
              </h3>

              <p>
                ${escapeHtml(
                  itemDescription(item)
                )}
                ·
                ${qty.toLocaleString("en-IN")}
                boxes
                ·
                ₹${price.toFixed(2)}/box
              </p>

            </div>

            <strong>
              ${formatMoney(lineTotal)}
            </strong>

          </div>
        `;

      }
    ).join("");


  /*
    Save the freshly recalculated prices back into
    localStorage so the order payload contains the
    exact same totals displayed here.
  */

  localStorage.setItem(
    CART_KEY,
    JSON.stringify(items)
  );


  subtotalEl.textContent =
    formatMoney(subtotal);

  totalEl.textContent =
    formatMoney(subtotal);
}


/* ============================================================
   IDEMPOTENCY
============================================================ */

function getIdempotencyKey() {

  const storageKey =
    "packniti_checkout_idempotency_key";


  let key =
    sessionStorage.getItem(
      storageKey
    );


  if (!key) {

    if (
      window.crypto &&
      crypto.randomUUID
    ) {

      key =
        crypto.randomUUID();

    } else {

      key =
        Date.now().toString(36) +
        "-" +
        Math.random()
          .toString(36)
          .slice(2) +
        "-" +
        Math.random()
          .toString(36)
          .slice(2);
    }


    sessionStorage.setItem(
      storageKey,
      key
    );
  }


  return key;
}


function clearIdempotencyKey() {

  try {

    sessionStorage.removeItem(
      "packniti_checkout_idempotency_key"
    );

  } catch (error) {

    console.warn(
      "Could not clear checkout idempotency key:",
      error
    );
  }
}


/* ============================================================
   RESTORE FORM DATA
============================================================ */

function restorePendingFormData() {

  try {

    const saved =
      JSON.parse(
        localStorage.getItem(
          "packniti_order"
        ) || "null"
      );


    if (!saved) {
      return;
    }


    const form =
      $("checkoutForm");


    if (!form) {
      return;
    }


    Object.entries(saved)
      .forEach(
        ([name, value]) => {

          if (
            name === "items" ||
            name === "subtotal" ||
            name === "reference" ||
            name === "serverReceived" ||
            name === "status" ||
            name === "idempotencyKey"
          ) {
            return;
          }


          const field =
            form.elements[name];


          if (
            !field ||
            typeof value === "object"
          ) {
            return;
          }


          if (
            field.type ===
            "checkbox"
          ) {

            field.checked =
              Boolean(value);

          } else if (
            field.type ===
            "radio"
          ) {

            field.checked =
              field.value ===
              String(value);

          } else {

            field.value =
              String(value ?? "");
          }
        }
      );


    if (
      $("sameBilling") &&
      $("billingFields")
    ) {

      $("billingFields")
        .classList.toggle(
          "hidden",
          $("sameBilling").checked
        );
    }


    if (
      $("noGst") &&
      $("gstin")
    ) {

      $("gstin").disabled =
        $("noGst").checked;
    }


  } catch (error) {

    console.warn(
      "Could not restore pending checkout data:",
      error
    );
  }
}


/* ============================================================
   SUBMIT BUTTON
============================================================ */

function setSubmittingState(
  isSubmitting
) {

  const form =
    $("checkoutForm");


  const button =
    form?.querySelector(
      'button[type="submit"]'
    );


  submitting =
    isSubmitting;


  if (!button) {
    return;
  }


  button.disabled =
    isSubmitting;


  button.setAttribute(
    "aria-disabled",
    String(isSubmitting)
  );


  if (isSubmitting) {

    button.dataset.originalText =
      button.innerHTML;

    button.innerHTML =
      "Submitting…";

  } else if (
    button.dataset.originalText
  ) {

    button.innerHTML =
      button.dataset.originalText;

    delete button.dataset.originalText;
  }
}


/* ============================================================
   SEND ORDER TO WORKER
============================================================ */

async function postOrder(
  payload
) {

  let lastError =
    null;


  for (
    let attempt = 1;
    attempt <= MAX_SUBMISSION_ATTEMPTS;
    attempt++
  ) {

    const controller =
      new AbortController();


    const timeout =
      setTimeout(
        () =>
          controller.abort(),
        REQUEST_TIMEOUT_MS
      );


    try {

      const response =
        await fetch(
          ORDER_API_URL,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "text/plain;charset=utf-8"
            },

            body:
              JSON.stringify(
                payload
              ),

            signal:
              controller.signal,

            cache:
              "no-store"
          }
        );


      const responseText =
        await response.text();


      let result;


      try {

        result =
          JSON.parse(
            responseText
          );

      } catch (error) {

        const parseError =
          new Error(
            `Order server returned an invalid response (HTTP ${response.status}).`
          );


        parseError.httpStatus =
          response.status;


        throw parseError;
      }


      if (!response.ok) {

        const serverError =
          new Error(
            result.error ||
            `Order server returned HTTP ${response.status}.`
          );


        serverError.httpStatus =
          response.status;


        const retryable =
          response.status === 502 ||
          response.status === 503 ||
          response.status === 504;


        if (
          retryable &&
          attempt <
            MAX_SUBMISSION_ATTEMPTS
        ) {

          lastError =
            serverError;


          await sleep(
            RETRY_DELAY_MS
          );


          continue;
        }


        throw serverError;
      }


      if (!result.ok) {

        const rejectedError =
          new Error(
            result.error ||
            "Order receiver rejected the order."
          );


        rejectedError.httpStatus =
          response.status;


        throw rejectedError;
      }


      return result;


    } catch (error) {

      lastError =
        error;


      const isAbort =
        error?.name ===
        "AbortError";


      const isNetworkError =
        error?.name ===
        "TypeError";


      const isRetryableHttp =
        error?.httpStatus === 502 ||
        error?.httpStatus === 503 ||
        error?.httpStatus === 504;


      const shouldRetry =
        attempt <
          MAX_SUBMISSION_ATTEMPTS &&
        (
          isAbort ||
          isNetworkError ||
          isRetryableHttp
        );


      if (!shouldRetry) {

        throw error;
      }


      console.warn(
        `PackNiti order attempt ${attempt} did not complete. Retrying safely...`,
        error
      );


      await sleep(
        RETRY_DELAY_MS
      );

    } finally {

      clearTimeout(
        timeout
      );
    }
  }


  throw (
    lastError ||
    new Error(
      "Order submission failed."
    )
  );
}


/* ============================================================
   SLEEP
============================================================ */

function sleep(ms) {

  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        ms
      )
  );
}


/* ============================================================
   SUBMIT ORDER
============================================================ */

async function submitOrder() {

  if (submitting) {
    return;
  }


  const form =
    $("checkoutForm");


  if (!form) {
    return;
  }


  if (!items.length) {

    showToast(
      "Please select at least one item first."
    );

    return;
  }


  if (!form.checkValidity()) {

    const invalidField =
      form.querySelector(
        ":invalid"
      );


    if (invalidField) {

      invalidField.classList.add(
        "invalid"
      );

      invalidField.focus();
    }


    showToast(
      "Please enter your WhatsApp number to continue."
    );

    return;
  }


  const email =
    String(
      form.elements.email?.value ||
      ""
    ).trim();


  if (
    email &&
    form.elements.email &&
    !form.elements.email.checkValidity()
  ) {

    form.elements.email.classList.add(
      "invalid"
    );

    form.elements.email.focus();


    showToast(
      "Please enter a valid email address."
    );

    return;
  }


  /*
    Final normalisation and pricing recalculation
    before sending the order.
  */

  items =
    normaliseItems(items);


  items.forEach(
    item => {

      const qty =
        Math.max(
          1,
          Number(item.qty) || 1
        );


      const price =
        getUnitPrice(item);


      item.qty =
        qty;

      item.price =
        price;


      if (isMugPackaging(item)) {

        item.box_price =
          price;
      }


      if (isLabel(item)) {

        item.label_price =
          price;

        item.label_qty =
          qty;
      }
    }
  );


  const data =
    Object.fromEntries(
      new FormData(form).entries()
    );


  data.noGst =
    Boolean(
      $("noGst")?.checked
    );


  data.sameBilling =
    Boolean(
      $("sameBilling")?.checked
    );


  data.items =
    items;


  data.subtotal =
    items.reduce(
      (
        sum,
        item
      ) =>
        sum +
        (
          Number(item.price) || 0
        ) *
        (
          Number(item.qty) || 0
        ),
      0
    );


  data.shipping_note =
    "Shipping charges applicable";


  data.source =
    "Website";


  data.idempotencyKey =
    getIdempotencyKey();


  /*
    Save before contacting the order server.
  */

  localStorage.setItem(
    "packniti_order",
    JSON.stringify(data)
  );


  localStorage.setItem(
    CART_KEY,
    JSON.stringify(items)
  );


  setSubmittingState(
    true
  );


  try {

    const result =
      await postOrder(
        data
      );


    data.reference =
      result.reference ||
      "";


    data.serverReceived =
      true;


    data.status =
      result.status ||
      "ORDER_RECEIVED";


    localStorage.setItem(
      "packniti_order",
      JSON.stringify(data)
    );


    clearIdempotencyKey();


    window.location.href =
      "confirmation.html";


  } catch (error) {

    console.error(
      "PackNiti order submission failed:",
      error
    );


    setSubmittingState(
      false
    );


    if (
      error.name ===
      "AbortError"
    ) {

      showToast(
        "The order server is taking longer than expected. Your details are saved. Please try again.",
        6000
      );

    } else {

      showToast(
        "We couldn't confirm the order yet. Your details are saved. Please try again.",
        6000
      );
    }
  }
}


/* ============================================================
   TOAST
============================================================ */

function showToast(
  message,
  duration = 5000
) {

  const toast =
    $("toast");


  if (!toast) {
    return;
  }


  toast.textContent =
    message;


  toast.classList.remove(
    "hidden"
  );


  clearTimeout(
    showToast.timer
  );


  showToast.timer =
    setTimeout(
      () =>
        toast.classList.add(
          "hidden"
        ),
      duration
    );
}


/* ============================================================
   INITIALISE CHECKOUT
============================================================ */

function initialiseCheckout() {

  /*
    Load current cart.
  */

  items =
    normaliseItems(
      getCartItems()
    );


  /*
    Render correct prices and product types.
  */

  renderSummary();


  /*
    Restore previous form data.
  */

  restorePendingFormData();


  /* ----------------------------------------------------------
     BILLING ADDRESS
  ---------------------------------------------------------- */

  const sameBilling =
    $("sameBilling");


  if (sameBilling) {

    sameBilling.addEventListener(
      "change",
      () => {

        $("billingFields")
          ?.classList.toggle(
            "hidden",
            sameBilling.checked
          );
      }
    );
  }


  /* ----------------------------------------------------------
     GST
  ---------------------------------------------------------- */

  const noGst =
    $("noGst");


  if (noGst) {

    noGst.addEventListener(
      "change",
      () => {

        const gstin =
          $("gstin");


        if (!gstin) {
          return;
        }


        gstin.disabled =
          noGst.checked;


        if (noGst.checked) {

          gstin.value =
            "";

          gstin.classList.remove(
            "invalid"
          );
        }
      }
    );
  }


  /* ----------------------------------------------------------
     FORM
  ---------------------------------------------------------- */

  const form =
    $("checkoutForm");


  if (!form) {

    console.error(
      "PackNiti checkout form not found."
    );

    return;
  }


  form.setAttribute(
    "onsubmit",
    "return false;"
  );


  form.addEventListener(
    "submit",
    event => {

      event.preventDefault();

      event.stopPropagation();

      submitOrder();
    }
  );


  /*
    Remove invalid styling after editing.
  */

  form.addEventListener(
    "input",
    event => {

      if (
        event.target?.matches(
          ".invalid"
        )
      ) {

        event.target.classList.remove(
          "invalid"
        );
      }
    }
  );
}


/* ============================================================
   START
============================================================ */

if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    initialiseCheckout
  );

} else {

  initialiseCheckout();
}