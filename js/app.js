import {PLAYLIST_SOURCES,CATALOG_URL,CACHE_TTL_MS,PAGE_SIZE} from "./config.js";
import {parseM3U} from "./m3u-parser.js";
import {renderCards} from "./catalog.js";
import {filterItems} from "./search.js";
import {playMedia,stopPlayer} from "./player.js";
import {getAll,put,getPref,setPref} from "./cache.js";
import {loadFavorites,toggleFavorite,loadHistory,addHistory} from "./favorites.js";
const $=id=>document.getElementById(id);
let items=[],favorites=new Set(),history=[],view="all",visible=PAGE_SIZE,filtered=[];
const status=m=>$("statusText").textContent=m;
function fromMaster(record) {
  return {...record, id:record.id, title:record.title, url:record.url || null,
    logo:record.logo || "", group:record.group || record.category || "Outros",
    category:record.category || "Outros", source:record.source || "Catálogo mestre",
    urlStatus:record.url_status || (record.url ? "https_unverified" : "missing"),
    addedAt:record.addedAt || 0};
}
async function readMaster(force=false) {
  const cached=await getPref("catalog:master");
  if(!force && cached && Date.now()-cached.at<CACHE_TTL_MS) return cached.items;
  const response=await fetch(CATALOG_URL,{cache:"no-store"});
  if(!response.ok) throw new Error("Catálogo HTTP "+response.status);
  const data=await response.json();
  if(!Array.isArray(data.records)) throw new Error("Formato de catálogo inválido");
  const parsed=data.records.map(fromMaster);
  await setPref("catalog:master",{at:Date.now(),items:parsed,stats:data.statistics||{}});
  return parsed;
}
async function readFallbackSources(force=false) {
  const combined=[];
  for(const src of PLAYLIST_SOURCES) {
    try {
      const cached=await getPref("source:"+src.url);
      if(!force && cached && Date.now()-cached.at<CACHE_TTL_MS) { combined.push(...cached.items); continue; }
      const response=await fetch(src.url,{cache:"no-store"});
      if(!response.ok) throw new Error("HTTP "+response.status);
      const parsed=parseM3U(await response.text(),src.name);
      combined.push(...parsed);
      await setPref("source:"+src.url,{at:Date.now(),items:parsed});
    } catch(error) { console.warn("Fonte fallback não carregada:",src.name,error.message); }
  }
  return combined;
}
function mergeWithoutDuplicates(all) {
  const byUrl=new Map(), withoutUrl=[];
  for(const item of all) {
    if(item.url) { if(!byUrl.has(item.url)) byUrl.set(item.url,item); }
    else withoutUrl.push(item);
  }
  return [...byUrl.values(),...withoutUrl];
}
async function loadSources(force=false) {
  status("Carregando catálogo...");
  let combined=[];
  try {
    combined=await readMaster(force);
    status("Catálogo mestre carregado.");
  } catch(error) {
    console.warn("Catálogo mestre indisponível; usando fallback.",error);
    combined=await readFallbackSources(force);
  }
  const local=await getAll("playlists");
  for(const playlist of local) combined.push(...(playlist.items||[]));
  items=mergeWithoutDuplicates(combined);
  status(items.length.toLocaleString("pt-BR")+" registros na biblioteca.");
  populateCategories(); applyFilters();
}
function populateCategories() {
  const select=$("categoryFilter"), current=select.value;
  const cats=[...new Set(items.map(x=>x.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  select.replaceChildren(new Option("Todas as categorias","Todos"),...cats.map(x=>new Option(x,x)));
  if(cats.includes(current)) select.value=current;
  const collectionSelect=$("collectionFilter"), selectedCollection=collectionSelect.value;
  const collections=[...new Set(items.map(x=>x.series||x.collection).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  collectionSelect.replaceChildren(new Option("Todas as coleções","Todos"),...collections.map(x=>new Option(x,x)));
  if(collections.includes(selectedCollection)) collectionSelect.value=selectedCollection;
}
function applyFilters() {
  filtered=filterItems(items,{query:$("searchInput").value,category:$("categoryFilter").value,collection:$("collectionFilter").value,view,favorites,history});
  if($("sortFilter").value==="name") filtered.sort((a,b)=>a.title.localeCompare(b.title,"pt-BR"));
  if($("sortFilter").value==="recent") filtered.sort((a,b)=>(b.addedAt||0)-(a.addedAt||0));
  visible=PAGE_SIZE;
  $("catalogTitle").textContent=({all:"Catálogo",movies:"Filmes",series:"Séries",favorites:"Favoritos",history:"Histórico"})[view];
  $("countText").textContent=filtered.length.toLocaleString("pt-BR")+" títulos";
  draw();
}
function draw() {
  renderCards(filtered.slice(0,visible),$("catalog"),{favorites,onPlay:openPlayer,onFavorite:async item=>{favorites=await toggleFavorite(item.id);applyFilters();}});
  $("loadMore").textContent=visible<filtered.length?`Carregar mais (${Math.min(PAGE_SIZE,filtered.length-visible).toLocaleString("pt-BR")})`:"";
  $("loadMore").hidden=visible>=filtered.length;
}
async function openPlayer(item) {
  if(!item.url) { $("playerMessage").textContent="Este registro não possui uma URL pública no catálogo. Importe uma playlist autorizada e atualizada pela área privada para reproduzi-lo neste aparelho."; $("playerSection").hidden=false; return; }
  $("playerSection").hidden=false; $("nowTitle").textContent=item.title; $("playerMessage").textContent="";
  $("playerSection").scrollIntoView({behavior:"smooth",block:"start"});
  await playMedia($("videoPlayer"),item,m=>$("playerMessage").textContent=m);
  history=await addHistory(item);
}
$("searchInput").addEventListener("input",applyFilters);
$("categoryFilter").addEventListener("change",applyFilters);
$("collectionFilter").addEventListener("change",applyFilters);
$("sortFilter").addEventListener("change",applyFilters);
$("loadMore").onclick=()=>{visible+=PAGE_SIZE;draw();};
document.querySelectorAll(".tab").forEach(button=>button.onclick=()=>{
  document.querySelector(".tab.active")?.classList.remove("active"); button.classList.add("active");
  view=button.dataset.view; applyFilters();
});
$("reloadBtn").onclick=()=>loadSources(true);
$("closePlayer").onclick=()=>{$("playerSection").hidden=true;stopPlayer($("videoPlayer"));};
async function admin() {
  const dialog=$("adminDialog"),root=$("adminContent");
  root.innerHTML='<div class="admin-box"><h2>Área privada</h2><p>Digite seu PIN para gerenciar playlists neste aparelho.</p><label>PIN de 4 dígitos</label><input id="pinInput" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" type="password" placeholder="••••"><button id="pinGo" class="primary-btn">Entrar</button><p class="notice">O PIN é uma barreira local de privacidade casual, não autenticação forte.</p></div>';
  dialog.showModal();
  const saved=await getPref("adminPinHash");
  $("pinGo").onclick=async()=>{
    const pin=$("pinInput").value;
    if(!/^\d{4}$/.test(pin)){alert("Digite exatamente 4 números.");return;}
    const hash=await digest(pin);
    if(!saved){await setPref("adminPinHash",hash);showAdmin();}
    else if(hash===saved) showAdmin(); else alert("PIN incorreto.");
  };
  function showAdmin() {
    root.innerHTML='<div class="admin-box"><h2>Gerenciar playlists</h2><p>Importação local: os arquivos não são enviados ao servidor.</p><label>Selecionar arquivos M3U</label><input id="m3uFiles" type="file" accept=".m3u,.m3u8,.txt,audio/x-mpegurl,application/vnd.apple.mpegurl" multiple><div class="admin-actions"><button id="importBtn">Importar arquivos</button><button id="refreshBtn" class="secondary-btn">Atualizar catálogo</button></div><p id="importStatus" class="notice">As playlists importadas ficam no IndexedDB deste navegador.</p><div id="playlistList"></div><button id="changePin" class="secondary-btn">Alterar PIN</button></div>';
    refreshList(); $("importBtn").onclick=importFiles;
    $("refreshBtn").onclick=async()=>{await loadSources(true);dialog.close();};
    $("changePin").onclick=changePin;
  }
  async function refreshList() {
    const playlists=await getAll("playlists"); $("playlistList").replaceChildren();
    const heading=document.createElement("h3"); heading.textContent="Playlists importadas ("+playlists.length+")"; $("playlistList").append(heading);
    for(const playlist of playlists) {
      const row=document.createElement("p"); row.textContent=playlist.name+" — "+playlist.items.length+" registros ";
      const removeButton=document.createElement("button"); removeButton.textContent="Remover";
      removeButton.onclick=async()=>{const cache=await import("./cache.js");await cache.remove("playlists",playlist.id);await loadSources();await refreshList();};
      row.append(removeButton); $("playlistList").append(row);
    }
  }
  async function importFiles() {
    const files=[...$("m3uFiles").files];
    if(!files.length){alert("Selecione ao menos um arquivo.");return;}
    let total=0;
    for(const file of files) {
      const parsed=parseM3U(await file.text(),file.name);
      await put("playlists",{id:crypto.randomUUID(),name:file.name,items:parsed,createdAt:Date.now()});
      total+=parsed.length;
    }
    $("importStatus").textContent=files.length+" arquivo(s) importado(s), "+total+" registros processados.";
    await loadSources(); await refreshList();
  }
  async function changePin() {
    const next=prompt("Digite o novo PIN de 4 dígitos:");
    if(next===null)return;
    if(!/^\d{4}$/.test(next)){alert("PIN inválido.");return;}
    await setPref("adminPinHash",await digest(next)); alert("PIN atualizado neste aparelho.");
  }
}
async function digest(value) {
  const buffer=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return [...new Uint8Array(buffer)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
$("adminOpen").onclick=admin;
(async()=>{
  if("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(console.warn);
  favorites=await loadFavorites(); history=await loadHistory(); await loadSources();
})();
