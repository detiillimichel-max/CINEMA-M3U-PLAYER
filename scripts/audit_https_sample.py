#!/usr/bin/env python3
"""Auditoria somente de cabeçalhos e 1 byte; não baixa nem reproduz mídia."""
import json, re, time, urllib.request, urllib.error
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "Cinema.txt"
OUT = ROOT / "data" / "audit" / "https-sample-report.json"
AUTH_KEYS = {"token", "auth", "key", "signature", "sig", "expires"}
MEDIA_EXT = {".mp4", ".m3u8", ".mkv", ".webm", ".mov", ".avi"}
class RedirectRecorder(urllib.request.HTTPRedirectHandler):
    def __init__(self): self.chain=[]
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        self.chain.append({"status": code, "host": urlsplit(newurl).hostname})
        return super().redirect_request(req, fp, code, msg, headers, newurl)
def safe_url(url):
    p=urlsplit(url)
    return p.scheme + "://" + (p.hostname or "") + p.path
def probe(url):
    result={"url":safe_url(url),"status":None,"final_host":None,"content_type":None,
            "content_length":None,"accept_ranges":None,"cors":None,"redirects":[],
            "auth_challenge":False,"method":None,"error":None}
    for method in ("HEAD","GET"):
        recorder=RedirectRecorder()
        headers={"User-Agent":"CinemaCatalog-Audit/1.0","Accept":"*/*"}
        if method=="GET": headers["Range"]="bytes=0-0"
        req=urllib.request.Request(url,headers=headers,method=method)
        try:
            with urllib.request.build_opener(recorder).open(req,timeout=12) as r:
                result.update(status=r.status,final_host=urlsplit(r.url).hostname,
                    content_type=r.headers.get("Content-Type"),
                    content_length=r.headers.get("Content-Length"),
                    accept_ranges=r.headers.get("Accept-Ranges"),
                    cors=r.headers.get("Access-Control-Allow-Origin"),
                    auth_challenge=bool(r.headers.get("WWW-Authenticate")),
                    method=method,redirects=recorder.chain)
                if method=="GET": r.read(1)
                break
        except urllib.error.HTTPError as e:
            result.update(status=e.code,final_host=urlsplit(e.url).hostname,
                content_type=e.headers.get("Content-Type"),
                content_length=e.headers.get("Content-Length"),
                accept_ranges=e.headers.get("Accept-Ranges"),
                cors=e.headers.get("Access-Control-Allow-Origin"),
                auth_challenge=bool(e.headers.get("WWW-Authenticate")),
                method=method,redirects=recorder.chain,error="HTTP " + str(e.code))
            if method=="HEAD" and e.code in (405,501): continue
            break
        except Exception as e:
            result.update(method=method,redirects=recorder.chain,error=type(e).__name__ + ": " + str(e)[:160])
            if method=="HEAD": continue
            break
    ct=(result.get("content_type") or "").lower()
    result["looks_like_media"] = any(x in ct for x in ("video/","application/vnd.apple.mpegurl","application/x-mpegurl"))
    result["browser_cors_header"] = result.get("cors") is not None
    return result
def main():
    if not SOURCE.exists() or SOURCE.stat().st_size==0: raise SystemExit("Cinema.txt ausente ou vazio.")
    lines=SOURCE.read_text(encoding="utf-8",errors="replace").splitlines()
    urls=[]; meta=""
    for i,line in enumerate(lines,1):
        if line.startswith("#EXTINF:"): meta=line.split(",",1)[-1].strip()
        elif line.strip().lower().startswith("https://"):
            u=line.strip(); p=urlsplit(u); q=parse_qs(p.query)
            if any(k.lower() in AUTH_KEYS for k in q): continue
            ext="."+p.path.rsplit(".",1)[-1].lower() if "." in p.path.rsplit("/",1)[-1] else ""
            if ext not in MEDIA_EXT: continue
            urls.append({"line":i,"title":meta[:100],"url":u,"host":p.hostname,"ext":ext})
    # Uma amostra representativa: até 12 hosts distintos, preservando ordem do TXT.
    chosen=[]; seen=set()
    for item in urls:
        if item["host"] in seen: continue
        seen.add(item["host"]); chosen.append(item)
        if len(chosen)>=12: break
    results=[]
    for item in chosen:
        r=probe(item["url"])
        r.update(line=item["line"],title=item["title"],host=item["host"],extension=item["ext"])
        results.append(r)
        time.sleep(0.25)
    report={"source":"Cinema.txt","tested_at_utc":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),
      "policy":"No credentials or signed-token URLs tested. HEAD plus at most one-byte Range GET; no full media download.",
      "source_https_entries":sum(1 for x in lines if x.strip().lower().startswith("https://")),
      "https_entries_with_auth_query_excluded":sum(1 for x in lines if x.strip().lower().startswith("https://") and any(k in x.lower().split("?",1)[-1].split("&") for k in ("token=","auth=","key=","signature=","sig=","expires="))),
      "eligible_media_urls":len(urls),"sample_size":len(results),"results":results}
    OUT.parent.mkdir(parents=True,exist_ok=True); OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=="__main__": main()
