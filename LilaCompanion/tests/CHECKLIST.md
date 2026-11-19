# Checklist de aceitação

Legenda: **PASS** = verificado de verdade · **FAIL** = falhou · **NOT TESTED** = não foi possível testar
neste ambiente (sem cliente gráfico/celular).

Ambiente: Bedrock Dedicated Server **1.26.65.1** oficial (Linux, sem jogadores), autoteste dentro do
mundo `/scriptevent lila:selftest` — log completo em `tests/last_bds_run.log` (25/25 PASS).

## Carregamento e qualidade
| Item | Resultado |
|---|---|
| Pacotes carregam no servidor oficial sem erros de conteúdo (entidade, item, receitas, scripts) | PASS |
| Typecheck contra `@minecraft/server` 2.8.0 / `server-ui` 2.1.0 | PASS |
| Todos os `minecraft:*` usados existem no jogo (vanilla-data) | PASS |
| Referências cruzadas RP/BP (geometria, ossos, animações, controladores, texturas, ícone, partículas) | PASS |
| Testes unitários (A*, frases pt-BR, receitas, regras de blocos, plantas) — 14 | PASS |
| Comando `/lila` registra sem cheats (limite de 8 parâmetros respeitado) | PASS |

## Comportamento no mundo (servidor oficial)
| Item | Resultado |
|---|---|
| Invocação e vínculo ao dono (1 por dono) | PASS |
| Inventário real (adicionar/contar/retirar) | PASS |
| Pathfinding contornando muro que ela não pode quebrar | PASS |
| Cortar árvores de verdade (8+ troncos) | PASS |
| Picareta de madeira: tábuas → gravetos → bancada (sem disputa de ingredientes) | PASS |
| Picareta de pedra minerando pedra real | PASS |
| Bancada temporária recolhida depois | PASS |
| Ferro: minerar minério + fornalha + combustível + fundição real | PASS |
| Ordem em texto pela fila (“pega 3 areia”) | PASS |
| Construção por planta (“abrigo”, 97/98 blocos; 1 tocha decorativa sem apoio) | PASS |
| Combate: mata zumbi | PASS |
| Dispensar guarda o corpo; invocar devolve o inventário completo | PASS |
| Golpe letal → derrota sem morrer | PASS |
| Retorno em 400 ticks (medido 402, polling de 5 ticks) | PASS |
| Inventário e plano preservados após derrota | PASS |
| Persistência do registro | PASS |
| Construção do jogador intacta no fim de tudo | PASS |
| Autonomia: sem ordens, escolhe e executa atividades úteis (ferramentas, comida) | PASS |

## Não testado (precisa de cliente/celular)
| Item | Resultado |
|---|---|
| Aparência do modelo/textura/animações no cliente | NOT TESTED (conferido só por renderização própria) |
| Item 3D do controle na mão (1ª e 3ª pessoa) | NOT TESTED |
| Menu do controle no toque (itemUse no Android) | NOT TESTED |
| HUD na barra de ação e ponto na barra de localização | NOT TESTED |
| Seguir/proteger um jogador real, entregar itens no inventário do jogador | NOT TESTED (sem jogador no servidor) |
| Plantação completa, mansão e exploração muito longa | NOT TESTED (tempo de teste) |
