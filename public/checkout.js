const ORDER_API_URL = "https://packniti-order-api.packniti.workers.dev/";
const REQUEST_TIMEOUT_MS = 30000;
const MAX_SUBMISSION_ATTEMPTS = 2;
const RETRY_DELAY_MS = 750;

const $ = (id) => document.getElementById(id);

let items = [];
let submitting = false;


// ============================================================
// MONEY
// ============================================================

function formatMoney(value) {
  return "₹" + Math.round(Number(value) || 0).toLocaleString("en-IN");
}


// ============================================================
// IMAGE
// ============================================================

function imageUrl(raw) {
  const s = String(raw || "").trim();

  if (!s) return "";

  if (
    s.startsWith("assets/") ||
    s.startsWith("./assets/") ||
    s.startsWith("../assets/")
  ) {
    return s;
  }

  const match =
    s.match(/drive\.google\.com\/.*[?&]id=([^&]+)/i) ||
    s.match(/drive\.google\.com\/file\/d\/([^/]+)/i);

  return match
    ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(match[1])}&sz=w400`
    : s;
}


// ============================================================
// HELPERS
// ============================================================

function dimText(item) {
  const d = item.dimensions || {};

  return `${d.length ?? ""} × ${d.breadth ?? ""} × ${d.width ?? ""} in`;
}


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


function showToast(message, duration = 5000) {
  const toast = $("toast");

  if (!toast) return;

  toast.textContent = message;
  toast.classList.remove("hidden");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.add("hidden");
  }, duration);
}


function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


// ============================================================
// CART
// ============================================================

function getCartItems() {
  try {
    const raw = localStorage.getItem("packniti_checkout_items");

    const parsed = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed) ? parsed : [];

  } catch (error) {

    console.error("Could not read checkout cart:", error);

    return [];
  }
}


// ============================================================
// ORDER SUMMARY
// ============================================================

function renderSummary() {

  const summaryItems = $("summaryItems");
  const subtotalEl = $("subtotal");
  const totalEl = $("total");

  if (!summaryItems || !subtotalEl || !totalEl) return;


  if (!items.length) {

    summaryItems.innerHTML =
      '<div class="summary-foot">No boxes selected. <a href="boxes.html"><u>Return to the catalogue</u></a> and choose the sizes you need.</div>';

    subtotalEl.textContent = "₹0";
    totalEl.textContent = "₹0";

    return;
  }


  let subtotal = 0;


  summaryItems.innerHTML = items.map((item) => {

    const qty = Number(item.qty) || 0;
    const price = Number(item.price) || 0;

    const lineTotal = price * qty;

    subtotal += lineTotal;


    const img = imageUrl(item.image_url);

    const image = img
      ? `<img src="${escapeHtml(img)}" alt="" onerror="this.style.display='none'">`
      : "";


    return `
      <div class="summary-item">

        <div class="summary-image">
          ${image}
        </div>

        <div>

          <h3>
            ${escapeHtml(item.title || "PackNiti box")}
          </h3>

          <p>
            ${escapeHtml(dimText(item))}
            · ${qty.toLocaleString("en-IN")} boxes
            · ₹${price.toFixed(2)}/box
          </p>

        </div>

        <strong>
          ${formatMoney(lineTotal)}
        </strong>

      </div>
    `;

  }).join("");


  subtotalEl.textContent = formatMoney(subtotal);

  totalEl.textContent = formatMoney(subtotal);
}


// ============================================================
// IDEMPOTENCY
// ============================================================

function getIdempotencyKey() {

  const storageKey = "packniti_checkout_idempotency_key";

  let key = sessionStorage.getItem(storageKey);


  if (!key) {

    if (window.crypto && crypto.randomUUID) {

      key = crypto.randomUUID();

    } else {

      key =
        Date.now().toString(36) +
        "-" +
        Math.random().toString(36).slice(2) +
        "-" +
        Math.random().toString(36).slice(2);

    }

    sessionStorage.setItem(storageKey, key);
  }


  return key;
}


function clearIdempotencyKey() {
  try {
    sessionStorage.removeItem("packniti_checkout_idempotency_key");
  } catch (error) {
    console.warn("Could not clear checkout idempotency key:", error);
  }
}


// ============================================================
// RESTORE FORM DATA
// ============================================================

function restorePendingFormData() {

  try {

    const saved = JSON.parse(
      localStorage.getItem("packniti_order") || "null"
    );

    if (!saved) return;


    const form = $("checkoutForm");

    if (!form) return;


    Object.entries(saved).forEach(([name, value]) => {

      if (
        name === "items" ||
        name === "subtotal" ||
        name === "reference"
      ) {
        return;
      }


      const field = form.elements[name];

      if (!field || typeof value === "object") return;


      if (field.type === "checkbox") {

        field.checked = Boolean(value);

      } else if (field.type === "radio") {

        field.checked = field.value === String(value);

      } else {

        field.value = String(value ?? "");

      }

    });


    if ($("sameBilling") && $("billingFields")) {

      $("billingFields").classList.toggle(
        "hidden",
        $("sameBilling").checked
      );

    }


    if ($("noGst") && $("gstin")) {

      $("gstin").disabled = $("noGst").checked;

    }


  } catch (error) {

    console.warn(
      "Could not restore pending checkout data:",
      error
    );

  }
}


// ============================================================
// SUBMIT BUTTON
// ============================================================

function setSubmittingState(isSubmitting) {

  const form = $("checkoutForm");

  const button =
    form?.querySelector('button[type="submit"]');


  submitting = isSubmitting;


  if (!button) return;


  button.disabled = isSubmitting;

  button.setAttribute(
    "aria-disabled",
    String(isSubmitting)
  );


  if (isSubmitting) {

    button.dataset.originalText = button.innerHTML;

    button.innerHTML = "Submitting…";

  } else if (button.dataset.originalText) {

    button.innerHTML = button.dataset.originalText;

    delete button.dataset.originalText;
  }
}


// ============================================================
// SEND ORDER TO WORKER
// ============================================================

async function postOrder(payload) {

  let lastError = null;


  for (
    let attempt = 1;
    attempt <= MAX_SUBMISSION_ATTEMPTS;
    attempt++
  ) {

    const controller = new AbortController();


    const timeout = setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS
    );


    try {

      const response = await fetch(
        ORDER_API_URL,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "text/plain;charset=utf-8"
          },

          body: JSON.stringify(payload),

          signal: controller.signal,

          cache: "no-store"
        }
      );


      const responseText =
        await response.text();


      let result;


      try {

        result = JSON.parse(responseText);

      } catch (error) {

        const parseError = new Error(
          `Order server returned an invalid response (HTTP ${response.status}).`
        );

        parseError.httpStatus = response.status;

        throw parseError;
      }


      /*
       * A 5xx response is considered potentially transient.
       *
       * IMPORTANT:
       * We retry with the SAME idempotency key.
       * Therefore, even if the first request was actually saved,
       * the retry cannot create a duplicate order.
       */
      if (!response.ok) {

        const serverError = new Error(
          result.error ||
          `Order server returned HTTP ${response.status}.`
        );

        serverError.httpStatus = response.status;

        const retryable =
          response.status === 502 ||
          response.status === 503 ||
          response.status === 504;


        if (
          retryable &&
          attempt < MAX_SUBMISSION_ATTEMPTS
        ) {

          lastError = serverError;

          await sleep(RETRY_DELAY_MS);

          continue;
        }


        throw serverError;
      }


      if (!result.ok) {

        const rejectedError = new Error(
          result.error ||
          "Order receiver rejected the order."
        );

        rejectedError.httpStatus = response.status;

        /*
         * Do NOT retry a valid HTTP response where the
         * application itself rejected the order.
         */
        throw rejectedError;
      }


      return result;


    } catch (error) {

      lastError = error;


      const isAbort =
        error?.name === "AbortError";


      const isNetworkError =
        error?.name === "TypeError";


      const isRetryableHttp =
        error?.httpStatus === 502 ||
        error?.httpStatus === 503 ||
        error?.httpStatus === 504;


      const shouldRetry =
        attempt < MAX_SUBMISSION_ATTEMPTS &&
        (
          isAbort ||
          isNetworkError ||
          isRetryableHttp
        );


      if (!shouldRetry) {

        throw error;
      }


      /*
       * The first request may still have reached the server
       * even though the browser stopped waiting.
       *
       * We deliberately reuse the same idempotency key.
       */
      console.warn(
        `PackNiti order attempt ${attempt} did not complete. Retrying safely...`,
        error
      );


      await sleep(RETRY_DELAY_MS);


    } finally {

      clearTimeout(timeout);

    }
  }


  throw lastError || new Error(
    "Order submission failed."
  );
}


// ============================================================
// SUBMIT ORDER
// ============================================================

async function submitOrder() {

  // Prevent accidental double-clicks.
  if (submitting) return;


  const form = $("checkoutForm");

  if (!form) return;


  // Must have at least one item.
  if (!items.length) {

    showToast(
      "Please select at least one box first."
    );

    return;
  }


  // Only WhatsApp/mobile is mandatory.
  if (!form.checkValidity()) {

    const invalidField =
      form.querySelector(":invalid");


    if (invalidField) {

      invalidField.classList.add("invalid");

      invalidField.focus();

    }


    showToast(
      "Please enter your WhatsApp number to continue."
    );

    return;
  }


  // Email remains optional, but if supplied,
  // it must be a valid email.
  const email =
    String(form.elements.email?.value || "").trim();


  if (
    email &&
    form.elements.email &&
    !form.elements.email.checkValidity()
  ) {

    form.elements.email.classList.add("invalid");

    form.elements.email.focus();

    showToast(
      "Please enter a valid email address."
    );

    return;
  }


  // Collect form data.
  const data =
    Object.fromEntries(
      new FormData(form).entries()
    );


  // Add checkout information.
  data.noGst =
    Boolean($("noGst")?.checked);


  data.sameBilling =
    Boolean($("sameBilling")?.checked);


  data.items = items;


  data.subtotal =
    items.reduce(
      (sum, item) =>
        sum +
        (Number(item.price) || 0) *
        (Number(item.qty) || 0),
      0
    );


  data.shipping_note =
    "Shipping charges applicable";


  data.source = "Website";


  /*
   * IMPORTANT:
   *
   * This key stays the same for the entire current
   * submission/retry cycle.
   *
   * If the browser times out after the server already
   * saved the order, the retry uses this same key and
   * Apps Script returns the existing order instead of
   * creating a second order.
   */
  data.idempotencyKey =
    getIdempotencyKey();


  // Save customer details BEFORE contacting server.
  localStorage.setItem(
    "packniti_order",
    JSON.stringify(data)
  );


  // Disable button immediately.
  setSubmittingState(true);


  try {

    const result =
      await postOrder(data);


    /*
     * IMPORTANT:
     * Always use the server-generated reference.
     */
    data.reference =
      result.reference || "";


    data.serverReceived = true;


    data.status =
      result.status || "ORDER_RECEIVED";


    // Save final order information.
    localStorage.setItem(
      "packniti_order",
      JSON.stringify(data)
    );


    /*
     * The order has now been confirmed.
     *
     * Clear the current checkout's idempotency key so
     * the next NEW order receives a fresh key.
     */
    clearIdempotencyKey();


    // Only redirect after confirmed success.
    window.location.href =
      "confirmation.html";


  } catch (error) {

    console.error(
      "PackNiti order submission failed:",
      error
    );


    // Keep the customer's form intact.
    setSubmittingState(false);


    if (error.name === "AbortError") {

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


// ============================================================
// INITIALISE CHECKOUT
// ============================================================

function initialiseCheckout() {

  // Load cart.
  items = getCartItems();


  // Render summary.
  renderSummary();


  // Restore any saved form data.
  restorePendingFormData();


  // Same billing checkbox.
  const sameBilling =
    $("sameBilling");


  if (sameBilling) {

    sameBilling.addEventListener(
      "change",
      () => {

        $("billingFields")?.classList.toggle(
          "hidden",
          sameBilling.checked
        );

      }
    );

  }


  // GST checkbox.
  const noGst =
    $("noGst");


  if (noGst) {

    noGst.addEventListener(
      "change",
      () => {

        const gstin =
          $("gstin");


        if (!gstin) return;


        gstin.disabled =
          noGst.checked;


        if (noGst.checked) {

          gstin.value = "";

          gstin.classList.remove(
            "invalid"
          );

        }

      }
    );

  }


  // Checkout form.
  const form =
    $("checkoutForm");


  if (!form) {

    console.error(
      "PackNiti checkout form not found."
    );

    return;
  }


  // SAFETY NET:
  // Never allow the browser to submit the form
  // using its normal GET behaviour.
  form.setAttribute(
    "onsubmit",
    "return false;"
  );


  // Our real submission handler.
  form.addEventListener(
    "submit",
    (event) => {

      event.preventDefault();

      event.stopPropagation();

      submitOrder();

    }
  );


  // Remove invalid styling once user edits field.
  form.addEventListener(
    "input",
    (event) => {

      if (
        event.target?.matches(".invalid")
      ) {

        event.target.classList.remove(
          "invalid"
        );

      }

    }
  );

}


// ============================================================
// START
// ============================================================

if (
  document.readyState === "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    initialiseCheckout
  );

} else {

  initialiseCheckout();

}