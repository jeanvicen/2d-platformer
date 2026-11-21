# Checklist de aceitação — DR-0N Mega Drone 2.2.1

Legenda: **PASS** = verificado de verdade · **NOT TESTED** = não dá para testar neste ambiente
(servidor sem tela, sem celular, sem som).

Ambiente: Bedrock Dedicated Server **1.26.65.1** oficial (Linux). Autoteste dentro do mundo:
`/scriptevent lila:selftest` (sem jogador) → `tests/last_bds_run.log`, e `/scriptevent lila:selftest owner`
com jogadores simulados "Dono" e "Intruso" → `tests/last_bds_owner_run.log`.

## Qualidade estática
| Item | Resultado |
|---|---|
| Pacotes carregam no servidor oficial sem erro de conteúdo/script | PASS |
| Typecheck contra `@minecraft/server` 2.8.0 / `server-ui` 2.1.0 | PASS |
| Todo `minecraft:*` usado existe no jogo (vanilla-data), inclusive as 4851 plantas do catálogo | PASS |
| Referências cruzadas (18 geometrias, render controller com 16 formas, animações, partículas, sons) | PASS |
| Testes unitários (frases pt-BR antigas e novas, receitas, A*) | PASS |
| Molang (444 expressões): parênteses, funções/consultas conhecidas e toda variável lida é escrita em algum lugar | PASS |
| Física das animações (molas): simulada fora do jogo a 20 e 60 FPS — estável, 1 quique ao frear, assenta em < 1 s | PASS |
| As 4851 construções do catálogo geram sem erro (Node) e as amostras renderizadas conferem planta e móveis | PASS |

## Sem jogador (servidor oficial)
| Item | Resultado |
|---|---|
| As 16 formas trocam (propriedade da forma + número de assentos certo) | PASS |
| Terrestres rápidos de verdade (3 s acelerando: carro ~22 b/s, moto ~27, caminhão ~19, tanque ~9, escavadeira ~8; na 2.1 o carro ficava em ~3) | PASS |
| Pular faz o carro pular (~1,9 bloco) e o caminhão-monstro pular alto (~4,6) | PASS |
| Helicóptero sobe no pular e anda acelerando; nave e disco voam; caça furtivo é o mais rápido | PASS |
| Lancha anda rápido na água e boia; submarino mergulha olhando pra baixo e anda debaixo d'água | PASS |
| Armas novas disparam (lasers, torpedo, mísseis, turbo, raio desintegrador) e o raio trator ergue o que está embaixo | PASS |
| TITÃ: escala 3,4, hitbox gigante, soco quebra parede e derruba zumbi, salto com propulsores (~6,7 blocos) | PASS |
| Robô de peças flutuantes: desligar (cai no chão, propriedade lila:off), ignora ordens desligado, ligar (volta online) | PASS |
| Soco forte: dano alto e arremesso | PASS |
| Torreta gigante derruba 3 zumbis e volta à forma normal | PASS |
| Construção à mão (modo humano): poço bloco por bloco, robô voando pela obra, passo < 60 ms | PASS |
| Aplainar / destruir tudo / recolher itens | PASS |
| Catálogo: todos os blocos + estados usados nas 4851 plantas existem no jogo de verdade (581 combinações) | PASS |
| Catálogo construído de verdade (instantâneo e à mão): portas com as 2 metades, camas com pé + cabeceira (3/3 na casa, 23/23 no hospital), móveis, passo < 60 ms | PASS |
| 12 megaconstruções completas; blocos reais conferidos; montanha-russa com trilhos + carrinho | PASS |
| Bioma de neve à mão; derrota numa forma volta em 20 s; dispensar e invocar mantém tudo | PASS |

## Com jogadores simulados (servidor oficial)
| Item | Resultado |
|---|---|
| Itens infinitos e "me fortalece" | PASS |
| "vira helicóptero": dono no volante, metralhadora no botão de ataque | PASS |
| **Agachar = sair do veículo**, e ele volta à forma normal | PASS |
| Tanque: dono pilota, canhão dispara; "Cancelar" desfaz | PASS |
| TITÃ: dono **em cima da cabeça** (~25 blocos de altura), não leva dano, ataque = soco perto / raio do visor longe, continua TITÃ ao sair | PASS |
| "vira nave espacial": dono pilota, lasers disparam | PASS |
| Enxame: escudo (dono não leva dano), flechas perto somem, pica monstro até cair, muralha, ponte sobre o vazio, "Cancelar" desmancha tudo | PASS |
| Outro jogador bate em você → o DR-0N revida; você bate nele → lição de leve | PASS |
| Modo proteger: ataca primeiro um zumbi a 20 blocos (você não leva dano) | PASS |
| Exército: 10 robôs, derrubam monstros, levam maçã dourada; "Cancelar" junta | PASS |
| Recolher itens por texto; velocidade de construção por texto; poço por texto; **cafeteria do catálogo por texto** | PASS |

## Não testado (limite do ambiente)
| Item | Resultado |
|---|---|
| Aparência dos modelos/animações no celular (conferidos por renderizações do próprio modelo e das poses, inclusive acelerando/freando/curva) | NOT TESTED |
| Física das peças rodando no cliente do jogo (Molang de cada quadro; o servidor não desenha) | NOT TESTED |
| Capota recolhendo ao entrar (animação no cliente; `q.has_rider`) — conferida só no arquivo de animação | NOT TESTED |
| Partículas do enxame (milhares de nanorrobôs) e desempenho delas no celular | NOT TESTED |
| Sons ouvidos no jogo (arquivos e definições validados) | NOT TESTED |
| Sensação de pilotar com o toque (o jogador simulado não envia o direcional; a física foi medida com entrada simulada) | NOT TESTED |
| Mudança do ID do bioma (impossível por script no Bedrock: não existe `/fillbiome`) | não suportado pelo jogo |
