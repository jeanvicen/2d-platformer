# Checklist de aceitação — DR-0N Mega Drone 2.1

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
| Todo `minecraft:*` usado existe no jogo (vanilla-data), inclusive blocos das megaconstruções | PASS |
| Referências cruzadas (9 geometrias de forma + robô, render controller por forma, sons, animações) | PASS |
| Testes unitários (frases pt-BR antigas e novas, receitas, A*) | PASS |
| 12 plantas de megaconstrução geram sem erro; montanha-russa com circuito fechado e contínuo | PASS (Node) |

## Sem jogador (servidor oficial)
| Item | Resultado |
|---|---|
| Itens infinitos: ferramenta e 64 troncos aparecem na hora | PASS |
| Construção à mão (modo humano): poço bloco por bloco, drone voando por vários pontos, passo < 60 ms | PASS |
| Aplainar: morro e árvore somem, chão fica plano, parede do jogador fica, itens do chão recolhidos | PASS |
| Destruir tudo: construção some, baú fica | PASS |
| As 9 formas trocam (propriedade da forma + número de assentos certo) | PASS |
| Colosso: escala 3,4 e hitbox gigante (acerta raios de 4 a 24 blocos de altura) | PASS |
| Soco do colosso quebra a parede e derruba o zumbi | PASS |
| Torreta gigante derruba 3 zumbis e volta a ser drone | PASS |
| 12 megaconstruções completas (poço, labirinto, montanha-russa, casa inteligente, castelo, vila, pirâmide, farol, arranha-céu, estádio, montanha, cidade) | PASS |
| Blocos reais conferidos (cidade, castelo, arranha-céu) e montanha-russa com trilhos + carrinho | PASS |
| Nenhum passo de script acima de 60 ms durante as obras (sem travar o jogo) | PASS |
| Bioma de neve à mão, coluna por coluna (camadas de neve no chão, árvores) | PASS |
| Derrota no meio de uma forma: desmonta e volta como drone em 20 s com o inventário | PASS |
| Dispensar e invocar de novo mantém tudo | PASS |

## Com jogadores simulados (servidor oficial)
| Item | Resultado |
|---|---|
| "me dá 64 diamantes" (itens infinitos) | PASS |
| "me fortalece": veste netherita encantada, entrega totem etc. | PASS |
| "vira helicóptero": o dono entra no volante sozinho | PASS |
| Botão de ataque dispara a metralhadora do helicóptero | PASS |
| Sair do veículo: ele volta a ser drone | PASS |
| Tanque: dono pilota, canhão dispara | PASS |
| "Cancelar" desfaz o veículo | PASS |
| Colosso: dono na cabine da cabeça (~20 blocos de altura) | PASS |
| Colosso: piloto não leva dano | PASS |
| Colosso: botão de ataque = soco | PASS |
| Colosso continua colosso quando você sai; "Cancelar" volta ao drone | PASS |
| Outro jogador bate em você → o DR-0N ataca ele | PASS |
| Você bate no DR-0N → lição de leve (não mata) | PASS |
| Modo proteger: ataca primeiro um zumbi a 20 blocos | PASS |
| Exército: vira 10 robôs, derrubam monstros, levam maçã dourada com vida baixa | PASS |
| "Cancelar" junta o exército de volta no drone | PASS |
| "recolhe os itens do chão" por texto; "constrói na hora / devagar" muda a velocidade | PASS |
| "constrói um poço aqui" por texto (à mão); construção do jogador intacta | PASS |

## Não testado (limite do ambiente)
| Item | Resultado |
|---|---|
| Aparência dos modelos/animações no celular (conferidos por renderizações do próprio modelo) | NOT TESTED |
| Sons ouvidos no jogo (arquivos e definições validados) | NOT TESTED |
| Sensação de pilotar com o toque (o jogador simulado não envia o direcional) | NOT TESTED |
| Mudança do ID do bioma (impossível por script no Bedrock: não existe `/fillbiome`) | não suportado pelo jogo |
