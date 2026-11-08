#!/usr/bin/env python3
"""Compare incoming M3U libraries against the master catalog; never auto-approve."""
import hashlib, json, re, unicodedata, urllib.parse
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
MASTER=ROOT/"data/catalog/catalogo-cinema-mestre-sanitizado.json"
INBOX=ROOT/"data/discovery/inbox"
REVIEW=ROOT/"data/discovery/review-candidates.json"
APPROVALS=ROOT/"data/discovery/approved.json"
AUTH_KEYS={"token","auth","key","signature","sig","password","secret","credential","api_key","apikey"}
def norm(s):
    s=unicodedata.normalize("NFKD",str(s or "").casefold())
    s="".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+"," ",s).strip()
def attrs(s):
    return {m.group(1).lower():(m.group(3) if m.group(3) is not None else m.group(4)) for m in re.finditer(r'([\w-]+)\s*=\s*("([^"]*)"|([^\s,]+))',s)}
def split_meta(s):
    quoted=False
    for i,c in enumerate(s):
        if c=='"': quoted=not quoted
        elif c=="," and not quoted: return s[:i],s[i+1:].strip()
    return s,""
def safe_url(url):
    if not url:return None,False
    p=urllib.parse.urlsplit(url)
    keys={k.casefold() for k,v in urllib.parse.parse_qsl(p.query,keep_blank_values=True)}
    path=p.path.casefold()
    sensitive=bool(keys & AUTH_KEYS or re.search(r"/(signature|token|auth|credential|key)/",path) or re.search(r"(signature|token|auth|credential|api[_-]?key)=",url,re.I))
    return (None,True) if sensitive else (url,False)
def parse(path):
    lines=path.read_text(encoding="utf-8-sig",errors="replace").splitlines()
    found=[]; cur=None
    def finish():
        nonlocal cur
        if not cur:return
        a=cur["attrs"]; title=cur["title"] or a.get("tvg-name") or "Sem título"
        group=a.get("group-title") or a.get("group") or "Outros"
        subgroup=a.get("pltv-subgroup") or ""
        m=re.search(r"\bT\s*0*(\d+)\s*(?:\||[-_ ]*)",title,re.I)
        e=re.search(r"\bEP\s*0*(\d+(?:\s*[-–]\s*\d+)?)",title,re.I)
        key="|".join([norm(subgroup or title),str(int(m.group(1))) if m else "",e.group(1).replace(" ","") if e else ""])
        safe,redacted=safe_url(cur["url"])
        uid=hashlib.sha256((norm(title)+"|"+norm(group)+"|"+(cur["url"] or "")).encode()).hexdigest()[:20]
        logo,_=safe_url(a.get("tvg-logo"))
        found.append({"candidate_id":uid,"title":title,"normalized_title":norm(title),"url":safe,"url_redacted":redacted,"logo":logo,"group":group,"collection":subgroup or None,"season":int(m.group(1)) if m else None,"episode":e.group(1).replace(" ","") if e else None,"format":Path(urllib.parse.urlsplit(cur["url"] or "").path).suffix.lstrip(".").lower() if cur["url"] else None,"source_file":path.name,"source_line":cur["line"],"comparison_key":key})
        cur=None
    for n,line in enumerate(lines,1):
        line=line.strip()
        if line.startswith("#EXTINF:"):
            finish(); meta,title=split_meta(line[8:]); cur={"title":title,"attrs":attrs(meta),"url":None,"line":n}
        elif line and not line.startswith("#") and line.startswith(("http://","https://")):
            if cur and not cur["url"]:cur["url"]=line
    finish()
    return found
def main():
    if not MASTER.exists() or MASTER.stat().st_size==0:
        raise SystemExit("Catálogo mestre ausente/vazio. Não será criado nem sobrescrito; primeiro publique o catálogo válido.")
    master=json.loads(MASTER.read_text(encoding="utf-8"))
    if not isinstance(master.get("records"),list):
        raise SystemExit("Formato inválido no catálogo mestre; operação interrompida.")
    known_urls={r.get("url") for r in master["records"] if r.get("url")}
    known_keys=set()
    for r in master["records"]:
        title=r.get("title") or ""; collection=r.get("collection") or r.get("series") or ""
        known_keys.add("|".join([norm(collection or title),str(r.get("season") or ""),str(r.get("episode") or "")]))
    incoming=[]
    if INBOX.exists():
        for p in sorted(INBOX.glob("*")):
            if p.is_file() and p.suffix.lower() in {".m3u",".m3u8",".txt"}:incoming.extend(parse(p))
    seen_urls=set();seen_keys=set();new=[];dupes=[];possible=[];redacted=[]
    for item in incoming:
        url=item["url"]; key=item["comparison_key"]
        if item.get("url_redacted"):
            redacted.append(item)
        elif url and (url in known_urls or url in seen_urls):
            dupes.append({**item,"match":"exact_url"})
        elif key in known_keys or key in seen_keys:
            possible.append({**item,"match":"same_title_episode_review"})
        else:new.append(item)
        if url:seen_urls.add(url)
        seen_keys.add(key)
    approvals=json.loads(APPROVALS.read_text(encoding="utf-8")) if APPROVALS.exists() else {"approved_candidate_ids":[]}
    approved=set(approvals.get("approved_candidate_ids",[]))
    approved_items=[x for x in new+possible if x["candidate_id"] in approved]
    output={"schema_version":"1.0.0","master_record_count":len(master["records"]),"incoming_record_count":len(incoming),"new_candidates":new,"possible_matches_requiring_review":possible,"exact_duplicates":dupes,"redacted_sensitive_candidates":redacted,"approved_ready_to_merge":approved_items,"policy":"No candidate is added to the master automatically."}
    REVIEW.parent.mkdir(parents=True,exist_ok=True)
    REVIEW.write_text(json.dumps(output,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps({"master_records":len(master["records"]),"incoming":len(incoming),"new_candidates":len(new),"possible_matches":len(possible),"exact_duplicates":len(dupes),"redacted_sensitive_candidates":len(redacted),"approved_ready_to_merge":len(approved_items)},ensure_ascii=False,indent=2))
if __name__=="__main__":main()
