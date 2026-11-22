# Sistema de Raças (Roleta das Essências) — auditoria e arquitetura

## 1. Ambiente verificado (nos arquivos do projeto)
| Item | Valor real |
|---|---|
| Plataforma | **Minecraft Bedrock** (add-on: behavior pack + resource pack). **Não é Java**: não existe Forge/Fabric/NeoForge, Gradle, mixins, GeckoLib nem PAL aqui. |
| Versão mínima | `min_engine_version` 1.26.30 (manifests gerados por `tools/build_assets.py`) |
| Script | `@minecraft/server` **2.8.0** + `@minecraft/server-ui` **2.1.0** (APIs estáveis) |
| Build | Python (`tools/build_assets.py` gera modelos, texturas, animações, partículas e JSON) + Node (typecheck `tsc`, testes unitários) |
| Teste no jogo | Bedrock Dedicated Server **1.26.65.1** oficial com autoteste (`/scriptevent lila:selftest [owner|race]`) e jogadores simulados |
| Conteúdo existente a preservar | Enxame **Hacknd** (`lila:drone`, 16 formas), soldados do exército (`lila:robot`), itens de nanorrobô, controle, construções, testes 60/60 + 45/45 |

## 2. O que muda em relação ao prompt (equivalentes Bedrock)
| Pedido (escrito para Java) | Equivalente honesto no Bedrock |
|---|---|
| GeckoLib / PAL para animar | Modelos e animações nativas do Bedrock (geometria 1.12 + animações Molang), gerados pelo nosso forge. Asas/auréola/coroa entram **no modelo do jogador** (override de `player.entity.json` com geometrias extras cujos ossos raiz se chamam `body`/`head`, então seguem as animações do jogador). |
| Attachments/capabilities | Propriedades de entidade no jogador (override de `player.json` 1.26.30 oficial, com `lila:race`, `lila:wing`, `lila:bat`, `lila:pose`, sincronizadas com o cliente) + `dynamic properties` (JSON versionado) para progresso, loadout e recargas. |
| Teclas configuráveis | Add-ons Bedrock **não registram teclas**. Controle pensado para celular: item **Núcleo da Raça** — bater/tocar = usa o poder ativo; usar = painel rápido com os 20 slots; agachado + usar = grimório completo (100 poderes, busca, filtros, montar os 20). |
| HUD clicável à direita | O HUD do Bedrock **não aceita clique** de add-on. Os 20 slots ficam no painel rápido (1 toque) com ícones e recargas; a barra de ação mostra o poder ativo, recarga e recurso. |
| Pacotes cliente↔servidor | Toda decisão é do servidor (script). O cliente só desenha. Formulários são enviados pelo servidor e cada escolha é validada de novo (raça, dono, recarga, custo, alvo, alcance). |
| Escala do Gigante | `minecraft:scale` no jogador (grupo de componentes). Alvo: 3× a altura do golem (2,7 → ~8,1 blocos) = escala 4,5. Testado no servidor (altura dos olhos). |

## 3. Arquitetura
- `scripts/race/data.js` — raças, pesos (pontos-base, soma 10 000), recursos, multiplicadores centrais e validação.
- `scripts/race/state.js` — estado por jogador (JSON versionado em dynamic property), migração/fallback seguro.
- `scripts/race/roulette.js` — transação da roleta: trava contra clique duplo, confirmação de troca, consumo de exatamente 1 item (sobrevivência/aventura), sorteio no servidor, roda 3D animada, revelação.
- `scripts/race/passives.js` — sol do vampiro (capacete protege, morcego imune), visão noturna, velocidades, regeneração por pulsos, gigante (escala, força/resistência 3×), asas (XP próprio 0→20), voo, pontos fracos.
- `scripts/race/catalog.js` + `scripts/race/kits/*.js` — 600 poderes (100 por raça) em dados.
- `scripts/race/engine.js` — formas (projétil, raio, cone, explosão, avanço, salto, zona, aura girando, corrente, parede, puxão, alvo, transformação…) + efeitos (dano, cura, roubo de vida, empurrão, atordoar, queimar, murchar, marcar, silenciar, escudo, limpar, teleporte…), recargas em tempo absoluto do mundo (não zera ao relogar/reiniciar), recursos.
- `scripts/race/weapons.js` — Lâmina Divina (30 de dano) e Foice do Vazio (35), presas ao dono por número de série (sem duplicar), cinzas com respeito a proteções.
- `scripts/race/ui.js` — grimório, painel rápido, roleta, informações.

## 4. Riscos e decisões
- Override do jogador (`player.json`/`player.entity.json`): necessário para propriedades e para desenhar asas no corpo. Base: arquivos oficiais 1.26.30/1.26.0 (Mojang/bedrock-samples). Conflita com outros add-ons que também substituem o jogador — documentado.
- 600 poderes: sistema composicional (forma × efeitos × tempo × alvo), com teste que exige assinatura de comportamento **diferente** para cada um dos 100 de cada raça e que **executa os 600** no servidor verificando efeito real.
- Cinzas da foice: só depois que o jogo deixou quebrar (evento depois da quebra), nunca em blocos protegidos/inquebráveis/contêineres/portais/comandos; em jogadores nunca apaga nada (35 de dano + "sombra fragmentada").
