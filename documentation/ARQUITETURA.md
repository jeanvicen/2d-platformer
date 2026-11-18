# Arquitetura do SHADOW AI BRAIN

## Alvo técnico (auditoria de compatibilidade)
| Item | Valor | Por quê |
|---|---|---|
| Minecraft Bedrock | 1.26.40+ (Play Store atual: 1.26.60) | mínimo exigido pelos módulos abaixo |
| `@minecraft/server` | **2.3.0** (estável) | menor versão estável que compila o código (verificado de 2.0.0 a 2.11.0); `Dimension.isChunkLoaded` chegou na 2.3.0 |
| `@minecraft/server-ui` | **2.1.0** (estável) | formulários `ActionFormData`/`ModalFormData` com opções em objeto |
| APIs experimentais | **nenhuma** | `chatSend` é beta, por isso a entrada é `/sombra` (comando custom estável, `cheatsRequired: false`) + menus |
| Formatos | entidade/item BP `1.21.40`, cliente `1.10.0`, geometria `1.12.0` (UV por face), animações `1.8.0` | estáveis e suportados |

## Fluxo de uma ordem
```
/sombra texto | menu | formulário
        │
        ▼
[authorization/owner_auth]  isOwner(player.id === record.ownerId)   ← nunca pelo nome
        │
        ▼
[nlu/interpreter]  normaliza PT-BR → cláusulas → Intent[]  (ou pergunta curta se faltar algo essencial)
        │                     └─ desconhecido + IA externa ligada → [ai/llm_bridge] → [ai/plan_schema] valida
        ▼
[planner/planner]  Intent[] → Task[] (objetivo, etapas, prioridade, tentativas, estratégia, entrega)
        │
        ▼
[ai/squad]  quem recebe? (nome, "todos", "criaturas") → divide por especialidade (coleta em partes,
        │       ataque para todos que lutam, obra para a melhor construtora + ajudantes)
        ▼
[ai/brain]  amarra contexto da ordem (bloco olhado, frente do dono, alvo) → fila (substitui ou "depois" acrescenta)
        │
        ▼  (a cada 4 ticks, por prioridade)
[executor/executor] → [executor/tasks] (geradores reinicializáveis) → [executor/routines]
        │                         │                                   ├─ navigation/mover (A* em runJob + seguidor)
        │                         │                                   ├─ breakAt / collectNear / placeAt (mundo real)
        │                         │                                   └─ returnToOwner / deliverTo (inventário real do dono)
        ▼
[communication/comms]  mensagem privada só ao dono, barra de ação para progresso, boca animada
```

## Módulos e interfaces
| Módulo | Arquivo | Entrada → Saída | Puro? |
|---|---|---|---|
| A. Perception | `perception/perception.ts` | `scanBlocks(dim, origem, pred, opções)` gerador → posições (anéis do mais perto, em lotes); `findTree`, `inspectTree`, `exposed`, `nearLiquid`, `nearestHostile` | não |
| B. Natural Language Interpreter | `nlu/normalize.ts`, `nlu/interpreter.ts` | `interpret(texto) → ParseResult {intents, clarification?, append}` | **sim** |
| C. Task Planner | `planner/planner.ts` | `plan(Intent[]) → {tasks, mode?, control, queries}` | **sim** |
| D. Action Executor | `executor/*.ts` | `Executor.tick(dt)` dirige `RUNNERS[kind](agent, task)` → `Outcome` | não |
| E. Memory Manager | `memory/memory_manager.ts` | índice do esquadrão `sb:squad:<dono>` + um registro por membro `sb:agent:<dono>:<id>` (JSON atômico no mundo; migra o formato antigo) | não |
| Esquadrão | `ai/squad.ts`, `ai/agent_manager.ts` | `addressees`, `assign` (divide por `SPECIALTY`), `handOff` (passa itens), `rallyTo` (socorro em combate), `socialTick` (conversa entre elas) | divisão **sim** |
| Criaturas | `core/species.ts`, `combat/beasts.ts` | 12 espécies com vida/ataque/velocidade/tamanho e habilidade própria; só `attack`, `hunt`, `return` | catálogo **sim** |
| Materiais de obra | `building/materials.ts`, `building/blueprints.ts` | `countNeeds`, `shortfall` → o que buscar antes de construir; plantas casinha, casa grande, mansão etc. | **sim** |
| F. Inventory Manager | `inventory/logical_inventory.ts`, `item_catalog.ts`, `equipment.ts` | add/remove/consumeAll atômicos; manipuladores por categoria | lógica **sim**, equipamento não |
| G. Survival Manager | `survival/needs.ts`, `survival_manager.ts` | `exert`, `chooseFood`, `eat`, `healthDelta`; tick de 1 s | lógica **sim** |
| H. Navigation Manager | `navigation/astar.ts`, `mover.ts` | `findPath(WorldProbe, início, opções)` gerador; `Mover.start/tick/stop` | A* **sim** |
| I. Combat Behavior | `combat/combat.ts` + IA nativa do JSON | `ownerThreat`, `enterProtect`, `magicBolt`, `leash`, `refreshCombatEffects` | não |
| J. Recovery System | `executor/executor.ts` (watchdog), `ai/agent_manager.ts` | timeout por etapa, tentativas e estratégia, retomada após morte/recarga, varredura anti-duplicação | não |
| K. Communication | `communication/comms.ts`, `phrases.ts` | `say/sayKey/actionBar`, anti-spam, frases variadas por persona | frases **sim** |
| Owner Authorization | `authorization/owner_auth.ts` | `isOwner(player, agent)` em toda entrada | não |
| Estado | `state/state_machine.ts` | estados IDLE…RECOVERING e prioridades | **sim** |
| UI | `ui/menus.ts`, `ui/commands.ts` | menus de toque e `/sombra` | não |
| IA opcional | `ai/llm_bridge.ts`, `ai/plan_schema.ts` | script events ↔ ponte BDS; validação de lista fechada | schema **sim** |

## Prioridades (brain tick, 5×/s)
1. **Proteger o dono**: ameaça perto dele, ou quem bateu nele nos últimos 6 s → interrompe a tarefa, liga a IA nativa de combate, raio mágico (Luna), habilidades das criaturas, coleira de 16 blocos. Quando o perigo passa, a tarefa interrompida é retomada do progresso salvo.
2. **Ordens urgentes**: aplicadas na hora em que chegam (a fila é substituída).
3. **Necessidades**: vida < 35% → RECOVERING (fica perto, come, só volta ≥ 70%); fome ≤ 12 → come (respeitando a reserva).
4. **Tarefa ativa**: executor.
5. **Comportamento padrão**: seguir / proteger / guarda (volta ao ponto se se afastar 8 blocos) / parada.

## Garantias de não duplicação
- O inventário lógico fica **no mundo** (dynamic property por dono), não no corpo. O corpo não tem `minecraft:inventory` nem loot.
- O equipamento aparece no corpo como **cópia visual** com `slot_drop_chance 0`. Além disso, logo após a morte, itens do mesmo tipo que surgirem no local por 4 ticks são removidos.
- Cada invocação incrementa `gen`. Corpos com `gen` antigo, sem dono ou com dono offline são removidos pela varredura (a cada 5 s), por `entitySpawn` e no `/summon`.
- Transferências: o item só sai de um lado depois de entrar no outro. Pegar do chão remove a entidade só após guardar; se sobrar, o resto volta ao chão exato. Entregar ao dono: o que não couber cai aos pés dele, nunca some.
- Fabricação é atômica, com rollback se a mochila encher.

## Desempenho (Android)
- Nada roda em todo tick, exceto o seguidor de caminho de quem está andando.
- A* limitado (2600 nós, raio 36) e espalhado em vários ticks via `system.runJob`; varreduras em lotes com parada antecipada.
- Consultas de entidade sempre com raio; nenhuma varredura global.
- Partículas discretas (fumaça na base a cada 6 s parada).
- 18 modelos; texturas das humanas 1024×1024 (60–95 KB cada no pacote), das criaturas 512×512.
- Esquadrão limitado a 12 por padrão (máximo 40 no menu): cada sombra a mais custa CPU no celular.

## Pipeline de arte (gerada, nunca editada à mão)
`tools/art/generate_art.py` gera geometria e textura juntas, então as UVs nunca desalinham.
- Atlas por face (UV por face), 128 unidades × 4 px; nas humanas o resultado é ampliado 2× (1024 px).
- Pintores normais recebem `light_pass` (luz de cima, sombra embaixo, oclusão nas bordas) e ampliação suave.
- Pintores marcados `hires` (rosto, cabelo) são pintados direto na resolução final, com supersampling 4×.
- O rosto inteiro é renderizado por `face_render(olhos, sobrancelhas)`; cada expressão (olhos brilhando, piscar,
  feliz, brava) é um **recorte** desse render, então as camadas encaixam pixel a pixel.
- `generate_anims.py` gera animações, controladores, render controllers e entidades de cliente; o validador cruza tudo.
