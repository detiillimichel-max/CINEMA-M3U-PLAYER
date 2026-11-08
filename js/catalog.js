export function groupSeasons(items) {
  const map = new Map();
  for (const item of items) {
    const key = item.series || item.collection || item.group || item.category || "Outros";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  for (const list of map.values()) list.sort((a,b) =>
    (a.season ?? 999) - (b.season ?? 999) ||
    String(a.episode ?? "9999").localeCompare(String(b.episode ?? "9999"), "pt-BR", {numeric:true}) ||
    a.title.localeCompare(b.title, "pt-BR"));
  return map;
}
export function renderCards(items, container, {favorites=new Set(), onPlay, onFavorite}={}) {
  container.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("p"); empty.className = "empty";
    empty.textContent = "Nenhum título encontrado. Importe uma playlist na área privada.";
    container.append(empty); return;
  }
  const frag = document.createDocumentFragment();
  for (const item of items) {
    const card = document.createElement("article");
    card.className = "media-card" + (item.url ? "" : " media-card-unavailable");
    const poster = document.createElement("div"); poster.className = "poster";
    if (item.logo) {
      const img = document.createElement("img"); img.loading = "lazy"; img.src = item.logo; img.alt = "";
      img.onerror = () => img.remove(); poster.append(img);
    } else poster.textContent = "🎬";
    const type = document.createElement("span"); type.className = "type"; type.textContent = item.category || "Outros"; poster.append(type);
    const fav = document.createElement("button"); fav.className = "fav-btn"; fav.textContent = favorites.has(item.id) ? "♥" : "♡";
    fav.setAttribute("aria-label", "Favoritar"); fav.onclick = e => { e.stopPropagation(); onFavorite?.(item); }; poster.append(fav);
    const info = document.createElement("div"); info.className = "card-info";
    const h = document.createElement("h3"); h.textContent = item.title || "Sem título";
    const p = document.createElement("p"); p.textContent = item.collection || item.group || item.source || "Biblioteca";
    info.append(h,p);
    if (!item.url) { const note = document.createElement("small"); note.textContent = "Fonte protegida ou ausente"; info.append(note); }
    card.append(poster,info);
    if (item.url) card.onclick = () => onPlay?.(item);
    frag.append(card);
  }
  container.append(frag);
}
