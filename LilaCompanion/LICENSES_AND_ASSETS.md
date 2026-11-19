# Licenças e origem dos recursos

## Personagem
**Lila** é uma personagem original deste projeto. A referência enviada pelo usuário (uma skin do
NovaSkin) foi usada apenas para pistas gerais de estilo: cabelo volumoso verde-esmeralda, pele
clara e roupa preta de mangas longas. O rosto, os olhos, o corte de cabelo (franja recortada,
mechas laterais, cabelo longo com pontas), a presilha de folha dourada, o vestido com gola alta,
acabamento esmeralda, cinto dourado, saia em duas camadas, meia-calça e botas foram desenhados
para este add-on. Nenhuma personagem de terceiros, skin ou rosto foi copiado.

## Recursos visuais
Todos gerados por código neste repositório (`tools/forge/`), sem arquivos de terceiros:

| Recurso | Origem |
|---|---|
| Modelo 3D da Lila (`geometry.lila.lila`) | `tools/forge/lila_art.py` (geometria por código) |
| Textura da Lila (pixel art 128×256, densidade 2×) | `tools/forge/lila_art.py` (paletas e rosto desenhados à mão em ASCII) |
| Animações e controladores | `tools/forge/lila_anims.py` |
| Controle 3D (mão) e ícone | `tools/forge/controller_art.py` + renderizador próprio `tools/forge/render.py` |
| Partículas (brilho, folhas) e suas texturas | `tools/build_assets.py` |
| Ícone dos pacotes e imagens da documentação | renderizados do próprio modelo |

## Referências ao jogo base
- Ícones dos botões do menu apontam para texturas **do próprio Minecraft instalado no aparelho**
  (ex.: `textures/items/iron_pickaxe`); nenhum arquivo do jogo é copiado ou redistribuído.
- Sons usados são eventos de som do jogo base (ex.: `random.pop`, `dig.stone`), tocados por nome.
- Identificadores de blocos/itens são os nomes oficiais do jogo.

## Código
Código-fonte (JavaScript dos scripts, Python das ferramentas) escrito para este projeto.
Dependências de desenvolvimento (não incluídas no `.mcaddon`): `@minecraft/server`,
`@minecraft/server-ui`, `@minecraft/vanilla-data` (tipos/dados oficiais da Mojang, licença MIT)
e `typescript` (Apache-2.0).

## Marcas
Minecraft é marca da Mojang/Microsoft. Este é um add-on de fã, não oficial e não afiliado.
