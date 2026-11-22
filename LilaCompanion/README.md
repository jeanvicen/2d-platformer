# Hacknd — Minecraft Bedrock

**Hacknd** é um **enxame de nanorrobôs** para Minecraft Bedrock (celular, PC e console), com **itens
infinitos**. Não tem corpo de robô: é uma nuvem de robozinhos do tamanho de poeira, que se mexe como
abelhas e mosquitos (zigue-zague turbulento). Quando você invoca, eles **descem do céu em várias
correntes, de lugares diferentes**. Tudo é feito pelos nanorrobôs:

- viram **12 veículos** (helicóptero, carro, moto, caminhão-monstro, escavadeira, tanque, jato, caça
  furtivo, nave espacial, disco voador, lancha e submarino);
- viram a **torreta gigante** e o **TITÃ** (robô gigante; você vai em cima da cabeça);
- se dividem num **exército** de soldados de nanorrobôs;
- viram **ferramentas na sua mão**, **asas**, **prancha voadora**, **mãos gigantes**, **escudo** e o
  **devorador**;
- constroem **cidades, castelos e montanhas-russas**, têm um **catálogo de 4851 construções
  mobiliadas** e **transformam biomas**.

Tudo que eles montam é **feito de nanorrobôs**: grafite granulado, com pontinhos ciano brilhando e
robozinhos soltos deslizando pela superfície.

> Criado por **0neajx**. Modelos, texturas, animações, partículas, sons e código são originais deste
> projeto (veja `LICENSES_AND_ASSETS.md`). Hacknd é a versão 3 do antigo DR-0N Mega Drone: mesmo pacote,
> então o mundo e o inventário do enxame continuam.

**Sobre "milhões" de nanorrobôs:** nenhum jogo desenha bilhões de pontos. A nuvem tem centenas de
robozinhos de verdade, desenhados no seu aparelho e presos ao enxame, mais uma névoa que dá a
sensação de densidade. O servidor não manda nada por quadro para desenhar a nuvem, por isso não trava.

![Hacknd](docs/img/portrait.png)

## 1. Instalar (Android)

1. Baixe **`Hacknd.mcaddon`** (pasta `dist/` ou a página de download).
2. Toque no arquivo → abrir com **Minecraft**. Ele importa os dois pacotes.
3. Editar mundo → **Pacotes de Comportamento** → ative **Hacknd (BP)** (é o mesmo pacote do DR-0N, versão nova). Se o mundo tinha
   a versão antiga (Lila Companion), desative ela antes.
4. Não precisa de experimentos nem de cheats. Requisito: Bedrock **1.26.30+** (testado no
   servidor oficial 1.26.65.1).

## 2. Começando

Ao entrar no mundo **nada aparece**. Fabrique o **Controle do Hacknd** (bancada):

```
F V F     F = barra de ferro   V = vidro
R D R     R = pó de redstone   D = diamante
F _ F
```

Use o controle → **Invocar o enxame Hacknd**: os nanorrobôs descem do céu. Pelo chat: `/hacknd <ordem>` (ou `/hacknd` sozinho = menu; `/drone` também funciona).

**Cancelar tudo** (primeiro botão vermelho, ou "cancela" / "volta ao normal") larga qualquer tarefa
e volta a ser enxame: junta o exército, desfaz veículo, TITÃ e torreta.

**Desligar / ligar** (botão no controle, ou "desliga" / "liga"): desligado, o campo cai e a poeira desce
num montinho no chão (não segue, não ataca). Ligando, a poeira levanta e mais robozinhos descem do céu.

**Luta:** o enxame compacta num **punho de nanorrobôs** que voa até o alvo (soco forte que arremessa)
e dispara **dardos de poeira**, protegendo você atacando primeiro.

**No dia a dia a nuvem passeia por perto** (4 a 9 blocos, do lado ou atrás, olhando em volta) em vez de
ficar rodando em volta de você; quando você anda, ele acompanha.

## 3. Veículos

"vira helicóptero / carro / moto / caminhão-monstro / escavadeira / tanque / jato / caça furtivo /
nave / disco voador / lancha / submarino" (ou menu **Veículos**). Ele se transforma do seu lado e você
já entra. **A capota recolhe quando você entra: dá pra ver tudo em volta.**

| Botão do jogo | O que faz |
|---|---|
| andar | acelera / ré |
| olhar | direção — nos voadores, olhar pra cima/baixo e acelerar sobe/desce |
| pular | o veículo **pula** (terrestres, lancha) · sobe (helicóptero, nave, disco, submarino) · pós-combustor (jatos) — **pular nunca tira você** |
| **slot da barra (1, 2…)** | **escolhe o poder** (a tela mostra a lista, o escolhido em amarelo) — sem abrir o controle |
| bater | usa o poder escolhido: metralhadora/mísseis (helicóptero), mísseis/metralhadora (jatos), canhão/metralhadora (tanque), cavar/escavar grande (escavadeira), lasers/mísseis (nave), desintegrador/**raio trator** (disco), torpedo (submarino), **turbo**/buzina (carro, moto, caminhão, lancha) |
| **agachar** | **sai** (é o único jeito de sair) — e ele volta à forma normal (do alto você cai devagar) |

Velocidades: carro ~23 blocos/s, moto ~26, caminhão ~20, tanque ~11, escavadeira ~9, lancha ~25 na
água, helicóptero ~20, disco ~28, nave ~36, jato ~44, caça furtivo ~60. Submarino: quem está dentro
respira e enxerga debaixo d'água. Outros jogadores podem pegar carona tocando no veículo. **Só o dono
pilota.**

## 4. Robô gigante TITÃ

"modo colosso" (ou "robô gigante", "titã", "robozão"). Robô humanoide original de ~26 blocos (armadura
branca e vermelha, visor em T, reator no peito, propulsores nas costas). Ele te põe **em cima da
cabeça** (plataforma com corrimão baixo: visão 360°), onde você fica **quase imortal**.

- **câmera em terceira pessoa** automática enquanto você pilota (dá pra ver o robô e o caminho);
- **andar**: passadas pesadas (tremor de tela, poeira); sobe morros de até 9 blocos de forma suave e
  **atravessa paredes e árvores** abrindo caminho na largura do corpo (não trava mais);
- **poderes na barra**: slot 1 soco · 2 raio do visor · 3 salto com pisão · 4 onda de choque · 5 pose de
  poder (monstros ficam fracos) — escolha o slot e **bata**;
- **pular**: salto com os propulsores e onda de choque ao cair (não sai);
- **agachar**: sai (cai devagar).

Mais pessoas sobem nas ombreiras e na mochila. Se você sair sem cancelar, ele **continua TITÃ**
(parado, pisando em monstros) até você mandar "Cancelar".

## 4b. Poderes do enxame

A forma normal **já é o enxame**: os poderes funcionam sempre (menu **Poderes do enxame…**, ou fale
o nome). Em volta de você ficam robozinhos minúsculos espalhados no ar (sem orbitar) e uma névoa
levíssima no horizonte. Você **não precisa abrir o controle** — eles agem sozinhos:

- **Ferramentas na sua mão**: de mão vazia, bata num bloco e os nanorrobôs se juntam na sua mão:
  **machado** em madeira (derruba a árvore inteira), **picareta** em pedra/minério (veio inteiro ou
  túnel 3×3), **pá** em terra/areia (3×3), **enxada** em folhas/plantas. Bata num bicho de mão vazia e
  vira **espada** (corte em área). Pare de usar por 15 s, ou largue no chão, e ela se desfaz.
- **Martelo**: peça "martelo" e **use** para arremessar — explode no que acertar e volta para a mão.
- **Proteção**: almofada nas quedas (sem dano), plataforma sobre lava ou vazio, luz que te segue no
  escuro, fôlego debaixo d'água, apagam o fogo, remendam você com vida baixa, somem com flechas perto
  de você e picam os monstros que chegam.

**Modos** — use o **Núcleo do enxame** (ele aparece na sua barra; agachado volta um modo), fale o nome
ou escolha no menu:

| Modo | O que faz |
|---|---|
| **Inteligente** | tudo acima, sozinho |
| **Escudo** | barreira girando em volta: nada passa e **nada te acerta**; eles não atacam |
| **Asas** | asas enormes nas costas: olhe e ande para voar · pular sobe · agachar desce planando |
| **Prancha voadora** | anda para voar · pular sobe · agachar desce |
| **Mãos gigantes** | duas mãozonas atrás de você: **bata** e a mão da vez soca até 12 blocos |
| **Devorador** | come tudo por onde você passa (agachado, o chão também; precisa de "pode destruir") |

Também: **muralha, ponte** (40 blocos), **escada, cúpula** (se desmancham depois), **punho do céu,
lâmina giratória, tornado, elevador, ataca** (o que você mira). "Cancelar" desmancha tudo e recolhe as
ferramentas.

## 4c. Roleta das Essências — raças

Fabrique a **Roleta das Essências** (bancada):

```
A O A     A = fragmento de ametista   O = barra de ouro
E D E     E = olho do fim             D = diamante
A O A
```

**Use** a roleta. Uma roda 3D gira na sua frente e para na raça sorteada **pelo servidor**:

| Raça | Chance | O que muda |
|---|---|---|
| Vampiro | 28% | corre 2× (5× na Rajada), regenera 2×, vira morcego, suga sangue segurando o botão, visão noturna automática · **o sol queima** (capacete ou morcego protegem) |
| Gigante | 24% | ~8 blocos de altura (3 golens; **câmera nos olhos do gigante, em 1ª pessoa**), 3× força, 3× resistência, 3× velocidade, passos que tremem |
| Anjo | 22% | auréola, asas que crescem com XP próprio (0→20, nunca encolhem), voo, regenera 5× |
| Demônio | 24% | coroa e asas rubras, fogo e maldições, imune a fogo, voo, regenera 5× |
| **DEUS** | **1%** | coroa de luz, asas enormes, regenera 10×, **Lâmina Divina** (30 de dano) |
| **TREVAS** | **1%** | coroa negra, asas sombrias, resistência 20×, regenera 10× em pulsos, **Foice do Vazio** (35 de dano; o que ela quebra vira cinza) |

Gasta 1 roleta por giro (no criativo não gasta). Se você já tem raça, ela pede confirmação, e cancelar
não gasta nada.

**Usar os poderes** — com o **Núcleo da Raça** (você recebe ao virar a raça):

- **usar o Núcleo** liga/desliga o **MODO PODER**: aparece o **painel no canto direito** (meio
  transparente) com os poderes, a recarga e o seu recurso;
- no modo poder, a **barra de itens (1–9) escolhe o poder** e **bater/tocar usa** (bater no bloco não
  quebra enquanto o modo poder estiver ligado);
- **agachar + bater**: troca a página do painel (poderes 1–9 / 10–18);
- **agachar + usar o Núcleo**: **grimório** com os **100 poderes** (categorias, busca, detalhes, montar a
  barra de 18) e "Sua raça e ajustes" (modo poder, câmera do gigante, efeitos reduzidos).

Cada raça tem 100 poderes diferentes, todos liberados. Os **10 poderes assinatura** de cada raça
(mecânica e visual próprios — Parar o Tempo, Buraco Negro, Olhar Hipnótico, Mão de Jötunn, Anjo da
Guarda, Possessão...) já vêm na barra. A lista completa e a tabela de equilíbrio estão em
`docs/race-abilities.md`.

**Limites do Bedrock** (equivalentes honestos ao que foi pedido):

- add-ons não criam botões clicáveis novos no HUD: o painel da direita mostra os poderes e a escolha é
  pela barra de itens (que já é tocável no celular);
- o jogo não sobe sozinho a câmera de um jogador escalado: o gigante usa uma câmera própria
  (`lila:giant_eye`) colada nos olhos dele. Se a altura não ficar certinha no seu aparelho, ajuste em
  "Sua raça e ajustes".

## 5. Torreta gigante

"modo torreta": pousa, **crava no chão e fica parada** (não anda, não teleporta), abre as pernas e arma
a metralhadora rotativa de 6 canos, lança-mísseis e radar. Atira **de longe (~60 blocos)** em todo
monstro e em **qualquer um que te atacar** (jogador também).

## 6. Proteção e revide

- **Me proteger**: ataca primeiro qualquer monstro a até 32 blocos de você.
- Quem bater em você ou nele vira **alvo marcado** — inclusive outros jogadores — até cair ou fugir.
- Se **você** bater nele, leva uma **lição de leve** (3 tirinhos fracos). Dá pra desligar em
  Configurações.

## 7. Modo exército

"modo exército" (ou "com 15 robôs"; padrão 10, até 24). O menu pergunta o **estilo**: misto, só
soldados, ninjas, artilharia, construtores ou médicos (por texto: "exército de ninjas"). O robô sobe,
explode num clarão e vira robôs humanoides de 5 tipos:

| Tipo | Visual | Faz |
|---|---|---|
| Soldado | branco e ciano | laser |
| Construtor | amarelo, capacete de obra | laser fraco, **constrói rápido** |
| Artilheiro | vermelho, canhão no ombro | tiro de canhão de longe com estouro em área (não quebra blocos) |
| Médico | branco e verde, mochila com cruz | **cura você** e os robôs feridos |
| Ninja | preto e roxo, katana | some na fumaça, aparece **nas costas** do inimigo e corta |

Todos seguem você com a IA do jogo, caçam monstros antes de chegarem, revidam em quem te atacar
(jogador também) e **trazem o que você precisa** (maçã dourada, comida, armadura, visão noturna,
respiração na água, resistência ao fogo, queda lenta, força com muitos monstros).

**O exército constrói junto:** com o exército ativo, peça qualquer construção ("constrói um castelo",
"faz uma padaria média estilo japonês" ou **Comandar o exército → Construir com o exército…**). Cada
robô voa até um pedaço da obra e solda os blocos; no fim eles conferem tudo e corrigem o que faltou.
"Cancelar" para só a obra; "Cancelar" de novo junta todos.

Comandos: construir, proteger, seguir, ficar, atacar o que você olha, ir até onde você olha, formações
**círculo / linha de frente / V**, me fortalecer, juntar.

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
torre, mansão, fazenda...) agora saem do catálogo, mobiliadas.

**Tudo num lugar só e tudo mobiliado:** menu **Construir…** (botões grandes, legíveis no celular) com
as megaconstruções, as 6 categorias do catálogo e "Surpresa". As megaconstruções vêm **mobiliadas por
dentro**: a vila usa casas e lojas do catálogo (camas, mesas, cozinha, baús, janelas) + igreja; a cidade
tem prédios com andares de escritório e apartamento, hotel e hospital; o castelo tem a torre de
menagem mobiliada, ferreiro e estábulo; o arranha-céu é um prédio futurista com 30 andares
mobiliados e heliponto; pirâmide com câmara do faraó; farol com quarto do faroleiro.

**Autocorreção:** no fim de toda obra ele confere bloco por bloco e recoloca o que faltou (incluindo a
metade de cima de portas e a cabeceira das camas) e avisa quantos corrigiu.

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

## 9b. Catálogo: 4851 construções mobiliadas

Menu **Catálogo: 1000+ construções** (escolha categoria → tipo → estilo → tamanho, ou "Surpresa") ou
por texto: "faz uma padaria pequena estilo japonês", "constrói um hospital futurista", "faz uma
igreja gótica grande", "faz uma fonte", "constrói uma torre de mago".

- **67 tipos** — casas (casa, cabana, sobrado, bangalô, mansão, prédio, hotel, castelinho, torre de
  mago, casa na árvore, iglu, palácio), comércio (padaria, açougue, ferreiro, farmácia, livraria,
  taverna, restaurante, cafeteria, mercado, banco, joalheria, roupas, barbearia, correio, ferragens,
  pet shop, floricultura, brinquedos, shopping, posto), públicos (escola, hospital, delegacia,
  bombeiros, prefeitura, igreja, biblioteca, museu, teatro, cinema, estação, academia, prisão,
  quartel, observatório, laboratório, fábrica, oficina), fazenda (celeiro, estábulo, galinheiro, silo,
  moinho, estufa, casa de fazenda, armazém, apiário) e lazer (torre de vigia, farolzinho, quiosque,
  coreto, piscina, cais, arena, parquinho);
- **21 estilos** — medieval, rústico, moderno, futurista, japonês, desértico, nórdico, tropical,
  gótico, colonial, castelo, infernal, gelo, mansão, rural, praiano, steampunk, élfico, industrial,
  colorido, savana · **3 tamanhos** · mais **30 objetos** (fonte, estátua, poste, banco de praça,
  árvore, canteiro, barraca de feira, carroça, fogueira, ponto de ônibus, jardim zen, laguinho...).
- **Interior arrumado**: quarto (cama, criados-mudos com lanterna, baú, estante), cozinha (fogão,
  forno, pia, bancada, armários em cima, mesa com bolo), sala (sofá, TV, estante, tapete), banheiro,
  escritório, loja com balcão, sino e a mercadoria certa (pão na padaria, armas no ferreiro, poções na
  farmácia...), sala de aula com carteiras e lousa, igreja com bancos, altar e velas, hospital com
  leitos, celas, baias com feno e bebedouro, estufa com plantação. Escada de mão entre andares,
  portas com as duas metades, luzes, janelas, telhado do estilo e caminho até a porta, **virada para
  você**.

## 10. Sons e animações

13 sons **originais sintetizados** (rotor, motor, turbina, canhão, metralhadora rotativa, pisão,
rugido mecânico, raio de plasma, servo, míssil, transformação, explosão do exército, laser), tocados
junto com sons do próprio Minecraft para dar peso. Animações em Molang contínuo (suaves em qualquer
FPS): rotores, rodas que giram com a velocidade e esterçam, moto que inclina nas curvas, recuo do
canhão, trem de pouso que recolhe, metralhadora que gira, transformação que monta girando, capotas
que recolhem quando alguém entra, hélice do submarino e da lancha, anel de luzes do disco voador,
TITÃ com passada de joelho, soco com giro do tronco, salto com propulsores, raio do visor e pose de
poder; enxame com anéis de nanorrobôs; robôs com andar, voo de propulsor, tiro e entrega.

## 11. Testes

- `node --test tests/unit.test.mjs` — parser de frases (inclusive as novas), receitas, caminhos.
- `node tests/validate_ids.mjs` — todo `minecraft:*` usado existe no jogo.
- `python3 tools/validate_packs.py` — referências cruzadas, formato de animações, sons, formas.
- `python3 tests/check_molang.py` — Molang: parênteses, funções/consultas conhecidas, toda variável lida existe.
- `cd tools && npx tsc -p tsconfig.json` — tipos contra as APIs oficiais 2.8.0.
- `python3 tools/bds_test/run_bds_test.py <bedrock-server> [owner]` — servidor oficial do Bedrock,
  autoteste dentro do mundo (com `owner`, jogadores simulados "Dono" e "Intruso").

Resultados e o que **não** foi testado: `tests/CHECKLIST.md`.

## 12. Gerar de novo

```
python3 tools/build_assets.py --previews   # modelos, texturas, animações, sons, partículas, entidades
python3 tools/package_mcaddon.py           # dist/Hacknd.mcaddon + fonte
python3 tools/build_site.py                # site/index.html (página de download)
```
