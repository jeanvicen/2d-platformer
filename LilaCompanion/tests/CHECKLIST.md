# Checklist de aceitação — Hacknd 3.1.0 (com a Roleta das Essências)

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
| Molang (751 expressões, inclusive a nuvem do enxame, chegada pelo céu, montar/desmanchar, asas/mãos/prancha): parênteses, funções conhecidas, toda variável lida é escrita | PASS |
| Hacknd: corpo de robô escondido na forma normal (render controller); efeitos do enxame ligados por controlador de animação no cliente (nuvem / montinho desligado / robozinhos em cada forma) — referências conferidas | PASS |
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
| **Hacknd: a forma normal já é o enxame** (modo inteligente ativo, núcleo do enxame na barra) | PASS |
| **Enxame inteligente**: mão vazia na madeira vira **machado**; machado **derruba a árvore inteira**; mão vazia num bicho vira **espada** | PASS |
| **Martelo de nanorrobôs**: arremessa, explode e volta para a mão | PASS |
| **Modo escudo**: dono não leva dano, flechas somem | PASS |
| **Prancha voadora**: levanta o jogador e segura a altura (medido: +1,5 bloco) | PASS |
| **Devorador**: come os blocos em volta do jogador | PASS |
| Enxame pica monstros; muralha; ponte sobre o vazio; "Cancelar" desmancha as formas **e recolhe as ferramentas** (volta ao modo inteligente) | PASS |
| Revide contra jogador; lição de leve; modo proteger | PASS |
| Exército: 10 robôs, derrubam monstros, levam maçã dourada; **esquadrão misto com os 5 tipos** | PASS |
| **Exército constrói junto** (casa do catálogo mobiliada com portas, conferida no fim) | PASS |
| Recolher itens, velocidade de construção, poço e cafeteria por texto | PASS |

## Sistema de Raças (servidor oficial, `/scriptevent lila:selftest race`, jogador simulado) → `tests/last_bds_race_run.log`
| Item | Resultado |
|---|---|
| Pesos somam exatamente 10 000 pontos-base; DEUS = TREVAS = 1%; limites do sorteio exatos; amostra de 200 mil giros bate com as chances | PASS |
| 6 raças × 100 poderes = 600, ids únicos, metadados completos, toda forma/efeito com implementação, nenhum comportamento repetido | PASS |
| Roleta: gasta exatamente 1; dá a raça sorteada pelo servidor; Núcleo + arma da raça uma vez só; propriedade sincronizada com o cliente | PASS |
| Clique duplo travado; cancelar não gasta nada; trocar com confirmação gasta 1 e troca uma vez; sem roleta no lugar → não sorteia | PASS |
| Raça persiste (dados salvos no jogador) e sobrevive à morte e ao renascer | PASS |
| TREVAS: dano × 1/20; Foice = 35 de dano; bloco quebrado pela foice vira cinza sem drop; baú e blocos protegidos nunca viram cinza | PASS |
| DEUS: chamar a Lâmina 3× deixa só 1; Lâmina = 30 de dano; arma largada volta ao dono; regeneração 10× | PASS |
| ANJO: asas crescem até 20 com XP próprio, não encolhem ao gastar XP e não comem o seu XP; voo levanta; regeneração 5× | PASS |
| GIGANTE: hitbox 2,6 × 8,1 no servidor; dano recebido × 1/3; soco × 3; velocidade 3× | PASS |
| VAMPIRO: velocidade 2×; sol direto queima; capacete protege; forma de morcego imune ao sol e volta ao normal; dreno até o alvo morrer, curando | PASS |
| **Os 543 poderes ativos executam no servidor com efeito real** (dano/efeito no alvo, efeito em você ou ação em andamento); as 57 passivas são efeitos sempre ligados (regeneração, velocidade, sol, imunidades etc., cobertas pelos itens acima) | PASS |
| Passivas sem teste próprio (visão noturna no escuro, esquiva, espinhos, golpes que queimam/murcham, aura de medo, impacto da queda do gigante) | NOT TESTED (só código) |

## Não testado (limite do ambiente)
| Item | Resultado |
|---|---|
| Visual das raças na tela: asas/auréolas/coroas no corpo, morcego, gigante escalado, poses, roda girando, armas 3D na mão (posição na mão conferida só por arquivo) | NOT TESTED |
| Câmera do gigante: o Bedrock não sobe a altura dos olhos de jogador escalado → câmera em 3ª pessoa automática | limite do jogo |
| A nuvem do enxame na tela (centenas de pontinhos em zigue-zague, névoa, rastro), a chegada pelo céu, o montinho desligado e montar/desmanchar formas — tudo é partícula desenhada no aparelho; conferido por arquivo e por imagens geradas com a mesma matemática | NOT TESTED |
| Desempenho da nuvem no celular (≈ 560 pontinhos + 22 manchas de névoa + 120 de rastro por enxame; a chegada pelo céu usa até 1000 por 2 s) | NOT TESTED |
| Aparência no celular: robôs do exército, itens de nanorrobô, asas/mãos/prancha de partículas (conferidos por renderização do modelo e por cálculo; a partícula com orientação depende do cliente) | NOT TESTED |
| Desempenho das partículas novas no celular (foram reduzidas: nuvem 70→24, escudo 160→56, grande 220→90 por emissão) | NOT TESTED |
| Névoa do enxame (tom leve no horizonte) e câmera em terceira pessoa da TITÃ vistas na tela | NOT TESTED |
| Sensação de voar com as asas pelo toque (a prancha foi medida com jogador simulado; as asas usam o mesmo empurrão) | NOT TESTED |
| Sons ouvidos no jogo (arquivos e definições validados) | NOT TESTED |
| Mudança do ID do bioma (impossível por script no Bedrock: não existe `/fillbiome`) | não suportado pelo jogo |
