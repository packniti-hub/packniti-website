const DATA_URL = "data/mug-packaging.json";
const ASSET = "assets/mug-packaging/v2/";
const CART_KEY = "packniti_checkout_items";

let data = {};
let selectedFile = null;

const $ = id => document.getElementById(id);

const money = n =>
  `₹${Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

const boxPrice = qty => {
  qty = Math.max(1, Number(qty) || 1);

  if (qty <= 100) return 38;
  if (qty <= 500) return 34;
  if (qty <= 2000) return 29;

  return 25;
};

const labelPrice = qty => {
  qty = Math.max(1, Number(qty) || 1);

  return qty <= 500 ? 3 : 2;
};


function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}


/* =========================================================
   CART COUNT
========================================================= */

function updateCartCount() {

  try {

    const items =
      JSON.parse(
        localStorage.getItem(CART_KEY) || "[]"
      );

    const count =
      items.reduce(
        (n, item) =>
          n + (Number(item.qty) || 0),
        0
      );

    const el =
      $("cartCount");

    if (el) {
      el.textContent =
        count.toLocaleString("en-IN");
    }

  } catch {

    const el =
      $("cartCount");

    if (el) {
      el.textContent = "0";
    }
  }
}


/* =========================================================
   GALLERY
========================================================= */

function renderGallery() {

  const thumbs =
    $("thumbs");

  if (!thumbs) {
    return;
  }

  thumbs.innerHTML = "";

  const gallery =
    Array.isArray(data.gallery)
      ? data.gallery
      : [];


  gallery.forEach(
    (g, i) => {

      const button =
        document.createElement("button");

      button.type =
        "button";

      button.className =
        "thumb" +
        (i === 0 ? " active" : "");


      button.innerHTML = `
        <img
          src="${ASSET}${g.file}"
          alt="${esc(g.alt)}"
        >
      `;


      button.onclick = () => {

        document
          .querySelectorAll(".thumb")
          .forEach(
            x =>
              x.classList.remove(
                "active"
              )
          );


        button.classList.add(
          "active"
        );


        const main =
          $("mainImage");

        if (main) {

          main.src =
            ASSET + g.file;

          main.alt =
            g.alt || "";
        }
      };


      thumbs.appendChild(
        button
      );
    }
  );
}


/* =========================================================
   LABEL EXAMPLES
========================================================= */

function renderLabels() {

  const grid =
    $("labelGallery");

  if (!grid) {
    return;
  }

  grid.innerHTML = "";

  const examples =
    Array.isArray(data.label_examples)
      ? data.label_examples
      : [];


  examples.forEach(
    (g, i) => {

      const article =
        document.createElement("article");


      article.innerHTML = `
        <img
          src="${ASSET}${g.file}"
          alt="${esc(g.alt)}"
        >

        <div>
          Label example ${i + 1}
          · Custom printed label
        </div>
      `;


      grid.appendChild(
        article
      );
    }
  );
}


/* =========================================================
   LIVE PRICE
========================================================= */

function recalc() {

  const qtyInput =
    $("qty");

  const unitPrice =
    $("unitPrice");

  const labelUnitPrice =
    $("labelUnitPrice");

  const total =
    $("total");

  const labelToggle =
    $("labelToggle");


  if (!qtyInput) {
    return;
  }


  let qty =
    parseInt(
      qtyInput.value,
      10
    );


  if (
    !Number.isFinite(qty) ||
    qty < 1
  ) {
    qty = 1;
  }


  if (qty > 100000) {
    qty = 100000;
  }


  qtyInput.value =
    qty;


  const bp =
    boxPrice(qty);

  const lp =
    labelPrice(qty);


  const hasLabel =
    Boolean(
      labelToggle?.checked
    );


  const grandTotal =
    qty *
    (
      bp +
      (
        hasLabel
          ? lp
          : 0
      )
    );


  if (unitPrice) {
    unitPrice.textContent =
      money(bp);
  }


  if (labelUnitPrice) {
    labelUnitPrice.textContent =
      `${money(lp)} / label`;
  }


  if (total) {
    total.textContent =
      money(grandTotal);
  }
}


/* =========================================================
   ERROR
========================================================= */

function setError(message) {

  const error =
    $("error");

  if (error) {
    error.textContent =
      message || "";
  }
}


/* =========================================================
   FILE STORAGE
========================================================= */

async function fileToDataURL(file) {

  return await new Promise(
    (resolve, reject) => {

      const reader =
        new FileReader();

      reader.onload =
        () =>
          resolve(
            reader.result
          );

      reader.onerror =
        reject;

      reader.readAsDataURL(
        file
      );
    }
  );
}


async function saveUpload(
  key,
  file
) {

  try {

    const db =
      await new Promise(
        (resolve, reject) => {

          const request =
            indexedDB.open(
              "packniti_uploads",
              1
            );


          request.onupgradeneeded =
            () => {

              if (
                !request.result.objectStoreNames.contains(
                  "files"
                )
              ) {

                request.result.createObjectStore(
                  "files"
                );
              }
            };


          request.onsuccess =
            () =>
              resolve(
                request.result
              );


          request.onerror =
            () =>
              reject(
                request.error
              );
        }
      );


    await new Promise(
      (resolve, reject) => {

        const transaction =
          db.transaction(
            "files",
            "readwrite"
          );


        transaction
          .objectStore("files")
          .put(
            {
              name: file.name,
              type: file.type,
              size: file.size,
              data: file
            },
            key
          );


        transaction.oncomplete =
          resolve;

        transaction.onerror =
          () =>
            reject(
              transaction.error
            );
      }
    );


    return true;

  } catch (error) {

    console.warn(
      "IndexedDB upload storage failed:",
      error
    );


    try {

      localStorage.setItem(
        "packniti_upload_" + key,
        await fileToDataURL(file)
      );

      return true;

    } catch {

      return false;
    }
  }
}


/* =========================================================
   ADD TO CART
   IMPORTANT:
   Mug and Label are now TWO separate cart entities.
========================================================= */

async function addToCart() {

  setError("");


  const qtyInput =
    $("qty");

  const labelToggle =
    $("labelToggle");

  const labelDetails =
    $("labelDetails");

  const labelNotes =
    $("labelNotes");


  const qty =
    Math.max(
      1,
      parseInt(
        qtyInput?.value,
        10
      ) || 1
    );


  const hasLabel =
    Boolean(
      labelToggle?.checked
    );


  /*
    Artwork is mandatory when labels are selected.
  */

  if (
    hasLabel &&
    !selectedFile
  ) {

    setError(
      "Please upload your label artwork to continue."
    );

    return;
  }


  const bp =
    boxPrice(qty);

  const lp =
    labelPrice(qty);


  /*
    Unique artwork key.
  */

  const itemKey =
    `PACKNITI-MUG-LABEL-${Date.now()}`;


  /*
    Read current cart.
  */

  let items = [];


  try {

    const stored =
      localStorage.getItem(
        CART_KEY
      );


    items =
      stored
        ? JSON.parse(stored)
        : [];


    if (!Array.isArray(items)) {
      items = [];
    }

  } catch {

    items = [];
  }


  /*
    Remove any existing Premium Mug Packaging
    and its associated label.

    This prevents duplicate Mug/Label pairs if
    the customer changes their selection and adds
    the Mug product again.
  */

  items =
    items.filter(
      item =>
        item?.id !==
          "PACKNITI-MUG-PACKAGING-01" &&
        item?.id !==
          "PACKNITI-MUG-LABEL-01"
    );


  /* =======================================================
     ENTITY 1 — PREMIUM MUG PACKAGING
  ======================================================= */

  const mugItem = {

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

    description:
      "1 corrugated outer box + 2 molded-pulp inserts",

    qty:
      qty,

    price:
      bp,

    box_price:
      bp,

    image:
      ASSET +
      "front-personalised-1.jpeg",

    dimensions:
      "15 × 12 × 10 cm",

    mug_capacity:
      "300–500 ml",

    inserts:
      2,

    label_area:
      "13.5 × 9.5 cm",

    shipping_extra:
      true
  };


  items.push(
    mugItem
  );


  /* =======================================================
     ENTITY 2 — CUSTOM PRINTED LABEL
     ONLY CREATED IF LABEL OPTION IS SELECTED
  ======================================================= */

  if (hasLabel) {

    const labelItem = {

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

      description:
        "Printed labels for Premium Mug Packaging",

      qty:
        qty,

      price:
        lp,

      label_price:
        lp,

      label_qty:
        qty,

      label_area:
        "13.5 × 9.5 cm",

      parent_product_id:
        "PACKNITI-MUG-PACKAGING-01",

      parent_product_title:
        "Premium Mug Packaging",

      label_details:
        labelDetails?.value.trim() || "",

      label_notes:
        labelNotes?.value.trim() || "",

      label_asset_key:
        itemKey,

      artwork_name:
        selectedFile
          ? selectedFile.name
          : null,

      shipping_extra:
        true
    };


    items.push(
      labelItem
    );
  }


  /*
    SAVE THE CLEAN CART.
  */

  localStorage.setItem(
    CART_KEY,
    JSON.stringify(items)
  );


  /*
    Save artwork after cart structure is saved.
  */

  if (
    hasLabel &&
    selectedFile
  ) {

    await saveUpload(
      itemKey,
      selectedFile
    );
  }


  updateCartCount();


  /*
    Go to cart.
  */

  window.location.href =
    "/cart.html";
}


/* =========================================================
   INITIALISE
========================================================= */

async function init() {

  /*
    Load Mug JSON.
  */

  try {

    const response =
      await fetch(
        DATA_URL
      );


    if (!response.ok) {
      throw new Error(
        "Mug data unavailable"
      );
    }


    data =
      await response.json();

  } catch (error) {

    console.error(
      "Could not load Mug Packaging data:",
      error
    );


    data = {
      gallery: [],
      label_examples: []
    };
  }


  renderGallery();

  renderLabels();

  updateCartCount();

  recalc();


  /* -------------------------------------------------------
     QUANTITY MINUS
  ------------------------------------------------------- */

  $("minus")?.addEventListener(
    "click",
    () => {

      const current =
        parseInt(
          $("qty").value,
          10
        ) || 1;


      $("qty").value =
        Math.max(
          1,
          current - 1
        );


      recalc();
    }
  );


  /* -------------------------------------------------------
     QUANTITY PLUS
  ------------------------------------------------------- */

  $("plus")?.addEventListener(
    "click",
    () => {

      const current =
        parseInt(
          $("qty").value,
          10
        ) || 1;


      $("qty").value =
        Math.min(
          100000,
          current + 1
        );


      recalc();
    }
  );


  /* -------------------------------------------------------
     MANUAL QUANTITY
  ------------------------------------------------------- */

  $("qty")?.addEventListener(
    "input",
    recalc
  );


  /* -------------------------------------------------------
     LABEL TOGGLE
  ------------------------------------------------------- */

  $("labelToggle")?.addEventListener(
    "change",
    () => {

      const panel =
        $("labelPanel");


      if (panel) {

        panel.hidden =
          !$("labelToggle").checked;
      }


      recalc();
    }
  );


  /* -------------------------------------------------------
     ARTWORK
  ------------------------------------------------------- */

  $("artwork")?.addEventListener(
    "change",
    event => {

      selectedFile =
        event.target.files?.[0] ||
        null;


      setError("");
    }
  );


  /* -------------------------------------------------------
     ADD TO CART
  ------------------------------------------------------- */

  $("addToCart")?.addEventListener(
    "click",
    addToCart
  );
}


init();