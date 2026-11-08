const CACHE="cinema-m3u-v5";
const CORE=["./","./index.html","./manifest.json","./css/style.css","./js/app.js","./js/m3u-parser.js","./js/catalog.js","./js/player.js","./js/search.js","./js/favorites.js","./js/cache.js","./js/config.js","./icons/icon.svg","./data/catalog/catalogo-cinema.json"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE))));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))));
self.addEventListener("fetch",event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=="GET"||url.origin!==location.origin)return;
  if(url.pathname.includes("/data/catalog/")){
    event.respondWith(fetch(event.request,{cache:"no-store"}).then(response=>{
      if(response.ok) caches.open(CACHE).then(cache=>cache.put(event.request,response.clone()));
      return response;
    }).catch(()=>caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}
    return response;
  }).catch(()=>caches.match("./index.html"))));
});
