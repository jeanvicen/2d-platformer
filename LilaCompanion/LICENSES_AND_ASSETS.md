# Licenças e origem dos recursos

## Personagem e designs
**DR-0N** (drone-robô), suas formas (helicóptero, carro esportivo, escavadeira, tanque, caça a
jato, moto, torreta gigante), o **colosso TITÃ** e o **robô-soldado** são designs originais deste
projeto. O colosso é um mecha-kaiju genérico (gênero "monstro gigante metálico"): não copia
nenhum personagem, filme ou jogo — formas, cores, cauda, nadadeiras, cabine e golpes foram
desenhados para este add-on.

## Recursos visuais
Todos gerados por código neste repositório (`tools/forge/`), sem arquivos de terceiros:

| Recurso | Origem |
|---|---|
| Modelo e textura do drone | `tools/forge/drone_art.py` |
| Formas (veículos e torreta gigante) | `tools/forge/forms_art.py` |
| Colosso TITÃ e robô-soldado | `tools/forge/colossus_art.py` |
| Animações e controladores | `tools/forge/drone_anims.py`, `tools/forge/forms_anims.py` |
| Texturas (pintura procedural por material) | `tools/forge/paint.py` |
| Partículas e suas texturas | `tools/build_assets.py` |
| Ícones e imagens da documentação | renderizados do próprio modelo (`tools/forge/render.py`) |

## Sons
13 sons **originais sintetizados do zero** em `tools/forge/audio.py` (numpy) e codificados em OGG
com o ffmpeg: rotor, motor, turbina, canhão, metralhadora rotativa, pisão, rugido mecânico, raio de
plasma, servo, míssil, transformação, explosão do exército e laser. Nenhuma gravação de terceiros.
Também são tocados **eventos de som do próprio jogo** por nome (ex.: `random.explode`,
`mob.ravager.roar`, `mob.warden.sonic_boom`); nenhum arquivo do jogo é copiado.

## Referências ao jogo base
- Ícones dos botões do menu apontam para texturas **do próprio Minecraft instalado no aparelho**.
- Identificadores de blocos/itens/efeitos/encantamentos são os nomes oficiais do jogo.

## Código
Código-fonte (JavaScript dos scripts, Python das ferramentas) escrito para este projeto.
