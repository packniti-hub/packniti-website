const tabs = document.querySelectorAll(".finder-tab");
const panels = {
  size: document.getElementById("sizePanel"),
  product: document.getElementById("productPanel"),
  browse: document.getElementById("browsePanel")
};

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    Object.values(panels).forEach(p => p.classList.add("hidden"));
    panels[tab.dataset.tab].classList.remove("hidden");
  });
});

document.querySelectorAll("[data-size]").forEach(btn => {
  btn.addEventListener("click", () => {
    const [l,b,w] = btn.dataset.size.split(",");
    document.getElementById("length").value = l;
    document.getElementById("breadth").value = b;
    document.getElementById("width").value = w;
    document.getElementById("finder").scrollIntoView({behavior:"smooth", block:"center"});
  });
});

document.getElementById("findBtn").addEventListener("click", () => {
  const l = document.getElementById("length").value || "—";
  const b = document.getElementById("breadth").value || "—";
  const w = document.getElementById("width").value || "—";
  document.querySelector(".results-top h2").textContent = `${l} × ${b} × ${w} — good fits`;
  document.getElementById("results").scrollIntoView({behavior:"smooth"});
});

const modal = document.getElementById("aiModal");
function openModal(){ modal.classList.remove("hidden"); document.body.style.overflow="hidden"; setTimeout(()=>document.getElementById("aiInput").focus(),100); }
function closeModal(){ modal.classList.add("hidden"); document.body.style.overflow=""; }
document.getElementById("openAi").addEventListener("click",openModal);
document.getElementById("openAi2").addEventListener("click",openModal);
document.getElementById("productAi").addEventListener("click",openModal);
document.getElementById("closeAi").addEventListener("click",closeModal);
document.getElementById("closeAi2").addEventListener("click",closeModal);
document.addEventListener("keydown", e => { if(e.key==="Escape") closeModal(); });

document.getElementById("sendAi").addEventListener("click", () => {
  const input = document.getElementById("aiInput");
  if(!input.value.trim()) { input.focus(); return; }
  input.value = "";
  closeModal();
  document.querySelector(".ai-section").scrollIntoView({behavior:"smooth"});
});
