#!/usr/bin/env python3
"""Build a safe, deterministic JSON catalog from the repository's Cinema.txt."""
import collections, datetime, json, re, urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "Cinema.txt"
OUTPUT = ROOT / "data" / "catalog" / "catalogo-cinema.json"
AUTH_KEYS = {"token", "auth", "key", "signature", "sig"}

def parse_attrs(text):
    result = {}
    for match in re.finditer(r'([\\w-]+)\\s*=\\s*("([^"]*)"|([^\\s,]+))', text):
        result[match.group(1).lower()] = match.group(3) if match.group(3) is not None else match.group(4)
    return result

def split_extinf(payload):
    quoted = False
    for index, char in enumerate(payload):
        if char == '"':
            quoted = not quoted
        elif char == "," and not quoted:
            return payload[:index], payload[index + 1:].strip()
    return payload, ""

def normalized(value):
    return re.sub(r"\\s+", " ", (value or "").strip()).casefold()

def category_for(group):
    key = (group or "").strip().casefold()
    if key in {"seriado", "série", "series", "séries"}: return "Séries"
    if key in {"filme", "filmes", "movie", "movies"}: return "Filmes"
    if key in {"documentário", "documentários", "documentario", "documentary"}: return "Documentários"
    if key in {"canal", "canais", "tv"}: return "Canais"
    return group or "Outros"

def main():
    if not SOURCE.exists():
        raise SystemExit("Arquivo Cinema.txt não encontrado na raiz do repositório.")
    lines = SOURCE.read_text(encoding="utf-8-sig", errors="replace").splitlines()
    records, orphan_urls = [], []
    duplicate_map = collections.defaultdict(list)
    metadata = {}
    current = None

    def finish():
        nonlocal current
        if current is None: return
        attrs = current["attributes"]
        group = attrs.get("group-title") or attrs.get("group") or "Outros"
        subgroup = attrs.get("pltv-subgroup") or ""
        title = current["title"] or attrs.get("tvg-name") or "Sem título"
        raw_url = current["url"]
        public_url, redacted = raw_url, False
        expires = None
        if raw_url:
            parsed = urllib.parse.urlsplit(raw_url)
            query = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
            expires = next((value for key, value in query if key.casefold() == "expires"), None)
            if any(key.casefold() in AUTH_KEYS for key, _ in query):
                public_url, redacted = None, True
        path = urllib.parse.urlsplit(raw_url or "").path
        extension = Path(path).suffix.lower().lstrip(".") or None
        season_match = re.search(r"\\bT\\s*0*(\\d+)\\s*(?:\\||[-_ ]*)", title, re.I)
        episode_match = re.search(r"\\bEP\\s*0*(\\d+(?:\\s*[-–]\\s*\\d+)?)", title, re.I)
        safe_attrs = {k:v for k,v in attrs.items() if not any(word in k.casefold() for word in ("token","secret","password","auth"))}
        index = len(records) + 1
        category = category_for(group)
        record = {
            "id": f"cinema-{index:05d}", "title": title, "normalized_title": normalized(title),
            "type": {"Séries":"series_episode","Filmes":"movie","Documentários":"documentary","Canais":"channel"}.get(category,"other"),
            "category": category, "group": group, "collection": subgroup or None,
            "series": subgroup if category == "Séries" and subgroup else None,
            "season": int(season_match.group(1)) if season_match else None,
            "episode": episode_match.group(1).replace(" ","") if episode_match else None,
            "duration": current["duration"], "logo": attrs.get("tvg-logo") or None,
            "url": public_url, "url_redacted": redacted, "format": extension,
            "source": "Cinema.txt", "source_line": current["line"], "attributes": safe_attrs,
            "url_status": "redacted_auth" if redacted else ("missing" if not raw_url else ("http_insecure" if raw_url.startswith("http://") else "https_unverified")),
            "has_auth_parameters": redacted, "expires_unix": expires
        }
        records.append(record)
        if public_url:
            duplicate_map[public_url].append(record["id"])
        current = None

    for line_number, raw in enumerate(lines, 1):
        line = raw.strip()
        if not line: continue
        if line.startswith("#PLAYLISTV:"):
            metadata = parse_attrs(line[len("#PLAYLISTV:"):])
        elif line.startswith("#EXTINF:"):
            finish()
            meta, title = split_extinf(line[len("#EXTINF:"):])
            duration_match = re.match(r"\\s*(-?\\d+(?:\\.\\d+)?)", meta)
            duration = float(duration_match.group(1)) if duration_match else None
            attr_text = meta[duration_match.end():] if duration_match else meta
            current = {"title": title, "duration": duration, "attributes": parse_attrs(attr_text), "url": None, "line": line_number}
        elif line.startswith("#"):
            continue
        elif line.startswith(("http://", "https://")):
            if current is not None and current["url"] is None:
                current["url"] = line
            else:
                orphan_urls.append({"source_line": line_number, "url": line, "reason": "URL sem EXTINF correspondente"})

    finish()
    duplicate_groups = [{"url": url, "occurrences": len(ids), "record_ids": ids}
                        for url, ids in duplicate_map.items() if len(ids) > 1]
    categories = collections.Counter(r["category"] for r in records)
    formats = collections.Counter(r["format"] or "unknown" for r in records)
    series = {r["series"] for r in records if r["series"]}
    stats = {
        "extinf_records": len(records), "records_with_url": sum(1 for r in records if r["url"] or r["url_redacted"]),
        "unique_public_urls": len(duplicate_map), "duplicate_url_groups": len(duplicate_groups),
        "duplicate_url_extra_occurrences": sum(x["occurrences"] - 1 for x in duplicate_groups),
        "redacted_auth_urls": sum(1 for r in records if r["url_redacted"]),
        "orphan_urls": len(orphan_urls), "distinct_series_groups": len(series),
        "categories": dict(categories), "formats": dict(formats)
    }
    result = {
        "schema_version": "1.1.0", "catalog_id": "cinema-m3u-master",
        "source_file": SOURCE.name, "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "description": "Catálogo gerado da playlist M3U. Links com parâmetros de autenticação foram omitidos do arquivo público.",
        "playlist_metadata": metadata, "statistics": stats, "records": records,
        "duplicate_urls": duplicate_groups, "orphan_urls": orphan_urls
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps(stats, ensure_ascii=False, indent=2))
    print(f"Catálogo gravado em {OUTPUT.relative_to(ROOT)}")

if __name__ == "__main__":
    main()
