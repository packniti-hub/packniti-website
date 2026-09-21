(function(){
  function slugFor(item){
    const d=item?.dimensions||{};
    if(d.length==null||d.breadth==null||d.width==null)return "";
    const n=v=>{const x=Number(v);return Number.isInteger(x)?String(x):String(x).replace(/\.0+$/,'')};
    return `${n(d.length)}x${n(d.breadth)}x${n(d.width)}`;
  }
  function readItems(){
    try{return JSON.parse(localStorage.getItem('packniti_checkout_items')||'[]')}catch(e){return []}
  }
  function fix(){
    const items=readItems();
    if(!items.length)return;
    const containers=[...document.querySelectorAll('.summary-item, .order-item, [class*="summary-item"], [class*="order-item"]')];
    containers.forEach((el,i)=>{
      const item=items[i]; if(!item)return;
      const slug=slugFor(item); if(!slug)return;
      let img=el.querySelector('img');
      if(!img){
        const holder=el.querySelector('.summary-image, .order-image, [class*="image"]');
        if(holder){img=document.createElement('img');holder.prepend(img)}
      }
      if(img){img.src=`assets/product-gallery/${slug}.png`;img.alt=item.title||'PackNiti box';img.style.display='block';img.onerror=function(){if(this.dataset.fallback!=='cataloguepng'){this.dataset.fallback='cataloguepng';this.src=`assets/catalogue/box_${slug}.png`}else if(this.dataset.fallback!=='cataloguejpg'){this.dataset.fallback='cataloguejpg';this.src=`assets/catalogue/box_${slug}.jpg`}else{this.style.display='none'}}}
    });
    // Fallback: if checkout uses a flat list of images rather than item containers.
    const imgs=[...document.querySelectorAll('.summary-column img, #summaryItems img, .summary-card img')];
    imgs.forEach((img,i)=>{const item=items[i];const slug=slugFor(item);if(slug){img.src=`assets/product-gallery/${slug}.png`;img.alt=item.title||'PackNiti box';img.style.display='block'}});
  }
  function start(){fix();setTimeout(fix,50);setTimeout(fix,250);setTimeout(fix,800);const obs=new MutationObserver(()=>fix());obs.observe(document.body,{childList:true,subtree:true});setTimeout(()=>obs.disconnect(),5000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
