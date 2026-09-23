let products = [];
let currentMatches = null;
let selected = new Map();
let openPriceId = null;

const $ = id => document.getElementById(id);
const fmt = n => Number.isInteger(n) ? String(n) : String(n).replace(/\.0$/,"");
const dims = p => `${fmt(p.dimensions.length)} × ${fmt(p.dimensions.breadth)} × ${fmt(p.dimensions.width)}`;
const getPly = p => String(p.title||"").toLowerCase().includes("5 ply") ? 5 : 3;
const isInStock = p => {
  const status = String(p.availability||"in stock").toLowerCase();
  return status.includes("stock") && !status.includes("not");
};
const imageUrl = p => {
  // Use the bundled PackNiti catalogue image as the source of truth.
  // The previous homepage merge accidentally reverted this to Google Drive thumbnails.
  const d = p.dimensions || {};
  const n = v => {
    const x = Number(v);
    return Number.isInteger(x) ? String(x) : String(x).replace(/\.0+$/, "");
  };
  const key = `assets/catalogue/box_${n(d.length)}x${n(d.breadth)}x${n(d.width)}`;
  // 6.5 × 2.5 × 3 is the only PNG in the bundled catalogue; all other images are JPG.
  return `${key}.${Number(d.length)===6.5 && Number(d.breadth)===2.5 && Number(d.width)===3 ? "png" : "jpg"}`;
};

async function loadCatalogue(){
  try{
    const response = await fetch("data/catalogue.json");
    if(!response.ok) throw new Error("Catalogue could not be loaded");
    products=(await response.json()).products||[];
    render();
  }catch(error){
    console.error(error);
    $("resultsList").innerHTML=`<div class="empty"><div class="empty-icon">!</div><h3>Catalogue couldn't load.</h3><p>Run the site through a local web server rather than opening the HTML file directly.</p></div>`;
  }
}

function tierPrice(p,qty){
  const tiers=p.pricing||[];
  if(!tiers.length)return null;
  if(qty<=100)return tiers.find(t=>t.range==="1-100")?.price_inr??tiers[0]?.price_inr;
  if(qty<=500)return tiers.find(t=>t.range==="101-500")?.price_inr??tiers[tiers.length-1]?.price_inr;
  if(qty<=2000)return tiers.find(t=>t.range==="501-2000")?.price_inr??tiers[tiers.length-1]?.price_inr;
  return tiers.find(t=>t.range==="2000+")?.price_inr??tiers[tiers.length-1]?.price_inr;
}
function getRanges(){return{lmin:+$("lengthMin").value,lmax:+$("lengthMax").value,bmin:+$("breadthMin").value,bmax:+$("breadthMax").value,wmin:+$("widthMin").value,wmax:+$("widthMax").value}}
function passesFilters(p){
  const r=getRanges(),d=p.dimensions;
  const brown=$("brownOnly").checked,three=$("threePly").checked,five=$("fivePly").checked;
  const ply=getPly(p);
  const materialAndPly=(!brown||String(p.color).toLowerCase()==="brown")&&((ply===3&&three)||(ply===5&&five));
  // When the customer explicitly searches a size, the search takes priority
  // over the sidebar dimension sliders. Otherwise the sliders filter normally.
  const dimensionMatch=currentMatches?.target
    ? true
    : (d.length>=r.lmin&&d.length<=r.lmax&&d.breadth>=r.bmin&&d.breadth<=r.bmax&&d.width>=r.wmin&&d.width<=r.wmax);
  return dimensionMatch && materialAndPly;
}
function dimensionPermutations(target){
  return [
    [target.l,target.b,target.w],
    [target.l,target.w,target.b],
    [target.b,target.l,target.w],
    [target.b,target.w,target.l],
    [target.w,target.l,target.b],
    [target.w,target.b,target.l]
  ];
}
function exactOrientation(p,target){
  const d=p.dimensions;
  if(d.length===target.l&&d.breadth===target.b&&d.width===target.w)return "exact";
  const sameRotation=dimensionPermutations(target).some(([l,b,w]) =>
    l===d.length&&b===d.breadth&&w===d.width
  );
  return sameRotation ? "rotated" : null;
}
function distance(p,target){
  const d=p.dimensions;
  return Math.min(...dimensionPermutations(target).map(([l,b,w]) =>
    Math.abs(d.length-l)+Math.abs(d.breadth-b)+Math.abs(d.width-w)
  ));
}
function searchDistance(p,target){
  const d=p.dimensions;
  return Math.min(...dimensionPermutations(target).map(([l,b,w]) => {
    const dl=Math.abs(d.length-l)/Math.max(l,1);
    const db=Math.abs(d.breadth-b)/Math.max(b,1);
    const dw=Math.abs(d.width-w)/Math.max(w,1);
    return dl+db+dw;
  }));
}

function sortedProducts(){
  let list = products.filter(passesFilters);

  // Dimension search first narrows the catalogue.
  // Exact/rotated matches are retained; otherwise we keep the six closest.
  if(currentMatches?.target){
    const eligible = list.slice();
    if(currentMatches.exact){
      list = eligible.filter(p => exactOrientation(p,currentMatches.target));
    }else{
      list = eligible
        .sort((a,b)=>searchDistance(a,currentMatches.target)-searchDistance(b,currentMatches.target))
        .slice(0,6);
    }
  }

  // Sorting remains interactive even after a dimension search.
  // "Best match" means dimensional closeness when a search is active,
  // otherwise it preserves catalogue order.
  const sort=$("sort").value;
  if(sort==="match" && currentMatches?.target){
    list.sort((a,b)=>{
      const da=searchDistance(a,currentMatches.target);
      const db=searchDistance(b,currentMatches.target);
      const ea=exactOrientation(a,currentMatches.target)==="exact";
      const eb=exactOrientation(b,currentMatches.target)==="exact";
      return (ea!==eb) ? (ea ? -1 : 1) : da-db;
    });
  }else if(sort==="size"){
    list.sort((a,b)=>volume(a)-volume(b));
  }else if(sort==="sizeDesc"){
    list.sort((a,b)=>volume(b)-volume(a));
  }else if(sort==="price"){
    list.sort((a,b)=>
      (tierPrice(a,selected.get(a.id)?.qty||+$("quantity").value)||999999)-
      (tierPrice(b,selected.get(b.id)?.qty||+$("quantity").value)||999999)
    );
  }
  return list;
}

function volume(p){return p.dimensions.length*p.dimensions.breadth*p.dimensions.width}

function render(){
  const list=sortedProducts();
  const visibleCount=list.length;
  const sortLabel={match:"Best match",size:"Smallest first",sizeDesc:"Largest first",price:"Lowest price"}[$("sort").value]||"Best match";
  $("resultMessage").textContent=currentMatches?.target
    ? (currentMatches.exact
        ? (list.some(p=>exactOrientation(p,currentMatches.target)==="exact")
            ? `Exact match found for ${dimsTarget(currentMatches.target)} — ${sortLabel.toLowerCase()} within the matches.`
            : `Same dimensions found in a different orientation — ${sortLabel.toLowerCase()} within the matches.`)
        : `No exact size — ${sortLabel.toLowerCase()} within the 6 closest available boxes to ${dimsTarget(currentMatches.target)}.`)
    : `All available ready-size boxes — ${sortLabel.toLowerCase()}.`;
  $("emptyState").classList.toggle("hidden",list.length>0);
  $("resultsList").classList.toggle("hidden",list.length===0);
  $("resultsList").innerHTML=list.map(productRow).join("");
  if(!list.length && $("fivePly").checked && !$("threePly").checked){
    $("emptyState").querySelector("h3").textContent="5-Ply boxes — not in stock.";
    $("emptyState").querySelector("p").textContent="We plan to add 5-Ply boxes to the PackNiti catalogue soon. For now, choose 3-Ply or ask us about a custom requirement.";
    $("showClosest").classList.add("hidden");
  }else{
    $("emptyState").querySelector("h3").textContent="No exact boxes in this range.";
    $("emptyState").querySelector("p").textContent="Try widening your dimensions, or let PackNiti show you the closest available sizes.";
    $("showClosest").classList.remove("hidden");
  }
  updateRangeLabels();
  updateTray();
}
function dimsTarget(t){return `${fmt(t.l)} × ${fmt(t.b)} × ${fmt(t.w)}`}

function productRow(p){
  const isActive=selected.get(p.id)?.userChangedQty===true;
  const qty=selected.get(p.id)?.qty||+$("quantity").value;
  const price=tierPrice(p,qty);
  const offer=isActive ? nextOffer(p,qty) : null;
  const matchType=currentMatches?.target ? exactOrientation(p,currentMatches.target) : null;
  const exact=matchType==="exact";
  const isRotated=matchType==="rotated";
  const isSelected=selected.has(p.id);
  const inStock=isInStock(p);
  const image=imageUrl(p);
  const imageMarkup=image
    ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(p.title||"PackNiti box")}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><div class="fallback-box" style="display:none"></div>`
    : `<div class="fallback-box"></div>`;
  const tiers=(p.pricing||[]).map(t=>`<div class="tier ${tierPrice(p,qty)===t.price_inr?"current":""}"><span>${tierLabel(t.range)}</span><b>₹${Number(t.price_inr).toFixed(2)}</b></div>`).join("");

  return `<article class="product-row ${isSelected?"selected":""} ${inStock?"":"unavailable"}" data-id="${escapeHtml(p.id)}">
    <div class="product-image">${imageMarkup}</div>

    <div>
      <div class="product-meta">${escapeHtml(p.material||"Corrugated")} · ${escapeHtml(p.color||"Brown")}</div>
      <div class="product-title"><a class="product-title-link" href="/boxes/${encodeURIComponent(String(p.id).replace(/^PACKNITI-3PLY-/i,""))}">${escapeHtml(p.title||"PackNiti Box")}</a></div>
      ${currentMatches?.target?`<div class="match-badge"><span></span>${exact?"Exact match":isRotated?"Same dimensions — rotated":"Close match"}</div>`:""}
      <div class="stock-badge ${inStock?"":"out"}">${inStock?"In stock":"Not in stock"}</div>
    </div>

    <div>
      <div class="product-dims">${dims(p)} <small>in</small></div>
      <div class="product-ply">${getPly(p)}-Ply</div>
    </div>

    <div class="price-stack">
      <div class="price-main"><strong>${inStock && price!=null?"₹"+Number(price).toFixed(2):"—"}</strong>${inStock?'<span>/ box</span>':''}</div>
      ${inStock?`
        <button class="price-tiers-btn" onclick="togglePrice(event,'${escapeJs(p.id)}')">See price by quantity ↗</button>
        <div class="price-popover ${openPriceId===p.id?"":"hidden"}" data-price="${escapeHtml(p.id)}">
          <div class="pop-title">Estimated price / box</div>${tiers||'<div class="tier"><span>Contact us</span><b>Enquiry</b></div>'}
        </div>
      `:`<div class="unavailable-label">Not in stock</div>`}
    </div>

    <div>
      ${inStock?`
        <div class="qty-label">Quantity</div>
        <div class="qty-control">
          <button onclick="changeQty(event,'${escapeJs(p.id)}',-1)">−</button>
          <input aria-label="Quantity for ${escapeHtml(dims(p))}" value="${qty}" inputmode="numeric" onchange="setQty(event,'${escapeJs(p.id)}',this.value)">
          <button onclick="changeQty(event,'${escapeJs(p.id)}',1)">+</button>
        </div>
        ${offer?`<div class="best-offer" aria-live="polite"><span>↗</span><span><b>Best offer</b> · Buy ${offer.threshold.toLocaleString("en-IN")} → ₹${offer.price.toFixed(2)}/box</span></div>`:""}
        <div class="row-actions"><button class="select-btn" onclick="addToCart('${escapeJs(p.id)}')">${isSelected?"Add to cart ✓":"Add to cart"}</button>${isSelected?`<button class="remove-selection" aria-label="Remove selection" title="Remove selection" onclick="removeSelection(event,'${escapeJs(p.id)}')">×</button>`:""}</div>
      `:`<div class="unavailable-label">Coming soon</div>`}
    </div>
  </article>`;
}

function tierLabel(range){return range==="1-100"?"≤100":range==="101-500"?"101–500":range==="501-2000"?"501–2,000":"2,000+"}
function nextOffer(p,qty){
  const tiers=(p.pricing||[]).slice().sort((a,b)=>tierStart(a.range)-tierStart(b.range));
  const current=tierPrice(p,qty);
  const next=tiers.find(t=>tierStart(t.range)>qty && Number(t.price_inr)<Number(current));
  if(!next)return null;
  const threshold=tierStart(next.range);
  return {threshold, add:Math.max(0,threshold-qty), price:Number(next.price_inr)};
}
function tierStart(range){
  if(range==="1-100")return 1;
  if(range==="101-500")return 101;
  if(range==="501-2000")return 501;
  // The catalogue's final tier is 2001+, not 2000+.
  // Keep the display label/data flexible, but use 2001 as the actual
  // quantity at which the final price becomes active.
  return 2001;
}
function shortDesc(s){return s.split(/\n/)[0].replace(/\s+/g," ").slice(0,115)}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function escapeJs(s){return String(s).replace(/\\/g,"\\\\").replace(/'/g,"\\'")}

function addToCart(id){
  const p=products.find(x=>x.id===id);if(!p || !isInStock(p))return;
  if(!selected.has(id)){
    selected.set(id,{product:p,qty:+$("quantity").value,userChangedQty:false});
    saveCart();
    render();
  }
}
function removeSelection(e,id){
  e.stopPropagation();
  selected.delete(id);
  saveCart();
  render();
}
function changeQty(e,id,delta){
  e.stopPropagation();
  const p=products.find(x=>x.id===id);if(!p || !isInStock(p))return;
  let q=selected.get(id)?.qty??+$("quantity").value;
  const thresholds=[101,501,2001];
  if(delta>0){
    const nextThreshold=thresholds.find(t=>t>q);
    q=(nextThreshold && q+10>=nextThreshold) ? nextThreshold : q+10;
  }else{
    const previousThreshold=[2001,501,101,1].find(t=>t<q);
    q=(previousThreshold && q-10<=previousThreshold) ? previousThreshold : q-10;
  }
  q=Math.max(1,Math.min(100000,q));
  selected.set(id,{product:p,qty:q,userChangedQty:true});
  saveCart();
  render();
}
function setQty(e,id,value){
  e.stopPropagation();
  const p=products.find(x=>x.id===id);if(!p || !isInStock(p))return;
  const q=Math.max(1,parseInt(String(value).replace(/\D/g,""))||1);
  selected.set(id,{product:p,qty:q,userChangedQty:true});
  saveCart();
  render();
}
function togglePrice(e,id){e.stopPropagation();openPriceId=openPriceId===id?null:id;render()}
function cartPayload(){
  return [...selected.values()].map(({product,qty})=>({
    ...product,
    qty:Number(qty)||1,
    price:Number(tierPrice(product,qty)||0)
  }));
}
function saveCart(){
  try{localStorage.setItem("packniti_checkout_items",JSON.stringify(cartPayload()));}catch(e){}
  updateCartCount();
}
function updateCartCount(){
  const count=[...selected.values()].reduce((sum,item)=>sum+(Number(item.qty)||0),0);
  document.querySelectorAll("[data-cart-count]").forEach(el=>{
    el.textContent=count.toLocaleString("en-IN");
    el.classList.toggle("hidden",count===0);
  });
}
function loadCart(){
  try{
    const saved=JSON.parse(localStorage.getItem("packniti_checkout_items")||"[]");
    saved.forEach(item=>{
      const product=products.find(p=>p.id===item.id);
      if(product && isInStock(product)){
        const qty=Math.max(1,Number(item.qty)||1);
        selected.set(product.id,{product,qty,userChangedQty:false});
      }
    });
  }catch(e){}
  updateCartCount();
}
function goToCart(){
  saveCart();
  window.location.href="cart.html";
}

function updateTray(){
  const entries=[...selected.values()];
  $("selectedCount").textContent=entries.length;
  $("selectionTray").classList.toggle("hidden",entries.length===0);
  $("trayItems").innerHTML=entries.slice(0,4).map(({product,qty})=>`<div class="tray-chip">${dims(product)} · ${qty}<button onclick="removeSelected(event,'${escapeJs(product.id)}')">×</button></div>`).join("")+(entries.length>4?`<div class="tray-chip">+${entries.length-4} more</div>`:"");
  let total=0;
  for(const {product,qty} of entries){const price=tierPrice(product,qty);if(price!=null)total+=price*qty}
  $("estimatedTotal").textContent=entries.length&&total?"₹"+Math.round(total).toLocaleString("en-IN"):"On enquiry";
  const summary=entries.length?entries.map(({product,qty})=>`${dims(product)} · ${qty} boxes`).join("<br>"):"Select one or more boxes above to start your enquiry.";
  $("selectedSummary").innerHTML=summary;
  updateCartCount();
}
function removeSelected(e,id){e.stopPropagation();selected.delete(id);saveCart();render()}
function clearSelection(){selected.clear();saveCart();render()}

function findByDimensions(){
  const l=parseFloat($('searchLength').value);
  const b=parseFloat($('searchBreadth').value);
  const w=parseFloat($('searchWidth').value);
  const feedback=$('searchFeedback');

  if([l,b,w].some(Number.isNaN)){
    if(feedback) feedback.textContent='Enter all three dimensions to search.';
    return;
  }

  const target={l,b,w};
  const eligible=products.filter(p=>{
    const status=String(p.availability||'in stock').toLowerCase();
    const inStock=status.includes('stock') && !status.includes('not');
    const ply=getPly(p);
    const brown=String(p.color||'').toLowerCase()==='brown';
    const plyOK=(ply===3 && $('threePly').checked) || (ply===5 && $('fivePly').checked);
    return inStock && brown && plyOK;
  });

  // First priority: exact dimensions in the entered orientation.
  // Second priority: the same physical box in another orientation.
  // Final priority: the six closest available boxes, using the best
  // rotational fit so L × B × H searches behave naturally.
  const exactOrientationMatches=eligible.filter(p=>{
    const d=p.dimensions;
    return d.length===l && d.breadth===b && d.width===w;
  });
  const rotatedMatches=eligible.filter(p=>{
    const match=exactOrientation(p,target);
    return match==='rotated';
  });

  let exactMode=exactOrientationMatches.length>0;
  let sameDimensionMode=!exactMode && rotatedMatches.length>0;

  currentMatches={
    target,
    exact: exactMode || sameDimensionMode,
    enteredExact: exactMode
  };
  openPriceId=null;

  render();

  const visible=sortedProducts().length;
  if(feedback){
    if(exactMode){
      feedback.textContent=`✓ Exact match found — catalogue updated to ${visible} matching box${visible===1?'':'es'}.`;
    }else if(sameDimensionMode){
      feedback.textContent=`↻ Same dimensions found in another orientation — catalogue updated to ${visible} matching box${visible===1?'':'es'}.`;
    }else{
      feedback.textContent=`No exact match — catalogue updated to the ${visible} closest available size${visible===1?'':'s'}.`;
    }
  }

  $('results').scrollIntoView({behavior:'smooth',block:'start'});
}

function clearSearch(){
  ["searchLength","searchBreadth","searchWidth"].forEach(id=>{
    $(id).value="";
    $(id).dataset.edited="false";
  });
  currentMatches=null;
  const feedback=$("searchFeedback");
  if(feedback) feedback.textContent="";
  render();
}
function updateRangeLabels(){
  const r=getRanges();
  $("lengthValue").textContent=(r.lmin===0&&r.lmax===60)?"All":`${fmt(r.lmin)}–${fmt(r.lmax)}"`;
  $("breadthValue").textContent=(r.bmin===0&&r.bmax===40)?"All":`${fmt(r.bmin)}–${fmt(r.bmax)}"`;
  $("widthValue").textContent=(r.wmin===0&&r.wmax===40)?"All":`${fmt(r.wmin)}–${fmt(r.wmax)}"`;
}
function resetFilters(){
  $("lengthMin").value=0;$("lengthMax").value=60;$("breadthMin").value=0;$("breadthMax").value=40;$("widthMin").value=0;$("widthMax").value=40;
  $("brownOnly").checked=true;$("threePly").checked=true;$("fivePly").checked=false;currentMatches=null;render();
}
document.querySelectorAll("[data-size]").forEach(btn=>btn.addEventListener("click",()=>{
  const[l,b,w]=btn.dataset.size.split(",");
  $("searchLength").value=l;
  $("searchBreadth").value=b;
  $("searchWidth").value=w;
  ["searchLength","searchBreadth","searchWidth"].forEach(id=>$(id).dataset.edited="false");
  findByDimensions();
}));
$("searchButton").addEventListener("click",findByDimensions);$("clearSearch").addEventListener("click",clearSearch);$("resetFilters").addEventListener("click",resetFilters);
["lengthMin","lengthMax","breadthMin","breadthMax","widthMin","widthMax","brownOnly","threePly","fivePly"].forEach(id=>$(id).addEventListener("input",()=>{currentMatches=null;render()}));
$("quantity").addEventListener("change",()=>render());$("sort").addEventListener("change",()=>{openPriceId=null;render();});
$("showClosest").addEventListener("click",()=>currentMatches?render():$("searchLength").focus());

$("clearSelection").addEventListener("click",clearSelection);
$("trayQuote").addEventListener("click",()=>{if(!selected.size){alert("Select at least one box first.");return;}goToCart();});


document.addEventListener("keydown",e=>{if(e.key==="Escape"){openPriceId=null}});
document.addEventListener("click",e=>{if(!e.target.closest(".price-stack")){if(openPriceId!==null){openPriceId=null;render()}}});
loadCatalogue().then(()=>{loadCart();render();}).catch(()=>{});




let dimensionSearchTimer=null;
["searchLength","searchBreadth","searchWidth"].forEach(id=>{
  const input=$(id);
  input.value="";
  input.dataset.edited="false";
});
function liveDimensionSearch(){
  clearTimeout(dimensionSearchTimer);
  const vals=["searchLength","searchBreadth","searchWidth"].map(id=>parseFloat($(id).value));
  if(vals.some(Number.isNaN)) return;
  dimensionSearchTimer=setTimeout(()=>findByDimensions(),180);
}
["searchLength","searchBreadth","searchWidth"].forEach(id=>{
  const input=$(id);

  // If the field contains an old value (including a value retained by the
  // browser after navigating back), the first click clears it so the user
  // can simply start typing the new dimension.
  input.dataset.edited="false";
  input.addEventListener("focus",()=>{
    if(input.value && input.dataset.edited!=="true"){
      input.value="";
      // Do not trigger a partial search after clearing one dimension.
      clearTimeout(dimensionSearchTimer);
      const feedback=$("searchFeedback");
      if(feedback) feedback.textContent="";
    }
  });
  input.addEventListener("input",()=>{
    input.dataset.edited="true";
    liveDimensionSearch();
  });
  input.addEventListener("keydown",e=>{
    if(e.key==="Enter"){
      e.preventDefault();
      clearTimeout(dimensionSearchTimer);
      findByDimensions();
    }
  });
});
