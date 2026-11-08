let hls = null;

export function stopPlayer(video) {
  if (hls) {
    hls.destroy();
    hls = null;
  }
  video.pause();
  video.removeAttribute("src");
  video.load();
}

function waitForMedia(video, eventName, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Tempo esgotado aguardando a mídia"));
    }, timeout);
    const onReady = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error("O navegador não conseguiu abrir a mídia")); };
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener(eventName, onReady);
      video.removeEventListener("error", onError);
    };
    video.addEventListener(eventName, onReady, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

export async function playMedia(video, item, onMessage = () => {}) {
  stopPlayer(video);
  const url = String(item.url || "").trim();
  if (!url) {
    onMessage("Este título não possui um link de mídia autorizado.");
    return;
  }

  try {
    const isHls = /\.m3u8(?:$|[?#])/i.test(url);
    if (isHls && video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      await waitForMedia(video, "loadedmetadata");
    } else if (isHls && window.Hls?.isSupported()) {
      await new Promise((resolve, reject) => {
        hls = new window.Hls({ enableWorker: true, lowLatencyMode: false });
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.once(window.Hls.Events.MANIFEST_PARSED, resolve);
        hls.once(window.Hls.Events.ERROR, (_, data) => {
          if (data.fatal) reject(new Error(`Falha HLS: ${data.type}`));
        });
      });
    } else {
      video.src = url;
      await waitForMedia(video, "loadedmetadata");
    }
    await video.play();
  } catch (error) {
    console.warn("Falha ao reproduzir mídia", { url, error });
    const detail = error?.message || "formato ou resposta inválida";
    onMessage(`Não foi possível reproduzir este conteúdo: ${detail}. Verifique se o link está ativo e permite CORS.`);
  }
}
