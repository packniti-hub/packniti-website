const ORDER_API_URL=""; // Add the deployed order receiver URL here when ready.
const $=id=>document.getElementById(id);
let items=[];
const fmtMoney=n=>"₹"+Math.round(Number(n)||0).toLocaleString("en-IN");
function imageUrl(raw){
  const s=String(raw||"").trim(); if(!s)return "";
  if(s.startsWith("assets/") || s.startsWith("./assets/") || s.startsWith("../assets/")) return s;
  const m=s.match(/drive\.google\.com\/.*[?&]id=([^&]+)/i)||s.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  return m?`https://drive.google.com/thumbnail?id=${encodeURIComponent(m[1])}&sz=w400`:s;
}
function renderSummary(){
  const box=$("summaryItems");
  if(!items.length){
    box.innerHTML=`<div class="summary-foot">No boxes selected. <a href="boxes.html"><u>Return to the catalogue</u></a> and choose the sizes you need.</div>`;
    $("subtotal").textContent="₹0";$("total").textContent="₹0";return;
  }
  let total=0;
  box.innerHTML=items.map(p=>{
    const line=(Number(p.price)||0)*Number(p.qty||0);total+=line;
    const img=imageUrl(p.image_url);
    const image=img?`<img src="${img}" alt="" onerror="this.style.display='none'">`:"";
    return `<div class="summary-item"><div class="summary-image">${image}</div><div><h3>${esc(p.title||"PackNiti box")}</h3><p>${esc(dimText(p))} · ${p.qty} boxes · ₹${Number(p.price||0).toFixed(2)}/box</p></div><strong>${fmtMoney(line)}</strong></div>`;
  }).join("");
  $("subtotal").textContent=fmtMoney(total);$("total").textContent=fmtMoney(total);
}
function dimText(p){const d=p.dimensions||{};return `${d.length??""} × ${d.breadth??""} × ${d.width??""} in`}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function showToast(msg){$("toast").textContent=msg;$("toast").classList.remove("hidden");setTimeout(()=>$("toast").classList.add("hidden"),2800)}
function load(){
  try{items=JSON.parse(localStorage.getItem("packniti_checkout_items")||"[]")}catch(e){items=[]}
  renderSummary();
}
$("sameBilling").addEventListener("change",()=>{
  $("billingFields").classList.toggle("hidden",$("sameBilling").checked);
});
$("noGst").addEventListener("change",()=>{
  $("gstin").disabled=$("noGst").checked;
  if($("noGst").checked){$("gstin").value="";$("gstin").classList.remove("invalid")}
});
$("checkoutForm").addEventListener("submit",async e=>{
  e.preventDefault();
  if(!items.length){showToast("Please select at least one box first.");return}
  const form=e.currentTarget;
  if(!form.checkValidity()){
    form.querySelector(":invalid")?.classList.add("invalid");
    showToast("Please enter your WhatsApp number to continue.");
    return;
  }

  const data=Object.fromEntries(new FormData(form).entries());
  data.noGst=$("noGst").checked;
  data.sameBilling=$("sameBilling").checked;
  data.items=items;
  data.subtotal=items.reduce((sum,p)=>sum+(Number(p.price)||0)*(Number(p.qty)||0),0);
  data.shipping_note="Shipping charges applicable";
  const stamp=new Date();
  const date=stamp.getFullYear().toString().slice(-2)+String(stamp.getMonth()+1).padStart(2,"0")+String(stamp.getDate()).padStart(2,"0");
  const random=Math.random().toString(36).slice(2,7).toUpperCase();
  data.reference=`PN-${date}-${random}`;
  data.createdAt=stamp.toISOString();
  data.status="ORDER_RECEIVED";

  localStorage.setItem("packniti_order",JSON.stringify(data));

  if(ORDER_API_URL){
    try{
      const response=await fetch(ORDER_API_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(data)});
      const result=await response.json();
      if(!result.ok) throw new Error(result.error||"Order receiver rejected the order");
      data.serverReceived=true;
      localStorage.setItem("packniti_order",JSON.stringify(data));
    }catch(error){
      console.error("Order notification failed:",error);
      showToast("Order reference saved. Please WhatsApp PackNiti if you need immediate assistance.");
      setTimeout(()=>window.location.href="confirmation.html",900);
      return;
    }
  }

  window.location.href="confirmation.html";
});
document.addEventListener("input",e=>{if(e.target.matches(".invalid"))e.target.classList.remove("invalid")});
load();
