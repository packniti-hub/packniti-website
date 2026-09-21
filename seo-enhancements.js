(function(){
  // PackNiti Box Finder SEO + quantity-control enhancement.
  // Loaded after boxes.js. Uses capture phase so it overrides the inline
  // changeQty() handlers without modifying the finder algorithm itself.

  const slugFromDims=s=>String(s||'').replace(/[^0-9.×x]/g,'').replace(/×/g,'x').replace(/\.{2,}/g,'.');
  const cleanSlug=s=>s.split('x').map(v=>{const n=Number(v);return Number.isInteger(n)?String(n):String(n).replace(/\.0+$/,'')}).join('x');

  const enhanceLinks=()=>{
    document.querySelectorAll('#resultsList .product-row').forEach(row=>{
      if(row.querySelector('.product-seo-link')) return;
      const dims=row.querySelector('.product-dims')?.textContent||'';
      const m=dims.match(/([0-9.]+)\s*[×x]\s*([0-9.]+)\s*[×x]\s*([0-9.]+)/);
      if(!m) return;
      const slug=cleanSlug(`${m[1]}x${m[2]}x${m[3]}`);
      const target=row.querySelector('.product-title');
      if(!target) return;
      const parent=target.parentElement;
      const a=document.createElement('a');
      a.className='product-seo-link';
      a.href=`boxes/${encodeURIComponent(slug)}.html`;
      a.textContent='View product details →';
      parent.appendChild(a);
    });
  };

  // Every + click in the Box Finder adds exactly 100 boxes.
  // Every − click removes exactly 100, never going below 1.
  const handleQuantityClick=e=>{
    const btn=e.target.closest('#resultsList .product-row .qty-control button');
    if(!btn) return;

    // Capture phase prevents the inline onclick in boxes.js from also adding 10.
    e.preventDefault();
    e.stopImmediatePropagation();

    const row=btn.closest('.product-row');
    const input=row?.querySelector('.qty-control input');
    if(!input) return;

    const current=Math.max(1,parseInt(String(input.value).replace(/\D/g,''),10)||1);
    const delta=btn.textContent.includes('+') ? 100 : -100;
    const next=Math.max(1,Math.min(100000,current+delta));
    input.value=String(next);

    // Let boxes.js keep its normal pricing/cart state in sync.
    input.dispatchEvent(new Event('change',{bubbles:true}));
  };

  const style=document.createElement('style');
  style.textContent='.product-seo-link{display:inline-block;margin-top:7px;font-size:11px;font-weight:700;text-decoration:underline;text-underline-offset:3px}.product-seo-link:hover{opacity:.7}';
  document.head.appendChild(style);

  document.addEventListener('click',handleQuantityClick,true);

  const boot=()=>{
    const list=document.getElementById('resultsList');
    if(!list) return;
    new MutationObserver(enhanceLinks).observe(list,{childList:true});
    enhanceLinks();
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
