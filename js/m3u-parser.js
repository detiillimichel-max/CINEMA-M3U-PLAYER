const attr=(s,k)=>{const re=new RegExp('(?:^|\\s)'+k+'="([^"]*)"','i');return s.match(re)?.[1]||''};
function classify(title,group=''){const s=(title+' '+group).toLowerCase();if(/\b(t\s*\d+\s*(?:\||[- ])?\s*ep?\s*\d+|temporada|season|epis[oó]dio|s[eé]rie|seriado)\b/.test(s))return 'Séries';if(/movie|filme|cinema|longa/.test(s))return 'Filmes';return group||'Outros';}
function episodeInfo(title){const m=title.match(/\bT\s*(\d{1,2})\s*(?:\||[- ])?\s*EP?\s*(\d{1,3})\b|(?:temporada|season)\s*(\d{1,2}).*?(?:epis[oó]dio|episode)\s*(\d{1,3})/i);return m?{season:Number(m[1]||m[3]),episode:Number(m[2]||m[4])}:null;}
export function parseM3U(text,source='Playlist'){
 const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/);const items=[];let meta=null;
 for(const rawLine of lines){const line=rawLine.trim();if(!line)continue;
  if(line.startsWith('#EXTINF')){const comma=line.indexOf(',');const title=comma>=0?line.slice(comma+1).trim():(attr(line,'tvg-name')||'Sem título');meta={title,logo:attr(line,'tvg-logo'),group:attr(line,'group-title')||attr(line,'group'),id:attr(line,'tvg-id'),raw:line};continue;}
  if(line.startsWith('#'))continue;
  if(/^https?:\/\//i.test(line)){const title=meta?.title||line.split('/').pop().split('?')[0]||'Vídeo sem título';const group=meta?.group||'Outros';const ep=episodeInfo(title);items.push({id:line,title,url:line,logo:meta?.logo||'',group,category:classify(title,group),season:ep?.season??null,episode:ep?.episode??null,source,addedAt:Date.now()});meta=null;}
 }
 return items;
}