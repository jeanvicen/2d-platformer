# Pesquisa: Jujutsu Kaisen (v4: clãs, técnicas, Sukuna, arsenal)

Mod de fã, pessoal e sem fins comerciais. Jujutsu Kaisen pertence a Gege Akutami / Shueisha (anime: MAPPA).
Nenhum arquivo do anime, mangá ou de jogos foi usado: modelos, texturas, sons e textos do mod são originais.

## Como a pesquisa foi feita (e os limites dela)
- O wiki da fandom (`jujutsu-kaisen.fandom.com`) **não pôde ser acessado** desta sessão: o host está fora da
  rede permitida. Para checar os detalhes com citações de capítulo, libere esse host nas configurações de rede do
  ambiente e rode a pesquisa de novo.
- As fontes usadas são guias e matérias de sites de anime (lista no fim). A maioria é secundária, então **não
  coloquei número de capítulo/episódio onde não consegui confirmar**. Onde as fontes discordam, o mod marca
  como `[interpretação]`.
- Cada item do mod tem um rótulo (no código: `scripts/jujutsu/canon.ts`; no jogo: Selo → Caderno):
  - **cânone**: confirmado na obra;
  - **interpretação**: a obra não deixa claro, ou as fontes discordam, e o mod escolheu um jeito;
  - **original do mod**: criado aqui.

## Shikigamis
| Shikigami (id interno) | O que é confirmado | No mod | Rótulo |
|---|---|---|---|
| Cães Divinos: Branco e Preto (`dog_white`, `wolf`) | Par de cães, faro e rastreamento; primeiro shikigami de quem herda a técnica | Começam liberados, invocados em par; rastreiam e avisam onde está o inimigo; mordida que prende | cânone |
| Cão Divino: Totalidade (`totality`) | Surge quando um Cão Divino é destruído e o outro herda o poder dele | Só aparece por herança, quando um dos cães é destruído; maior e mais forte | cânone |
| Nue (`owl`) | Ave com mobilidade aérea e ataques elétricos | Mergulho com descarga elétrica (paralisa); amortece a sua queda | cânone; amortecer queda = interpretação |
| Grande Serpente (`serpent`) | Serpente enorme que emerge da sombra para morder e prender | Surge embaixo do alvo e o prende | cânone |
| Sapo (`toad`) | Agarra e puxa alvos com a língua | Puxa inimigos; resgata o dono ferido | língua = cânone; resgate = interpretação |
| Elefante Máximo (`elephant`) | Grande invocação de água, custo alto | Jato de água em área que empurra; custo 60 | cânone |
| Fuga dos Coelhos (`rabbit`) | Muitos coelhos para distrair e cobrir a visão; força individual quase nula | Cria 6 cópias por 20 s e cega inimigos | cânone |
| Veado Redondo (`deer`) | Cura com energia positiva (técnica reversa) | Cura você e os aliados e limpa efeitos ruins | cura = cânone; limpar efeitos = interpretação (representa a anulação de técnicas) |
| Boi Perfurante (`bull`) | Só investe em linha reta; mais forte quanto maior a distância | Dano = 4 + 1,1 × distância (até 15 blocos) | cânone |
| Funeral do Tigre (`tiger`) | Existe, mas as capacidades próprias aparecem pouco | "Bote Fúnebre" (salto + golpe + fraqueza) | shikigami = cânone; habilidade = **original do mod** |
| Mahoraga (`colossus`) | General Divino; adapta-se a fenômenos, a roda gira durante a adaptação; espada com energia positiva; nenhum usuário o domou antes de Sukuna (no corpo de Megumi) | Só por ritual (domínio 5, 150 de energia). A roda gira 45° a cada golpe; com 4 golpes do mesmo tipo ele se adapta e ignora aquele dano; espada muito forte contra mortos-vivos | adaptação e roda = cânone; "4 giros" = interpretação; **domar vencendo o ritual = rota original do mod** |
| Leão / Dragão de Sombra (`lion`, `dragon`) | Não existem nas Dez Sombras | Criações da "Forja de Sombras" | **original do mod** |

### Regras da técnica
| Regra | Fonte | No mod |
|---|---|---|
| Os outros shikigamis são obtidos vencendo um ritual de exorcismo | cânone | Selo → Shikigami → Iniciar ritual. Ele aparece selvagem e ataca você |
| Se outra pessoa entra na luta, o ritual é anulado | cânone (resumo) | Dano de outro jogador, de companheiras ou de sombras de outro dono anula |
| Shikigami destruído não pode ser invocado de novo; o poder dele é herdado | cânone | **Modo Cânone** (padrão): destruído some de vez; cão destruído libera a Totalidade; os outros dão vida extra aos que restam (esse bônus é interpretação). **Modo Livre**: eles voltam |
| Guardar objetos na sombra | cânone (Megumi guarda ferramentas) | Até 9 pilhas, 5 de energia por vez |
| Mover-se pelas sombras | cânone (afundar na sombra) | Teleporte até 16 blocos para onde você olha (alcance = interpretação) |
| Fusões: Fuchiseitei (Sapo + Nue), Besta Fundida Agito (Sukuna) | fontes discordam sobre os componentes de Agito | **Não implementadas ainda** |

## Técnicas gerais
| Técnica | Conceito | Efeito no jogo |
|---|---|---|
| Reforço com energia amaldiçoada | cânone | Força + velocidade enquanto ligado (1/s) — efeito original |
| Black Flash | cânone (o dano sobe à potência 2,5) | Chance pequena por golpe (sobe com o domínio); dano extra grande e devolve energia — interpretação |
| Domínio Simples | cânone (anula o acerto garantido de um domínio) | Resistência e limpeza de efeitos (2/s) — efeito original |
| Técnica Reversa | cânone | Cura instantânea + regeneração — efeito original |
| Expansão de Domínio: Jardim Sombrio da Quimera | cânone (domínio incompleto de Megumi, chão de sombras, mais shikigamis) | 30 s, raio 12: inimigos lentos e cegos, shikigamis mais fortes, invocar custa metade — efeito original |

## Clãs
| Clã | Técnica (cânone) | No mod |
|---|---|---|
| Zenin | Dez Sombras; Feitiçaria de Projeção (nem todo membro tem a mesma técnica) | Dez Sombras jogável; Projeção ainda não |
| Gojo | Ilimitado + Seis Olhos | Ainda não |
| Kamo | Manipulação de Sangue | Ainda não |
| Inumaki | Fala Amaldiçoada | Ainda não |


## Clãs (v4)
| Clã | O que é confirmado | No mod | Rótulo |
|---|---|---|---|
| Gojo | Um dos Três Grandes; Ilimitado e Seis Olhos | Roleta 3% (lendário) | cânone; chance = original |
| Zenin | Um dos Três Grandes; valoriza Dez Sombras e Feitiçaria de Projeção; Maki/Toji têm Restrição Celestial | Roleta 22%: Dez Sombras 40%, Projeção 35%, Restrição 25% | cânone; chances = original |
| Kamo | Um dos Três Grandes; Manipulação de Sangue | Roleta 18% | cânone; chance = original |
| Inumaki | Fala Amaldiçoada; não é um dos Três Grandes | Roleta 12% | cânone; chance = original |
| Sem clã | Boneco de Palha (Nobara), Boogie Woogie (Todo), Proporção (Nanami), Construção (Mai) existem na obra | Agrupados como "sem clã", 45% | técnicas = cânone; agrupamento = original |

## Técnicas inatas e habilidades
Os conceitos são da obra. Números (dano, custo, raio, duração) e a forma de jogar são do mod.
- **Ilimitado:** Infinito, Azul (atração), Vermelho (repulsão), Roxo (combinação). Domínio: Vazio Infinito. Os Seis Olhos reduzem o gasto de energia (no mod: metade).
- **Feitiçaria de Projeção:** regra dos 24 quadros por segundo; quem falha fica congelado num quadro.
- **Restrição Celestial:** sem energia amaldiçoada, com físico sobre-humano. "Vigor" é original do mod.
- **Manipulação de Sangue:** Sangue Perfurante, Supernova, Amarração Carmesim, Escamas Vermelhas Fluentes.
- **Fala Amaldiçoada:** ordens com contragolpe na garganta. O usuário toma remédio para a garganta.
- **Boneco de Palha:** pregos, Ressonância, Grampo.
- **Boogie Woogie:** troca de posição com uma palma.
- **Proporção:** ponto 7:3, Hora Extra (voto de restrição), Colapso.
- **Construção:** cria matéria com custo alto.
- **Santuário (Sukuna):** Desmantelar (corte básico) e Clivar (ajusta-se à resistência do alvo). Fuga ("Abrir") tem detalhes que as fontes não fecham, então é marcado como interpretação. Domínio: Santuário Malevolente, sem barreira.
- **Gerais:** Reforço, Black Flash, Domínio Simples, Técnica Reversa.

## Dedos de Sukuna
| Fato | Fonte | No mod |
|---|---|---|
| A alma de Sukuna foi selada em 20 dedos indestrutíveis | cânone | 20 por mundo, caem raramente (1,2%) de inimigos derrotados por você ou seus shikigamis |
| Comer um dedo é veneno mortal para quase todos; Yuji é uma exceção | cânone | 25% de chance de virar receptáculo; se falhar, você sobrevive com pouca vida (original) |
| Mais dedos = mais poder de Sukuna | cânone | Cada dedo: +10 de energia máxima e +4% de influência; libera Clivar (3), Fuga (10) e o domínio (15) |
| Sukuna assume o corpo do receptáculo | cânone (com Yuji e Megumi) | Possessão de 12 s com influência alta e vida baixa; meditar reduz a influência (original) |

## Ferramentas amaldiçoadas e uniformes
| Item | Confirmado | Efeito no jogo |
|---|---|---|
| Nuvem Brincalhona | bastão de três seções sem técnica própria, amplifica a força | empurrão enorme; +dano com Restrição Celestial |
| Lança Invertida do Céu | anula técnicas ao tocar | tira os efeitos do alvo e fura a adaptação do Mahoraga (interpretação) |
| Katana Alma Dividida | corta a alma, ignora a resistência física | dano extra que ignora armadura e corta regeneração (interpretação) |
| Osso de Dragão | mencionado nas fontes, sem detalhe confirmado | guarda o dano recebido e solta no próximo golpe (interpretação) |
| Demônio Matador | faca amaldiçoada | dano dobrado contra mortos-vivos (original) |
| Uniformes de Tóquio/Kyoto, venda preta | visual da obra | roupas vestíveis com proteção leve (original) |

## Fontes adicionais (v4)
- Sportskeeda, técnicas herdadas: https://sportskeeda.com/anime/every-inherited-innate-cursed-technique-jujutsu-kaisen-season-1
- Epicdope, os três grandes clãs: https://www.epicdope.com/who-are-the-top-3-clans-in-jjk-and-how-do-they-operate
- AnimeHunch, guia de técnicas: https://animehunch.com/cursed-technique-guide-jujutsu-kaisen/
- Comicbook, ferramentas amaldiçoadas: https://comicbook.com/anime/list/10-most-powerful-cursed-tools-in-jujutsu-kaisen-ranked
- Sportskeeda, ferramentas amaldiçoadas: https://www.sportskeeda.com/anime/9-powerful-cursed-tools-jujutsu-kaisen-ranked
- AnimeHunch, Santuário Malevolente: https://animehunch.com/what-does-sukunas-malevolent-shrine-do-in-jujutsu-kaisen/
- Sportskeeda, técnica de Sukuna: https://sportskeeda.com/anime/jujutsu-kaisen-ryomen-sukuna-s-cursed-technique-explained

## O que está implementado (v3.0, Dez Sombras)
**Pronto:** Selo das Dez Sombras com menu por toque (Shikigamis, Técnicas e Habilidades, Ordens, Esquadrão, Sombra,
Clã, Caderno, Configurações, Recolher tudo); energia amaldiçoada com barra, recarga e domínio da técnica (níveis 0–10);
14 shikigamis com modelos, texturas e 9 animações próprias cada; rituais de exorcismo; destruição e herança
(Totalidade); adaptação do Mahoraga com a roda girando; 7 técnicas; Modo Cânone e Modo Livre; posse por id do
jogador validada no servidor; 6 companheiras originais com a IA de esquadrão das versões anteriores.

**Parcial:** sinal de mãos (aparece como texto, o modelo do jogador não muda sem substituir a animação dele);
invocação "saindo da sombra" (poça de sombra + subida do chão, sem câmera cinematográfica).

**Ainda não feito (próximas fases):** personagens da obra como companheiros (Yuji, Megumi, Gojo...), outros clãs e
técnicas, Feitiçaria de Projeção, fusões (Fuchiseitei, Agito), maldições com graus, dedos de Sukuna e possessão
narrativa, missões, mapa e locais (escolas de Tóquio/Kyoto, colônias), roupas e personalização, Forja de Sombras com
editor por texto, autorização de aliados em cooperação.

**Não é possível no Bedrock (com API estável):** trocar a animação do jogador pelo script, câmera cinematográfica sem
travar o celular, ler o chat (por isso o comando `/sombra`).

## Fontes consultadas
- Beebom, "Jujutsu Kaisen: Megumi's Ten Shadows Technique Explained": https://beebom.com/jujutsu-kaisen-megumi-ten-shadows-technique-explained/amp/
- Beebom, "Mahoraga's Powers and Abilities in Jujutsu Kaisen": https://beebom.com/mahoraga-jujutsu-kaisen-powers-abilities-explained/amp/
- We Got This Covered, "All of Megumi's Shikigami From the Anime and the Manga, Explained": https://wegotthiscovered.com/?p=1631282
- Sportskeeda, "Chimera Shadow Garden: Fushiguro Megumi's Domain Expansion": https://sportskeeda.com/anime/chimera-shadow-garden-fushiguro-megumi-s-domain-expansion-jujutsu-kaisen-far
- Game Rant, "Megumi's half-baked Domain Expansion: Chimera Shadow Garden": https://gamerant.com/jujutsu-kaisen-megumi-fushiguro-half-baked-domain-expansion-chimera-shadow-garden-explained/
- Sportskeeda, capítulos 233 e 234 (Agito, Shinjuku): https://www.sportskeeda.com/anime/jujutsu-kaisen-chapter-233-sukuna-s-new-shikigami-leaves-gojo-uncertain-fate e https://www.sportskeeda.com/anime/jujutsu-kaisen-chapter-234-spoilers-raw-scans-gojo-suffers-major-injury-trying-destroy-sukuna-s-trump-card
- Sportskeeda, "The idea of taming Mahoraga...": https://sportskeeda.com/anime/the-idea-taming-mahoraga-jujutsu-kaisen-s-biggest-plot-hole
- AniHK, "Megumi Fushiguro shikigami: Ten Shadows Technique explained": https://anihk.com/en/blogs/characters/megumi-fushiguro-shikigami-ten-shadows-technique-explained

## O que está implementado (v4.0)
**Pronto:**
- roleta de clã animada ao entrar, com giros extras;
- 5 clãs e 10 técnicas inatas com 40 habilidades no total (inclui gerais e Santuário), com efeitos de partículas;
- 3 Expansões de Domínio;
- Restrição Celestial com Vigor;
- garganta e xarope da Fala Amaldiçoada;
- 20 Dedos de Sukuna: receptáculo, influência, possessão e meditação;
- 5 ferramentas amaldiçoadas, 4 peças de roupa vestíveis e forja pelo Grimório;
- Fragmentos Amaldiçoados;
- Grimório Jujutsu com seções e ícones;
- Dez Sombras completas (v3);
- companheiras humanas removidas.

**Ainda não feito:**
- personagens da obra como NPCs;
- maldições próprias com graus (os inimigos são os monstros do Minecraft);
- missões, mapa, escolas e colônias;
- fusões de shikigamis;
- a Feitiçaria de Projeção como domínio;
- outras técnicas da obra (Copiar de Yuta, Manipulação de Espíritos Amaldiçoados etc.);
- mudar o visual do personagem além das roupas.
