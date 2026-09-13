const $=id=>document.getElementById(id);
let items=[];
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function imageUrl(raw){const s=String(raw||"").trim();if(!s)return"";if(s.startsWith("assets/")||s.startsWith("./assets/")||s.startsWith("../assets/"))return s;const m=s.match(/drive\.google\.com\/.*[?&]id=([^&]+)/i)||s.match(/drive\.google\.com\/file\/d\/([^/]+)/i);return m?`https://drive.google.com/thumbnail?id=${encodeURIComponent(m[1])}&sz=w400`:s}
function price(p,qty){const tiers=p.pricing||[];if(qty<=100)return Number(tiers.find(t=>t.range==="1-100")?.price_inr||0);if(qty<=500)return Number(tiers.find(t=>t.range==="101-500")?.price_inr||0);if(qty<=2000)return Number(tiers.find(t=>t.range==="501-2000")?.price_inr||0);return Number(tiers.find(t=>t.range==="2000+")?.price_inr||0)}
function save(){localStorage.setItem("packniti_checkout_items",JSON.stringify(items))}
function render(){
  const box=$("cartItems");let total=0,count=0;
  if(!items.length){box.innerHTML=`<div class="empty-cart"><h3>Your cart is empty.</h3><p>Choose some ready-size boxes from the catalogue to get started.</p><a href="boxes.html">Find your box →</a></div>`;$("subtotal").textContent="₹0";$("summaryCount").textContent="0";$("cartCount").textContent="0";$("checkoutButton").disabled=true;return}
  $("checkoutButton").disabled=false;
  box.innerHTML=items.map((p,i)=>{const q=Math.max(1,Number(p.qty)||1);const unit=price(p,q);const line=unit*q;total+=line;count+=q;const d=p.dimensions||{};const dims=`${d.length??""} × ${d.breadth??""} × ${d.width??""} in`;const img=imageUrl(p.image_url);return `<article class="cart-item"><div class="cart-image">${img?`<img src="${img}" alt="" onerror="this.style.display='none'">`:""}</div><div><h3>${esc(p.title||"PackNiti box")}</h3><div class="cart-meta">${esc(dims)} · ${esc(p.material||"3-Ply")} · ₹${unit.toFixed(2)}/box</div><div class="cart-controls"><div class="qty-control"><button onclick="changeQty(${i},-1)">−</button><input value="${q}" inputmode="numeric" onchange="setQty(${i},this.value)"><button onclick="changeQty(${i},1)">+</button></div><button class="remove-btn" onclick="removeItem(${i})">Remove</button></div></div><div class="cart-price"><strong>₹${Math.round(line).toLocaleString("en-IN")}</strong><small>${q.toLocaleString("en-IN")} boxes</small></div></article>`}).join("");
  $("subtotal").textContent="₹"+Math.round(total).toLocaleString("en-IN");$("summaryCount").textContent=count.toLocaleString("en-IN");$("cartCount").textContent=count.toLocaleString("en-IN");
}
function changeQty(i,delta){items[i].qty=Math.max(1,(Number(items[i].qty)||1)+delta*10);save();render()}
function setQty(i,v){items[i].qty=Math.max(1,parseInt(String(v).replace(/\D/g,""))||1);save();render()}
function removeItem(i){items.splice(i,1);save();render()}
$("clearCart").addEventListener("click",()=>{if(!items.length)return;if(confirm("Clear your cart?")){items=[];save();render()}})
$("checkoutButton").addEventListener("click",()=>{if(!items.length)return;window.location.href="checkout.html"})
try{items=JSON.parse(localStorage.getItem("packniti_checkout_items")||"[]")}catch(e){items=[]}
render();
