# Compatibilidade de APIs

| Item | Versão |
|---|---|
| Minecraft Bedrock mínimo (`min_engine_version`) | 1.26.30 |
| Servidor usado nos testes | Bedrock Dedicated Server **1.26.65.1** (Linux, oficial) |
| `@minecraft/server` | **2.8.0** (estável) |
| `@minecraft/server-ui` | **2.1.0** (estável) |
| Formato de itens / entidades | 1.21.90 / 1.21.0 |
| Experimentos necessários | nenhum |

Somente APIs **estáveis** (sem “Beta APIs”). Tipagem conferida com `tsc --checkJs` contra os
`.d.ts` oficiais das versões acima.

## APIs usadas e para quê

| API | Uso |
|---|---|
| `system.beforeEvents.startup` → `customCommandRegistry.registerCommand` | comando `/lila` sem cheats (até 8 parâmetros de texto, limite do jogo) |
| `world.afterEvents.worldLoad`, `system.runInterval` | inicialização e agendador único |
| `world.afterEvents.itemUse`, `playerInteractWithBlock`, `playerInteractWithEntity` | abrir o menu do controle |
| `@minecraft/server-ui` `ActionFormData` / `ModalFormData` | menus, campo de texto, configurações |
| `Entity.teleport` (rotação, sem velocidade) | locomoção suave passo a passo ao longo do caminho A* |
| `Entity.setProperty` (enum com `client_sync`) | `lila:action` / `lila:move` → animações |
| `EntityInventoryComponent.container` | inventário real dela (36 espaços) |
| `ItemStack`, `ItemDurabilityComponent` | itens reais e desgaste de ferramentas |
| `Dimension.getBlocks(BlockVolume, {includeTypes})` | procurar árvores/minérios/água |
| `Block.setPermutation`, `BlockPermutation.resolve` | colocar blocos com estado (portas, tochas, plantação) |
| `Dimension.runCommand("setblock … destroy")` | quebrar com drops e partículas reais do jogo |
| `BlockInventoryComponent` (fornalha) | fundir de verdade (slots entrada/combustível/saída) |
| `world.structureManager.createFromWorld / place / delete` | guardar o corpo (inventário sem perdas) ao dispensar/derrota |
| `world.tickingAreaManager` | manter carregada a área onde ela explora longe |
| `world.beforeEvents.entityHurt` (`cancel`, `damage`) | resistência e derrota sem morrer |
| `world.afterEvents.entityHurt` / `entityDie` / `entityLoad` | proteção e reconexão |
| `Entity.applyDamage` / `applyKnockback` | golpes 5× mais fortes |
| `player.locatorBar.addWaypoint(EntityWaypoint)` | ponto dela na barra de localização |
| `player.onScreenDisplay.setActionBar` | “Lila ↗ 38m” |
| `world.get/setDynamicProperty` | persistência (registro por dono, fatiado em blocos de 30 kB) |

## O que **não** existe na API estável (e como foi contornado)

| Necessidade | Situação | Solução |
|---|---|---|
| “Navegar até X” para entidade de script | `EntityNavigationComponent` só tem leitura | A* próprio + passos interpolados por tick |
| Ler o chat | `chatSend` é Beta | comando `/lila` + campo de texto no controle |
| Mostrar item na mão de entidade customizada | sem API de equipamento para mobs customizados | cópia visual via `replaceitem` (o item real fica no inventário) |
| Abrir a GUI da fornalha/bancada | não existe | animação + regras reais de receita e fundição na fornalha de verdade |
