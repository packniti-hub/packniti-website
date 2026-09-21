const fmt=n=>Number.isInteger(Number(n))?String(Number(n)):String(n).replace(/\.0+$/,'');
const dims=p=>`${fmt(p.dimensions.length)} × ${fmt(p.dimensions.breadth)} × ${fmt(p.dimensions.width)}`;
const slugOf=p=>[p.dimensions.length,p.dimensions.breadth,p.dimensions.width].map(fmt).join('x');
const localImage=p=>`assets/product-gallery/${slugOf(p)}.png`;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function init(){
  const r=await fetch('data/catalogue.json'); const data=await r.json(); const products=data.products||[];
  document.getElementById('galleryCount').textContent=`${products.length} boxes`;
  document.getElementById('galleryGrid').innerHTML=products.map(p=>{const d=dims(p),img=localImage(p),slug=slugOf(p),url=`boxes/${encodeURIComponent(slug)}.html`;return `<article class="gallery-card"><a href="${url}"><div class="gallery-card-media"><img src="${esc(img)}" alt="${esc(p.title||d)}" loading="lazy"></div><div class="gallery-card-body"><div class="meta">${esc(p.material||'Corrugated')} · ${esc(p.color||'Brown')}</div><h2>${esc(p.title||'PackNiti Box')}</h2><div class="dims">${esc(d)} in · ${esc(String(p.availability||'In stock'))}</div><div class="gallery-select"><span>View product</span><b>→</b></div></div></a></article>`}).join('');
  const count=[...JSON.parse(localStorage.getItem('packniti_checkout_items')||'[]')].reduce((s,x)=>s+(+x.qty||0),0);document.querySelectorAll('[data-cart-count]').forEach(e=>{e.textContent=count.toLocaleString('en-IN');e.classList.toggle('hidden',!count)});
}
init().catch(e=>{console.error(e);document.getElementById('galleryGrid').innerHTML='<p>Catalogue could not load. Please return to the box finder.</p>'});
