// O catálogo mestre é gerado pelo workflow a partir de Cinema.txt.
// A playlist original permanece como fallback, não como leitura normal a cada abertura.
export const CATALOG_URL = "./data/catalog/catalogo-cinema-mestre-sanitizado.json";
export const PLAYLIST_SOURCES = [
  { name: "Cinema (GitHub Gist — fallback)", url: "https://gist.githubusercontent.com/detiillimichel-max/34a3fa5776316de5f8944b04ac6a38f2/raw/442c2f4086d8c6f5861080ea93a24544b05ffef0/Cinema.m3u", optional: true },
  { name: "Cinema.txt (fallback do repositório)", url: "./Cinema.txt", optional: true }
];
export const PAGE_SIZE = 60;
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
