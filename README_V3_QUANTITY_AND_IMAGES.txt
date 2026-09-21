PACKNITI V3 — checkout thumbnails + 100-box quantity steps

1) Replace product.html and product.js from this package. Product +/- now changes by 100.
2) Replace cart.js from this package. Cart +/- now changes by 100, and cart thumbnails use bundled PackNiti catalogue images.
3) Copy checkout-image-fix.js to the repository root.
4) Add this line AFTER <script src="checkout.js"></script> in checkout.html:
   <script src="checkout-image-fix.js"></script>
5) Add this line AFTER <script src="boxes.js"></script> in boxes.html:
   <script src="quantity-step-100.js"></script>
6) Box Finder +/- clicks are intercepted and changed to 100-box steps. Manual typing remains allowed.
7) Do not change pricing tiers, cart storage, checkout API, or order submission.
8) Test locally before pushing to GitHub.
