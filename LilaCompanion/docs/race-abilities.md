# Os 600 poderes das raças (100 por raça)

Gerado de `behavior_pack/scripts/race/kits/*.js` (fonte única) por `tools/gen_race_doc.mjs`. Todos os 100 de cada raça ficam liberados; a barra tem **18 lugares** (2 páginas de 9 no painel da direita: a barra de itens 1–9 escolhe e bater usa). O autoteste executa os 600 no servidor e exige efeito real em cada um.

⭐ = **poder assinatura** (3.2): mecânica e visual próprios, inspirados no folclore/mitologia da raça — os 10 de cada raça já vêm na barra.

## Tabela de equilíbrio (núcleo)

| Raça | Chance | Regeneração | Resistência | Força | Velocidade | Arma | Ponto fraco |
|---|---|---|---|---|---|---|---|
| Vampiro | 28% | 2× | 1× | 1× | 2× (5× na Rajada) | — | Luz do sol direta (capacete ou forma de morcego protegem). |
| Gigante | 24% | 1× | 3× | 3× | 3× | — | Grande demais para túneis, portas e tetos baixos. |
| Anjo | 22% | 5× | 1× | 1× | voo | — | Golpes de demônios e das trevas ferem 50% mais; no Nether a graça não volta. |
| Demônio | 24% | 5× | 1× | 1× | voo | — | Golpes sagrados ferem 50% mais; na água/chuva a regeneração e a imunidade a fogo param. |
| DEUS | 1% | 10× | 1× | 1× | voo | Lâmina Divina 30 | Golpes das trevas ferem 50% mais; poderes caros. |
| TREVAS | 1% | 10× (pulsos de 9 a cada 4 s) | 20× (10× no sol) | 1× | voo | Foice do Vazio 35 | No sol direto a resistência cai para 10×; golpes sagrados ferem o dobro. |

Regeneração base de um jogador: ~1 ponto a cada 4 s (0,25/s); "N×" = o jogo dá 1× e o script soma (N−1)× em pulsos. Valores em `behavior_pack/scripts/race/data.js` (BAL).

## Poderes assinatura (10 por raça)

### Vampiro

| Poder | Categoria | Recarga | Custo | O que faz |
|---|---|---|---|---|
| ⭐ Forma de Névoa | Transformação | 18s | 20 | Vira névoa rubra por 6 s: invisível, rápido, NÃO leva dano nem queima no sol. Volta com um estouro de sangue. |
| ⭐ Olhar Hipnótico | Controle | 25s | 25 | Olhar hipnótico: a criatura na mira vira sua serva por 15 s — não te ataca e parte para cima dos outros monstros (eles revidam nela). |
| ⭐ Revoada de Morcegos | Ataque | 16s | 22 | Solta uma revoada de 6 morcegos de sangue que caçam os inimigos sozinhos; cada mordida rouba vida para você. |
| ⭐ Banquete Rubro | Ataque | 20s | 25 | Banquete Rubro: por 3 s suga TODOS os inimigos em volta (8 blocos) ao mesmo tempo, com fios de sangue até a sua boca. |
| ⭐ Lua de Sangue | Suprema | 240s | 100 | SUPREMA: a noite cai na hora e a lua fica rubra. 20 s de força, regeneração e cada golpe seu rouba 30% em vida. |
| ⭐ Matilha Noturna | Apoio | 60s | 35 | Chama uma matilha de 3 lobos domados que lutam por você por 30 s e depois somem na névoa. |
| ⭐ Garras Carmesins | Ataque | 12s | 18 | Garras Carmesins: salta de inimigo em inimigo (até 5), rasgando cada um e fazendo sangrar. |
| ⭐ Passo da Noite | Movimento | 9s | 14 | Passo da Noite: aparece nas costas do alvo e crava as presas (golpe forte + cegueira). |
| ⭐ Sono do Caixão | Defesa | 90s | 30 | Sono do Caixão: por 30 s, o golpe que te mataria vira névoa — você sobrevive com metade da vida. |
| ⭐ Lança Hemática | Ataque | 8s | 14 | Lança de sangue coagulado que atravessa até 3 inimigos, prende e faz sangrar; estoura em cristais rubros. |

### Gigante

| Poder | Categoria | Recarga | Custo | O que faz |
|---|---|---|---|---|
| ⭐ Terremoto de Ymir | Ataque | 18s | 30 | Terremoto de Ymir: três ondas de choque saem de você (4, 8 e 12 blocos), lançando tudo para o alto e rachando o chão. |
| ⭐ Rocha Arrancada | Ataque | 8s | 14 | Arranca uma rocha do chão e arremessa em arco: estoura em estilhaços, racha o chão e esmaga quem estiver perto. |
| ⭐ Pisão Colossal | Controle | 12s | 20 | Pisão Colossal: o chão afunda em volta — atordoa, lança e machuca tudo em 7 blocos. A tela treme. |
| ⭐ Mão de Jötunn | Controle | 10s | 16 | Mão de Jötunn: agarra a criatura na mira, ergue acima da cabeça e arremessa longe; ela esmaga quem estiver onde cair. |
| ⭐ Muralha da Montanha | Defesa | 20s | 20 | Muralha da Montanha: uma parede de pedra sobe do chão camada por camada na sua frente (some depois de 10 s). |
| ⭐ Sopro de Hrímthurs | Controle | 12s | 18 | Sopro de Hrímthurs (gigante de gelo): cone de geada que congela a água, deixa lento e machuca. |
| ⭐ Lâmina de Muspel | Ataque | 10s | 18 | Lâmina de Muspel (gigante de fogo): três cortes de fogo gigantes em volta que incendeiam tudo. |
| ⭐ Rugido Colossal | Controle | 16s | 15 | Rugido Colossal: os monstros em 14 blocos são jogados longe e ficam fracos de medo. |
| ⭐ Fúria Titânica | Suprema | 240s | 100 | SUPREMA: Fúria Titânica — você cresce AINDA MAIS (6,3×) por 15 s, com força e resistência enormes. |
| ⭐ Espinhos da Terra | Ataque | 9s | 16 | Espinhos da Terra: uma fileira de estalagmites brota do chão para a frente, furando e lançando quem estiver no caminho. |

### Anjo

| Poder | Categoria | Recarga | Custo | O que faz |
|---|---|---|---|---|
| ⭐ Julgamento | Ataque | 10s | 20 | Julgamento: um selo dourado marca o chão e uma coluna de luz desce do céu (sagrado: dobra contra trevas/demônios/mortos-vivos). |
| ⭐ Espada Flamejante do Querubim | Ataque | 8s | 16 | Espada Flamejante do Querubim: três cortes de fogo sagrado seguidos à sua frente. |
| ⭐ Trombeta Celestial | Controle | 18s | 22 | Trombeta Celestial: três ondas douradas atordoam os inimigos e curam os aliados. |
| ⭐ Asas Protetoras | Defesa | 20s | 18 | Asas Protetoras: você se cobre com as asas por 3 s e NÃO leva dano; quem bater é empurrado. |
| ⭐ Anjo da Guarda | Defesa | 120s | 40 | Anjo da Guarda: por 60 s, o golpe que te mataria é anulado — você volta com a vida cheia. |
| ⭐ Santuário | Apoio | 30s | 30 | Santuário: domo de luz de 7 blocos por 10 s. Monstros são expulsos e queimam; aliados regeneram. |
| ⭐ Tempestade de Penas | Ataque | 9s | 16 | Tempestade de Penas: 12 penas afiadas que perseguem os inimigos à sua frente. |
| ⭐ Ascensão | Movimento | 12s | 14 | Ascensão: sobe aos céus num salto de luz e, ao pousar, solta uma onda sagrada. |
| ⭐ Coro dos Serafins | Suprema | 240s | 100 | SUPREMA: Coro dos Serafins — 6 luzes giram em volta por 12 s disparando raios sagrados e curando aliados. |
| ⭐ Sopro da Vida | Apoio | 45s | 35 | Sopro da Vida: cura totalmente você e os aliados em 12 blocos, limpa efeitos ruins e dá escudo. |

### Demônio

| Poder | Categoria | Recarga | Custo | O que faz |
|---|---|---|---|---|
| ⭐ Pacto Infernal | Transformação | 45s | 0 | Pacto Infernal: paga 40% da sua vida atual e ganha 20 s de força III, velocidade e aura de fogo. |
| ⭐ Possessão | Controle | 25s | 25 | Possessão: a criatura na mira vira sua marionete por 15 s e ataca os outros; quando o demônio sai, ela explode. |
| ⭐ Correntes do Abismo | Controle | 14s | 20 | Correntes do Abismo: prende até 4 inimigos com correntes e depois arrasta todos até você. |
| ⭐ Portão do Inferno | Ataque | 20s | 28 | Portão do Inferno: abre um selo no chão que cospe gêiseres de fogo por 7 s. |
| ⭐ Chuva de Enxofre | Ataque | 16s | 26 | Chuva de Enxofre: 10 meteoros de fogo caem do céu na área mirada. |
| ⭐ Onda de Fogo Negro | Ataque | 9s | 16 | Onda de Fogo Negro: chamas negras correm pelo chão queimando e fazendo murchar. |
| ⭐ Marca da Danação | Ataque | 12s | 18 | Marca da Danação: marca o alvo (leva +25% de dano) e em 5 s ele explode em fogo infernal. |
| ⭐ Legião de Diabretes | Apoio | 40s | 30 | Legião: invoca 4 diabretes de fogo que voam em volta e atiram bolas de fogo nos inimigos. |
| ⭐ Asas de Brasa | Movimento | 7s | 10 | Asas de Brasa: dispara voando para a frente deixando um rastro de fogo que queima quem passa por perto. |
| ⭐ Coroa do Inferno | Suprema | 240s | 100 | SUPREMA: Coroa do Inferno — 15 s de arquidemônio: anel de fogo infernal em volta, força, resistência e medo. |

### DEUS

| Poder | Categoria | Recarga | Custo | O que faz |
|---|---|---|---|---|
| ⭐ Parar o Tempo | Controle | 90s | 60 | Parar o Tempo: por 6 s tudo em 24 blocos CONGELA no lugar (criaturas e flechas). Só você se mexe. |
| ⭐ Gênese | Apoio | 30s | 25 | Gênese: a vida brota em 10 blocos — plantações maduras, flores e grama — e os aliados se curam. |
| ⭐ Ira dos Céus | Ataque | 14s | 30 | Ira dos Céus: raios DE VERDADE caem em até 5 inimigos, com dano sagrado extra. |
| ⭐ Palavra Divina | Ataque | 40s | 50 | Palavra Divina: cada inimigo em 16 blocos perde 35% da vida máxima (chefes: dano fixo). |
| ⭐ Sol Nascente | Apoio | 35s | 35 | Sol Nascente: um pequeno sol aparece no alto por 10 s, ilumina, queima inimigos (mortos-vivos mais) e cura aliados. |
| ⭐ Criação | Defesa | 45s | 30 | Criação: ergue na hora um templo de cristal à sua volta (pilares e teto) por 20 s, onde você regenera. |
| ⭐ Coroa de Estrelas | Ataque | 25s | 30 | Coroa de Estrelas: 8 estrelas giram em volta por 10 s e disparam raios nos inimigos. |
| ⭐ Rebobinar | Movimento | 30s | 25 | Rebobinar: volta para onde você estava 5 s atrás, com a vida que tinha (se era maior). |
| ⭐ Juízo Final | Suprema | 240s | 100 | SUPREMA: Juízo Final — um selo imenso se abre e 12 colunas de luz caem por toda a área. |
| ⭐ Sopro Divino | Apoio | 60s | 40 | Sopro Divino: cura total, limpa efeitos ruins, escudo grande e resistência para você e aliados em 16 blocos. |

### TREVAS

| Poder | Categoria | Recarga | Custo | O que faz |
|---|---|---|---|---|
| ⭐ Buraco Negro | Controle | 30s | 40 | Buraco Negro: uma singularidade puxa tudo em 10 blocos por 5 s e no fim colapsa numa explosão. |
| ⭐ Eclipse | Transformação | 60s | 35 | Eclipse: 15 s de escuridão — você fica invisível e forte; os inimigos perto ficam cegos. |
| ⭐ Colheita de Almas | Ataque | 10s | 18 | Colheita de Almas: giro da foice em 360°; cada alma colhida orbita você e te cura. |
| ⭐ Passo do Vazio | Movimento | 8s | 12 | Passo do Vazio: rasga o espaço e aparece até 30 blocos à frente; quem estava no caminho é ferido e murcha. |
| ⭐ Sombras Vivas | Apoio | 35s | 30 | Sombras Vivas: 3 sombras suas saem caçando e golpeando os inimigos por 10 s. |
| ⭐ Entropia | Ataque | 12s | 18 | Entropia: o alvo apodrece por dentro (murchar forte e decomposição); se ficar fraco, vira cinza. |
| ⭐ Fenda do Vazio | Ataque | 14s | 22 | Fenda do Vazio: abre uma fenda de 12 blocos à frente — criaturas fracas viram cinza, as outras sofrem e ficam no escuro. |
| ⭐ Pesadelo | Controle | 16s | 20 | Pesadelo: o alvo fica paralisado de medo por 4 s e os outros perto fogem. |
| ⭐ Anular | Controle | 25s | 25 | Anular: tira os efeitos bons dos inimigos em 12 blocos, silencia e revela; limpa os seus efeitos ruins. |
| ⭐ Noite Sem Fim | Suprema | 240s | 100 | SUPREMA: Noite Sem Fim — domo de trevas de 10 blocos por 12 s que drena os inimigos para você e termina num colapso. |

## Vampiro (Sangue)

### Passiva (8)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 5 | Visão Escarlate | passiva | — | — | Passiva: visão noturna automática no escuro. |
| 83 | Predador Noturno | passiva | — | — | Passiva: +% de dano à noite. |
| 84 | Sanguessuga | passiva | — | — | Passiva: rouba vida em todo golpe. |
| 85 | Banquete do Abate | passiva | — | — | Passiva: cura ao abater. |
| 86 | Pés Silenciosos | passiva | — | — | Passiva: sem dano de queda. |
| 87 | Instinto Sombrio | passiva | — | — | Passiva: chance de esquivar de golpes. |
| 88 | Sangue Antigo | passiva | — | — | Passiva: resiste mais com pouca vida. |
| 89 | Velocidade Sobrenatural | passiva | — | — | Passiva: corre 2× mais rápido que um jogador. |

### Movimento (12)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 3 | Rajada Noturna | instantâneo | 22s | 20 | Rajada: sua velocidade vai a 5× a de um jogador normal por alguns segundos. |
| 4 | Salto da Lua | instantâneo | 6s | 8 | Super pulo de vampiro, sem dano de queda. |
| 13 | ⭐ Passo da Noite | instantâneo | 9s | 14 | Passo da Noite: aparece nas costas do alvo e crava as presas (golpe forte + cegueira). |
| 54 | Passo Sombrio | instantâneo | 5s | 8 | Teleporte · 12 blocos: velocidade 1. |
| 55 | Investida Predadora | instantâneo | 6s | 8 | Avanço · 12 blocos: 4 de dano. |
| 56 | Planar de Morcego | instantâneo | 14s | 8 | Em você: queda lenta, super pulo. |
| 57 | Troca de Sombras | alvo | 14s | 14 | Troca de lugar com o alvo · 16 blocos: cega. |
| 58 | Escalada Noturna | instantâneo | 9s | 10 | Salto com impacto · 10 blocos: 3 de dano, empurra. |
| 59 | Teia de Sombras | instantâneo | 12s | 12 | Gancho até a mira · 20 blocos: velocidade 2. |
| 60 | Mergulho Carmesim | instantâneo | 12s | 16 | Salta e cai com impacto · 12 blocos: 7 de dano, empurra. |
| 61 | Rastro de Névoa | instantâneo | 18s | 14 | Em você: velocidade 2, queda lenta. |
| 91 | Caçada Noturna | instantâneo | 10s | 12 | Avanço · 14 blocos: 5 de dano, revela. |

### Ataque (20)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 2 | Dreno de Sangue | segurar | 1s | 0 | Segure o Núcleo mirando numa criatura perto: suga o sangue até ela morrer (para se ela fugir, sair da mira ou você soltar). |
| 8 | ⭐ Revoada de Morcegos | instantâneo | 16s | 22 | Solta uma revoada de 6 morcegos de sangue que caçam os inimigos sozinhos; cada mordida rouba vida para você. |
| 9 | ⭐ Banquete Rubro | instantâneo | 20s | 25 | Banquete Rubro: por 3 s suga TODOS os inimigos em volta (8 blocos) ao mesmo tempo, com fios de sangue até a sua boca. |
| 12 | ⭐ Garras Carmesins | instantâneo | 12s | 18 | Garras Carmesins: salta de inimigo em inimigo (até 5), rasgando cada um e fazendo sangrar. |
| 15 | ⭐ Lança Hemática | instantâneo | 8s | 14 | Lança de sangue coagulado que atravessa até 3 inimigos, prende e faz sangrar; estoura em cristais rubros. |
| 16 | Mordida Carmesim | alvo | 5s | 8 | No alvo da mira · 3 blocos: 7 de dano, rouba 50% em vida. |
| 17 | Lâmina de Sangue | instantâneo | 4s | 10 | Projétil · 24 blocos: 8 de dano, sangramento 3s. |
| 18 | Leque de Espinhos Rubros | instantâneo | 7s | 14 | Leque de projéteis · 18 blocos · 5×: 4 de dano, sangramento 2s. |
| 19 | Chicote Hemático | instantâneo | 6s | 10 | Cone à frente · 6 blocos: 6 de dano, puxa. |
| 20 | Corte Fantasma | instantâneo | 7s | 12 | Avanço · 8 blocos: 7 de dano, cega. |
| 21 | Garras da Meia-Noite | instantâneo | 8s | 12 | Explosão ao redor · 4 blocos: 6 de dano, fraqueza 1. |
| 22 | Lança Coagulada | instantâneo | 9s | 16 | Raio em linha · 20 blocos: 9 de dano, lentidão 2. |
| 23 | Sangria Encadeada | alvo | 10s | 16 | Salta entre alvos · 12 blocos · 4×: 5 de dano, rouba 30% em vida. |
| 24 | Ferroada Vampírica | alvo | 6s | 8 | No alvo da mira · 4 blocos: 4 de dano, veneno. |
| 25 | Bumerangue Escarlate | instantâneo | 8s | 12 | Vai e volta · 16 blocos: 6 de dano, sangramento 2s. |
| 26 | Chuva Rubra | instantâneo | 14s | 24 | Chuva de impactos · 6 blocos · 8×: 5 de dano, sangramento 2s. |
| 27 | Golpe da Agonia | alvo | 12s | 18 | Puxa e golpeia · 6 blocos: 8 de dano, atordoa 1.0s. |
| 28 | Navalhas da Lua | duração | 16s | 20 | Lâminas girando · 3 blocos · 5s: 3 de dano. |
| 29 | Espiral de Morcegos | duração | 18s | 24 | Invocação · 6× · 6s: 3 de dano. |
| 93 | Beijo da Morte | alvo | 14s | 18 | Puxa e golpeia · 6 blocos: 6 de dano, murchar, rouba 40% em vida. |

### Defesa (14)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 14 | ⭐ Sono do Caixão | instantâneo | 90s | 30 | Sono do Caixão: por 30 s, o golpe que te mataria vira névoa — você sobrevive com metade da vida. |
| 30 | Escudo de Sangue | instantâneo | 20s | 20 | Em você: escudo. |
| 31 | Névoa Rubra | duração | 22s | 24 | Área persistente · 4 blocos · 5s: cega, invisível. |
| 32 | Pele de Pedra Noturna | instantâneo | 24s | 22 | Em você: resistência 1. |
| 33 | Recuo do Morcego | instantâneo | 8s | 10 | Teleporte · 8 blocos: resistência 1. |
| 34 | Véu de Sombra | instantâneo | 26s | 24 | Em você: invisível, velocidade 1. |
| 35 | Carapaça Coagulada | instantâneo | 28s | 26 | Em você: resistência 2, lentidão 1. |
| 36 | Reflexo Vampírico | instantâneo | 24s | 20 | Em você: devolve 5 de dano. |
| 37 | Sangue Frio | instantâneo | 30s | 18 | Em você: limpa efeitos ruins, imune a fogo. |
| 38 | Barreira de Ossos | duração | 22s | 20 | Muro · 4 blocos · 6s: lentidão 1. |
| 39 | Fuga Enevoada | instantâneo | 12s | 14 | Teleporte · 10 blocos: cega, invisível. |
| 40 | Transfusão | instantâneo | 26s | 30 | Em você: cura 8. |
| 41 | Sede Protetora | instantâneo | 28s | 26 | Em você: regeneração 2. |
| 90 | Sangue Espelhado | instantâneo | 26s | 22 | Em você: +6 de vida extra, devolve 3 de dano. |

### Utilidade (11)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 62 | Farejar Presas | instantâneo | 16s | 6 | Revela criaturas · 32 blocos: revela. |
| 63 | Sentir Sangue | instantâneo | 20s | 8 | Revela criaturas · 16 blocos: revela, lentidão 1. |
| 64 | Fome Saciada | instantâneo | 30s | 10 | Em você: sacia a fome. |
| 65 | Chamado dos Morcegos | duração | 24s | 16 | Invocação · 4× · 8s: cega. |
| 66 | Olhos na Treva | instantâneo | 20s | 4 | Em você: visão noturna. |
| 67 | Selo da Cripta | duração | 24s | 18 | Muro · 3 blocos · 8s: resistência 1. |
| 68 | Coleta Sanguínea | instantâneo | 18s | 6 | Puxa itens · 10 blocos: sacia a fome. |
| 69 | Marca do Caçador | alvo | 12s | 6 | Marca · 24 blocos: marca (+25% dano), revela, lentidão 1. |
| 70 | Fôlego Eterno | instantâneo | 24s | 6 | Em você: respira na água. |
| 71 | Sombra Silenciosa | instantâneo | 40s | 20 | Em você: invisível. |
| 94 | Selo de Sangue | duração | 14s | 12 | Armadilha · 12 blocos · 10s: sangramento 4s, revela. |

### Apoio (8)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 11 | ⭐ Matilha Noturna | instantâneo | 60s | 35 | Chama uma matilha de 3 lobos domados que lutam por você por 30 s e depois somem na névoa. |
| 72 | Frenesi Carmesim | instantâneo | 26s | 24 | Em você: força 1, velocidade 1. |
| 73 | Sede Insaciável | instantâneo | 28s | 22 | Em você: pressa, força 1. |
| 74 | Pacto de Sangue | instantâneo | 22s | 20 | Em você e aliados · 8 blocos: cura 6, regeneração 1. |
| 75 | Ritual da Lua Cheia | instantâneo | 34s | 30 | Em você: regeneração 1, resistência 1. |
| 76 | Banquete | instantâneo | 20s | 24 | Explosão ao redor · 5 blocos: 3 de dano, rouba 80% em vida. |
| 77 | Coração Negro | instantâneo | 30s | 26 | Em você: +8 de vida extra. |
| 95 | Crepúsculo | instantâneo | 30s | 12 | Em você: visão noturna, velocidade 1, super pulo. |

### Controle (14)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 7 | ⭐ Olhar Hipnótico | instantâneo | 25s | 25 | Olhar hipnótico: a criatura na mira vira sua serva por 15 s — não te ataca e parte para cima dos outros monstros (eles revidam nela). |
| 42 | Olhar Paralisante | alvo | 16s | 20 | No alvo da mira · 12 blocos: atordoa 2.5s. |
| 43 | Grito Noturno | instantâneo | 18s | 20 | Explosão ao redor · 6 blocos: medo, fraqueza 1. |
| 44 | Correntes de Sangue | alvo | 14s | 18 | No alvo da mira · 14 blocos: prende 3.0s, sangramento 2s. |
| 45 | Nuvem de Morcegos | duração | 20s | 22 | Área persistente · 5 blocos · 6s: cega, lentidão 1. |
| 46 | Puxão Hemático | instantâneo | 12s | 16 | pull · 10 blocos: puxa, lentidão 1. |
| 47 | Maldição da Lua | alvo | 14s | 10 | Marca · 18 blocos: marca (+25% dano), revela. |
| 48 | Escuridão Total | instantâneo | 24s | 24 | Explosão ao redor · 8 blocos: escuridão, cega. |
| 49 | Prisão Carmesim | duração | 16s | 18 | Armadilha · 12 blocos · 10s: prende 4.0s, 4 de dano. |
| 50 | Silêncio da Cripta | alvo | 20s | 22 | No alvo da mira · 12 blocos: silencia 5.0s, fraqueza 2. |
| 51 | Vórtice de Sangue | duração | 18s | 24 | Redemoinho · 6 blocos · 4s: puxa, 2 de dano. |
| 52 | Hipnose em Massa | instantâneo | 22s | 28 | Cone à frente · 7 blocos: atordoa 1.5s. |
| 53 | Arrasto da Noite | alvo | 14s | 16 | Puxa e golpeia · 8 blocos: lentidão 3. |
| 92 | Revoada | instantâneo | 14s | 16 | Cone à frente · 7 blocos: cega, empurra. |

### Transformação (7)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 1 | Forma de Morcego | instantâneo | 2s | 0 | Vira um morcego de verdade (pequeno, voa, imune ao sol). Usar de novo volta ao normal. |
| 6 | ⭐ Forma de Névoa | instantâneo | 18s | 20 | Vira névoa rubra por 6 s: invisível, rápido, NÃO leva dano nem queima no sol. Volta com um estouro de sangue. |
| 78 | Aura da Noite | alternar | 1s | 0 | Aura (liga/desliga) · 5 blocos: fraqueza 1. |
| 79 | Forma Bestial | instantâneo | 40s | 40 | Em você: força 2, velocidade 2, resistência 1. |
| 80 | Véu de Névoa | instantâneo | 36s | 34 | Em você: invisível, resistência 3, velocidade 1. |
| 81 | Asas de Morcego | instantâneo | 26s | 20 | Em você: levita, queda lenta. |
| 82 | Dança das Lâminas | duração | 24s | 28 | Lâminas girando · 2.5 blocos · 7s: 4 de dano, sangramento 2s. |

### Suprema (6)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 10 | ⭐ Lua de Sangue | instantâneo | 240s | 100 | SUPREMA: a noite cai na hora e a lua fica rubra. 20 s de força, regeneração e cada golpe seu rouba 30% em vida. |
| 96 | Eclipse Sangrento | instantâneo | 90s | 60 | Explosão ao redor · 10 blocos: 14 de dano, sangramento 5s, cega, rouba 40% em vida. |
| 97 | Lua Carmesim | duração | 80s | 60 | Área persistente · 10 blocos · 10s: 3 de dano, fraqueza 2, regeneração 2. |
| 98 | Rei dos Morcegos | duração | 85s | 60 | Invocação · 14× · 10s: 5 de dano, cega. |
| 99 | Sede de Mil Anos | alvo | 75s | 55 | Salta entre alvos · 16 blocos · 8×: 9 de dano, sangramento 3s, rouba 50% em vida. |
| 100 | Noite Eterna | instantâneo | 95s | 70 | Explosão ao redor · 14 blocos: escuridão, atordoa 2.0s, 8 de dano. |

## Gigante (Fúria)

### Passiva (11)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 1 | Passada Colossal | passiva | — | — | Passiva: passadas que tremem o chão. |
| 2 | Força de Três Golens | passiva | — | — | Passiva: 3× a força de um jogador. |
| 3 | Pele de Montanha | passiva | — | — | Passiva: 3× a resistência de um jogador. |
| 4 | Mãos de Pedreira | passiva | — | — | Passiva: quebra blocos com estilhaços gigantes. |
| 85 | Peso Esmagador | passiva | — | — | Passiva: cair de alto causa impacto. |
| 86 | Ossos de Bronze | passiva | — | — | Passiva: não é empurrado. |
| 87 | Fúria Acumulada | passiva | — | — | Passiva: mais dano quanto menos vida. |
| 88 | Coração de Montanha | passiva | — | — | Passiva: resiste mais com pouca vida. |
| 89 | Raiz Firme | passiva | — | — | Passiva: sem dano de queda. |
| 90 | Mão Pesada | passiva | — | — | Passiva: golpes arremessam longe. |
| 91 | Calor da Forja | passiva | — | — | Passiva: imune a fogo e lava. |

### Movimento (9)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 56 | Salto Gigante | instantâneo | 8s | 10 | Salto com impacto · 14 blocos: 5 de dano, empurra. |
| 57 | Corrida Estrondosa | instantâneo | 16s | 12 | Em você: velocidade 2, super pulo. |
| 58 | Arremessar-se | instantâneo | 6s | 8 | Avanço · 14 blocos: 3 de dano. |
| 59 | Ponte de Pedra | instantâneo | 14s | 10 | Ponte temporária · 12 blocos · 15s: efeito especial. |
| 60 | Escalada Rochosa | instantâneo | 14s | 8 | Em você: super pulo, queda lenta. |
| 61 | Investida de Aríete | instantâneo | 11s | 14 | Avanço · 12 blocos: 6 de dano, empurra, atordoa 0.5s. |
| 62 | Queda Meteórica | instantâneo | 12s | 16 | Salta e cai com impacto · 14 blocos: 9 de dano, lança para o alto. |
| 63 | Passo Telúrico | instantâneo | 8s | 10 | Teleporte · 10 blocos: resistência 1. |
| 94 | Pedra Lisa | instantâneo | 14s | 10 | Em você: velocidade 3, queda lenta. |

### Ataque (21)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 5 | ⭐ Terremoto de Ymir | instantâneo | 18s | 30 | Terremoto de Ymir: três ondas de choque saem de você (4, 8 e 12 blocos), lançando tudo para o alto e rachando o chão. |
| 6 | ⭐ Rocha Arrancada | instantâneo | 8s | 14 | Arranca uma rocha do chão e arremessa em arco: estoura em estilhaços, racha o chão e esmaga quem estiver perto. |
| 11 | ⭐ Lâmina de Muspel | instantâneo | 10s | 18 | Lâmina de Muspel (gigante de fogo): três cortes de fogo gigantes em volta que incendeiam tudo. |
| 14 | ⭐ Espinhos da Terra | instantâneo | 9s | 16 | Espinhos da Terra: uma fileira de estalagmites brota do chão para a frente, furando e lançando quem estiver no caminho. |
| 15 | Soco Sísmico | instantâneo | 5s | 8 | Cone à frente · 5 blocos: 9 de dano, empurra. |
| 16 | Pisada Sísmica | instantâneo | 7s | 12 | Explosão ao redor · 5 blocos: 8 de dano, lança para o alto. |
| 17 | Arremesso de Rocha | instantâneo | 8s | 12 | Projétil em arco · 22 blocos: 10 de dano, empurra. |
| 18 | Onda de Choque | instantâneo | 9s | 14 | Onda pelo chão · 16 blocos: 7 de dano, lança para o alto. |
| 19 | Martelo de Punhos | instantâneo | 10s | 16 | Salta e cai com impacto · 6 blocos: 11 de dano, atordoa 1.0s. |
| 20 | Agarrar e Esmagar | alvo | 12s | 18 | Puxa e golpeia · 5 blocos: 9 de dano, atordoa 1.5s. |
| 21 | Chute de Avalanche | instantâneo | 8s | 12 | Cone à frente · 4 blocos: 7 de dano, empurra, lança para o alto. |
| 22 | Coluna de Pedra | instantâneo | 10s | 14 | Coluna sob o alvo · 16 blocos: 8 de dano, lança para o alto. |
| 23 | Chuva de Pedregulhos | instantâneo | 14s | 22 | Chuva de impactos · 7 blocos · 10×: 6 de dano, lentidão 1. |
| 24 | Rolo Compressor | instantâneo | 9s | 14 | Avanço · 10 blocos: 8 de dano, empurra. |
| 25 | Palmas do Trovão | instantâneo | 12s | 18 | Explosão ao redor · 4 blocos: 5 de dano, atordoa 1.3s, empurra. |
| 26 | Lança de Estalagmite | instantâneo | 10s | 14 | Raio em linha · 18 blocos: 9 de dano, lança para o alto. |
| 27 | Bumerangue de Laje | instantâneo | 9s | 12 | Vai e volta · 16 blocos: 8 de dano, lentidão 1. |
| 28 | Fragmentos de Granito | instantâneo | 7s | 10 | Leque de projéteis · 18 blocos · 6×: 4 de dano, empurra. |
| 29 | Terremoto | duração | 22s | 26 | Área persistente · 8 blocos · 5s: 3 de dano, lentidão 2. |
| 30 | Punho Meteoro | instantâneo | 14s | 22 | Meteoro · 12 blocos: 12 de dano, empurra. |
| 31 | Moinho Gigante | duração | 18s | 22 | Lâminas girando · 3.5 blocos · 5s: 4 de dano, empurra. |

### Defesa (14)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 9 | ⭐ Muralha da Montanha | instantâneo | 20s | 20 | Muralha da Montanha: uma parede de pedra sobe do chão camada por camada na sua frente (some depois de 10 s). |
| 32 | Postura Inabalável | instantâneo | 22s | 20 | Em você: resistência 2, lentidão 1. |
| 33 | Muralha de Pedra | duração | 18s | 18 | Muro · 5 blocos · 8s: empurra. |
| 34 | Pele de Basalto | instantâneo | 26s | 22 | Em você: resistência 1, imune a fogo. |
| 35 | Escudo de Laje | instantâneo | 24s | 22 | Em você: escudo. |
| 36 | Couraça de Bronze | instantâneo | 30s | 26 | Em você: +12 de vida extra. |
| 37 | Rugido Defensivo | instantâneo | 20s | 18 | Explosão ao redor · 6 blocos: fraqueza 1, resistência 1. |
| 38 | Raízes de Pedra | instantâneo | 28s | 20 | Em você: resistência 3, prende 3.0s. |
| 39 | Contra-Ataque | instantâneo | 22s | 20 | Em você: devolve 6 de dano. |
| 40 | Domo de Rocha | duração | 30s | 28 | Domo · 3 blocos · 8s: resistência 1. |
| 41 | Cicatrização Telúrica | instantâneo | 26s | 24 | Em você: regeneração 2. |
| 42 | Ombro Blindado | instantâneo | 10s | 10 | Avanço · 6 blocos: empurra, resistência 1. |
| 43 | Pedra Viva | instantâneo | 30s | 30 | Em você: cura 10. |
| 93 | Bastião Vivo | instantâneo | 26s | 24 | Em você e aliados · 8 blocos: +4 de vida extra, resistência 1. |

### Utilidade (10)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 64 | Sentir Vibrações | instantâneo | 16s | 6 | Revela criaturas · 32 blocos: revela. |
| 65 | Escavar Túnel | instantâneo | 10s | 8 | Túnel · 6 blocos: efeito especial. |
| 66 | Erguer Plataforma | instantâneo | 14s | 10 | Plataforma temporária · 3 blocos · 20s: efeito especial. |
| 67 | Força de Carga | instantâneo | 26s | 12 | Em você: pressa. |
| 68 | Abrir Caminho | instantâneo | 12s | 10 | Abre caminho · 4 blocos: efeito especial. |
| 69 | Fome de Gigante | instantâneo | 30s | 10 | Em você: sacia a fome. |
| 70 | Faro de Minério | instantâneo | 20s | 8 | Revela minérios · 12 blocos: efeito especial. |
| 71 | Aspirar Destroços | instantâneo | 16s | 6 | Puxa itens · 12 blocos: efeito especial. |
| 72 | Fogueira de Pedra | instantâneo | 24s | 6 | Em você: imune a fogo, visão noturna. |
| 73 | Vigia da Montanha | instantâneo | 30s | 10 | Em você: visão noturna, resistência 1. |

### Apoio (6)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 74 | Grito de Guerra | instantâneo | 26s | 22 | Em você e aliados · 10 blocos: força 1, resistência 1. |
| 75 | Fúria do Titã | instantâneo | 28s | 24 | Em você: força 2. |
| 76 | Sangue de Pedra | instantâneo | 30s | 24 | Em você: regeneração 1, +4 de vida extra. |
| 77 | Abrigo do Gigante | instantâneo | 28s | 26 | Em você e aliados · 6 blocos: resistência 2, cura 4. |
| 78 | Tambores da Terra | instantâneo | 26s | 18 | Em você: pressa, velocidade 1. |
| 79 | Fôlego Profundo | instantâneo | 26s | 12 | Em você: respira na água, cura 4. |

### Controle (18)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 7 | ⭐ Pisão Colossal | instantâneo | 12s | 20 | Pisão Colossal: o chão afunda em volta — atordoa, lança e machuca tudo em 7 blocos. A tela treme. |
| 8 | ⭐ Mão de Jötunn | instantâneo | 10s | 16 | Mão de Jötunn: agarra a criatura na mira, ergue acima da cabeça e arremessa longe; ela esmaga quem estiver onde cair. |
| 10 | ⭐ Sopro de Hrímthurs | instantâneo | 12s | 18 | Sopro de Hrímthurs (gigante de gelo): cone de geada que congela a água, deixa lento e machuca. |
| 12 | ⭐ Rugido Colossal | instantâneo | 16s | 15 | Rugido Colossal: os monstros em 14 blocos são jogados longe e ficam fracos de medo. |
| 44 | Agarrão Titânico | alvo | 14s | 16 | Puxa e golpeia · 6 blocos: atordoa 2.0s. |
| 45 | Arremesso Humano | alvo | 12s | 16 | Agarra e arremessa · 5 blocos: 6 de dano, lança para o alto. |
| 46 | Fosso Súbito | duração | 16s | 18 | Armadilha · 14 blocos · 10s: prende 4.0s, lentidão 2. |
| 47 | Rugido da Terra | instantâneo | 18s | 20 | Explosão ao redor · 7 blocos: medo, lentidão 2. |
| 48 | Prisão de Rocha | alvo | 18s | 20 | No alvo da mira · 12 blocos: prende 5.0s. |
| 49 | Atração Magnética | instantâneo | 14s | 18 | pull · 12 blocos: puxa, atordoa 0.8s. |
| 50 | Tremor Paralisante | instantâneo | 20s | 24 | Explosão ao redor · 5 blocos: atordoa 1.8s, 3 de dano. |
| 51 | Vórtice de Areia | duração | 20s | 22 | Redemoinho · 6 blocos · 4s: puxa, cega. |
| 52 | Marca do Colosso | alvo | 12s | 8 | Marca · 18 blocos: marca (+25% dano), fraqueza 1. |
| 53 | Pisada Atordoante | instantâneo | 16s | 20 | Salta e cai com impacto · 8 blocos: atordoa 2.0s, 5 de dano, lentidão 1. |
| 54 | Corrente de Bronze | instantâneo | 14s | 14 | Gancho até a mira · 16 blocos: lentidão 3. |
| 55 | Lançar ao Céu | alvo | 16s | 18 | No alvo da mira · 8 blocos: levita, 4 de dano. |
| 92 | Pancada no Chão | instantâneo | 14s | 18 | Cruz de ondas · 10 blocos: 5 de dano, lentidão 2. |
| 95 | Grito da Montanha | instantâneo | 18s | 20 | Cone à frente · 8 blocos: medo, atordoa 1.0s. |

### Transformação (5)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 80 | Aura Sísmica | alternar | 1s | 0 | Aura (liga/desliga) · 6 blocos: lentidão 1. |
| 81 | Forma de Granito | instantâneo | 40s | 40 | Em você: resistência 3, lentidão 2, força 2. |
| 82 | Fúria Berserker | instantâneo | 42s | 36 | Em você: força 3, velocidade 1, fraqueza 1. |
| 83 | Postura do Colosso | instantâneo | 36s | 34 | Em você: resistência 2, +8 de vida extra. |
| 84 | Ciclone Titânico | duração | 26s | 30 | Lâminas girando · 4 blocos · 7s: 5 de dano, empurra, lentidão 1. |

### Suprema (6)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 13 | ⭐ Fúria Titânica | instantâneo | 240s | 100 | SUPREMA: Fúria Titânica — você cresce AINDA MAIS (6,3×) por 15 s, com força e resistência enormes. |
| 96 | Cataclismo | duração | 90s | 60 | Área persistente · 12 blocos · 8s: 5 de dano, lança para o alto, lentidão 2. |
| 97 | Queda da Montanha | instantâneo | 85s | 60 | Chuva de impactos · 10 blocos · 16×: 14 de dano, atordoa 1.5s. |
| 98 | Punho do Mundo | instantâneo | 80s | 55 | Raio em linha · 30 blocos: 24 de dano, empurra. |
| 99 | Terremoto Ancestral | instantâneo | 95s | 70 | Explosão ao redor · 14 blocos: 16 de dano, lança para o alto, atordoa 2.0s. |
| 100 | Golem Primordial | duração | 100s | 70 | Invocação · 1× · 20s: 8 de dano, empurra. |

## Anjo (Graça)

### Passiva (10)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 2 | Auréola Viva | passiva | — | — | Passiva: auréola/coroa sobre a cabeça. |
| 3 | Asas que Crescem | passiva | — | — | Passiva: as asas crescem com XP próprio (0→20) e nunca encolhem. |
| 4 | Graça Restauradora | passiva | — | — | Passiva: regeneração da raça. |
| 79 | Luz Interior | passiva | — | — | Passiva: regenera mais de dia. |
| 80 | Plumas Leves | passiva | — | — | Passiva: sem dano de queda. |
| 81 | Proteção Divina | passiva | — | — | Passiva: resiste mais com pouca vida. |
| 82 | Golpe Sagrado | passiva | — | — | Passiva: golpes sagrados ferem mais demônios, trevas e mortos-vivos. |
| 83 | Misericórdia | passiva | — | — | Passiva: cura ao abater. |
| 84 | Pureza | passiva | — | — | Passiva: imune a veneno e murchar. |
| 85 | Esquiva Celeste | passiva | — | — | Passiva: chance de esquivar de golpes. |

### Movimento (11)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 1 | Voo Celestial | instantâneo | 1s | 0 | Liga/desliga o voo com as asas: olhe e ande para voar, pule sobe, agache desce. |
| 12 | ⭐ Ascensão | instantâneo | 12s | 14 | Ascensão: sobe aos céus num salto de luz e, ao pousar, solta uma onda sagrada. |
| 50 | Impulso das Asas | instantâneo | 5s | 6 | Avanço · 12 blocos: queda lenta. |
| 51 | Teleporte de Luz | instantâneo | 7s | 10 | Teleporte · 16 blocos: velocidade 1. |
| 52 | Planar Sereno | instantâneo | 10s | 4 | Em você: queda lenta. |
| 53 | Subida Vertical | instantâneo | 12s | 8 | Em você: levita, queda lenta. |
| 54 | Troca Celestial | alvo | 14s | 14 | Troca de lugar com o alvo · 18 blocos: revela. |
| 55 | Rasante | instantâneo | 9s | 10 | Avanço · 14 blocos: 5 de dano, revela, sagrado. |
| 56 | Fio de Luz | instantâneo | 12s | 10 | Gancho até a mira · 24 blocos: velocidade 2. |
| 57 | Pouso Gracioso | instantâneo | 10s | 10 | Salta e cai com impacto · 10 blocos: 4 de dano, empurra. |
| 88 | Brisa Celeste | instantâneo | 9s | 10 | Salto com impacto · 12 blocos: empurra, queda lenta. |

### Ataque (17)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 5 | ⭐ Julgamento | instantâneo | 10s | 20 | Julgamento: um selo dourado marca o chão e uma coluna de luz desce do céu (sagrado: dobra contra trevas/demônios/mortos-vivos). |
| 6 | ⭐ Espada Flamejante do Querubim | instantâneo | 8s | 16 | Espada Flamejante do Querubim: três cortes de fogo sagrado seguidos à sua frente. |
| 11 | ⭐ Tempestade de Penas | instantâneo | 9s | 16 | Tempestade de Penas: 12 penas afiadas que perseguem os inimigos à sua frente. |
| 15 | Lança de Luz | instantâneo | 5s | 10 | Projétil · 28 blocos: 8 de dano, sagrado. |
| 16 | Raio Sagrado | instantâneo | 8s | 14 | Raio em linha · 22 blocos: 8 de dano, revela, sagrado. |
| 17 | Pena Afiada | instantâneo | 6s | 10 | Leque de projéteis · 20 blocos · 6×: 4 de dano, sagrado. |
| 18 | Círculo Radiante | instantâneo | 9s | 14 | Explosão ao redor · 5 blocos: 6 de dano, cega, sagrado. |
| 19 | Julgamento Menor | instantâneo | 10s | 16 | Coluna sob o alvo · 18 blocos: 9 de dano, sagrado. |
| 20 | Corrente de Luz | alvo | 9s | 14 | Salta entre alvos · 14 blocos · 5×: 5 de dano, sagrado. |
| 21 | Estrela Cadente | instantâneo | 9s | 14 | Projétil em arco · 24 blocos: 9 de dano, empurra, sagrado. |
| 22 | Leque de Plumas | instantâneo | 7s | 12 | Cone à frente · 6 blocos: 6 de dano, empurra, sagrado. |
| 23 | Mergulho Seráfico | instantâneo | 12s | 18 | Salta e cai com impacto · 14 blocos: 9 de dano, lança para o alto, sagrado. |
| 24 | Espada de Luz | instantâneo | 8s | 12 | Avanço · 10 blocos: 8 de dano, sagrado. |
| 25 | Anel de Lâminas | duração | 16s | 20 | Lâminas girando · 3 blocos · 5s: 3 de dano, sagrado. |
| 90 | Lâmina Serafim | alvo | 12s | 16 | Puxa e golpeia · 10 blocos: 8 de dano, sagrado, revela. |
| 92 | Cometa Branco | instantâneo | 14s | 20 | Meteoro · 12 blocos: 11 de dano, sagrado. |
| 95 | Coroa de Estrelas | duração | 20s | 24 | Invocação · 5× · 7s: 4 de dano, sagrado. |

### Defesa (17)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 8 | ⭐ Asas Protetoras | instantâneo | 20s | 18 | Asas Protetoras: você se cobre com as asas por 3 s e NÃO leva dano; quem bater é empurrado. |
| 9 | ⭐ Anjo da Guarda | instantâneo | 120s | 40 | Anjo da Guarda: por 60 s, o golpe que te mataria é anulado — você volta com a vida cheia. |
| 26 | Escudo Sagrado | instantâneo | 20s | 20 | Em você: escudo. |
| 27 | Bolha de Luz | duração | 28s | 30 | Domo · 3 blocos · 7s: resistência 2. |
| 28 | Abrigo das Asas | instantâneo | 20s | 18 | Em você: resistência 2, queda lenta. |
| 29 | Égide Celestial | instantâneo | 28s | 26 | Em você: +12 de vida extra. |
| 30 | Barreira Radiante | duração | 20s | 20 | Muro · 5 blocos · 7s: cega, sagrado. |
| 31 | Refúgio da Graça | duração | 26s | 28 | Área persistente · 4 blocos · 7s: regeneração 1, resistência 1. |
| 32 | Pele de Estrela | instantâneo | 24s | 20 | Em você: resistência 1, imune a fogo. |
| 33 | Reflexo de Luz | instantâneo | 22s | 18 | Em você: devolve 4 de dano. |
| 34 | Esquiva Angelical | instantâneo | 8s | 10 | Teleporte · 9 blocos: resistência 1, queda lenta. |
| 35 | Círculo Sagrado | duração | 30s | 30 | Área persistente · 5 blocos · 6s: empurra, resistência 1. |
| 36 | Toque Restaurador | instantâneo | 24s | 28 | Em você: cura 10. |
| 37 | Coração Puro | instantâneo | 26s | 20 | Em você: limpa efeitos ruins, regeneração 1. |
| 86 | Pena Guardiã | duração | 22s | 20 | Lâminas girando · 3 blocos · 6s: empurra, sagrado, resistência 1. |
| 91 | Fé Inabalável | instantâneo | 28s | 24 | Em você: resistência 1, regeneração 1, visão noturna. |
| 93 | Véu de Luz | duração | 24s | 24 | Área persistente · 4 blocos · 5s: cega, sagrado, resistência 1. |

### Utilidade (10)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 58 | Revelação | instantâneo | 16s | 6 | Revela criaturas · 32 blocos: revela. |
| 59 | Luz Guia | instantâneo | 10s | 4 | Luz que acompanha · 30s: efeito especial. |
| 60 | Pão dos Anjos | instantâneo | 30s | 10 | Em você: sacia a fome. |
| 61 | Bênção do Explorador | instantâneo | 28s | 8 | Em você: visão noturna, respira na água. |
| 62 | Ponte de Luz | instantâneo | 14s | 10 | Ponte temporária · 14 blocos · 15s: efeito especial. |
| 63 | Recolher Bênçãos | instantâneo | 16s | 6 | Puxa itens · 12 blocos: efeito especial. |
| 64 | Plataforma de Nuvem | instantâneo | 14s | 8 | Plataforma temporária · 3 blocos · 20s: efeito especial. |
| 65 | Chamado Celestial | instantâneo | 60s | 20 | Volta ao lar: efeito especial. |
| 66 | Olhar Divino | instantâneo | 22s | 10 | Revela minérios · 12 blocos: efeito especial. |
| 67 | Paz | instantâneo | 30s | 14 | Acalma monstros · 16 blocos: efeito especial. |

### Apoio (9)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 10 | ⭐ Santuário | instantâneo | 30s | 30 | Santuário: domo de luz de 7 blocos por 10 s. Monstros são expulsos e queimam; aliados regeneram. |
| 14 | ⭐ Sopro da Vida | instantâneo | 45s | 35 | Sopro da Vida: cura totalmente você e os aliados em 12 blocos, limpa efeitos ruins e dá escudo. |
| 68 | Cura em Área | instantâneo | 18s | 24 | Em você e aliados · 8 blocos: cura 8, regeneração 1. |
| 69 | Bênção de Força | instantâneo | 22s | 18 | Em você e aliados · 10 blocos: força 1. |
| 70 | Bênção da Rapidez | instantâneo | 20s | 16 | Em você e aliados · 10 blocos: velocidade 2, super pulo. |
| 71 | Purificar Aliados | instantâneo | 20s | 18 | Em você e aliados · 10 blocos: limpa efeitos ruins, cura 4. |
| 72 | Hino da Esperança | instantâneo | 28s | 28 | Em você e aliados · 10 blocos: regeneração 2, resistência 1. |
| 73 | Ressurgir | instantâneo | 60s | 50 | Em você: cura 20, +8 de vida extra. |
| 87 | Luz de Cura | alvo | 10s | 12 | No alvo da mira · 16 blocos: cura 8, regeneração 1. |

### Controle (15)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 7 | ⭐ Trombeta Celestial | instantâneo | 18s | 22 | Trombeta Celestial: três ondas douradas atordoam os inimigos e curam os aliados. |
| 38 | Selo de Luz | alvo | 14s | 18 | No alvo da mira · 16 blocos: prende 4.0s, sagrado. |
| 39 | Cântico Ofuscante | instantâneo | 16s | 18 | Explosão ao redor · 6 blocos: cega, fraqueza 1. |
| 40 | Corrente Celestial | instantâneo | 14s | 16 | Gancho até a mira · 18 blocos: lentidão 2, sagrado. |
| 41 | Halo Paralisante | alvo | 18s | 22 | No alvo da mira · 14 blocos: atordoa 2.5s, sagrado. |
| 42 | Ascensão Forçada | alvo | 16s | 18 | No alvo da mira · 14 blocos: levita. |
| 43 | Vento das Asas | instantâneo | 10s | 12 | Cone à frente · 7 blocos: empurra, lentidão 1. |
| 44 | Prisão Radiante | duração | 16s | 18 | Armadilha · 14 blocos · 10s: prende 4.0s, revela. |
| 45 | Marca da Verdade | alvo | 12s | 8 | Marca · 22 blocos: marca (+25% dano), revela, sagrado. |
| 46 | Silêncio Sagrado | alvo | 20s | 22 | No alvo da mira · 14 blocos: silencia 6.0s. |
| 47 | Redemoinho de Plumas | duração | 20s | 24 | Redemoinho · 6 blocos · 4s: puxa, levita. |
| 48 | Repulsão Divina | instantâneo | 18s | 20 | Explosão ao redor · 6 blocos: empurra, medo. |
| 49 | Laço de Luz | alvo | 12s | 14 | Puxa e golpeia · 10 blocos: atordoa 1.0s, sagrado. |
| 89 | Clarão | alvo | 12s | 12 | No alvo da mira · 20 blocos: cega, revela. |
| 94 | Trombeta | instantâneo | 14s | 16 | Onda pelo chão · 14 blocos: empurra, fraqueza 1. |

### Transformação (5)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 74 | Aura de Graça | alternar | 1s | 0 | Aura (liga/desliga) · 6 blocos: regeneração 1. |
| 75 | Forma Seráfica | instantâneo | 42s | 40 | Em você: resistência 2, regeneração 2, velocidade 1. |
| 76 | Asas de Fogo Branco | duração | 24s | 28 | Lâminas girando · 3 blocos · 7s: 4 de dano, incendeia, sagrado. |
| 77 | Avatar da Luz | instantâneo | 38s | 34 | Em você: força 2, você brilha, visão noturna. |
| 78 | Coro Celestial | duração | 30s | 30 | Área persistente · 6 blocos · 7s: 2 de dano, sagrado, regeneração 1. |

### Suprema (6)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 13 | ⭐ Coro dos Serafins | instantâneo | 240s | 100 | SUPREMA: Coro dos Serafins — 6 luzes giram em volta por 12 s disparando raios sagrados e curando aliados. |
| 96 | Julgamento Celestial | instantâneo | 90s | 60 | Chuva de impactos · 10 blocos · 16×: 12 de dano, atordoa 1.0s, sagrado. |
| 97 | Arcanjo | instantâneo | 100s | 70 | Em você: resistência 3, regeneração 3, força 2, +16 de vida extra. |
| 98 | Sol Nascente | instantâneo | 85s | 60 | Explosão ao redor · 12 blocos: 14 de dano, cega, incendeia, sagrado. |
| 99 | Milagre | instantâneo | 110s | 80 | Em você e aliados · 16 blocos: cura 40, limpa efeitos ruins, +12 de vida extra. |
| 100 | Lança dos Céus | instantâneo | 80s | 55 | Raio em linha · 36 blocos: 26 de dano, empurra, sagrado. |

## Demônio (Energia Infernal)

### Passiva (10)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 2 | Coroa Rubra | passiva | — | — | Passiva: auréola/coroa sobre a cabeça. |
| 3 | Asas da Danação | passiva | — | — | Passiva: as asas crescem com XP próprio (0→20) e nunca encolhem. |
| 4 | Chama Interior | passiva | — | — | Passiva: imune a fogo e lava. |
| 84 | Chama na Pele | passiva | — | — | Passiva: golpes incendeiam. |
| 85 | Sede de Caos | passiva | — | — | Passiva: cura ao abater. |
| 86 | Brasas Eternas | passiva | — | — | Passiva: nada na lava. |
| 87 | Ódio Crescente | passiva | — | — | Passiva: mais dano quanto menos vida. |
| 88 | Couro do Inferno | passiva | — | — | Passiva: resiste mais com pouca vida. |
| 89 | Pés de Brasa | passiva | — | — | Passiva: sem dano de queda. |
| 90 | Corrupção | passiva | — | — | Passiva: golpes fazem murchar. |

### Movimento (10)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 1 | Voo Infernal | instantâneo | 1s | 0 | Liga/desliga o voo com as asas: olhe e ande para voar, pule sobe, agache desce. |
| 13 | ⭐ Asas de Brasa | instantâneo | 7s | 10 | Asas de Brasa: dispara voando para a frente deixando um rastro de fogo que queima quem passa por perto. |
| 55 | Investida em Chamas | instantâneo | 6s | 8 | Avanço · 12 blocos: 4 de dano, queima 2s. |
| 56 | Passo do Abismo | instantâneo | 6s | 8 | Teleporte · 14 blocos: queima 1s. |
| 57 | Planar em Brasa | instantâneo | 14s | 10 | Em você: velocidade 2, imune a fogo. |
| 58 | Troca Infernal | alvo | 14s | 14 | Troca de lugar com o alvo · 16 blocos: queima 3s. |
| 59 | Salto Explosivo | instantâneo | 9s | 12 | Salto com impacto · 12 blocos: 5 de dano, queima 2s, empurra. |
| 60 | Gancho de Corrente | instantâneo | 12s | 12 | Gancho até a mira · 22 blocos: velocidade 2. |
| 61 | Queda Demoníaca | instantâneo | 12s | 16 | Salta e cai com impacto · 14 blocos: 8 de dano, queima 3s, empurra. |
| 62 | Rastro de Fumaça | instantâneo | 18s | 14 | Em você: velocidade 2, invisível. |

### Ataque (21)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 8 | ⭐ Portão do Inferno | instantâneo | 20s | 28 | Portão do Inferno: abre um selo no chão que cospe gêiseres de fogo por 7 s. |
| 9 | ⭐ Chuva de Enxofre | instantâneo | 16s | 26 | Chuva de Enxofre: 10 meteoros de fogo caem do céu na área mirada. |
| 10 | ⭐ Onda de Fogo Negro | instantâneo | 9s | 16 | Onda de Fogo Negro: chamas negras correm pelo chão queimando e fazendo murchar. |
| 11 | ⭐ Marca da Danação | instantâneo | 12s | 18 | Marca da Danação: marca o alvo (leva +25% de dano) e em 5 s ele explode em fogo infernal. |
| 15 | Bola de Fogo Infernal | instantâneo | 5s | 10 | Projétil · 26 blocos: 8 de dano, queima 4s, estouro de 2 blocos. |
| 16 | Sopro do Abismo | instantâneo | 7s | 12 | Cone à frente · 6 blocos: 5 de dano, queima 5s. |
| 17 | Chicote de Brasas | instantâneo | 7s | 12 | Cone à frente · 7 blocos: 6 de dano, queima 3s, puxa. |
| 18 | Correntes do Inferno | alvo | 11s | 16 | Puxa e golpeia · 10 blocos: 7 de dano, queima 3s, atordoa 0.8s. |
| 19 | Meteoro Rubro | instantâneo | 10s | 16 | Projétil em arco · 24 blocos: 10 de dano, queima 4s, estouro de 3 blocos. |
| 20 | Explosão Sulfúrica | instantâneo | 12s | 20 | Explosão ao redor · 5 blocos: 9 de dano, queima 3s, empurra. |
| 21 | Lança de Magma | instantâneo | 10s | 16 | Raio em linha · 20 blocos: 9 de dano, queima 4s. |
| 22 | Fogo Encadeado | alvo | 10s | 16 | Salta entre alvos · 12 blocos · 5×: 5 de dano, queima 3s. |
| 23 | Garoa de Cinzas Rubras | instantâneo | 16s | 26 | Chuva de impactos · 7 blocos · 10×: 5 de dano, queima 4s, veneno. |
| 24 | Tridente Infernal | instantâneo | 8s | 12 | Leque de projéteis · 18 blocos · 3×: 5 de dano, queima 2s. |
| 25 | Garra Demoníaca | instantâneo | 8s | 12 | Avanço · 9 blocos: 8 de dano, queima 2s, fraqueza 1. |
| 26 | Pilar de Fogo | instantâneo | 10s | 16 | Coluna sob o alvo · 18 blocos: 8 de dano, queima 5s, lança para o alto. |
| 27 | Rastro Incandescente | instantâneo | 14s | 16 | Rastro de fogo · 10 blocos · 5s: 2 de dano, queima 3s. |
| 28 | Mergulho do Abismo | instantâneo | 12s | 18 | Salta e cai com impacto · 14 blocos: 10 de dano, queima 4s. |
| 29 | Coroa de Espinhos | duração | 18s | 22 | Lâminas girando · 3 blocos · 5s: 4 de dano, queima 2s. |
| 30 | Fogo de Gehenna | duração | 22s | 26 | Área persistente · 5 blocos · 6s: 2 de dano, queima 3s. |
| 91 | Lâmina de Brasa | alvo | 13s | 16 | Agarra e arremessa · 5 blocos: 6 de dano, queima 4s, empurra. |

### Defesa (13)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 31 | Couraça de Lava | instantâneo | 22s | 20 | Em você: imune a fogo, resistência 1. |
| 32 | Escudo de Brasas | instantâneo | 24s | 20 | Em você: devolve 5 de dano, imune a fogo. |
| 33 | Pacto de Sangue Negro | instantâneo | 26s | 18 | Em você: +12 de vida extra, te enfraquece. |
| 34 | Muralha de Fogo | duração | 20s | 20 | Muro · 5 blocos · 7s: queima 4s. |
| 35 | Fuga Sulfúrica | instantâneo | 9s | 12 | Teleporte · 10 blocos: queima 2s, resistência 1. |
| 36 | Pele de Obsidiana | instantâneo | 26s | 22 | Em você: resistência 3, lentidão 2. |
| 37 | Regeneração Profana | instantâneo | 26s | 24 | Em você: regeneração 2. |
| 38 | Fumaça Negra | duração | 22s | 22 | Área persistente · 4 blocos · 5s: cega, invisível. |
| 39 | Contrato Vital | instantâneo | 28s | 10 | Em você: cura 12, custa 4 de vida. |
| 40 | Domo Ígneo | duração | 30s | 28 | Domo · 3 blocos · 7s: queima 2s, resistência 1. |
| 41 | Sacrifício | instantâneo | 26s | 14 | Em você: limpa efeitos ruins, +8 de vida extra, custa 2 de vida. |
| 42 | Escamas Infernais | instantâneo | 28s | 22 | Em você: resistência 1. |
| 93 | Cinzas Quentes | instantâneo | 22s | 16 | Em você: invisível, imune a fogo, velocidade 1. |

### Utilidade (10)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 63 | Farejar Almas | instantâneo | 16s | 6 | Revela criaturas · 32 blocos: revela. |
| 64 | Tocha Viva | instantâneo | 10s | 4 | Luz que acompanha · 30s: efeito especial. |
| 65 | Fome do Abismo | instantâneo | 30s | 10 | Em você: sacia a fome. |
| 66 | Visão Infernal | instantâneo | 28s | 8 | Em você: visão noturna, imune a fogo. |
| 67 | Ponte de Basalto | instantâneo | 14s | 10 | Ponte temporária · 12 blocos · 15s: efeito especial. |
| 68 | Colheita de Almas | instantâneo | 16s | 6 | Puxa itens · 12 blocos: efeito especial. |
| 69 | Marca do Caçador Infernal | alvo | 12s | 6 | Marca · 26 blocos: marca (+25% dano), revela. |
| 70 | Forja Infernal | instantâneo | 24s | 10 | Funde minérios da mão: efeito especial. |
| 71 | Portal Menor | instantâneo | 60s | 20 | Volta ao lar: efeito especial. |
| 72 | Barganha | instantâneo | 40s | 20 | Troca vida por energia: efeito especial. |

### Apoio (8)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 12 | ⭐ Legião de Diabretes | instantâneo | 40s | 30 | Legião: invoca 4 diabretes de fogo que voam em volta e atiram bolas de fogo nos inimigos. |
| 73 | Fúria Infernal | instantâneo | 26s | 24 | Em você: força 2, velocidade 1. |
| 74 | Pacto de Guerra | instantâneo | 24s | 20 | Em você e aliados · 10 blocos: força 1, imune a fogo. |
| 75 | Banquete de Almas | instantâneo | 20s | 24 | Explosão ao redor · 5 blocos: 3 de dano, murchar, rouba 60% em vida. |
| 76 | Sangue Ardente | instantâneo | 26s | 20 | Em você: pressa, força 1. |
| 77 | Bênção Profana | instantâneo | 26s | 24 | Em você e aliados · 8 blocos: regeneração 1, resistência 1. |
| 78 | Renascer das Cinzas | instantâneo | 60s | 45 | Em você: cura 16, imune a fogo, +4 de vida extra. |
| 95 | Inferno Pessoal | instantâneo | 30s | 24 | Em você: força 1, regeneração 1, imune a fogo. |

### Controle (16)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 6 | ⭐ Possessão | instantâneo | 25s | 25 | Possessão: a criatura na mira vira sua marionete por 15 s e ataca os outros; quando o demônio sai, ela explode. |
| 7 | ⭐ Correntes do Abismo | instantâneo | 14s | 20 | Correntes do Abismo: prende até 4 inimigos com correntes e depois arrasta todos até você. |
| 43 | Olhar do Medo | alvo | 14s | 16 | No alvo da mira · 14 blocos: medo, fraqueza 2. |
| 44 | Correntes Rubras | instantâneo | 14s | 16 | Gancho até a mira · 16 blocos: lentidão 3, queima 2s. |
| 45 | Selo do Inferno | duração | 16s | 18 | Armadilha · 14 blocos · 10s: prende 4.0s, queima 3s. |
| 46 | Vórtice de Chamas | duração | 20s | 24 | Redemoinho · 6 blocos · 4s: puxa, queima 2s. |
| 47 | Maldição da Fraqueza | alvo | 12s | 8 | Marca · 20 blocos: marca (+25% dano), fraqueza 2. |
| 48 | Grito Infernal | instantâneo | 18s | 20 | Explosão ao redor · 7 blocos: medo, lentidão 2, queima 1s. |
| 49 | Amarras de Enxofre | alvo | 18s | 20 | No alvo da mira · 12 blocos: prende 5.0s, veneno. |
| 50 | Gravidade Rubra | instantâneo | 18s | 22 | Explosão ao redor · 8 blocos: puxa, atordoa 1.0s. |
| 51 | Silêncio Profano | alvo | 20s | 22 | No alvo da mira · 14 blocos: silencia 6.0s, murchar. |
| 52 | Escuridão Sulfúrica | instantâneo | 16s | 18 | Cone à frente · 8 blocos: escuridão, cega. |
| 53 | Arrebatar | alvo | 14s | 16 | Agarra e arremessa · 5 blocos: 5 de dano, queima 2s, lança para o alto. |
| 54 | Sentença | alvo | 20s | 24 | No alvo da mira · 12 blocos: atordoa 2.5s, queima 3s. |
| 92 | Pântano Sulfúrico | duração | 22s | 22 | Área persistente · 5 blocos · 6s: lentidão 2, veneno. |
| 94 | Grilhões | instantâneo | 12s | 14 | pull · 12 blocos: puxa, queima 2s. |

### Transformação (6)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 5 | ⭐ Pacto Infernal | instantâneo | 45s | 0 | Pacto Infernal: paga 40% da sua vida atual e ganha 20 s de força III, velocidade e aura de fogo. |
| 79 | Aura Infernal | alternar | 1s | 0 | Aura (liga/desliga) · 5 blocos: queima 2s. |
| 80 | Forma do Arquidemônio | instantâneo | 42s | 40 | Em você: força 3, resistência 1, imune a fogo. |
| 81 | Asas Flamejantes | duração | 24s | 28 | Lâminas girando · 3 blocos · 7s: 4 de dano, queima 3s, empurra. |
| 82 | Avatar do Caos | instantâneo | 36s | 30 | Em você: velocidade 2, força 2, te enfraquece. |
| 83 | Círculo Profano | duração | 30s | 30 | Área persistente · 6 blocos · 7s: 2 de dano, queima 2s, força 1. |

### Suprema (6)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 14 | ⭐ Coroa do Inferno | instantâneo | 240s | 100 | SUPREMA: Coroa do Inferno — 15 s de arquidemônio: anel de fogo infernal em volta, força, resistência e medo. |
| 96 | Apocalipse | instantâneo | 90s | 60 | Chuva de impactos · 10 blocos · 14×: 13 de dano, queima 6s, estouro de 3 blocos. |
| 97 | Fenda Infernal | duração | 85s | 60 | Área persistente · 10 blocos · 10s: 4 de dano, queima 4s, puxa. |
| 98 | Ira do Arquidemônio | instantâneo | 80s | 55 | Explosão ao redor · 12 blocos: 16 de dano, queima 6s, empurra, medo. |
| 99 | Contrato Final | alvo | 100s | 70 | No alvo da mira · 10 blocos: executa abaixo de 50% de vida, queima 8s, murchar. |
| 100 | Legião Infernal | duração | 95s | 70 | Invocação · 10× · 10s: 6 de dano, queima 3s. |

## DEUS (Energia Divina)

### Passiva (9)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 2 | Coroa de Luz | passiva | — | — | Passiva: auréola/coroa sobre a cabeça. |
| 4 | Graça Absoluta | passiva | — | — | Passiva: regeneração da raça. |
| 81 | Toque Sagrado | passiva | — | — | Passiva: golpes sagrados ferem mais demônios, trevas e mortos-vivos. |
| 82 | Imaculado | passiva | — | — | Passiva: imune a veneno e murchar. |
| 83 | Plumas de Ouro | passiva | — | — | Passiva: sem dano de queda. |
| 84 | Vontade Eterna | passiva | — | — | Passiva: resiste mais com pouca vida. |
| 85 | Clemência | passiva | — | — | Passiva: cura ao abater. |
| 86 | Luz Perpétua | passiva | — | — | Passiva: regenera mais de dia. |
| 87 | Presença | passiva | — | — | Passiva: monstros perto ficam com medo. |

### Movimento (11)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 1 | Voo Divino | instantâneo | 1s | 0 | Liga/desliga o voo com as asas: olhe e ande para voar, pule sobe, agache desce. |
| 12 | ⭐ Rebobinar | instantâneo | 30s | 25 | Rebobinar: volta para onde você estava 5 s atrás, com a vida que tinha (se era maior). |
| 52 | Teleporte Celestial | instantâneo | 6s | 10 | Teleporte · 20 blocos: velocidade 2. |
| 53 | Rasante Divino | instantâneo | 7s | 10 | Avanço · 16 blocos: 6 de dano, empurra, sagrado. |
| 54 | Ascensão Gloriosa | instantâneo | 12s | 8 | Em você: levita, queda lenta. |
| 55 | Troca do Destino | alvo | 14s | 14 | Troca de lugar com o alvo · 22 blocos: atordoa 1.0s, sagrado. |
| 56 | Fio de Aurora | instantâneo | 10s | 10 | Gancho até a mira · 28 blocos: velocidade 3. |
| 57 | Descida dos Céus | instantâneo | 12s | 16 | Salta e cai com impacto · 16 blocos: 9 de dano, empurra, sagrado. |
| 58 | Velocidade da Luz | instantâneo | 18s | 16 | Em você: velocidade 4. |
| 59 | Planar Majestoso | instantâneo | 10s | 4 | Em você: queda lenta, super pulo. |
| 91 | Asas da Aurora | instantâneo | 10s | 10 | Salto com impacto · 16 blocos: empurra, sagrado, queda lenta. |

### Ataque (16)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 7 | ⭐ Ira dos Céus | instantâneo | 14s | 30 | Ira dos Céus: raios DE VERDADE caem em até 5 inimigos, com dano sagrado extra. |
| 8 | ⭐ Palavra Divina | instantâneo | 40s | 50 | Palavra Divina: cada inimigo em 16 blocos perde 35% da vida máxima (chefes: dano fixo). |
| 11 | ⭐ Coroa de Estrelas | instantâneo | 25s | 30 | Coroa de Estrelas: 8 estrelas giram em volta por 10 s e disparam raios nos inimigos. |
| 15 | Julgamento | instantâneo | 8s | 14 | Coluna sob o alvo · 22 blocos: 12 de dano, sagrado. |
| 16 | Raio do Firmamento | instantâneo | 8s | 14 | Raio em linha · 28 blocos: 11 de dano, sagrado. |
| 17 | Lâminas Celestes | instantâneo | 7s | 12 | Leque de projéteis · 22 blocos · 7×: 5 de dano, sagrado. |
| 18 | Estrela da Manhã | instantâneo | 8s | 14 | Projétil · 30 blocos: 11 de dano, estouro de 3 blocos, sagrado. |
| 19 | Espada Arremessada | instantâneo | 9s | 14 | Vai e volta · 20 blocos: 10 de dano, sagrado. |
| 20 | Corte do Horizonte | instantâneo | 10s | 16 | Onda pelo chão · 20 blocos: 9 de dano, sagrado. |
| 21 | Cruz Sagrada | instantâneo | 12s | 18 | Cruz de ondas · 12 blocos: 10 de dano, sagrado. |
| 22 | Coroa de Espadas | duração | 18s | 24 | Lâminas girando · 3.5 blocos · 6s: 5 de dano, sagrado. |
| 23 | Chuva Áurea | instantâneo | 14s | 24 | Chuva de impactos · 8 blocos · 12×: 7 de dano, sagrado. |
| 24 | Martelo da Justiça | instantâneo | 12s | 18 | Salta e cai com impacto · 14 blocos: 12 de dano, atordoa 1.0s, sagrado. |
| 25 | Pulso Solar | instantâneo | 12s | 20 | Explosão ao redor · 6 blocos: 9 de dano, incendeia, sagrado. |
| 26 | Golpe do Criador | instantâneo | 9s | 14 | Avanço · 12 blocos: 10 de dano, sagrado. |
| 27 | Mão de Deus | alvo | 12s | 18 | Puxa e golpeia · 12 blocos: 10 de dano, atordoa 1.0s, sagrado. |

### Defesa (14)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 10 | ⭐ Criação | instantâneo | 45s | 30 | Criação: ergue na hora um templo de cristal à sua volta (pilares e teto) por 20 s, onde você regenera. |
| 28 | Muralha da Criação | duração | 18s | 18 | Muro · 6 blocos · 10s: empurra, sagrado. |
| 29 | Égide Absoluta | instantâneo | 30s | 30 | Em você: resistência 3. |
| 30 | Bastião de Luz | duração | 32s | 32 | Domo · 4 blocos · 8s: resistência 2, regeneração 1. |
| 31 | Manto Estelar | instantâneo | 30s | 28 | Em você: +16 de vida extra. |
| 32 | Graça Imaculada | instantâneo | 26s | 20 | Em você: limpa efeitos ruins, resistência 1, imune a fogo. |
| 33 | Reflexo Divino | instantâneo | 24s | 22 | Em você: devolve 8 de dano. |
| 34 | Passo Imortal | instantâneo | 8s | 12 | Teleporte · 12 blocos: resistência 2. |
| 35 | Renovação | instantâneo | 24s | 28 | Em você: cura 14. |
| 36 | Santuário Maior | duração | 32s | 32 | Área persistente · 6 blocos · 8s: empurra, regeneração 1, resistência 1. |
| 37 | Pele de Diamante Celeste | instantâneo | 30s | 24 | Em você: resistência 1, devolve 3 de dano. |
| 38 | Asas Escudo | instantâneo | 22s | 20 | Em você: resistência 2, queda lenta. |
| 39 | Bênção Inviolável | instantâneo | 28s | 26 | Em você: regeneração 2, +4 de vida extra. |
| 90 | Pedra Angular | duração | 20s | 20 | Muro · 6 blocos · 8s: atordoa 1.0s, sagrado. |

### Utilidade (12)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 3 | Chamar a Lâmina Divina | instantâneo | 20s | 0 | Chama a sua arma da raça de volta para a mão (a cópia antiga some: nunca duplica). |
| 60 | Criar Ponte de Luz | instantâneo | 12s | 8 | Ponte temporária · 18 blocos · 20s: efeito especial. |
| 61 | Criar Plataforma | instantâneo | 12s | 8 | Plataforma temporária · 4 blocos · 20s: efeito especial. |
| 62 | Criar Luz | instantâneo | 8s | 2 | Luz que acompanha · 45s: efeito especial. |
| 63 | Pão Celestial | instantâneo | 30s | 8 | Em você: sacia a fome. |
| 64 | Onisciência | instantâneo | 14s | 6 | Revela criaturas · 48 blocos: revela. |
| 65 | Visão do Criador | instantâneo | 18s | 10 | Revela minérios · 16 blocos: efeito especial. |
| 66 | Recolher Tudo | instantâneo | 14s | 4 | Puxa itens · 16 blocos: efeito especial. |
| 67 | Retorno ao Lar | instantâneo | 50s | 16 | Volta ao lar: efeito especial. |
| 68 | Paz Divina | instantâneo | 24s | 12 | Acalma monstros · 24 blocos: efeito especial. |
| 69 | Florescer | instantâneo | 20s | 10 | Faz florescer · 6 blocos: efeito especial. |
| 94 | Profecia | alvo | 14s | 8 | Marca · 30 blocos: marca (+25% dano), revela, lentidão 1. |

### Apoio (11)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 6 | ⭐ Gênese | instantâneo | 30s | 25 | Gênese: a vida brota em 10 blocos — plantações maduras, flores e grama — e os aliados se curam. |
| 9 | ⭐ Sol Nascente | instantâneo | 35s | 35 | Sol Nascente: um pequeno sol aparece no alto por 10 s, ilumina, queima inimigos (mortos-vivos mais) e cura aliados. |
| 14 | ⭐ Sopro Divino | instantâneo | 60s | 40 | Sopro Divino: cura total, limpa efeitos ruins, escudo grande e resistência para você e aliados em 16 blocos. |
| 70 | Bênção Suprema | instantâneo | 30s | 28 | Em você e aliados · 12 blocos: força 2, resistência 1, regeneração 1. |
| 71 | Cura Divina | instantâneo | 18s | 24 | Em você e aliados · 12 blocos: cura 12, limpa efeitos ruins. |
| 72 | Hino da Criação | instantâneo | 24s | 20 | Em você e aliados · 12 blocos: velocidade 2, pressa, super pulo. |
| 73 | Proteção dos Fiéis | instantâneo | 28s | 26 | Em você e aliados · 10 blocos: +8 de vida extra, resistência 1. |
| 74 | Fôlego Divino | instantâneo | 30s | 10 | Em você: respira na água, visão noturna, imune a fogo. |
| 75 | Renascimento | instantâneo | 90s | 60 | Em você: cura 30, +16 de vida extra, limpa efeitos ruins. |
| 88 | Cântico Celestial | duração | 30s | 28 | Área persistente · 6 blocos · 7s: regeneração 2, velocidade 1. |
| 92 | Toque da Vida | alvo | 12s | 16 | No alvo da mira · 18 blocos: cura 14, +4 de vida extra. |

### Controle (15)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 5 | ⭐ Parar o Tempo | instantâneo | 90s | 60 | Parar o Tempo: por 6 s tudo em 24 blocos CONGELA no lugar (criaturas e flechas). Só você se mexe. |
| 40 | Gravidade Divina | instantâneo | 18s | 22 | Explosão ao redor · 9 blocos: puxa, atordoa 1.0s, sagrado. |
| 41 | Correntes da Justiça | instantâneo | 14s | 16 | Gancho até a mira · 20 blocos: lentidão 3, sagrado. |
| 42 | Prisão de Luz | duração | 16s | 18 | Armadilha · 16 blocos · 10s: prende 5.0s, revela. |
| 43 | Palavra de Poder | alvo | 20s | 24 | No alvo da mira · 16 blocos: atordoa 3.0s, sagrado. |
| 44 | Ascensão | alvo | 16s | 18 | No alvo da mira · 16 blocos: levita, sagrado. |
| 45 | Silêncio dos Céus | instantâneo | 20s | 22 | Cone à frente · 8 blocos: silencia 5.0s, sagrado. |
| 46 | Marca do Eleito | alvo | 12s | 8 | Marca · 28 blocos: marca (+25% dano), revela, sagrado. |
| 47 | Vendaval Sagrado | instantâneo | 12s | 14 | Cone à frente · 8 blocos: empurra, lentidão 1. |
| 48 | Vórtice Estelar | duração | 20s | 26 | Redemoinho · 7 blocos · 5s: puxa, levita, sagrado. |
| 49 | Ordem de Recuar | instantâneo | 18s | 20 | Explosão ao redor · 7 blocos: empurra, medo, sagrado. |
| 50 | Cegueira Divina | alvo | 16s | 18 | No alvo da mira · 18 blocos: cega, fraqueza 2. |
| 51 | Juízo Paralisante | instantâneo | 18s | 22 | Coluna sob o alvo · 18 blocos: atordoa 2.0s, sagrado. |
| 89 | Estigma | alvo | 12s | 14 | No alvo da mira · 18 blocos: sangramento 4s, revela, sagrado. |
| 93 | Selo Solar | duração | 16s | 18 | Armadilha · 16 blocos · 10s: atordoa 2.0s, incendeia. |

### Transformação (6)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 76 | Aura Divina | alternar | 1s | 0 | Aura (liga/desliga) · 8 blocos: regeneração 1. |
| 77 | Forma Transcendente | instantâneo | 45s | 45 | Em você: resistência 3, força 2, regeneração 2. |
| 78 | Halo de Lâminas | duração | 26s | 30 | Lâminas girando · 3.5 blocos · 8s: 6 de dano, lentidão 1, sagrado. |
| 79 | Avatar Solar | duração | 34s | 34 | Área persistente · 6 blocos · 8s: 3 de dano, incendeia, sagrado, resistência 1. |
| 80 | Olhar Divino | instantâneo | 30s | 20 | Em você: visão noturna, você brilha, força 1. |
| 95 | Coroa Radiante | alternar | 1s | 0 | Aura (liga/desliga) · 6 blocos: cega, sagrado. |

### Suprema (6)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 13 | ⭐ Juízo Final | instantâneo | 240s | 100 | SUPREMA: Juízo Final — um selo imenso se abre e 12 colunas de luz caem por toda a área. |
| 96 | Veredito Eterno | instantâneo | 100s | 70 | Chuva de impactos · 12 blocos · 20×: 18 de dano, atordoa 1.5s, sagrado. |
| 97 | Sopro da Criação | duração | 95s | 70 | Área persistente · 10 blocos · 12s: regeneração 3, resistência 2, +2 de vida extra. |
| 98 | Sol Divino | instantâneo | 90s | 65 | Explosão ao redor · 14 blocos: 20 de dano, incendeia, cega, sagrado. |
| 99 | Espada do Firmamento | instantâneo | 85s | 60 | Raio em linha · 40 blocos: 32 de dano, empurra, sagrado. |
| 100 | Exército Celestial | duração | 110s | 80 | Invocação · 12× · 12s: 8 de dano, sagrado. |

## TREVAS (Vazio)

### Passiva (9)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 2 | Coroa Negra | passiva | — | — | Passiva: auréola/coroa sobre a cabeça. |
| 4 | Pulso Sombrio | passiva | — | — | Passiva: regeneração da raça. |
| 81 | Toque Decadente | passiva | — | — | Passiva: golpes fazem murchar. |
| 82 | Ceifador | passiva | — | — | Passiva: cura ao abater. |
| 83 | Sem Peso | passiva | — | — | Passiva: sem dano de queda. |
| 84 | Vontade do Vazio | passiva | — | — | Passiva: resiste mais com pouca vida. |
| 85 | Pés de Cinza | passiva | — | — | Passiva: imune a veneno e murchar. |
| 86 | Sombra Esquiva | passiva | — | — | Passiva: chance de esquivar de golpes. |
| 87 | Presença Sombria | passiva | — | — | Passiva: monstros perto ficam com medo. |

### Movimento (11)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 1 | Voo do Vazio | instantâneo | 1s | 0 | Liga/desliga o voo com as asas: olhe e ande para voar, pule sobe, agache desce. |
| 8 | ⭐ Passo do Vazio | instantâneo | 8s | 12 | Passo do Vazio: rasga o espaço e aparece até 30 blocos à frente; quem estava no caminho é ferido e murcha. |
| 52 | Salto Sombrio | instantâneo | 5s | 8 | Teleporte · 18 blocos: velocidade 2. |
| 53 | Investida da Foice | instantâneo | 7s | 10 | Avanço · 14 blocos: 6 de dano, vira cinzas. |
| 54 | Troca de Almas | alvo | 14s | 14 | Troca de lugar com o alvo · 20 blocos: escuridão. |
| 55 | Mergulho no Vazio | instantâneo | 12s | 16 | Salta e cai com impacto · 16 blocos: 9 de dano, escuridão. |
| 56 | Fio de Sombra | instantâneo | 10s | 10 | Gancho até a mira · 26 blocos: velocidade 3. |
| 57 | Andar nas Sombras | instantâneo | 18s | 16 | Em você: velocidade 3, invisível. |
| 58 | Queda Lenta Negra | instantâneo | 10s | 4 | Em você: queda lenta, super pulo. |
| 59 | Ascensão Sombria | instantâneo | 12s | 8 | Em você: levita, queda lenta. |
| 90 | Passo do Ceifador | instantâneo | 10s | 12 | Salto com impacto · 14 blocos: 5 de dano, vira cinzas. |

### Ataque (17)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 7 | ⭐ Colheita de Almas | instantâneo | 10s | 18 | Colheita de Almas: giro da foice em 360°; cada alma colhida orbita você e te cura. |
| 10 | ⭐ Entropia | instantâneo | 12s | 18 | Entropia: o alvo apodrece por dentro (murchar forte e decomposição); se ficar fraco, vira cinza. |
| 11 | ⭐ Fenda do Vazio | instantâneo | 14s | 22 | Fenda do Vazio: abre uma fenda de 12 blocos à frente — criaturas fracas viram cinza, as outras sofrem e ficam no escuro. |
| 15 | Ceifar | instantâneo | 6s | 10 | Cone à frente · 5 blocos: 10 de dano, vira cinzas. |
| 16 | Foice Arremessada | instantâneo | 9s | 14 | Vai e volta · 20 blocos: 10 de dano, murchar. |
| 17 | Corte do Vazio | instantâneo | 10s | 16 | Onda pelo chão · 18 blocos: 9 de dano, escuridão. |
| 18 | Lua Negra | instantâneo | 8s | 14 | Projétil · 28 blocos: 11 de dano, murchar. |
| 19 | Espinhos de Sombra | instantâneo | 7s | 12 | Leque de projéteis · 20 blocos · 7×: 5 de dano, lentidão 1. |
| 20 | Colapso | instantâneo | 12s | 20 | Explosão ao redor · 6 blocos: 10 de dano, puxa. |
| 21 | Erosão | alvo | 9s | 12 | No alvo da mira · 16 blocos: 6 de dano, decomposição 3s. |
| 22 | Ceifa Encadeada | alvo | 10s | 16 | Salta entre alvos · 14 blocos · 6×: 7 de dano, murchar. |
| 23 | Garras da Escuridão | alvo | 12s | 18 | Puxa e golpeia · 12 blocos: 9 de dano, escuridão. |
| 24 | Pilar do Abismo | instantâneo | 10s | 16 | Coluna sob o alvo · 20 blocos: 10 de dano, levita. |
| 25 | Lâmina Fantasma | instantâneo | 8s | 12 | Avanço · 12 blocos: 9 de dano, escuridão. |
| 26 | Anel de Foices | duração | 18s | 24 | Lâminas girando · 3.5 blocos · 6s: 5 de dano, murchar. |
| 27 | Implosão | duração | 18s | 24 | Redemoinho · 6 blocos · 3s: puxa, 3 de dano. |
| 88 | Sombra Gêmea | duração | 22s | 26 | Invocação · 3× · 8s: 5 de dano, cega. |

### Defesa (14)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 28 | Manto do Vazio | instantâneo | 26s | 24 | Em você: invisível, resistência 1. |
| 29 | Casulo Sombrio | duração | 32s | 30 | Domo · 3 blocos · 7s: resistência 3. |
| 30 | Passo Entre Sombras | instantâneo | 8s | 12 | Teleporte · 12 blocos: escuridão, resistência 2. |
| 31 | Absorver Luz | instantâneo | 30s | 26 | Em você: +16 de vida extra, visão noturna. |
| 32 | Muralha de Cinzas | duração | 20s | 20 | Muro · 6 blocos · 8s: cega, decomposição 2s. |
| 33 | Reflexo Sombrio | instantâneo | 24s | 22 | Em você: devolve 8 de dano. |
| 34 | Pele de Ônix | instantâneo | 30s | 24 | Em você: resistência 1. |
| 35 | Fuga Etérea | instantâneo | 22s | 18 | Em você: invisível, velocidade 3, resistência 2. |
| 36 | Devorar Dor | instantâneo | 26s | 26 | Em você: cura 12, limpa efeitos ruins. |
| 37 | Névoa Negra | duração | 24s | 24 | Área persistente · 5 blocos · 6s: escuridão, invisível. |
| 38 | Corpo de Sombra | instantâneo | 24s | 20 | Em você: resistência 2, queda lenta. |
| 39 | Fome do Vazio | instantâneo | 22s | 24 | Explosão ao redor · 6 blocos: 3 de dano, rouba 70% em vida. |
| 91 | Escudo de Almas | duração | 26s | 24 | Lâminas girando · 3 blocos · 6s: empurra, +4 de vida extra. |
| 93 | Torre Negra | duração | 20s | 20 | Muro · 6 blocos · 8s: escuridão, lentidão 2. |

### Utilidade (12)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 3 | Chamar a Foice do Vazio | instantâneo | 20s | 0 | Chama a sua arma da raça de volta para a mão (a cópia antiga some: nunca duplica). |
| 60 | Sentir Almas | instantâneo | 14s | 6 | Revela criaturas · 48 blocos: revela. |
| 61 | Visão do Vazio | instantâneo | 16s | 2 | Em você: visão noturna. |
| 62 | Devorar Fome | instantâneo | 30s | 8 | Em você: sacia a fome. |
| 63 | Ponte de Obsidiana | instantâneo | 14s | 10 | Ponte temporária · 16 blocos · 20s: efeito especial. |
| 64 | Aspirar Almas | instantâneo | 14s | 4 | Puxa itens · 16 blocos: efeito especial. |
| 65 | Portal Sombrio | instantâneo | 50s | 16 | Volta ao lar: efeito especial. |
| 66 | Olho do Abismo | instantâneo | 18s | 10 | Revela minérios · 16 blocos: efeito especial. |
| 67 | Silêncio do Mundo | instantâneo | 24s | 12 | Acalma monstros · 24 blocos: efeito especial. |
| 68 | Cinzas ao Vento | instantâneo | 12s | 8 | Desfaz em cinzas · 3 blocos: efeito especial. |
| 69 | Plataforma Sombria | instantâneo | 12s | 8 | Plataforma temporária · 4 blocos · 20s: efeito especial. |
| 95 | Respiração da Noite | instantâneo | 30s | 10 | Em você: visão noturna, invisível, queda lenta. |

### Apoio (8)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 9 | ⭐ Sombras Vivas | instantâneo | 35s | 30 | Sombras Vivas: 3 sombras suas saem caçando e golpeando os inimigos por 10 s. |
| 70 | Pacto do Vazio | instantâneo | 30s | 28 | Em você: força 2, resistência 1. |
| 71 | Sombras Aliadas | instantâneo | 26s | 22 | Em você e aliados · 10 blocos: invisível, velocidade 1. |
| 72 | Banquete de Almas Negras | instantâneo | 22s | 24 | Explosão ao redor · 6 blocos: murchar, rouba 50% em vida. |
| 73 | Força Abissal | instantâneo | 30s | 26 | Em você: força 3, pressa. |
| 74 | Fôlego do Abismo | instantâneo | 28s | 10 | Em você: respira na água, imune a fogo. |
| 75 | Renascer Sombrio | instantâneo | 90s | 60 | Em você: cura 30, +12 de vida extra, invisível. |
| 94 | Vínculo Sombrio | instantâneo | 26s | 24 | Em você e aliados · 10 blocos: resistência 1, +4 de vida extra. |

### Controle (17)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 5 | ⭐ Buraco Negro | instantâneo | 30s | 40 | Buraco Negro: uma singularidade puxa tudo em 10 blocos por 5 s e no fim colapsa numa explosão. |
| 12 | ⭐ Pesadelo | instantâneo | 16s | 20 | Pesadelo: o alvo fica paralisado de medo por 4 s e os outros perto fogem. |
| 13 | ⭐ Anular | instantâneo | 25s | 25 | Anular: tira os efeitos bons dos inimigos em 12 blocos, silencia e revela; limpa os seus efeitos ruins. |
| 40 | Prisão Sombria | duração | 16s | 18 | Armadilha · 16 blocos · 10s: prende 5.0s, escuridão. |
| 41 | Gravidade Esmagadora | instantâneo | 18s | 22 | Explosão ao redor · 9 blocos: puxa, lentidão 3. |
| 42 | Silêncio Absoluto | alvo | 22s | 24 | No alvo da mira · 16 blocos: silencia 8.0s. |
| 43 | Medo Primordial | instantâneo | 20s | 22 | Explosão ao redor · 8 blocos: medo, fraqueza 2, escuridão. |
| 44 | Correntes do Abismo | instantâneo | 14s | 16 | Gancho até a mira · 20 blocos: lentidão 4, murchar. |
| 45 | Olhar do Nada | alvo | 20s | 24 | No alvo da mira · 16 blocos: atordoa 3.0s, escuridão. |
| 46 | Marca da Morte | alvo | 12s | 8 | Marca · 26 blocos: marca (+25% dano), decomposição 2s. |
| 47 | Levitação Negra | alvo | 16s | 18 | No alvo da mira · 16 blocos: levita, murchar. |
| 48 | Vácuo | instantâneo | 16s | 20 | Cone à frente · 8 blocos: puxa, silencia 3.0s. |
| 49 | Zona de Treva | duração | 24s | 26 | Área persistente · 6 blocos · 7s: cega, lentidão 2, silencia quem está dentro. |
| 50 | Arrastar ao Abismo | alvo | 14s | 16 | Puxa e golpeia · 10 blocos: atordoa 1.5s, escuridão. |
| 51 | Sentença Sombria | instantâneo | 18s | 22 | Coluna sob o alvo · 18 blocos: atordoa 2.0s, decomposição 2s. |
| 89 | Fenda | instantâneo | 14s | 16 | Onda pelo chão · 16 blocos: prende 3.0s, decomposição 2s. |
| 92 | Silêncio Cortante | instantâneo | 12s | 14 | Avanço · 12 blocos: silencia 3.0s, 5 de dano. |

### Transformação (6)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 6 | ⭐ Eclipse | instantâneo | 60s | 35 | Eclipse: 15 s de escuridão — você fica invisível e forte; os inimigos perto ficam cegos. |
| 76 | Aura do Vazio | alternar | 1s | 0 | Aura (liga/desliga) · 6 blocos: murchar, lentidão 1. |
| 77 | Forma Ceifadora | instantâneo | 45s | 45 | Em você: força 3, velocidade 2, resistência 1. |
| 78 | Tempestade de Foices | duração | 26s | 30 | Lâminas girando · 4 blocos · 8s: 6 de dano, vira cinzas. |
| 79 | Avatar do Nada | duração | 34s | 34 | Área persistente · 6 blocos · 8s: 3 de dano, decomposição 1s, escuridão, resistência 1. |
| 80 | Eclipse Pessoal | instantâneo | 32s | 24 | Em você: invisível, visão noturna, força 2. |

### Suprema (6)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 14 | ⭐ Noite Sem Fim | instantâneo | 240s | 100 | SUPREMA: Noite Sem Fim — domo de trevas de 10 blocos por 12 s que drena os inimigos para você e termina num colapso. |
| 96 | Fim de Tudo | instantâneo | 100s | 70 | Explosão ao redor · 14 blocos: 22 de dano, vira cinzas, murchar. |
| 97 | Singularidade Menor | duração | 90s | 65 | Redemoinho · 12 blocos · 8s: puxa, 5 de dano, silencia 2.0s. |
| 98 | Crepúsculo Eterno | duração | 95s | 70 | Área persistente · 12 blocos · 12s: escuridão, 4 de dano, decomposição 1s, silencia quem está dentro. |
| 99 | Ceifa das Almas | alvo | 85s | 60 | Salta entre alvos · 20 blocos · 10×: 14 de dano, vira cinzas, rouba 40% em vida. |
| 100 | Legião de Sombras | duração | 110s | 80 | Invocação · 12× · 12s: 7 de dano, escuridão. |

## Supremas (todas as raças)

| Raça | Poder | Recarga | Custo | Efeito |
|---|---|---|---|---|
| Vampiro | ⭐ Lua de Sangue | 240s | 100 | SUPREMA: a noite cai na hora e a lua fica rubra. 20 s de força, regeneração e cada golpe seu rouba 30% em vida. |
| Vampiro | Eclipse Sangrento | 90s | 60 | Explosão ao redor · 10 blocos: 14 de dano, sangramento 5s, cega, rouba 40% em vida. |
| Vampiro | Lua Carmesim | 80s | 60 | Área persistente · 10 blocos · 10s: 3 de dano, fraqueza 2, regeneração 2. |
| Vampiro | Rei dos Morcegos | 85s | 60 | Invocação · 14× · 10s: 5 de dano, cega. |
| Vampiro | Sede de Mil Anos | 75s | 55 | Salta entre alvos · 16 blocos · 8×: 9 de dano, sangramento 3s, rouba 50% em vida. |
| Vampiro | Noite Eterna | 95s | 70 | Explosão ao redor · 14 blocos: escuridão, atordoa 2.0s, 8 de dano. |
| Gigante | ⭐ Fúria Titânica | 240s | 100 | SUPREMA: Fúria Titânica — você cresce AINDA MAIS (6,3×) por 15 s, com força e resistência enormes. |
| Gigante | Cataclismo | 90s | 60 | Área persistente · 12 blocos · 8s: 5 de dano, lança para o alto, lentidão 2. |
| Gigante | Queda da Montanha | 85s | 60 | Chuva de impactos · 10 blocos · 16×: 14 de dano, atordoa 1.5s. |
| Gigante | Punho do Mundo | 80s | 55 | Raio em linha · 30 blocos: 24 de dano, empurra. |
| Gigante | Terremoto Ancestral | 95s | 70 | Explosão ao redor · 14 blocos: 16 de dano, lança para o alto, atordoa 2.0s. |
| Gigante | Golem Primordial | 100s | 70 | Invocação · 1× · 20s: 8 de dano, empurra. |
| Anjo | ⭐ Coro dos Serafins | 240s | 100 | SUPREMA: Coro dos Serafins — 6 luzes giram em volta por 12 s disparando raios sagrados e curando aliados. |
| Anjo | Julgamento Celestial | 90s | 60 | Chuva de impactos · 10 blocos · 16×: 12 de dano, atordoa 1.0s, sagrado. |
| Anjo | Arcanjo | 100s | 70 | Em você: resistência 3, regeneração 3, força 2, +16 de vida extra. |
| Anjo | Sol Nascente | 85s | 60 | Explosão ao redor · 12 blocos: 14 de dano, cega, incendeia, sagrado. |
| Anjo | Milagre | 110s | 80 | Em você e aliados · 16 blocos: cura 40, limpa efeitos ruins, +12 de vida extra. |
| Anjo | Lança dos Céus | 80s | 55 | Raio em linha · 36 blocos: 26 de dano, empurra, sagrado. |
| Demônio | ⭐ Coroa do Inferno | 240s | 100 | SUPREMA: Coroa do Inferno — 15 s de arquidemônio: anel de fogo infernal em volta, força, resistência e medo. |
| Demônio | Apocalipse | 90s | 60 | Chuva de impactos · 10 blocos · 14×: 13 de dano, queima 6s, estouro de 3 blocos. |
| Demônio | Fenda Infernal | 85s | 60 | Área persistente · 10 blocos · 10s: 4 de dano, queima 4s, puxa. |
| Demônio | Ira do Arquidemônio | 80s | 55 | Explosão ao redor · 12 blocos: 16 de dano, queima 6s, empurra, medo. |
| Demônio | Contrato Final | 100s | 70 | No alvo da mira · 10 blocos: executa abaixo de 50% de vida, queima 8s, murchar. |
| Demônio | Legião Infernal | 95s | 70 | Invocação · 10× · 10s: 6 de dano, queima 3s. |
| DEUS | ⭐ Juízo Final | 240s | 100 | SUPREMA: Juízo Final — um selo imenso se abre e 12 colunas de luz caem por toda a área. |
| DEUS | Veredito Eterno | 100s | 70 | Chuva de impactos · 12 blocos · 20×: 18 de dano, atordoa 1.5s, sagrado. |
| DEUS | Sopro da Criação | 95s | 70 | Área persistente · 10 blocos · 12s: regeneração 3, resistência 2, +2 de vida extra. |
| DEUS | Sol Divino | 90s | 65 | Explosão ao redor · 14 blocos: 20 de dano, incendeia, cega, sagrado. |
| DEUS | Espada do Firmamento | 85s | 60 | Raio em linha · 40 blocos: 32 de dano, empurra, sagrado. |
| DEUS | Exército Celestial | 110s | 80 | Invocação · 12× · 12s: 8 de dano, sagrado. |
| TREVAS | ⭐ Noite Sem Fim | 240s | 100 | SUPREMA: Noite Sem Fim — domo de trevas de 10 blocos por 12 s que drena os inimigos para você e termina num colapso. |
| TREVAS | Fim de Tudo | 100s | 70 | Explosão ao redor · 14 blocos: 22 de dano, vira cinzas, murchar. |
| TREVAS | Singularidade Menor | 90s | 65 | Redemoinho · 12 blocos · 8s: puxa, 5 de dano, silencia 2.0s. |
| TREVAS | Crepúsculo Eterno | 95s | 70 | Área persistente · 12 blocos · 12s: escuridão, 4 de dano, decomposição 1s, silencia quem está dentro. |
| TREVAS | Ceifa das Almas | 85s | 60 | Salta entre alvos · 20 blocos · 10×: 14 de dano, vira cinzas, rouba 40% em vida. |
| TREVAS | Legião de Sombras | 110s | 80 | Invocação · 12× · 12s: 7 de dano, escuridão. |
