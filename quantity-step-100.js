(function(){
  document.addEventListener('click',function(e){
    const btn=e.target.closest('.qty-control button');
    if(!btn || !btn.closest('.product-row')) return;
    // boxes.js has an inline onclick handler that normally changes by 10.
    // Stop it and apply a 100-box step ourselves using the row's input.
    e.preventDefault(); e.stopImmediatePropagation();
    const row=btn.closest('.product-row');
    const input=row.querySelector('.qty-control input');
    if(!input)return;
    const current=Math.max(1,parseInt(String(input.value).replace(/\D/g,''),10)||1);
    const delta=btn.textContent.includes('+')?100:-100;
    const next=Math.max(1,Math.min(100000,current+delta));
    input.value=next;
    input.dispatchEvent(new Event('change',{bubbles:true}));
  },true);
})();
