# DR-0N Mega Drone — Minecraft Bedrock

**DR-0N** é um drone-robô para Minecraft Bedrock (celular, PC e console) com **itens infinitos**.
Ele vira **helicóptero, carro, escavadeira, tanque, jato e moto**, vira uma **torreta gigante**,
vira o **colosso TITÃ** (você pilota da cabeça, quase imortal), **explode num exército de robôs**,
**constrói cidades, castelos, vilas e montanhas-russas** e **transforma biomas**.

> Criado por **0neajx**. Modelos, texturas, animações, sons e código são originais deste projeto
> (veja `LICENSES_AND_ASSETS.md`). A versão 2.0 removeu a Lila: o add-on agora é só o DR-0N.

![DR-0N](docs/img/portrait.png)

## 1. Instalar (Android)

1. Baixe **`DR-0N_Mega_Drone.mcaddon`** (pasta `dist/` ou a página de download).
2. Toque no arquivo → abrir com **Minecraft**. Ele importa os dois pacotes.
3. Editar mundo → **Pacotes de Comportamento** → ative **DR-0N Mega Drone (BP)**. Se o mundo tinha
   a versão antiga (Lila Companion), desative ela antes.
4. Não precisa de experimentos nem de cheats. Requisito: Bedrock **1.26.30+** (testado no
   servidor oficial 1.26.65.1).

## 2. Começando

Ao entrar no mundo **nada aparece**. Fabrique o **Controle do DR-0N** (bancada):

```
F V F     F = barra de ferro   V = vidro
R D R     R = pó de redstone   D = diamante
F _ F
```

Use o controle → **Invocar DR-0N**. Pelo chat: `/drone <ordem>` (ou `/drone` sozinho = menu).

**Cancelar tudo** (primeiro botão vermelho, ou "cancela" / "volta ao normal") larga qualquer tarefa
e volta ao drone normal: junta o exército, desfaz veículo, colosso e torreta.

## 3. Formas (veículos)

"vira helicóptero / carro / escavadeira / tanque / jato / moto" (ou menu **Veículos**). Ele se
transforma do seu lado e você já entra no volante.

| Botão do jogo | O que faz |
|---|---|
| andar | acelera / ré |
| olhar | direção |
| pular | sobe (helicóptero), turbo (jato), pulo (terrestres) |
| bater | arma: metralhadora (helicóptero), canhão (tanque), mísseis (jato), cavar (escavadeira), buzina |
| agachar segurado | desce (helicóptero), freio |
| agachar 2× rápido | sai — e ele volta a ser drone |

Outros jogadores podem pegar carona tocando no veículo. **Só o dono pilota.**

## 4. Colosso TITÃ

"modo colosso" (ou "vira o godzila", "robozão", "titã"). Mecha-kaiju metálico original de ~25
blocos: pernas digitígradas, cauda em 4 segmentos, nadadeiras dorsais que acendem, mandíbula,
reator no peito. Ele te põe na **cabine da cabeça**, onde você fica **quase imortal**.

- **andar**: passadas pesadas (tremor de tela, poeira), derruba árvores/paredes na frente, sobe morros;
- **bater**: soco que destrói blocos e arremessa inimigos;
- **pular**: pisão com onda de choque;
- **agachar**: raio de plasma pela boca, para onde você olha;
- **painel** (use o controle lá dentro): rugido (monstros ficam lentos e fracos), trocar de cabine, sair.

Mais pessoas entram nas cabines do peito/ombros. Se você sair sem cancelar, ele **continua colosso**
(parado, pisando em monstros) até você mandar "Cancelar".

## 5. Torreta gigante

"modo torreta": pousa, crava no chão e vira uma arma gigante (metralhadora rotativa de 6 canos,
lança-mísseis, radar). Atira em todo monstro perto e em **qualquer um que te atacar** (jogador também).

## 6. Proteção e revide

- **Me proteger**: ataca primeiro qualquer monstro a até 32 blocos de você.
- Quem bater em você ou nele vira **alvo marcado** — inclusive outros jogadores — até cair ou fugir.
- Se **você** bater nele, leva uma **lição de leve** (3 tirinhos fracos). Dá pra desligar em
  Configurações.

## 7. Modo exército

"modo exército" (ou "com 15 robôs"; padrão 10, até 24). O drone sobe, explode num clarão e vira
robôs-soldado humanoides. Eles:

- seguem você com a IA do jogo (pulam, nadam, abrem portas) e teleportam se você for longe;
- caçam monstros antes de chegarem, revidam em quem te atacar (jogador também), atiram laser;
- **trazem o que você precisa**: maçã dourada + regeneração com vida baixa, comida com fome,
  armadura de netherita encantada se você estiver sem, visão noturna no escuro, respiração na água,
  resistência ao fogo, queda lenta em queda livre, força/resistência quando há muitos monstros.

Comandos (menu **Comandar o exército**): proteger, seguir, ficar, atacar o que você olha, ir até onde
você olha, formação em círculo, me fortalecer. **Cancelar** junta todos no drone.

## 8. Itens infinitos e kit de força

- "me dá 64 diamantes", "me dá um élitro", "me dá uma espada de netherite", "me dá tnt"... ou o menu
  **Itens infinitos** (lista + campo de texto aceitando o id do jogo, ex.: `golden_apple`).
- "me fortalece": veste **netherita encantada** (Proteção IV, Inquebrável III, Remendo...) e entrega
  espada (Afiação V...), arco (Força V, Infinidade), picareta, machado, escudo, élitro, foguetes,
  totem, maçãs douradas e encantadas, pérolas, mais efeitos de força/resistência/regeneração.

## 9. Construções gigantes e biomas

"constrói um castelo aqui", "faz uma cidade inteira", "cria uma vila", "faz uma montanha russa"...
Material infinito, montado por partes sem travar o jogo, com o drone voando e disparando o feixe:

castelo (muralhas com ameias, 4 torres, portão com grade, ponte, fosso, torre de menagem) · cidade
(ruas com faixa, calçadas, postes, prédios, arranha-céus com heliponto, casas, praça e parque) · vila
(casas de várias madeiras, caminhos, poço, plantações, postes, igreja com sino) · montanha-russa
(subida com trilhos energizados, quedas, curvas, estação e carrinho) · poço · labirinto (gerado na
hora, tesouro no centro) · casa inteligente (lâmpadas que acendem sozinhas à noite, portas
automáticas, piscina iluminada, "placas solares", câmeras) · montanha (neve no pico, árvores,
cachoeira) · pirâmide · farol · arranha-céu de 30 andares · estádio. As casas antigas (cabana, casa,
torre, mansão, fazenda...) continuam no menu.

**Construção à mão (padrão):** ele voa até cada ponto e coloca bloco por bloco, parte por parte, de
baixo para cima, como um jogador construindo voando (feixe, som do material, poeira). Velocidade em
Configurações ou por texto ("constrói devagar", "constrói rápido", "constrói na hora"):
à mão ~10 blocos/s · normal ~60 · rápido ~500 · instantâneo. Ele avisa o tempo estimado — obras
gigantes à mão levam bastante (é um jogador construindo uma cidade!).

Ele **não derruba construção sua**: a limpeza do terreno só tira blocos naturais e, se houver coisa
sua no lugar, ele escolhe outro ao lado.

**Aplainar / destruir em volta:** "deixa tudo plano" (ou menu) tira o que é natural acima do chão num
raio de 12 a 64 blocos, tapa buracos e deixa plano. "destrói tudo" tira **tudo**, inclusive
construções — menos baús, camas e blocos que guardam itens. No fim ele recolhe os itens do chão.
**Recolher itens:** "recolhe os itens do chão" — ele aspira os itens em volta e guarda com ele.

**Biomas** (raio de 36 blocos): neve, deserto, selva, cerejeiras, cogumelos, flores, floresta,
pântano. *Limite do jogo:* script não troca o ID do bioma (o Bedrock não tem `/fillbiome`), então a
cor da grama e o clima continuam os de antes; chão, árvores, plantas, gelo e água mudam.

## 10. Sons e animações

13 sons **originais sintetizados** (rotor, motor, turbina, canhão, metralhadora rotativa, pisão,
rugido mecânico, raio de plasma, servo, míssil, transformação, explosão do exército, laser), tocados
junto com sons do próprio Minecraft para dar peso. Animações em Molang contínuo (suaves em qualquer
FPS): rotores, rodas que giram com a velocidade e esterçam, moto que inclina nas curvas, recuo do
canhão, trem de pouso que recolhe, metralhadora que gira, transformação que monta girando, colosso
com passada, cauda, soco, pisão, raio e rugido; robôs com andar, voo de propulsor, tiro e entrega.

## 11. Testes

- `node --test tests/unit.test.mjs` — parser de frases (inclusive as novas), receitas, caminhos.
- `node tests/validate_ids.mjs` — todo `minecraft:*` usado existe no jogo.
- `python3 tools/validate_packs.py` — referências cruzadas, formato de animações, sons, formas.
- `cd tools && npx tsc -p tsconfig.json` — tipos contra as APIs oficiais 2.8.0.
- `python3 tools/bds_test/run_bds_test.py <bedrock-server> [owner]` — servidor oficial do Bedrock,
  autoteste dentro do mundo (com `owner`, jogadores simulados "Dono" e "Intruso").

Resultados e o que **não** foi testado: `tests/CHECKLIST.md`.

## 12. Gerar de novo

```
python3 tools/build_assets.py --previews   # modelos, texturas, animações, sons, partículas, entidades
python3 tools/package_mcaddon.py           # dist/DR-0N_Mega_Drone.mcaddon + fonte
python3 tools/build_site.py                # site/index.html (página de download)
```
