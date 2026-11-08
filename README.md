# CINEMA M3U PLAYER

PWA para ler playlists M3U, organizar títulos e reproduzir fontes HTTP(S) autorizadas.

## Estrutura inicial

- `index.html`: interface principal.
- `js/m3u-parser.js`: leitor M3U/EXTINF.
- `js/catalog.js`: cards do catálogo.
- `js/player.js`: reprodução HLS (Hls.js) e MP4.
- `js/search.js`: pesquisa e filtros.
- `js/favorites.js`: favoritos e histórico.
- `js/cache.js`: IndexedDB local.
- `js/config.js`: fontes de playlist.
- `data/playlists/`: playlists públicas e não confidenciais.
- `sw.js` e `manifest.json`: suporte PWA.

## Adicionar playlists por URL

Edite `js/config.js` e acrescente uma entrada em `PLAYLIST_SOURCES`:

```js
{ name: 'Minha playlist', url: 'https://servidor.exemplo/lista.m3u' }
```

A URL precisa permitir acesso pelo navegador (CORS). O endereço do Gist Cinema.m3u já está configurado como fonte inicial.

## Adicionar arquivo ao repositório

Coloque playlists que podem ser públicas em `data/playlists/`. O nome inicial opcional é `cinema.m3u`. Não coloque tokens, links temporários, credenciais ou conteúdo privado em um repositório público.

## Importação privada no aparelho

Use a engrenagem no aplicativo, defina um PIN de quatro dígitos e selecione arquivos M3U. Os arquivos importados são processados e guardados no IndexedDB do navegador; não são enviados ao GitHub nem a um servidor. Para aparecer em outro aparelho, será necessário importar novamente.

**Limite de segurança:** como o aplicativo é hospedado como site estático, o PIN é uma barreira local de privacidade casual, não autenticação forte. Alguém com acesso técnico ao navegador/dispositivo pode contorná-la ou apagar os dados locais. Não use esse mecanismo para proteger segredos.

## Reproduzir

- MP4: reprodução nativa do navegador.
- M3U8/HLS: Hls.js em navegadores compatíveis; Safari pode usar HLS nativo dependendo do ambiente.
- Reprodução pode falhar se a origem estiver indisponível, exigir autorização, bloquear CORS ou fornecer codec incompatível. O aplicativo não contorna essas restrições.

## Publicar no GitHub Pages

No repositório, abra **Settings → Pages**, selecione **Deploy from a branch**, escolha **main** e a pasta **/(root)** e salve. Aguarde a publicação e abra a URL informada pelo GitHub. O Service Worker/PWA exige HTTPS (GitHub Pages fornece HTTPS).

## Observação sobre escala

O parser percorre milhares de linhas, mas a interface desenha 60 cards por vez para reduzir o consumo de memória no celular. Playlists muito grandes são mantidas no IndexedDB após a primeira leitura.
