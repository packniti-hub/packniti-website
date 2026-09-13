const grid=document.getElementById('featuredGrid');
const money=n=>`₹${Number(n).toFixed(2)}`;
const localImage=p=>{
  const d=p?.dimensions||{};
  const key=[d.length,d.breadth,d.width].map(v=>String(v??'').trim()).join('x');
  const known={
    '5x3x2':'assets/catalogue/box_5x3x2.jpg',
    '4x3x3':'assets/catalogue/box_4x3x3.jpg',
    '6.5x2.5x3':'assets/catalogue/box_6.5x2.5x3.png',
    '5x4x3.5':'assets/catalogue/box_5x4x3.5.jpg',
    '6x4x3':'assets/catalogue/box_6x4x3.jpg',
    '8x4x1.5':'assets/catalogue/box_8x4x1.5.jpg'
  };
  return known[key]||String(p?.image_url||'');
};
const price=p=>p.pricing?.find(t=>t.range==='501-2000')?.price_inr||p.pricing?.[0]?.price_inr;
function escapeHtml(s){return String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
fetch('data/catalogue.json').then(r=>r.json()).then(data=>{
  const products=data.products||[];
  const wanted=['5x3x2','4x3x3','6.5x2.5x3','5x4x3.5','6x4x3','8x4x1.5'];
  const keyOf=p=>[p?.dimensions?.length,p?.dimensions?.breadth,p?.dimensions?.width].map(v=>String(v??'').trim()).join('x');
  const list=wanted.map(k=>products.find(p=>keyOf(p)===k)).filter(Boolean);
  grid.innerHTML=list.map(p=>`<a class="feature" href="boxes.html#finder">
    <div class="feature-img"><img src="${escapeHtml(localImage(p))}" alt="${escapeHtml(p.title||'PackNiti corrugated box')}" loading="lazy"></div>
    <div class="feature-meta"><span>${escapeHtml(p.material||'Corrugated')} · ${escapeHtml(p.color||'Brown')}</span><span>3-Ply</span></div>
    <h3>${escapeHtml(p.dimensions?.display||p.title||'Ready-size box')}</h3>
    <div class="feature-foot"><div class="feature-price"><strong>${price(p)?money(price(p)):'Enquiry'}</strong><span> / box</span></div><span class="feature-link">View →</span></div>
  </a>`).join('');
}).catch(()=>{grid.innerHTML='<a class="feature" href="boxes.html#finder"><div class="feature-img"></div><h3>Browse the ready-size catalogue</h3><div class="feature-foot"><span>Find your box by size</span><span class="feature-link">Open →</span></div></a>';});
function updateCartCount(){let count=0;try{const items=JSON.parse(localStorage.getItem('packniti_checkout_items')||'[]');count=items.reduce((s,i)=>s+(Number(i.qty)||0),0);}catch(e){}document.querySelectorAll('[data-cart-count]').forEach(el=>{el.textContent=count.toLocaleString('en-IN');el.classList.toggle('hidden',count===0);});}
updateCartCount();window.addEventListener('storage',updateCartCount);
