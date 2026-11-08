#!/usr/bin/env python3
"""Explicitly promote only reviewed candidate IDs; preserve a backup and append-only semantics."""
import datetime,json,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
MASTER=ROOT/"data/catalog/catalogo-cinema.json"
REVIEW=ROOT/"data/discovery/review-candidates.json"
APPROVALS=ROOT/"data/discovery/approved.json"
BACKUPS=ROOT/"data/catalog/backups"
def main():
    for p in (MASTER,REVIEW,APPROVALS):
        if not p.exists() or p.stat().st_size==0: raise SystemExit(f"Arquivo obrigatório ausente/vazio: {p.relative_to(ROOT)}")
    master=json.loads(MASTER.read_text(encoding="utf-8"))
    review=json.loads(REVIEW.read_text(encoding="utf-8"))
    approvals=json.loads(APPROVALS.read_text(encoding="utf-8"))
    if not isinstance(master.get("records"),list): raise SystemExit("Formato mestre inválido.")
    approved=set(approvals.get("approved_candidate_ids",[]))
    candidates=review.get("new_candidates",[])+review.get("possible_matches_requiring_review",[])
    selected=[x for x in candidates if x.get("candidate_id") in approved]
    if not selected: raise SystemExit("Nenhum candidato aprovado encontrado. Catálogo não alterado.")
    urls={r.get("url") for r in master["records"] if r.get("url")}
    ids={r.get("id") for r in master["records"]}
    additions=[]
    for x in selected:
        url=x.get("url")
        if not url or url in urls: continue
        rid="discovery-"+x["candidate_id"]
        if rid in ids: continue
        additions.append({"id":rid,"title":x["title"],"normalized_title":x["normalized_title"],"type":"series_episode" if x.get("season") is not None or x.get("episode") else "other","category":x["group"],"group":x["group"],"collection":x.get("collection"),"series":x.get("collection"),"season":x.get("season"),"episode":x.get("episode"),"url":url,"logo":x.get("logo"),"format":x.get("format"),"source":x.get("source_file"),"source_line":x.get("source_line")})
        urls.add(url);ids.add(rid)
    if not additions: raise SystemExit("Todos os candidatos aprovados já existem ou não têm URL. Catálogo não alterado.")
    BACKUPS.mkdir(parents=True,exist_ok=True)
    stamp=datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup=BACKUPS/f"catalogo-cinema-{stamp}.json"
    shutil.copy2(MASTER,backup)
    master["records"].extend(additions)
    master.setdefault("statistics",{})["extinf_records"]=len(master["records"])
    master["statistics"]["discovery_additions"]=master["statistics"].get("discovery_additions",0)+len(additions)
    master["generated_at"]=datetime.datetime.now(datetime.timezone.utc).isoformat()
    temp=MASTER.with_suffix(".json.tmp")
    temp.write_text(json.dumps(master,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    temp.replace(MASTER)
    print(json.dumps({"added":len(additions),"backup":str(backup.relative_to(ROOT)),"total":len(master["records"])},ensure_ascii=False,indent=2))
if __name__=="__main__":main()
