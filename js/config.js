// Fontes públicas e autorizadas. Arquivos adicionados manualmente pelo painel ficam somente neste aparelho.
export const PLAYLIST_SOURCES = [
  { name: 'Cinema (GitHub Gist)', url: 'https://gist.githubusercontent.com/detiillimichel-max/34a3fa5776316de5f8944b04ac6a38f2/raw/442c2f4086d8c6f5861080ea93a24544b05ffef0/Cinema.m3u' },
  { name: 'Cinema.txt (arquivo enviado ao repositório)', url: './Cinema.txt', optional: true },
  { name: 'Cinema local do repositório', url: './data/playlists/cinema.m3u', optional: true }
];
export const PAGE_SIZE = 60;
export const CACHE_TTL_MS = 6 * 60 * 60 * 1000;