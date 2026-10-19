// Mengisi sidebar dari content.json (diatur lewat admin). Jika belum ada, placeholder tetap tampil.
fetch("/api/public?type=content",{cache:"no-store"}).then(r=>r.json()).then(c=>{
 const esc=t=>String(t).replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
 const img=(p,a)=>`<img src="${esc(p)}" alt="${a}" style="width:100%;border-radius:8px;display:block">`;
 const $=id=>document.getElementById(id);
 if(c.artikel&&c.artikel.length&&$("news"))$("news").innerHTML=c.artikel.slice(0,5).map(a=>`<li><a href="${esc(a.link||a.file||"#")}">${esc(a.title)}</a></li>`).join("");
 if(c.shakemap&&$("shake"))$("shake").innerHTML=img(c.shakemap,"ShakeMap");
 if(c.ikm&&$("ikm"))$("ikm").innerHTML=img(c.ikm,"IKM");
 document.dispatchEvent(new CustomEvent("content-loaded",{detail:c}));
}).catch(()=>{});
