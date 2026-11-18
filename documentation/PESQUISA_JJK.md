# Pesquisa: Jujutsu Kaisen (Técnica das Dez Sombras)

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

## O que está implementado (v3.0)
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
