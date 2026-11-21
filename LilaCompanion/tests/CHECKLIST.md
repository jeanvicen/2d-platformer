# Checklist de aceitação — DR-0N Mega Drone 2.3.0

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
| Referências cruzadas (18 geometrias, render controllers das 16 formas e dos 5 tipos de robô, animações, partículas, sons) | PASS |
| Testes unitários (frases pt-BR antigas e novas, receitas, A*) | PASS |
| Molang (479 expressões, inclusive as partículas novas de asas/mãos/prancha): parênteses, funções conhecidas, toda variável lida é escrita | PASS |
| As 4851 construções do catálogo geram sem erro (Node) e as megaconstruções mobiliadas geram (vila, cidade, castelo, casa tech, arranha-céu, pirâmide, farol) | PASS |

## Sem jogador (servidor oficial)
| Item | Resultado |
|---|---|
| As 16 formas trocam (propriedade da forma + número de assentos certo), com a transformação carregada | PASS |
| Terrestres rápidos, pulo do carro/caminhão, voadores, lancha, submarino | PASS |
| Armas dos veículos (lasers, torpedo, mísseis, turbo, desintegrador, raio trator) | PASS |
| TITÃ: escala, hitbox gigante, soco quebra parede e derruba zumbi, salto com propulsores | PASS |
| Desligar / ligar o robô; soco forte | PASS |
| **Torreta fica cravada no lugar enquanto atira** (deslocamento medido durante a luta) e derruba 3 zumbis | PASS |
| Construção à mão, aplainar, destruir, recolher | PASS |
| Catálogo: todos os blocos + estados existem no jogo; construções reais com portas inteiras e camas completas | PASS |
| 12 megaconstruções completas (agora mobiliadas) + **autocorreção** no fim; arranha-céu futurista conferido | PASS |
| Bioma, derrota numa forma, dispensar e invocar | PASS |

## Com jogadores simulados (servidor oficial)
| Item | Resultado |
|---|---|
| Itens infinitos e "me fortalece" | PASS |
| Helicóptero: dono no volante, poder do slot dispara no botão de ataque | PASS |
| **Agachar = sair** do veículo (pular não tira) | PASS |
| Tanque, nave, TITÃ (dono em cima da cabeça, quase imortal, soco/raio) | PASS |
| **Enxame inteligente**: núcleo do enxame na barra; mão vazia na madeira vira **machado**; machado **derruba a árvore inteira**; mão vazia num bicho vira **espada** | PASS |
| **Martelo de nanorrobôs**: arremessa, explode e volta para a mão | PASS |
| **Modo escudo**: dono não leva dano, flechas somem | PASS |
| **Prancha voadora**: levanta o jogador e segura a altura (medido: +1,5 bloco) | PASS |
| **Devorador**: come os blocos em volta do jogador | PASS |
| Enxame pica monstros; muralha; ponte sobre o vazio; "Cancelar" desmancha tudo **e recolhe as ferramentas/núcleo** | PASS |
| Revide contra jogador; lição de leve; modo proteger | PASS |
| Exército: 10 robôs, derrubam monstros, levam maçã dourada; **esquadrão misto com os 5 tipos** | PASS |
| **Exército constrói junto** (casa do catálogo mobiliada com portas, conferida no fim) | PASS |
| Recolher itens, velocidade de construção, poço e cafeteria por texto | PASS |

## Não testado (limite do ambiente)
| Item | Resultado |
|---|---|
| Aparência no celular: robôs do exército, itens de nanorrobô, asas/mãos/prancha de partículas (conferidos por renderização do modelo e por cálculo; a partícula com orientação depende do cliente) | NOT TESTED |
| Desempenho das partículas novas no celular (foram reduzidas: nuvem 70→24, escudo 160→56, grande 220→90 por emissão) | NOT TESTED |
| Névoa do enxame (tom leve no horizonte) e câmera em terceira pessoa da TITÃ vistas na tela | NOT TESTED |
| Sensação de voar com as asas pelo toque (a prancha foi medida com jogador simulado; as asas usam o mesmo empurrão) | NOT TESTED |
| Sons ouvidos no jogo (arquivos e definições validados) | NOT TESTED |
| Mudança do ID do bioma (impossível por script no Bedrock: não existe `/fillbiome`) | não suportado pelo jogo |
