// Leitor M3U robusto. Mantém compatibilidade: parseM3U(texto, origem) retorna array.
function parseAttributes(input) {
  const attrs = {};
  const re = /([\w-]+)\s*=\s*("([^"]*)"|([^\s,]+))/g;
  let m;
  while ((m = re.exec(input)) !== null) attrs[m[1].toLowerCase()] = m[3] !== undefined ? m[3] : m[4];
  return attrs;
}
function splitExtinf(payload) {
  let quoted = false;
  for (let i = 0; i < payload.length; i++) {
    if (payload[i] === '"') quoted = !quoted;
    else if (payload[i] === "," && !quoted) return [payload.slice(0, i), payload.slice(i + 1).trim()];
  }
  return [payload, ""];
}
function normalizeTitle(value) {
  return String(value || "").normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");
}
function classifyGroup(group) {
  const g = String(group || "").trim().toLocaleLowerCase("pt-BR");
  if (["seriado", "série", "series", "séries"].includes(g)) return "Séries";
  if (["filme", "filmes", "movie", "movies"].includes(g)) return "Filmes";
  if (["documentário", "documentários", "documentario", "documentary"].includes(g)) return "Documentários";
  if (["canal", "canais", "tv"].includes(g)) return "Canais";
  return group || "Outros";
}
function episodeInfo(title) {
  const season = String(title || "").match(/\bT\s*0*(\d+)\s*(?:\||[-_ ]*)/i);
  const episode = String(title || "").match(/\bEP\s*0*(\d+(?:\s*[-–]\s*\d+)?)/i);
  return { season: season ? Number(season[1]) : null, episode: episode ? episode[1].replace(/\s+/g, "") : null };
}
export function parseM3UFull(input, source = "Playlist") {
  const lines = String(input || "").replace(/^\uFEFF/, "").split(/\r?\n/);
  const records = [], errors = [], orphanUrls = [], urlMap = new Map();
  let current = null, playlistMetadata = {};
  const finish = () => {
    if (!current) return;
    const attrs = current.attributes;
    const originalGroup = attrs["group-title"] || attrs["group"] || "";
    const subgroup = attrs["pltv-subgroup"] || "";
    const se = episodeInfo(current.title);
    let format = null;
    if (current.url) {
      try { const p = new URL(current.url).pathname; format = p.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() || null; } catch (_) {}
    }
    const query = current.url ? current.url.split("?")[1] || "" : "";
    const params = new URLSearchParams(query);
    const record = {
      id: current.url || "m3u-" + String(records.length + 1).padStart(5, "0"),
      title: current.title || attrs["tvg-name"] || "Sem título",
      normalized_title: normalizeTitle(current.title || attrs["tvg-name"]),
      url: current.url,
      logo: attrs["tvg-logo"] || null,
      group: originalGroup || "Outros",
      category: classifyGroup(originalGroup),
      collection: subgroup || null,
      series: classifyGroup(originalGroup) === "Séries" ? (subgroup || null) : null,
      season: se.season,
      episode: se.episode,
      duration: current.duration,
      format,
      source,
      source_line: current.source_line,
      attributes: attrs,
      has_auth_parameters: ["token", "auth", "key", "signature", "sig"].some(k => params.has(k)),
      expires_unix: params.get("expires"),
      url_status: !current.url ? "missing" : current.url.startsWith("http://") ? "http_insecure" : "https_unverified"
    };
    if (!record.url) errors.push({ line: current.source_line, reason: "EXTINF sem URL" });
    else {
      if (!urlMap.has(record.url)) urlMap.set(record.url, []);
      urlMap.get(record.url).push(record.id);
    }
    records.push(record);
    current = null;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith("#PLAYLISTV:")) { playlistMetadata = parseAttributes(line.slice(11)); continue; }
    if (line.startsWith("#EXTINF:")) {
      finish();
      const [meta, title] = splitExtinf(line.slice(8));
      const dm = meta.match(/^\s*(-?\d+(?:\.\d+)?)/);
      current = { title, duration: dm ? Number(dm[1]) : null, attributes: parseAttributes(dm ? meta.slice(dm[0].length) : meta), url: null, source_line: i + 1 };
      continue;
    }
    if (line.startsWith("#")) continue;
    if (/^https?:\/\//i.test(line)) {
      if (current && !current.url) current.url = line;
      else orphanUrls.push({ source_line: i + 1, url: line, reason: current ? "URL extra após registro preenchido" : "URL sem EXTINF" });
    }
  }
  finish();
  const duplicates = [...urlMap.entries()].filter(([, ids]) => ids.length > 1).map(([url, ids]) => ({ url, occurrences: ids.length, record_ids: ids }));
  const categories = {}, formats = {}, series = new Set();
  for (const r of records) {
    categories[r.category] = (categories[r.category] || 0) + 1;
    const f = r.format || "unknown"; formats[f] = (formats[f] || 0) + 1;
    if (r.series) series.add(r.series);
  }
  return { metadata: playlistMetadata, records, duplicates, orphan_urls: orphanUrls, errors,
    report: { extinf_records: records.length, records_with_url: records.filter(r => r.url).length, unique_urls: urlMap.size, duplicate_url_groups: duplicates.length, orphan_urls: orphanUrls.length, distinct_series: series.size, categories, formats } };
}
export function parseM3U(input, source = "Playlist") { return parseM3UFull(input, source).records; }
