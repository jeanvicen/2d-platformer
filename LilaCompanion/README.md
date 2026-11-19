# Lila Companion — Minecraft Bedrock

**Lila** é uma companheira autônoma para Minecraft Bedrock (celular, PC e console). Você fabrica o
**Controle da Lila**, invoca ela e pronto: ela coleta, minera, fabrica, funde na fornalha, constrói,
planta, cozinha, explora longe, dorme à noite e te protege. Quando você não pede nada, ela joga
sozinha como uma jogadora de verdade, decidindo o que fazer.

> Criado por **0neajx**. Personagem, modelo, texturas, animações, sons de interface e código são
> originais deste projeto (veja `LICENSES_AND_ASSETS.md`).

![Lila](docs/img/portrait.png)

---

## 1. Download e instalação (Android)

1. Baixe **`Lila_Companion.mcaddon`** (pasta `dist/` ou a página de download).
2. Toque no arquivo baixado → abrir com **Minecraft**. O jogo importa os dois pacotes
   (“Lila Companion (BP)” e “(RP)”) automaticamente.
3. Crie/edite um mundo → **Pacotes de Comportamento** → ative **Lila Companion (BP)**
   (o pacote de recursos é ativado junto).
4. Não precisa de experimentos nem de cheats.

Requisitos: Minecraft Bedrock **1.26.30 ou mais novo** (testado no servidor oficial 1.26.65.1).

Se o celular abrir o arquivo como .zip: renomeie para `.mcaddon` e abra pelo app de Arquivos.

## 2. Começando

Ao entrar no mundo **nada aparece** — o jogo começa normal. A Lila só existe depois que você
fabrica o controle:

| Receita (bancada) | |
|---|---|
| `  R  ` | R = pó de redstone |
| `F B F` | F = barra de ferro (ou **barra de cobre** na receita alternativa) |
| `F   F` | B = botão de pedra |

O **Controle da Lila** é infinito: nunca gasta, nunca quebra.

**Usar o controle** (tocar/segurar com ele na mão, ou tocar num bloco) abre o menu:

- **✎ Escrever ordem** — campo de texto livre + exemplos prontos.
- Botões rápidos: Me seguir · Ficar aqui · Vem aqui · Modo livre · Pegar madeira · Minerar… ·
  Achar comida · Construir… · Fazer plantação · Fabricar… · Me proteger · Explorar ·
  Colocar tochas · Me dá tudo · Ir para a base · Inventário e status · Pausar/Continuar ·
  Configurações · Dispensar.
- Tocar **na Lila** com o controle também abre o menu.

Pelo chat: **`/lila pega 32 madeira`** (ou `/lila:lila ...`). `/lila` sozinho abre o menu.

### Exemplos de ordens em texto

```
pega 20 madeira e depois faz uma casa aqui
faz uma picareta de diamante
minera 10 ferro
constrói uma mansão aqui
faz uma plantação de cenoura aqui
arranja comida pra mim
procura diamante
coloca tochas por aqui
me dá tudo          (ela fica só com as ferramentas dela)
aqui é a base       /   vai pra casa
me segue  ·  fica aqui  ·  vem aqui  ·  modo livre  ·  me protege
para  ·  pausa  ·  continua  ·  dorme  ·  acorda  ·  status  ·  o que você tem
```

Ela entende quantidades (“20”, “vinte e cinco”, “uma dúzia”, “2 pilhas”), erros de digitação
leves e várias ordens encadeadas (“…e depois…”, “…, em seguida…”).

## 3. O que ela faz de verdade

Nada é trapaça: tudo usa itens reais do inventário dela (36 espaços) e as regras do jogo.

- **Planejamento:** pediu uma picareta de ferro? Ela descobre a cadeia sozinha: madeira →
  tábuas/gravetos → bancada → picareta de madeira → pedra → picareta de pedra → fornalha →
  minerar ferro → combustível → fundir (10 s por item, na fornalha de verdade) → picareta de ferro.
- **Coleta:** corta a árvore inteira e replanta a muda; minera com a picareta certa (respeita o
  nível: ferro precisa de pedra, diamante precisa de ferro), desce em **escadaria** até a camada
  certa do minério e abre **túneis**; colhe só plantas maduras e replanta.
- **Construção:** cabana, casa, torre, muralha, ponte, abrigo, fazenda e mansão (2.249 blocos).
  Ela calcula a lista de materiais, junta tudo, limpa o terreno (só blocos naturais), faz a
  fundação e ergue bloco a bloco andando pela obra.
- **Plantação:** ara a terra com enxada, põe água com balde, planta e depois colhe e faz pão.
- **Comida:** colhe plantas maduras/frutas, faz pão, assa carne/batata na fornalha, pega maçãs.
  Caçar animais só com permissão (pedido direto ou opção ligada nas configurações).
- **Movimento:** caminhos A* com portas (abre e fecha), água (nada), escadas, degraus e quedas
  seguras; desvia de lava. Se travar: replaneja → cava/faz ponte/pilar (só blocos naturais) →
  teleporte só como último recurso.
- **Explora longe:** mantém a área dela carregada (área de processamento móvel) e anota árvores,
  água, areia e minérios na memória.
- **Proteção:** luta contra monstros perto de você ou dela; quem te atacar vira alvo na hora.
  Nunca ataca jogadores, aldeões, golens, pets ou bichos com nome.
- **Necessidades:** tem fome (come do inventário), regenera vida de barriga cheia, dorme à noite
  (na cama da base ou perto de você) e acorda se aparecer perigo.

### Modo livre (autônoma)

Sem ordens, ela escolhe a melhor atividade do momento (IA por utilidade): fazer ferramentas e
melhorar de nível, juntar madeira/pedra/tochas, construir a casinha dela, montar e cuidar da
plantação, guardar coisas no baú, minerar ferro e diamante, fazer armadura, explorar, dormir à
noite e ficar de boa por perto. Se você se afastar demais, ela larga o que estava fazendo e volta.

## 4. Força, derrota e retorno

- **100 de vida** (5× a do jogador) e **dano 5×** maior que o seu com a mesma arma; recebe metade
  do dano, menos ainda com armadura no inventário.
- Se cair em batalha ela **não morre**: faz a animação de derrota e **volta em exatos 20 s**
  (400 ticks, contados mesmo se o mundo fechar) perto de você, **com o inventário inteiro**, e
  **continua o plano** de onde parou.
- **Dispensar** guarda o corpo dela com tudo; invocar de novo traz ela de volta igualzinha.

## 5. Localizador

“**Lila ↗ 38m · minerando ferro**” na barra de ação (seta relativa para onde você olha, ▲/▼ se
estiver acima/abaixo) + ponto verde na barra de localização do jogo. Mostra também “está no
Nether”, “volta em 12s”, “fora de alcance”. Configurável: Automático / Sempre / Desligado.

## 6. Configurações

HUD · conversa no chat (normal / pouca / só respostas) · pode caçar animais · distância máxima
para explorar sozinha (32–256 blocos).

## 7. Como funciona por dentro (honestidade)

A “inteligência” da Lila é **um planejador determinístico** escrito para o Minecraft — **não** é
um modelo de linguagem. O texto das ordens passa por um reconhecedor de intenções em português
(vocabulário + quantidades + tolerância a erros); o objetivo vira um plano por encadeamento para
trás sobre o livro de receitas reais; e a execução usa geradores retomáveis (cada passo checa o
mundo de novo). Frases fora do vocabulário recebem um pedido para reformular com exemplos.
Um adaptador opcional para IA na nuvem está só **desenhado** (`source/llm_adapter_design.md`),
desligado e sem nenhuma chave no pacote.

Módulos (`behavior_pack/scripts/`):

| Módulo | Papel |
|---|---|
| `lila/registry.js` | SummonRegistry (Lila é a 1ª entrada) |
| `lila/companion.js` | estado por dono, persistência, uma Lila por dono |
| `lila/lifecycle.js` | invocar, dispensar, derrota/retorno em 20 s, backup |
| `lila/brain.js` | executor de objetivos, fila de ordens, IA por utilidade, necessidades |
| `lib/intent.js`, `lib/lexicon.js`, `lib/text.js` | IntentRecognizer pt-BR |
| `lila/planner.js` | TaskPlanner (obtain/ensureTool/viaRecipe/viaSmelt/comida) |
| `lila/goals.js` | GoalExecutor (seguir, ficar, entregar, dormir, tochas, baú, fazenda…) |
| `lila/motor.js`, `lib/pathfinding.js` | NavigationService (A*, estados, travamento, recuperação) |
| `lila/world.js` | WorldScanner + memória espacial |
| `lila/resource.js`, `lila/blocks.js` | ResourceService (árvores, minas, escadaria, túnel, plantas) |
| `lila/crafting.js`, `lib/recipes.js` | CraftingService (bancada, fornalha real) |
| `lila/inventory.js` | InventoryService (inventário real de 36 espaços) |
| `lila/combat.js` | proteção, combate, caça, tosquia |
| `lila/build.js`, `lib/blueprints.js` | plantas de construção |
| `lila/hud.js` | HUDLocator |
| `lila/talk.js` | ConversationService |
| `lila/anim.js` | AnimationController (propriedades → animações) |
| `ui/controller.js` | menu do controle |

### Registrar uma segunda invocação

1. Crie a entidade (BP) com as mesmas propriedades `lila:action`/`lila:move`, inventário e
   `minecraft:interact`; e o modelo/cliente (RP) com os ossos humanoides padrão
   (`tools/forge/lila_art.py` é o exemplo; `tools/build_assets.py` gera tudo).
2. Em `behavior_pack/scripts/lila/registry.js` chame `registerSummon({ key, name, entity,
   controller, health, strength, respawnTicks, color, chatTag, defaults })`.
3. O cérebro, o motor, o planejador, o HUD e o menu são genéricos e passam a funcionar para ela.

## 8. Testes

- `node --test tests/unit.test.mjs` — pathfinding, parser de frases, receitas, regras de blocos.
- `node tests/validate_ids.mjs` — todo `minecraft:*` usado existe no jogo (vanilla-data oficial).
- `python3 tools/validate_packs.py` — referências cruzadas dos pacotes.
- `cd tools && npx tsc -p tsconfig.json` — checagem de tipos contra as APIs oficiais 2.8.0.
- `python3 tools/bds_test/run_bds_test.py <bedrock-server>` — sobe o **servidor oficial do
  Bedrock**, carrega os pacotes e roda o autoteste dentro do mundo (`/scriptevent lila:selftest`).

Resultados e o que **não** foi testado: `tests/CHECKLIST.md`.

## 9. Gerar de novo

```
python3 tools/build_assets.py --previews   # modelos, texturas, animações, item, receitas, partículas
python3 tools/package_mcaddon.py           # dist/Lila_Companion.mcaddon + fonte
```
