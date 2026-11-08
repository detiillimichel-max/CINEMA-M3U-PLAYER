# CINEMA M3U PLAYER

PWA para organizar uma biblioteca pessoal a partir de playlists M3U e fontes autorizadas.

## Catálogo mestre

- Entrada de origem: `Cinema.txt` na raiz do repositório.
- Gerador: `scripts/build_catalog.py`.
- Saída: `data/catalog/catalogo-cinema.json`.
- O workflow `Build Cinema Catalog` pode ser executado manualmente em Actions ou é acionado quando `Cinema.txt` ou o gerador muda.
- O aplicativo carrega primeiro o JSON e mantém uma cópia local no IndexedDB por 24 horas. A playlist original só é usada como fallback.

## Privacidade e links

Este repositório é público. O gerador remove do catálogo publicado URLs que contenham parâmetros de autenticação (`token`, `auth`, `key`, `signature`, `sig`). Os registros e metadados são preservados, mas esses itens aparecem sem reprodução até que uma fonte autorizada seja importada localmente. Não publique tokens ou playlists privadas.

## Biblioteca cumulativa

Novas playlists importadas pela engrenagem são armazenadas no IndexedDB do aparelho. O app não sobrescreve o catálogo mestre. A deduplicação automática usa URL exata quando disponível; registros sem URL permanecem separados. A futura etapa de descoberta deve comparar metadados e enviar candidatos para aprovação antes de incorporar novas entradas.

## Estrutura

- `js/m3u-parser.js`: leitor M3U compatível com importação local.
- `js/catalog.js`: cards e organização de temporadas.
- `js/app.js`: carrega o catálogo mestre, fallback e playlists locais.
- `js/cache.js`: IndexedDB.
- `scripts/build_catalog.py`: gera JSON a partir de Cinema.txt.
- `.github/workflows/build-cinema-catalog.yml`: execução automatizada.
- `data/catalog/`: catálogo mestre gerado.

## Publicar

GitHub Pages: Settings → Pages → Deploy from a branch → main → /(root).
