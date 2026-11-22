# Os 600 poderes das raças (100 por raça)

Gerado de `behavior_pack/scripts/race/kits/*.js` (fonte única). Todos os 100 de cada raça ficam liberados; o jogador escolhe 20 para a barra. O autoteste executa os 600 no servidor e exige efeito real em cada um.

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

### Movimento (11)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 3 | Rajada Noturna | instantâneo | 22s | 20 | Rajada: sua velocidade vai a 5× a de um jogador normal por alguns segundos. |
| 4 | Salto da Lua | instantâneo | 6s | 8 | Super pulo de vampiro, sem dano de queda. |
| 54 | Passo Sombrio | instantâneo | 5s | 8 | Teleporte · 12 blocos: velocidade 1. |
| 55 | Investida Predadora | instantâneo | 6s | 8 | Avanço · 12 blocos: 4 de dano. |
| 56 | Planar de Morcego | instantâneo | 14s | 8 | Em você: queda lenta, super pulo. |
| 57 | Troca de Sombras | alvo | 14s | 14 | Troca de lugar com o alvo · 16 blocos: cega. |
| 58 | Escalada Noturna | instantâneo | 9s | 10 | Salto com impacto · 10 blocos: 3 de dano, empurra. |
| 59 | Teia de Sombras | instantâneo | 12s | 12 | Gancho até a mira · 20 blocos: velocidade 2. |
| 60 | Mergulho Carmesim | instantâneo | 12s | 16 | Salta e cai com impacto · 12 blocos: 7 de dano, empurra. |
| 61 | Rastro de Névoa | instantâneo | 18s | 14 | Em você: velocidade 2, queda lenta. |
| 91 | Caçada Noturna | instantâneo | 10s | 12 | Avanço · 14 blocos: 5 de dano, revela. |

### Ataque (26)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 2 | Dreno de Sangue | segurar | 1s | — | Segure o Núcleo mirando numa criatura perto: suga o sangue até ela morrer (para se ela fugir, sair da mira ou você soltar). |
| 6 | Mordida Carmesim | alvo | 5s | 8 | No alvo da mira · 3 blocos: 7 de dano, rouba 50% em vida. |
| 7 | Lâmina de Sangue | instantâneo | 4s | 10 | Projétil · 24 blocos: 8 de dano, sangramento 3s. |
| 8 | Leque de Espinhos Rubros | instantâneo | 7s | 14 | Leque de projéteis · 18 blocos · 5×: 4 de dano, sangramento 2s. |
| 9 | Chicote Hemático | instantâneo | 6s | 10 | Cone à frente · 6 blocos: 6 de dano, puxa. |
| 10 | Corte Fantasma | instantâneo | 7s | 12 | Avanço · 8 blocos: 7 de dano, cega. |
| 11 | Garras da Meia-Noite | instantâneo | 8s | 12 | Explosão ao redor · 4 blocos: 6 de dano, fraqueza 1. |
| 12 | Lança Coagulada | instantâneo | 9s | 16 | Raio em linha · 20 blocos: 9 de dano, lentidão 2. |
| 13 | Sangria Encadeada | alvo | 10s | 16 | Salta entre alvos · 12 blocos · 4×: 5 de dano, rouba 30% em vida. |
| 14 | Ferroada Vampírica | alvo | 6s | 8 | No alvo da mira · 4 blocos: 4 de dano, veneno. |
| 15 | Bumerangue Escarlate | instantâneo | 8s | 12 | Vai e volta · 16 blocos: 6 de dano, sangramento 2s. |
| 16 | Chuva Rubra | instantâneo | 14s | 24 | Chuva de impactos · 6 blocos · 8×: 5 de dano, sangramento 2s. |
| 17 | Pilar de Sangue | instantâneo | 10s | 16 | Coluna sob o alvo · 16 blocos: 8 de dano, lança para o alto. |
| 18 | Mordida Dupla | alvo | 7s | 10 | No alvo da mira · 3 blocos: 5 de dano, revela, rouba 25% em vida. |
| 19 | Presa Sônica | instantâneo | 9s | 14 | Onda pelo chão · 14 blocos: 5 de dano, lentidão 1. |
| 20 | Golpe da Agonia | alvo | 12s | 18 | Puxa e golpeia · 6 blocos: 8 de dano, atordoa 1.0s. |
| 21 | Bomba de Coágulo | instantâneo | 8s | 12 | Projétil em arco · 18 blocos: 7 de dano, lentidão 1. |
| 22 | Navalhas da Lua | duração | 16s | 20 | Lâminas girando · 3 blocos · 5s: 3 de dano. |
| 23 | Explosão Arterial | instantâneo | 14s | 24 | Explosão ao redor · 5 blocos: 9 de dano, empurra. |
| 24 | Agulhas da Sede | instantâneo | 8s | 12 | Leque de projéteis · 16 blocos · 7×: 3 de dano, veneno, rouba 15% em vida. |
| 25 | Execução Carmesim | alvo | 18s | 25 | No alvo da mira · 4 blocos: executa abaixo de 30% de vida, 6 de dano. |
| 26 | Corte Crescente | instantâneo | 9s | 16 | Cone à frente · 5 blocos: 8 de dano, sangramento 3s, empurra. |
| 27 | Rasgo Sombrio | instantâneo | 11s | 16 | Raio em linha · 16 blocos: 6 de dano, cega, escuridão. |
| 28 | Espiral de Morcegos | duração | 18s | 24 | Invocação · 6× · 6s: 3 de dano. |
| 29 | Dente de Ferro | instantâneo | 10s | 16 | Projétil · 28 blocos: 10 de dano, empurra. |
| 93 | Beijo da Morte | alvo | 14s | 18 | Puxa e golpeia · 6 blocos: 6 de dano, murchar, rouba 40% em vida. |

### Defesa (13)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
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

### Apoio (7)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 72 | Frenesi Carmesim | instantâneo | 26s | 24 | Em você: força 1, velocidade 1. |
| 73 | Sede Insaciável | instantâneo | 28s | 22 | Em você: pressa, força 1. |
| 74 | Pacto de Sangue | instantâneo | 22s | 20 | Em você e aliados · 8 blocos: cura 6, regeneração 1. |
| 75 | Ritual da Lua Cheia | instantâneo | 34s | 30 | Em você: regeneração 1, resistência 1. |
| 76 | Banquete | instantâneo | 20s | 24 | Explosão ao redor · 5 blocos: 3 de dano, rouba 80% em vida. |
| 77 | Coração Negro | instantâneo | 30s | 26 | Em você: +8 de vida extra. |
| 95 | Crepúsculo | instantâneo | 30s | 12 | Em você: visão noturna, velocidade 1, super pulo. |

### Controle (13)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 42 | Olhar Hipnótico | alvo | 16s | 20 | No alvo da mira · 12 blocos: atordoa 2.5s. |
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

### Transformação (6)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 1 | Forma de Morcego | instantâneo | 2s | — | Vira um morcego de verdade (pequeno, voa, imune ao sol). Usar de novo volta ao normal. |
| 78 | Aura da Noite | alternar | 1s | — | Aura (liga/desliga) · 5 blocos: fraqueza 1. |
| 79 | Forma Bestial | instantâneo | 40s | 40 | Em você: força 2, velocidade 2, resistência 1. |
| 80 | Forma de Névoa | instantâneo | 36s | 34 | Em você: invisível, resistência 3, velocidade 1. |
| 81 | Asas de Morcego | instantâneo | 26s | 20 | Em você: levita, queda lenta. |
| 82 | Dança das Lâminas | duração | 24s | 28 | Lâminas girando · 2.5 blocos · 7s: 4 de dano, sangramento 2s. |

### Suprema (5)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
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
| 83 | Peso Esmagador | passiva | — | — | Passiva: cair de alto causa impacto. |
| 84 | Ossos de Bronze | passiva | — | — | Passiva: não é empurrado. |
| 85 | Fúria Acumulada | passiva | — | — | Passiva: mais dano quanto menos vida. |
| 86 | Coração de Montanha | passiva | — | — | Passiva: resiste mais com pouca vida. |
| 87 | Raiz Firme | passiva | — | — | Passiva: sem dano de queda. |
| 88 | Mão Pesada | passiva | — | — | Passiva: golpes arremessam longe. |
| 89 | Calor da Forja | passiva | — | — | Passiva: imune a fogo e lava. |

### Movimento (9)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 54 | Salto Gigante | instantâneo | 8s | 10 | Salto com impacto · 14 blocos: 5 de dano, empurra. |
| 55 | Corrida Estrondosa | instantâneo | 16s | 12 | Em você: velocidade 2, super pulo. |
| 56 | Arremessar-se | instantâneo | 6s | 8 | Avanço · 14 blocos: 3 de dano. |
| 57 | Ponte de Pedra | instantâneo | 14s | 10 | Ponte temporária · 12 blocos · 15s: efeito especial. |
| 58 | Escalada Rochosa | instantâneo | 14s | 8 | Em você: super pulo, queda lenta. |
| 59 | Investida de Aríete | instantâneo | 11s | 14 | Avanço · 12 blocos: 6 de dano, empurra, atordoa 0.5s. |
| 60 | Queda Meteórica | instantâneo | 12s | 16 | Salta e cai com impacto · 14 blocos: 9 de dano, lança para o alto. |
| 61 | Passo Telúrico | instantâneo | 8s | 10 | Teleporte · 10 blocos: resistência 1. |
| 93 | Pedra Lisa | instantâneo | 14s | 10 | Em você: velocidade 3, queda lenta. |

### Ataque (27)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 5 | Soco Sísmico | instantâneo | 5s | 8 | Cone à frente · 5 blocos: 9 de dano, empurra. |
| 6 | Pisão Colossal | instantâneo | 7s | 12 | Explosão ao redor · 5 blocos: 8 de dano, lança para o alto. |
| 7 | Arremesso de Rocha | instantâneo | 8s | 12 | Projétil em arco · 22 blocos: 10 de dano, empurra. |
| 8 | Onda de Choque | instantâneo | 9s | 14 | Onda pelo chão · 16 blocos: 7 de dano, lança para o alto. |
| 9 | Martelo de Punhos | instantâneo | 10s | 16 | Salta e cai com impacto · 6 blocos: 11 de dano, atordoa 1.0s. |
| 10 | Agarrar e Esmagar | alvo | 12s | 18 | Puxa e golpeia · 5 blocos: 9 de dano, atordoa 1.5s. |
| 11 | Chute de Avalanche | instantâneo | 8s | 12 | Cone à frente · 4 blocos: 7 de dano, empurra, lança para o alto. |
| 12 | Coluna de Pedra | instantâneo | 10s | 14 | Coluna sob o alvo · 16 blocos: 8 de dano, lança para o alto. |
| 13 | Chuva de Pedregulhos | instantâneo | 14s | 22 | Chuva de impactos · 7 blocos · 10×: 6 de dano, lentidão 1. |
| 14 | Rolo Compressor | instantâneo | 9s | 14 | Avanço · 10 blocos: 8 de dano, empurra. |
| 15 | Palmas do Trovão | instantâneo | 12s | 18 | Explosão ao redor · 4 blocos: 5 de dano, atordoa 1.3s, empurra. |
| 16 | Lança de Estalagmite | instantâneo | 10s | 14 | Raio em linha · 18 blocos: 9 de dano, lança para o alto. |
| 17 | Bumerangue de Laje | instantâneo | 9s | 12 | Vai e volta · 16 blocos: 8 de dano, lentidão 1. |
| 18 | Fragmentos de Granito | instantâneo | 7s | 10 | Leque de projéteis · 18 blocos · 6×: 4 de dano, empurra. |
| 19 | Terremoto | duração | 22s | 26 | Área persistente · 8 blocos · 5s: 3 de dano, lentidão 2. |
| 20 | Punho Meteoro | instantâneo | 14s | 22 | Meteoro · 12 blocos: 12 de dano, empurra. |
| 21 | Uppercut Titânico | alvo | 9s | 14 | No alvo da mira · 4 blocos: 10 de dano, lança para o alto. |
| 22 | Rachadura Profunda | instantâneo | 12s | 16 | Onda pelo chão · 14 blocos: 6 de dano, prende 2.0s. |
| 23 | Esmagar Escudos | alvo | 10s | 12 | No alvo da mira · 4 blocos: 8 de dano, fraqueza 2. |
| 24 | Pedra Ricochete | alvo | 11s | 14 | Salta entre alvos · 14 blocos · 4×: 6 de dano, empurra. |
| 25 | Golpe da Montanha | instantâneo | 16s | 24 | Cone à frente · 6 blocos: 13 de dano, lentidão 2. |
| 26 | Moinho Gigante | duração | 18s | 22 | Lâminas girando · 3.5 blocos · 5s: 4 de dano, empurra. |
| 27 | Estouro de Poeira | instantâneo | 10s | 12 | Explosão ao redor · 6 blocos: 4 de dano, cega. |
| 28 | Pedregulho Rolante | instantâneo | 9s | 14 | Projétil · 26 blocos: 9 de dano, empurra. |
| 29 | Dedo Esmagador | alvo | 16s | 22 | No alvo da mira · 5 blocos: executa abaixo de 25% de vida, 6 de dano. |
| 90 | Rocha Ardente | instantâneo | 10s | 14 | Projétil em arco · 22 blocos: 8 de dano, incendeia, estouro de 2 blocos. |
| 94 | Esmagar Armadura | alvo | 10s | 12 | No alvo da mira · 4 blocos: 7 de dano, fraqueza 1, lentidão 1. |

### Defesa (13)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 30 | Postura Inabalável | instantâneo | 22s | 20 | Em você: resistência 2, lentidão 1. |
| 31 | Muralha de Pedra | duração | 18s | 18 | Muro · 5 blocos · 8s: empurra. |
| 32 | Pele de Basalto | instantâneo | 26s | 22 | Em você: resistência 1, imune a fogo. |
| 33 | Escudo de Laje | instantâneo | 24s | 22 | Em você: escudo. |
| 34 | Couraça de Bronze | instantâneo | 30s | 26 | Em você: +12 de vida extra. |
| 35 | Rugido Defensivo | instantâneo | 20s | 18 | Explosão ao redor · 6 blocos: fraqueza 1, resistência 1. |
| 36 | Raízes de Pedra | instantâneo | 28s | 20 | Em você: resistência 3, prende 3.0s. |
| 37 | Contra-Ataque | instantâneo | 22s | 20 | Em você: devolve 6 de dano. |
| 38 | Domo de Rocha | duração | 30s | 28 | Domo · 3 blocos · 8s: resistência 1. |
| 39 | Cicatrização Telúrica | instantâneo | 26s | 24 | Em você: regeneração 2. |
| 40 | Ombro Blindado | instantâneo | 10s | 10 | Avanço · 6 blocos: empurra, resistência 1. |
| 41 | Pedra Viva | instantâneo | 30s | 30 | Em você: cura 10. |
| 92 | Bastião Vivo | instantâneo | 26s | 24 | Em você e aliados · 8 blocos: +4 de vida extra, resistência 1. |

### Utilidade (10)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 62 | Sentir Vibrações | instantâneo | 16s | 6 | Revela criaturas · 32 blocos: revela. |
| 63 | Escavar Túnel | instantâneo | 10s | 8 | Túnel · 6 blocos: efeito especial. |
| 64 | Erguer Plataforma | instantâneo | 14s | 10 | Plataforma temporária · 3 blocos · 20s: efeito especial. |
| 65 | Força de Carga | instantâneo | 26s | 12 | Em você: pressa. |
| 66 | Abrir Caminho | instantâneo | 12s | 10 | Abre caminho · 4 blocos: efeito especial. |
| 67 | Fome de Gigante | instantâneo | 30s | 10 | Em você: sacia a fome. |
| 68 | Faro de Minério | instantâneo | 20s | 8 | Revela minérios · 12 blocos: efeito especial. |
| 69 | Aspirar Destroços | instantâneo | 16s | 6 | Puxa itens · 12 blocos: efeito especial. |
| 70 | Fogueira de Pedra | instantâneo | 24s | 6 | Em você: imune a fogo, visão noturna. |
| 71 | Vigia da Montanha | instantâneo | 30s | 10 | Em você: visão noturna, resistência 1. |

### Apoio (6)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 72 | Grito de Guerra | instantâneo | 26s | 22 | Em você e aliados · 10 blocos: força 1, resistência 1. |
| 73 | Fúria do Titã | instantâneo | 28s | 24 | Em você: força 2. |
| 74 | Sangue de Pedra | instantâneo | 30s | 24 | Em você: regeneração 1, +4 de vida extra. |
| 75 | Abrigo do Gigante | instantâneo | 28s | 26 | Em você e aliados · 6 blocos: resistência 2, cura 4. |
| 76 | Tambores da Terra | instantâneo | 26s | 18 | Em você: pressa, velocidade 1. |
| 77 | Fôlego Profundo | instantâneo | 26s | 12 | Em você: respira na água, cura 4. |

### Controle (14)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 42 | Agarrão Titânico | alvo | 14s | 16 | Puxa e golpeia · 6 blocos: atordoa 2.0s. |
| 43 | Arremesso Humano | alvo | 12s | 16 | Agarra e arremessa · 5 blocos: 6 de dano, lança para o alto. |
| 44 | Fosso Súbito | duração | 16s | 18 | Armadilha · 14 blocos · 10s: prende 4.0s, lentidão 2. |
| 45 | Rugido da Terra | instantâneo | 18s | 20 | Explosão ao redor · 7 blocos: medo, lentidão 2. |
| 46 | Prisão de Rocha | alvo | 18s | 20 | No alvo da mira · 12 blocos: prende 5.0s. |
| 47 | Atração Magnética | instantâneo | 14s | 18 | pull · 12 blocos: puxa, atordoa 0.8s. |
| 48 | Tremor Paralisante | instantâneo | 20s | 24 | Explosão ao redor · 5 blocos: atordoa 1.8s, 3 de dano. |
| 49 | Vórtice de Areia | duração | 20s | 22 | Redemoinho · 6 blocos · 4s: puxa, cega. |
| 50 | Marca do Colosso | alvo | 12s | 8 | Marca · 18 blocos: marca (+25% dano), fraqueza 1. |
| 51 | Pisada Atordoante | instantâneo | 16s | 20 | Salta e cai com impacto · 8 blocos: atordoa 2.0s, 5 de dano, lentidão 1. |
| 52 | Corrente de Bronze | instantâneo | 14s | 14 | Gancho até a mira · 16 blocos: lentidão 3. |
| 53 | Lançar ao Céu | alvo | 16s | 18 | No alvo da mira · 8 blocos: levita, 4 de dano. |
| 91 | Pancada no Chão | instantâneo | 14s | 18 | Cruz de ondas · 10 blocos: 5 de dano, lentidão 2. |
| 95 | Grito da Montanha | instantâneo | 18s | 20 | Cone à frente · 8 blocos: medo, atordoa 1.0s. |

### Transformação (5)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 78 | Aura Sísmica | alternar | 1s | — | Aura (liga/desliga) · 6 blocos: lentidão 1. |
| 79 | Forma de Granito | instantâneo | 40s | 40 | Em você: resistência 3, lentidão 2, força 2. |
| 80 | Fúria Berserker | instantâneo | 42s | 36 | Em você: força 3, velocidade 1, fraqueza 1. |
| 81 | Postura do Colosso | instantâneo | 36s | 34 | Em você: resistência 2, +8 de vida extra. |
| 82 | Ciclone Titânico | duração | 26s | 30 | Lâminas girando · 4 blocos · 7s: 5 de dano, empurra, lentidão 1. |

### Suprema (5)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
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

### Movimento (10)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 1 | Voo Celestial | instantâneo | 1s | — | Liga/desliga o voo com as asas: olhe e ande para voar, pule sobe, agache desce. |
| 50 | Impulso das Asas | instantâneo | 5s | 6 | Avanço · 12 blocos: queda lenta. |
| 51 | Teleporte de Luz | instantâneo | 7s | 10 | Teleporte · 16 blocos: velocidade 1. |
| 52 | Planar Sereno | instantâneo | 10s | 4 | Em você: queda lenta. |
| 53 | Subida Vertical | instantâneo | 12s | 8 | Em você: levita, queda lenta. |
| 54 | Troca Celestial | alvo | 14s | 14 | Troca de lugar com o alvo · 18 blocos: revela. |
| 55 | Rasante | instantâneo | 9s | 10 | Avanço · 14 blocos: 5 de dano, revela, sagrado. |
| 56 | Fio de Luz | instantâneo | 12s | 10 | Gancho até a mira · 24 blocos: velocidade 2. |
| 57 | Pouso Gracioso | instantâneo | 10s | 10 | Salta e cai com impacto · 10 blocos: 4 de dano, empurra. |
| 88 | Brisa Celeste | instantâneo | 9s | 10 | Salto com impacto · 12 blocos: empurra, queda lenta. |

### Ataque (24)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 5 | Lança de Luz | instantâneo | 5s | 10 | Projétil · 28 blocos: 8 de dano, sagrado. |
| 6 | Raio Sagrado | instantâneo | 8s | 14 | Raio em linha · 22 blocos: 8 de dano, revela, sagrado. |
| 7 | Pena Afiada | instantâneo | 6s | 10 | Leque de projéteis · 20 blocos · 6×: 4 de dano, sagrado. |
| 8 | Círculo Radiante | instantâneo | 9s | 14 | Explosão ao redor · 5 blocos: 6 de dano, cega, sagrado. |
| 9 | Julgamento Menor | instantâneo | 10s | 16 | Coluna sob o alvo · 18 blocos: 9 de dano, sagrado. |
| 10 | Corrente de Luz | alvo | 9s | 14 | Salta entre alvos · 14 blocos · 5×: 5 de dano, sagrado. |
| 11 | Estrela Cadente | instantâneo | 9s | 14 | Projétil em arco · 24 blocos: 9 de dano, empurra, sagrado. |
| 12 | Leque de Plumas | instantâneo | 7s | 12 | Cone à frente · 6 blocos: 6 de dano, empurra, sagrado. |
| 13 | Chuva de Estrelas | instantâneo | 16s | 26 | Chuva de impactos · 7 blocos · 10×: 5 de dano, revela, sagrado. |
| 14 | Disco Solar | instantâneo | 8s | 12 | Vai e volta · 18 blocos: 7 de dano, sagrado. |
| 15 | Purificação Ofensiva | alvo | 9s | 12 | No alvo da mira · 16 blocos: 6 de dano, tira efeitos bons do alvo, sagrado. |
| 16 | Mergulho Seráfico | instantâneo | 12s | 18 | Salta e cai com impacto · 14 blocos: 9 de dano, lança para o alto, sagrado. |
| 17 | Onda de Aurora | instantâneo | 10s | 14 | Onda pelo chão · 16 blocos: 6 de dano, lentidão 1, sagrado. |
| 18 | Espada de Luz | instantâneo | 8s | 12 | Avanço · 10 blocos: 8 de dano, sagrado. |
| 19 | Anel de Lâminas | duração | 16s | 20 | Lâminas girando · 3 blocos · 5s: 3 de dano, sagrado. |
| 20 | Sol do Meio-Dia | instantâneo | 14s | 22 | Explosão ao redor · 6 blocos: 8 de dano, incendeia, sagrado. |
| 21 | Prisma Celestial | instantâneo | 12s | 18 | Raio em linha · 20 blocos: 6 de dano, cega, revela, sagrado. |
| 22 | Flecha da Alvorada | instantâneo | 10s | 16 | Projétil · 34 blocos: 11 de dano, empurra, sagrado. |
| 23 | Castigo Divino | alvo | 18s | 24 | No alvo da mira · 16 blocos: executa abaixo de 25% de vida, 5 de dano, sagrado. |
| 24 | Explosão de Penas | instantâneo | 8s | 10 | Leque de projéteis · 14 blocos · 9×: 3 de dano, lentidão 1, sagrado. |
| 25 | Luz Cegante | instantâneo | 10s | 14 | Cone à frente · 7 blocos: cega, 4 de dano, sagrado. |
| 90 | Lâmina Serafim | alvo | 12s | 16 | Puxa e golpeia · 10 blocos: 8 de dano, sagrado, revela. |
| 92 | Cometa Branco | instantâneo | 14s | 20 | Meteoro · 12 blocos: 11 de dano, sagrado. |
| 95 | Coroa de Estrelas | duração | 20s | 24 | Invocação · 5× · 7s: 4 de dano, sagrado. |

### Defesa (15)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 26 | Escudo Sagrado | instantâneo | 20s | 20 | Em você: escudo. |
| 27 | Bolha de Luz | duração | 28s | 30 | Domo · 3 blocos · 7s: resistência 2. |
| 28 | Asas Protetoras | instantâneo | 20s | 18 | Em você: resistência 2, queda lenta. |
| 29 | Égide Celestial | instantâneo | 28s | 26 | Em você: +12 de vida extra. |
| 30 | Barreira Radiante | duração | 20s | 20 | Muro · 5 blocos · 7s: cega, sagrado. |
| 31 | Refúgio da Graça | duração | 26s | 28 | Área persistente · 4 blocos · 7s: regeneração 1, resistência 1. |
| 32 | Pele de Estrela | instantâneo | 24s | 20 | Em você: resistência 1, imune a fogo. |
| 33 | Reflexo de Luz | instantâneo | 22s | 18 | Em você: devolve 4 de dano. |
| 34 | Esquiva Angelical | instantâneo | 8s | 10 | Teleporte · 9 blocos: resistência 1, queda lenta. |
| 35 | Santuário | duração | 30s | 30 | Área persistente · 5 blocos · 6s: empurra, resistência 1. |
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

### Apoio (7)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 68 | Cura em Área | instantâneo | 18s | 24 | Em você e aliados · 8 blocos: cura 8, regeneração 1. |
| 69 | Bênção de Força | instantâneo | 22s | 18 | Em você e aliados · 10 blocos: força 1. |
| 70 | Bênção da Rapidez | instantâneo | 20s | 16 | Em você e aliados · 10 blocos: velocidade 2, super pulo. |
| 71 | Purificar Aliados | instantâneo | 20s | 18 | Em você e aliados · 10 blocos: limpa efeitos ruins, cura 4. |
| 72 | Hino da Esperança | instantâneo | 28s | 28 | Em você e aliados · 10 blocos: regeneração 2, resistência 1. |
| 73 | Ressurgir | instantâneo | 60s | 50 | Em você: cura 20, +8 de vida extra. |
| 87 | Luz de Cura | alvo | 10s | 12 | No alvo da mira · 16 blocos: cura 8, regeneração 1. |

### Controle (14)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
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
| 74 | Aura de Graça | alternar | 1s | — | Aura (liga/desliga) · 6 blocos: regeneração 1. |
| 75 | Forma Seráfica | instantâneo | 42s | 40 | Em você: resistência 2, regeneração 2, velocidade 1. |
| 76 | Asas de Fogo Branco | duração | 24s | 28 | Lâminas girando · 3 blocos · 7s: 4 de dano, incendeia, sagrado. |
| 77 | Avatar da Luz | instantâneo | 38s | 34 | Em você: força 2, você brilha, visão noturna. |
| 78 | Coro Celestial | duração | 30s | 30 | Área persistente · 6 blocos · 7s: 2 de dano, sagrado, regeneração 1. |

### Suprema (5)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
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
| 83 | Chama na Pele | passiva | — | — | Passiva: golpes incendeiam. |
| 84 | Sede de Caos | passiva | — | — | Passiva: cura ao abater. |
| 85 | Brasas Eternas | passiva | — | — | Passiva: nada na lava. |
| 86 | Ódio Crescente | passiva | — | — | Passiva: mais dano quanto menos vida. |
| 87 | Couro do Inferno | passiva | — | — | Passiva: resiste mais com pouca vida. |
| 88 | Pés de Brasa | passiva | — | — | Passiva: sem dano de queda. |
| 89 | Corrupção | passiva | — | — | Passiva: golpes fazem murchar. |

### Movimento (9)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 1 | Voo Infernal | instantâneo | 1s | — | Liga/desliga o voo com as asas: olhe e ande para voar, pule sobe, agache desce. |
| 54 | Investida em Chamas | instantâneo | 6s | 8 | Avanço · 12 blocos: 4 de dano, queima 2s. |
| 55 | Passo do Abismo | instantâneo | 6s | 8 | Teleporte · 14 blocos: queima 1s. |
| 56 | Asas de Brasa | instantâneo | 14s | 10 | Em você: velocidade 2, imune a fogo. |
| 57 | Troca Infernal | alvo | 14s | 14 | Troca de lugar com o alvo · 16 blocos: queima 3s. |
| 58 | Salto Explosivo | instantâneo | 9s | 12 | Salto com impacto · 12 blocos: 5 de dano, queima 2s, empurra. |
| 59 | Gancho de Corrente | instantâneo | 12s | 12 | Gancho até a mira · 22 blocos: velocidade 2. |
| 60 | Queda Demoníaca | instantâneo | 12s | 16 | Salta e cai com impacto · 14 blocos: 8 de dano, queima 3s, empurra. |
| 61 | Rastro de Fumaça | instantâneo | 18s | 14 | Em você: velocidade 2, invisível. |

### Ataque (27)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 5 | Bola de Fogo Infernal | instantâneo | 5s | 10 | Projétil · 26 blocos: 8 de dano, queima 4s, estouro de 2 blocos. |
| 6 | Sopro do Abismo | instantâneo | 7s | 12 | Cone à frente · 6 blocos: 5 de dano, queima 5s. |
| 7 | Chicote de Brasas | instantâneo | 7s | 12 | Cone à frente · 7 blocos: 6 de dano, queima 3s, puxa. |
| 8 | Correntes do Inferno | alvo | 11s | 16 | Puxa e golpeia · 10 blocos: 7 de dano, queima 3s, atordoa 0.8s. |
| 9 | Meteoro Rubro | instantâneo | 10s | 16 | Projétil em arco · 24 blocos: 10 de dano, queima 4s, estouro de 3 blocos. |
| 10 | Explosão Sulfúrica | instantâneo | 12s | 20 | Explosão ao redor · 5 blocos: 9 de dano, queima 3s, empurra. |
| 11 | Lança de Magma | instantâneo | 10s | 16 | Raio em linha · 20 blocos: 9 de dano, queima 4s. |
| 12 | Fogo Encadeado | alvo | 10s | 16 | Salta entre alvos · 12 blocos · 5×: 5 de dano, queima 3s. |
| 13 | Chuva de Enxofre | instantâneo | 16s | 26 | Chuva de impactos · 7 blocos · 10×: 5 de dano, queima 4s, veneno. |
| 14 | Tridente Infernal | instantâneo | 8s | 12 | Leque de projéteis · 18 blocos · 3×: 5 de dano, queima 2s. |
| 15 | Garra Demoníaca | instantâneo | 8s | 12 | Avanço · 9 blocos: 8 de dano, queima 2s, fraqueza 1. |
| 16 | Pilar de Fogo | instantâneo | 10s | 16 | Coluna sob o alvo · 18 blocos: 8 de dano, queima 5s, lança para o alto. |
| 17 | Roda de Fogo | instantâneo | 9s | 12 | Vai e volta · 16 blocos: 7 de dano, queima 3s. |
| 18 | Rastro Incandescente | instantâneo | 14s | 16 | Rastro de fogo · 10 blocos · 5s: 2 de dano, queima 3s. |
| 19 | Mergulho do Abismo | instantâneo | 12s | 18 | Salta e cai com impacto · 14 blocos: 10 de dano, queima 4s. |
| 20 | Maldição Ardente | alvo | 12s | 14 | No alvo da mira · 16 blocos: murchar, queima 4s. |
| 21 | Onda de Lava | instantâneo | 11s | 16 | Onda pelo chão · 14 blocos: 7 de dano, queima 4s. |
| 22 | Bomba de Almas | instantâneo | 9s | 14 | Projétil · 22 blocos: 6 de dano, murchar, estouro de 3 blocos. |
| 23 | Coroa de Espinhos | duração | 18s | 22 | Lâminas girando · 3 blocos · 5s: 4 de dano, queima 2s. |
| 24 | Execução Infernal | alvo | 18s | 24 | No alvo da mira · 6 blocos: executa abaixo de 30% de vida, queima 5s. |
| 25 | Lança Sombria | instantâneo | 12s | 18 | Raio em linha · 18 blocos: 7 de dano, escuridão, murchar. |
| 26 | Inferno em Cruz | instantâneo | 14s | 20 | Cruz de ondas · 10 blocos: 8 de dano, queima 4s. |
| 27 | Estilhaço de Obsidiana | instantâneo | 8s | 10 | Leque de projéteis · 16 blocos · 7×: 4 de dano, lentidão 1. |
| 28 | Garras Gêmeas | alvo | 7s | 10 | No alvo da mira · 4 blocos: 5 de dano, sangramento 3s, queima 2s. |
| 29 | Fogo de Gehenna | duração | 22s | 26 | Área persistente · 5 blocos · 6s: 2 de dano, queima 3s. |
| 90 | Lâmina de Brasa | alvo | 13s | 16 | Agarra e arremessa · 5 blocos: 6 de dano, queima 4s, empurra. |
| 95 | Estrela Negra | instantâneo | 10s | 14 | Projétil · 24 blocos: 7 de dano, escuridão, estouro de 2 blocos. |

### Defesa (13)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 30 | Couraça de Lava | instantâneo | 22s | 20 | Em você: imune a fogo, resistência 1. |
| 31 | Escudo de Brasas | instantâneo | 24s | 20 | Em você: devolve 5 de dano, imune a fogo. |
| 32 | Pacto de Sangue Negro | instantâneo | 26s | 18 | Em você: +12 de vida extra, te enfraquece. |
| 33 | Muralha de Fogo | duração | 20s | 20 | Muro · 5 blocos · 7s: queima 4s. |
| 34 | Fuga Sulfúrica | instantâneo | 9s | 12 | Teleporte · 10 blocos: queima 2s, resistência 1. |
| 35 | Pele de Obsidiana | instantâneo | 26s | 22 | Em você: resistência 3, lentidão 2. |
| 36 | Regeneração Profana | instantâneo | 26s | 24 | Em você: regeneração 2. |
| 37 | Fumaça Negra | duração | 22s | 22 | Área persistente · 4 blocos · 5s: cega, invisível. |
| 38 | Contrato Vital | instantâneo | 28s | 10 | Em você: cura 12, custa 4 de vida. |
| 39 | Domo Ígneo | duração | 30s | 28 | Domo · 3 blocos · 7s: queima 2s, resistência 1. |
| 40 | Sacrifício | instantâneo | 26s | 14 | Em você: limpa efeitos ruins, +8 de vida extra, custa 2 de vida. |
| 41 | Escamas Infernais | instantâneo | 28s | 22 | Em você: resistência 1. |
| 92 | Cinzas Quentes | instantâneo | 22s | 16 | Em você: invisível, imune a fogo, velocidade 1. |

### Utilidade (10)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 62 | Farejar Almas | instantâneo | 16s | 6 | Revela criaturas · 32 blocos: revela. |
| 63 | Tocha Viva | instantâneo | 10s | 4 | Luz que acompanha · 30s: efeito especial. |
| 64 | Fome do Abismo | instantâneo | 30s | 10 | Em você: sacia a fome. |
| 65 | Visão Infernal | instantâneo | 28s | 8 | Em você: visão noturna, imune a fogo. |
| 66 | Ponte de Basalto | instantâneo | 14s | 10 | Ponte temporária · 12 blocos · 15s: efeito especial. |
| 67 | Colheita de Almas | instantâneo | 16s | 6 | Puxa itens · 12 blocos: efeito especial. |
| 68 | Marca do Caçador Infernal | alvo | 12s | 6 | Marca · 26 blocos: marca (+25% dano), revela. |
| 69 | Forja Infernal | instantâneo | 24s | 10 | Funde minérios da mão: efeito especial. |
| 70 | Portal Menor | instantâneo | 60s | 20 | Volta ao lar: efeito especial. |
| 71 | Barganha | instantâneo | 40s | 20 | Troca vida por energia: efeito especial. |

### Apoio (7)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 72 | Fúria Infernal | instantâneo | 26s | 24 | Em você: força 2, velocidade 1. |
| 73 | Pacto de Guerra | instantâneo | 24s | 20 | Em você e aliados · 10 blocos: força 1, imune a fogo. |
| 74 | Banquete de Almas | instantâneo | 20s | 24 | Explosão ao redor · 5 blocos: 3 de dano, murchar, rouba 60% em vida. |
| 75 | Sangue Ardente | instantâneo | 26s | 20 | Em você: pressa, força 1. |
| 76 | Bênção Profana | instantâneo | 26s | 24 | Em você e aliados · 8 blocos: regeneração 1, resistência 1. |
| 77 | Renascer das Cinzas | instantâneo | 60s | 45 | Em você: cura 16, imune a fogo, +4 de vida extra. |
| 94 | Inferno Pessoal | instantâneo | 30s | 24 | Em você: força 1, regeneração 1, imune a fogo. |

### Controle (14)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 42 | Olhar do Medo | alvo | 14s | 16 | No alvo da mira · 14 blocos: medo, fraqueza 2. |
| 43 | Correntes Rubras | instantâneo | 14s | 16 | Gancho até a mira · 16 blocos: lentidão 3, queima 2s. |
| 44 | Selo do Inferno | duração | 16s | 18 | Armadilha · 14 blocos · 10s: prende 4.0s, queima 3s. |
| 45 | Vórtice de Chamas | duração | 20s | 24 | Redemoinho · 6 blocos · 4s: puxa, queima 2s. |
| 46 | Maldição da Fraqueza | alvo | 12s | 8 | Marca · 20 blocos: marca (+25% dano), fraqueza 2. |
| 47 | Grito Infernal | instantâneo | 18s | 20 | Explosão ao redor · 7 blocos: medo, lentidão 2, queima 1s. |
| 48 | Amarras de Enxofre | alvo | 18s | 20 | No alvo da mira · 12 blocos: prende 5.0s, veneno. |
| 49 | Gravidade Rubra | instantâneo | 18s | 22 | Explosão ao redor · 8 blocos: puxa, atordoa 1.0s. |
| 50 | Silêncio Profano | alvo | 20s | 22 | No alvo da mira · 14 blocos: silencia 6.0s, murchar. |
| 51 | Escuridão Sulfúrica | instantâneo | 16s | 18 | Cone à frente · 8 blocos: escuridão, cega. |
| 52 | Arrebatar | alvo | 14s | 16 | Agarra e arremessa · 5 blocos: 5 de dano, queima 2s, lança para o alto. |
| 53 | Sentença | alvo | 20s | 24 | No alvo da mira · 12 blocos: atordoa 2.5s, queima 3s. |
| 91 | Pântano Sulfúrico | duração | 22s | 22 | Área persistente · 5 blocos · 6s: lentidão 2, veneno. |
| 93 | Grilhões | instantâneo | 12s | 14 | pull · 12 blocos: puxa, queima 2s. |

### Transformação (5)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 78 | Aura Infernal | alternar | 1s | — | Aura (liga/desliga) · 5 blocos: queima 2s. |
| 79 | Forma do Arquidemônio | instantâneo | 42s | 40 | Em você: força 3, resistência 1, imune a fogo. |
| 80 | Asas Flamejantes | duração | 24s | 28 | Lâminas girando · 3 blocos · 7s: 4 de dano, queima 3s, empurra. |
| 81 | Avatar do Caos | instantâneo | 36s | 30 | Em você: velocidade 2, força 2, te enfraquece. |
| 82 | Círculo Profano | duração | 30s | 30 | Área persistente · 6 blocos · 7s: 2 de dano, queima 2s, força 1. |

### Suprema (5)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 96 | Apocalipse | instantâneo | 90s | 60 | Chuva de impactos · 10 blocos · 14×: 13 de dano, queima 6s, estouro de 3 blocos. |
| 97 | Portão do Inferno | duração | 85s | 60 | Área persistente · 10 blocos · 10s: 4 de dano, queima 4s, puxa. |
| 98 | Ira do Arquidemônio | instantâneo | 80s | 55 | Explosão ao redor · 12 blocos: 16 de dano, queima 6s, empurra, medo. |
| 99 | Contrato Final | alvo | 100s | 70 | No alvo da mira · 10 blocos: executa abaixo de 50% de vida, queima 8s, murchar. |
| 100 | Legião Infernal | duração | 95s | 70 | Invocação · 10× · 10s: 6 de dano, queima 3s. |

## DEUS (Energia Divina)

### Passiva (9)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 2 | Coroa de Luz | passiva | — | — | Passiva: auréola/coroa sobre a cabeça. |
| 4 | Graça Absoluta | passiva | — | — | Passiva: regeneração da raça. |
| 79 | Toque Sagrado | passiva | — | — | Passiva: golpes sagrados ferem mais demônios, trevas e mortos-vivos. |
| 80 | Imaculado | passiva | — | — | Passiva: imune a veneno e murchar. |
| 81 | Plumas de Ouro | passiva | — | — | Passiva: sem dano de queda. |
| 82 | Vontade Eterna | passiva | — | — | Passiva: resiste mais com pouca vida. |
| 83 | Clemência | passiva | — | — | Passiva: cura ao abater. |
| 84 | Luz Perpétua | passiva | — | — | Passiva: regenera mais de dia. |
| 85 | Presença | passiva | — | — | Passiva: monstros perto ficam com medo. |

### Movimento (10)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 1 | Voo Divino | instantâneo | 1s | — | Liga/desliga o voo com as asas: olhe e ande para voar, pule sobe, agache desce. |
| 50 | Teleporte Celestial | instantâneo | 6s | 10 | Teleporte · 20 blocos: velocidade 2. |
| 51 | Rasante Divino | instantâneo | 7s | 10 | Avanço · 16 blocos: 6 de dano, empurra, sagrado. |
| 52 | Ascensão Gloriosa | instantâneo | 12s | 8 | Em você: levita, queda lenta. |
| 53 | Troca do Destino | alvo | 14s | 14 | Troca de lugar com o alvo · 22 blocos: atordoa 1.0s, sagrado. |
| 54 | Fio de Aurora | instantâneo | 10s | 10 | Gancho até a mira · 28 blocos: velocidade 3. |
| 55 | Descida dos Céus | instantâneo | 12s | 16 | Salta e cai com impacto · 16 blocos: 9 de dano, empurra, sagrado. |
| 56 | Velocidade da Luz | instantâneo | 18s | 16 | Em você: velocidade 4. |
| 57 | Planar Majestoso | instantâneo | 10s | 4 | Em você: queda lenta, super pulo. |
| 91 | Asas da Aurora | instantâneo | 10s | 10 | Salto com impacto · 16 blocos: empurra, sagrado, queda lenta. |

### Ataque (23)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 5 | Julgamento | instantâneo | 8s | 14 | Coluna sob o alvo · 22 blocos: 12 de dano, sagrado. |
| 6 | Raio do Firmamento | instantâneo | 8s | 14 | Raio em linha · 28 blocos: 11 de dano, sagrado. |
| 7 | Lâminas Celestes | instantâneo | 7s | 12 | Leque de projéteis · 22 blocos · 7×: 5 de dano, sagrado. |
| 8 | Estrela da Manhã | instantâneo | 8s | 14 | Projétil · 30 blocos: 11 de dano, estouro de 3 blocos, sagrado. |
| 9 | Espada Arremessada | instantâneo | 9s | 14 | Vai e volta · 20 blocos: 10 de dano, sagrado. |
| 10 | Corte do Horizonte | instantâneo | 10s | 16 | Onda pelo chão · 20 blocos: 9 de dano, sagrado. |
| 11 | Cruz Sagrada | instantâneo | 12s | 18 | Cruz de ondas · 12 blocos: 10 de dano, sagrado. |
| 12 | Coroa de Espadas | duração | 18s | 24 | Lâminas girando · 3.5 blocos · 6s: 5 de dano, sagrado. |
| 13 | Chuva Áurea | instantâneo | 14s | 24 | Chuva de impactos · 8 blocos · 12×: 7 de dano, sagrado. |
| 14 | Martelo da Justiça | instantâneo | 12s | 18 | Salta e cai com impacto · 14 blocos: 12 de dano, atordoa 1.0s, sagrado. |
| 15 | Pulso Solar | instantâneo | 12s | 20 | Explosão ao redor · 6 blocos: 9 de dano, incendeia, sagrado. |
| 16 | Sentença Corrente | alvo | 10s | 16 | Salta entre alvos · 16 blocos · 6×: 7 de dano, sagrado. |
| 17 | Lança Primordial | instantâneo | 12s | 18 | Projétil · 36 blocos: 14 de dano, empurra, sagrado. |
| 18 | Golpe do Criador | instantâneo | 9s | 14 | Avanço · 12 blocos: 10 de dano, sagrado. |
| 19 | Selo da Purificação | alvo | 10s | 14 | No alvo da mira · 18 blocos: 8 de dano, tira efeitos bons do alvo, sagrado. |
| 20 | Luz Implacável | instantâneo | 12s | 18 | Raio em linha · 24 blocos: 7 de dano, cega, revela, sagrado. |
| 21 | Fim dos Tempos | alvo | 20s | 28 | No alvo da mira · 18 blocos: executa abaixo de 30% de vida, 8 de dano, sagrado. |
| 22 | Gládio Gêmeo | instantâneo | 8s | 14 | Cone à frente · 6 blocos: 10 de dano, empurra, sagrado. |
| 23 | Estilhaços de Sol | instantâneo | 9s | 14 | Projétil em arco · 24 blocos: 9 de dano, incendeia, estouro de 2 blocos, sagrado. |
| 24 | Mão de Deus | alvo | 12s | 18 | Puxa e golpeia · 12 blocos: 10 de dano, atordoa 1.0s, sagrado. |
| 25 | Fulgor | instantâneo | 12s | 16 | Explosão ao redor · 7 blocos: 6 de dano, cega, sagrado. |
| 87 | Lança Gêmea | instantâneo | 9s | 14 | Leque de projéteis · 24 blocos · 2×: 8 de dano, empurra, sagrado. |
| 89 | Céu Partido | instantâneo | 14s | 20 | Cruz de ondas · 12 blocos: 8 de dano, lança para o alto, sagrado. |

### Defesa (13)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 26 | Muralha da Criação | duração | 18s | 18 | Muro · 6 blocos · 10s: empurra, sagrado. |
| 27 | Égide Absoluta | instantâneo | 30s | 30 | Em você: resistência 3. |
| 28 | Bastião de Luz | duração | 32s | 32 | Domo · 4 blocos · 8s: resistência 2, regeneração 1. |
| 29 | Manto Estelar | instantâneo | 30s | 28 | Em você: +16 de vida extra. |
| 30 | Graça Imaculada | instantâneo | 26s | 20 | Em você: limpa efeitos ruins, resistência 1, imune a fogo. |
| 31 | Reflexo Divino | instantâneo | 24s | 22 | Em você: devolve 8 de dano. |
| 32 | Passo Imortal | instantâneo | 8s | 12 | Teleporte · 12 blocos: resistência 2. |
| 33 | Renovação | instantâneo | 24s | 28 | Em você: cura 14. |
| 34 | Santuário Maior | duração | 32s | 32 | Área persistente · 6 blocos · 8s: empurra, regeneração 1, resistência 1. |
| 35 | Pele de Diamante Celeste | instantâneo | 30s | 24 | Em você: resistência 1, devolve 3 de dano. |
| 36 | Asas Escudo | instantâneo | 22s | 20 | Em você: resistência 2, queda lenta. |
| 37 | Bênção Inviolável | instantâneo | 28s | 26 | Em você: regeneração 2, +4 de vida extra. |
| 90 | Pedra Angular | duração | 20s | 20 | Muro · 6 blocos · 8s: atordoa 1.0s, sagrado. |

### Utilidade (12)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 3 | Chamar a Lâmina Divina | instantâneo | 20s | — | Chama a sua arma da raça de volta para a mão (a cópia antiga some: nunca duplica). |
| 58 | Criar Ponte de Luz | instantâneo | 12s | 8 | Ponte temporária · 18 blocos · 20s: efeito especial. |
| 59 | Criar Plataforma | instantâneo | 12s | 8 | Plataforma temporária · 4 blocos · 20s: efeito especial. |
| 60 | Criar Luz | instantâneo | 8s | 2 | Luz que acompanha · 45s: efeito especial. |
| 61 | Pão Celestial | instantâneo | 30s | 8 | Em você: sacia a fome. |
| 62 | Onisciência | instantâneo | 14s | 6 | Revela criaturas · 48 blocos: revela. |
| 63 | Visão do Criador | instantâneo | 18s | 10 | Revela minérios · 16 blocos: efeito especial. |
| 64 | Recolher Tudo | instantâneo | 14s | 4 | Puxa itens · 16 blocos: efeito especial. |
| 65 | Retorno ao Lar | instantâneo | 50s | 16 | Volta ao lar: efeito especial. |
| 66 | Paz Divina | instantâneo | 24s | 12 | Acalma monstros · 24 blocos: efeito especial. |
| 67 | Florescer | instantâneo | 20s | 10 | Faz florescer · 6 blocos: efeito especial. |
| 94 | Profecia | alvo | 14s | 8 | Marca · 30 blocos: marca (+25% dano), revela, lentidão 1. |

### Apoio (8)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 68 | Bênção Suprema | instantâneo | 30s | 28 | Em você e aliados · 12 blocos: força 2, resistência 1, regeneração 1. |
| 69 | Cura Divina | instantâneo | 18s | 24 | Em você e aliados · 12 blocos: cura 12, limpa efeitos ruins. |
| 70 | Hino da Criação | instantâneo | 24s | 20 | Em você e aliados · 12 blocos: velocidade 2, pressa, super pulo. |
| 71 | Proteção dos Fiéis | instantâneo | 28s | 26 | Em você e aliados · 10 blocos: +8 de vida extra, resistência 1. |
| 72 | Fôlego Divino | instantâneo | 30s | 10 | Em você: respira na água, visão noturna, imune a fogo. |
| 73 | Renascimento | instantâneo | 90s | 60 | Em você: cura 30, +16 de vida extra, limpa efeitos ruins. |
| 86 | Cântico Celestial | duração | 30s | 28 | Área persistente · 6 blocos · 7s: regeneração 2, velocidade 1. |
| 92 | Toque da Vida | alvo | 12s | 16 | No alvo da mira · 18 blocos: cura 14, +4 de vida extra. |

### Controle (14)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 38 | Gravidade Divina | instantâneo | 18s | 22 | Explosão ao redor · 9 blocos: puxa, atordoa 1.0s, sagrado. |
| 39 | Correntes da Justiça | instantâneo | 14s | 16 | Gancho até a mira · 20 blocos: lentidão 3, sagrado. |
| 40 | Prisão de Luz | duração | 16s | 18 | Armadilha · 16 blocos · 10s: prende 5.0s, revela. |
| 41 | Palavra de Poder | alvo | 20s | 24 | No alvo da mira · 16 blocos: atordoa 3.0s, sagrado. |
| 42 | Ascensão | alvo | 16s | 18 | No alvo da mira · 16 blocos: levita, sagrado. |
| 43 | Silêncio dos Céus | instantâneo | 20s | 22 | Cone à frente · 8 blocos: silencia 5.0s, sagrado. |
| 44 | Marca do Eleito | alvo | 12s | 8 | Marca · 28 blocos: marca (+25% dano), revela, sagrado. |
| 45 | Vendaval Sagrado | instantâneo | 12s | 14 | Cone à frente · 8 blocos: empurra, lentidão 1. |
| 46 | Vórtice Estelar | duração | 20s | 26 | Redemoinho · 7 blocos · 5s: puxa, levita, sagrado. |
| 47 | Ordem de Recuar | instantâneo | 18s | 20 | Explosão ao redor · 7 blocos: empurra, medo, sagrado. |
| 48 | Cegueira Divina | alvo | 16s | 18 | No alvo da mira · 18 blocos: cega, fraqueza 2. |
| 49 | Juízo Paralisante | instantâneo | 18s | 22 | Coluna sob o alvo · 18 blocos: atordoa 2.0s, sagrado. |
| 88 | Estigma | alvo | 12s | 14 | No alvo da mira · 18 blocos: sangramento 4s, revela, sagrado. |
| 93 | Selo Solar | duração | 16s | 18 | Armadilha · 16 blocos · 10s: atordoa 2.0s, incendeia. |

### Transformação (6)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 74 | Aura Divina | alternar | 1s | — | Aura (liga/desliga) · 8 blocos: regeneração 1. |
| 75 | Forma Transcendente | instantâneo | 45s | 45 | Em você: resistência 3, força 2, regeneração 2. |
| 76 | Halo de Lâminas | duração | 26s | 30 | Lâminas girando · 3.5 blocos · 8s: 6 de dano, lentidão 1, sagrado. |
| 77 | Avatar Solar | duração | 34s | 34 | Área persistente · 6 blocos · 8s: 3 de dano, incendeia, sagrado, resistência 1. |
| 78 | Olhar Divino | instantâneo | 30s | 20 | Em você: visão noturna, você brilha, força 1. |
| 95 | Coroa Radiante | alternar | 1s | — | Aura (liga/desliga) · 6 blocos: cega, sagrado. |

### Suprema (5)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 96 | Juízo Final | instantâneo | 100s | 70 | Chuva de impactos · 12 blocos · 20×: 18 de dano, atordoa 1.5s, sagrado. |
| 97 | Gênese | duração | 95s | 70 | Área persistente · 10 blocos · 12s: regeneração 3, resistência 2, +2 de vida extra. |
| 98 | Sol Divino | instantâneo | 90s | 65 | Explosão ao redor · 14 blocos: 20 de dano, incendeia, cega, sagrado. |
| 99 | Espada do Firmamento | instantâneo | 85s | 60 | Raio em linha · 40 blocos: 32 de dano, empurra, sagrado. |
| 100 | Exército Celestial | duração | 110s | 80 | Invocação · 12× · 12s: 8 de dano, sagrado. |

## TREVAS (Vazio)

### Passiva (9)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 2 | Coroa Negra | passiva | — | — | Passiva: auréola/coroa sobre a cabeça. |
| 4 | Pulso Sombrio | passiva | — | — | Passiva: regeneração da raça. |
| 79 | Toque Decadente | passiva | — | — | Passiva: golpes fazem murchar. |
| 80 | Ceifador | passiva | — | — | Passiva: cura ao abater. |
| 81 | Sem Peso | passiva | — | — | Passiva: sem dano de queda. |
| 82 | Vontade do Vazio | passiva | — | — | Passiva: resiste mais com pouca vida. |
| 83 | Pés de Cinza | passiva | — | — | Passiva: imune a veneno e murchar. |
| 84 | Sombra Esquiva | passiva | — | — | Passiva: chance de esquivar de golpes. |
| 85 | Presença Sombria | passiva | — | — | Passiva: monstros perto ficam com medo. |

### Movimento (10)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 1 | Voo do Vazio | instantâneo | 1s | — | Liga/desliga o voo com as asas: olhe e ande para voar, pule sobe, agache desce. |
| 50 | Salto Sombrio | instantâneo | 5s | 8 | Teleporte · 18 blocos: velocidade 2. |
| 51 | Investida da Foice | instantâneo | 7s | 10 | Avanço · 14 blocos: 6 de dano, vira cinzas. |
| 52 | Troca de Almas | alvo | 14s | 14 | Troca de lugar com o alvo · 20 blocos: escuridão. |
| 53 | Mergulho no Vazio | instantâneo | 12s | 16 | Salta e cai com impacto · 16 blocos: 9 de dano, escuridão. |
| 54 | Fio de Sombra | instantâneo | 10s | 10 | Gancho até a mira · 26 blocos: velocidade 3. |
| 55 | Andar nas Sombras | instantâneo | 18s | 16 | Em você: velocidade 3, invisível. |
| 56 | Queda Lenta Negra | instantâneo | 10s | 4 | Em você: queda lenta, super pulo. |
| 57 | Ascensão Sombria | instantâneo | 12s | 8 | Em você: levita, queda lenta. |
| 89 | Passo do Ceifador | instantâneo | 10s | 12 | Salto com impacto · 14 blocos: 5 de dano, vira cinzas. |

### Ataque (24)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 5 | Ceifar | instantâneo | 6s | 10 | Cone à frente · 5 blocos: 10 de dano, vira cinzas. |
| 6 | Foice Arremessada | instantâneo | 9s | 14 | Vai e volta · 20 blocos: 10 de dano, murchar. |
| 7 | Corte do Vazio | instantâneo | 10s | 16 | Onda pelo chão · 18 blocos: 9 de dano, escuridão. |
| 8 | Lua Negra | instantâneo | 8s | 14 | Projétil · 28 blocos: 11 de dano, murchar. |
| 9 | Espinhos de Sombra | instantâneo | 7s | 12 | Leque de projéteis · 20 blocos · 7×: 5 de dano, lentidão 1. |
| 10 | Colapso | instantâneo | 12s | 20 | Explosão ao redor · 6 blocos: 10 de dano, puxa. |
| 11 | Erosão | alvo | 9s | 12 | No alvo da mira · 16 blocos: 6 de dano, decomposição 3s. |
| 12 | Ceifa Encadeada | alvo | 10s | 16 | Salta entre alvos · 14 blocos · 6×: 7 de dano, murchar. |
| 13 | Garras da Escuridão | alvo | 12s | 18 | Puxa e golpeia · 12 blocos: 9 de dano, escuridão. |
| 14 | Pilar do Abismo | instantâneo | 10s | 16 | Coluna sob o alvo · 20 blocos: 10 de dano, levita. |
| 15 | Chuva de Cinzas | instantâneo | 16s | 26 | Chuva de impactos · 8 blocos · 12×: 6 de dano, cega, decomposição 2s. |
| 16 | Lâmina Fantasma | instantâneo | 8s | 12 | Avanço · 12 blocos: 9 de dano, escuridão. |
| 17 | Rasgo Dimensional | instantâneo | 10s | 16 | Raio em linha · 24 blocos: 10 de dano, murchar. |
| 18 | Cruz de Sombras | instantâneo | 12s | 18 | Cruz de ondas · 12 blocos: 9 de dano, lentidão 2. |
| 19 | Anel de Foices | duração | 18s | 24 | Lâminas girando · 3.5 blocos · 6s: 5 de dano, murchar. |
| 20 | Esfera do Vazio | instantâneo | 9s | 14 | Projétil em arco · 24 blocos: 10 de dano, puxa, estouro de 2 blocos. |
| 21 | Toque das Cinzas | alvo | 18s | 26 | No alvo da mira · 5 blocos: executa abaixo de 35% de vida, vira cinzas. |
| 22 | Corte Duplo | alvo | 7s | 10 | No alvo da mira · 5 blocos: 6 de dano, sangramento 4s, escuridão. |
| 23 | Eco Sombrio | instantâneo | 12s | 18 | Explosão ao redor · 6 blocos: 6 de dano, silencia 3.0s. |
| 24 | Lança da Decadência | instantâneo | 10s | 16 | Projétil · 26 blocos: 8 de dano, decomposição 4s, veneno. |
| 25 | Implosão | duração | 18s | 24 | Redemoinho · 6 blocos · 3s: puxa, 3 de dano. |
| 86 | Ferrão do Nada | alvo | 10s | 14 | No alvo da mira · 16 blocos: 8 de dano, murchar, silencia 2.0s. |
| 87 | Sombra Gêmea | duração | 22s | 26 | Invocação · 3× · 8s: 5 de dano, cega. |
| 91 | Cinza Ardente | instantâneo | 10s | 14 | Projétil em arco · 24 blocos: 8 de dano, decomposição 3s, estouro de 3 blocos. |

### Defesa (14)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 26 | Manto do Vazio | instantâneo | 26s | 24 | Em você: invisível, resistência 1. |
| 27 | Casulo Sombrio | duração | 32s | 30 | Domo · 3 blocos · 7s: resistência 3. |
| 28 | Passo Entre Sombras | instantâneo | 8s | 12 | Teleporte · 12 blocos: escuridão, resistência 2. |
| 29 | Absorver Luz | instantâneo | 30s | 26 | Em você: +16 de vida extra, visão noturna. |
| 30 | Muralha de Cinzas | duração | 20s | 20 | Muro · 6 blocos · 8s: cega, decomposição 2s. |
| 31 | Reflexo Sombrio | instantâneo | 24s | 22 | Em você: devolve 8 de dano. |
| 32 | Pele de Ônix | instantâneo | 30s | 24 | Em você: resistência 1. |
| 33 | Fuga Etérea | instantâneo | 22s | 18 | Em você: invisível, velocidade 3, resistência 2. |
| 34 | Devorar Dor | instantâneo | 26s | 26 | Em você: cura 12, limpa efeitos ruins. |
| 35 | Névoa Negra | duração | 24s | 24 | Área persistente · 5 blocos · 6s: escuridão, invisível. |
| 36 | Corpo de Sombra | instantâneo | 24s | 20 | Em você: resistência 2, queda lenta. |
| 37 | Fome do Vazio | instantâneo | 22s | 24 | Explosão ao redor · 6 blocos: 3 de dano, rouba 70% em vida. |
| 90 | Escudo de Almas | duração | 26s | 24 | Lâminas girando · 3 blocos · 6s: empurra, +4 de vida extra. |
| 93 | Torre Negra | duração | 20s | 20 | Muro · 6 blocos · 8s: escuridão, lentidão 2. |

### Utilidade (12)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 3 | Chamar a Foice do Vazio | instantâneo | 20s | — | Chama a sua arma da raça de volta para a mão (a cópia antiga some: nunca duplica). |
| 58 | Sentir Almas | instantâneo | 14s | 6 | Revela criaturas · 48 blocos: revela. |
| 59 | Visão do Vazio | instantâneo | 16s | 2 | Em você: visão noturna. |
| 60 | Devorar Fome | instantâneo | 30s | 8 | Em você: sacia a fome. |
| 61 | Ponte de Obsidiana | instantâneo | 14s | 10 | Ponte temporária · 16 blocos · 20s: efeito especial. |
| 62 | Aspirar Almas | instantâneo | 14s | 4 | Puxa itens · 16 blocos: efeito especial. |
| 63 | Portal Sombrio | instantâneo | 50s | 16 | Volta ao lar: efeito especial. |
| 64 | Olho do Abismo | instantâneo | 18s | 10 | Revela minérios · 16 blocos: efeito especial. |
| 65 | Silêncio do Mundo | instantâneo | 24s | 12 | Acalma monstros · 24 blocos: efeito especial. |
| 66 | Cinzas ao Vento | instantâneo | 12s | 8 | Desfaz em cinzas · 3 blocos: efeito especial. |
| 67 | Plataforma Sombria | instantâneo | 12s | 8 | Plataforma temporária · 4 blocos · 20s: efeito especial. |
| 95 | Respiração da Noite | instantâneo | 30s | 10 | Em você: visão noturna, invisível, queda lenta. |

### Apoio (7)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 68 | Pacto do Vazio | instantâneo | 30s | 28 | Em você: força 2, resistência 1. |
| 69 | Sombras Aliadas | instantâneo | 26s | 22 | Em você e aliados · 10 blocos: invisível, velocidade 1. |
| 70 | Banquete de Almas Negras | instantâneo | 22s | 24 | Explosão ao redor · 6 blocos: murchar, rouba 50% em vida. |
| 71 | Força Abissal | instantâneo | 30s | 26 | Em você: força 3, pressa. |
| 72 | Fôlego do Abismo | instantâneo | 28s | 10 | Em você: respira na água, imune a fogo. |
| 73 | Renascer Sombrio | instantâneo | 90s | 60 | Em você: cura 30, +12 de vida extra, invisível. |
| 94 | Vínculo Sombrio | instantâneo | 26s | 24 | Em você e aliados · 10 blocos: resistência 1, +4 de vida extra. |

### Controle (14)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 38 | Prisão Sombria | duração | 16s | 18 | Armadilha · 16 blocos · 10s: prende 5.0s, escuridão. |
| 39 | Gravidade Esmagadora | instantâneo | 18s | 22 | Explosão ao redor · 9 blocos: puxa, lentidão 3. |
| 40 | Silêncio Absoluto | alvo | 22s | 24 | No alvo da mira · 16 blocos: silencia 8.0s. |
| 41 | Medo Primordial | instantâneo | 20s | 22 | Explosão ao redor · 8 blocos: medo, fraqueza 2, escuridão. |
| 42 | Correntes do Abismo | instantâneo | 14s | 16 | Gancho até a mira · 20 blocos: lentidão 4, murchar. |
| 43 | Olhar do Nada | alvo | 20s | 24 | No alvo da mira · 16 blocos: atordoa 3.0s, escuridão. |
| 44 | Marca da Morte | alvo | 12s | 8 | Marca · 26 blocos: marca (+25% dano), decomposição 2s. |
| 45 | Levitação Negra | alvo | 16s | 18 | No alvo da mira · 16 blocos: levita, murchar. |
| 46 | Vácuo | instantâneo | 16s | 20 | Cone à frente · 8 blocos: puxa, silencia 3.0s. |
| 47 | Zona de Treva | duração | 24s | 26 | Área persistente · 6 blocos · 7s: cega, lentidão 2, silencia quem está dentro. |
| 48 | Arrastar ao Abismo | alvo | 14s | 16 | Puxa e golpeia · 10 blocos: atordoa 1.5s, escuridão. |
| 49 | Sentença Sombria | instantâneo | 18s | 22 | Coluna sob o alvo · 18 blocos: atordoa 2.0s, decomposição 2s. |
| 88 | Fenda | instantâneo | 14s | 16 | Onda pelo chão · 16 blocos: prende 3.0s, decomposição 2s. |
| 92 | Silêncio Cortante | instantâneo | 12s | 14 | Avanço · 12 blocos: silencia 3.0s, 5 de dano. |

### Transformação (5)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 74 | Aura do Vazio | alternar | 1s | — | Aura (liga/desliga) · 6 blocos: murchar, lentidão 1. |
| 75 | Forma Ceifadora | instantâneo | 45s | 45 | Em você: força 3, velocidade 2, resistência 1. |
| 76 | Tempestade de Foices | duração | 26s | 30 | Lâminas girando · 4 blocos · 8s: 6 de dano, vira cinzas. |
| 77 | Avatar do Nada | duração | 34s | 34 | Área persistente · 6 blocos · 8s: 3 de dano, decomposição 1s, escuridão, resistência 1. |
| 78 | Eclipse Pessoal | instantâneo | 32s | 24 | Em você: invisível, visão noturna, força 2. |

### Suprema (5)

| # | Poder | Modo | Recarga | Custo | O que faz |
|---|---|---|---|---|---|
| 96 | Fim de Tudo | instantâneo | 100s | 70 | Explosão ao redor · 14 blocos: 22 de dano, vira cinzas, murchar. |
| 97 | Buraco Negro | duração | 90s | 65 | Redemoinho · 12 blocos · 8s: puxa, 5 de dano, silencia 2.0s. |
| 98 | Noite sem Fim | duração | 95s | 70 | Área persistente · 12 blocos · 12s: escuridão, 4 de dano, decomposição 1s, silencia quem está dentro. |
| 99 | Ceifa das Almas | alvo | 85s | 60 | Salta entre alvos · 20 blocos · 10×: 14 de dano, vira cinzas, rouba 40% em vida. |
| 100 | Legião de Sombras | duração | 110s | 80 | Invocação · 12× · 12s: 7 de dano, escuridão. |

## Supremas (todas as raças)

| Raça | Poder | Recarga | Custo | Efeito |
|---|---|---|---|---|
| Vampiro | Eclipse Sangrento | 90s | 60 | Explosão ao redor · 10 blocos: 14 de dano, sangramento 5s, cega, rouba 40% em vida. |
| Vampiro | Lua Carmesim | 80s | 60 | Área persistente · 10 blocos · 10s: 3 de dano, fraqueza 2, regeneração 2. |
| Vampiro | Rei dos Morcegos | 85s | 60 | Invocação · 14× · 10s: 5 de dano, cega. |
| Vampiro | Sede de Mil Anos | 75s | 55 | Salta entre alvos · 16 blocos · 8×: 9 de dano, sangramento 3s, rouba 50% em vida. |
| Vampiro | Noite Eterna | 95s | 70 | Explosão ao redor · 14 blocos: escuridão, atordoa 2.0s, 8 de dano. |
| Gigante | Cataclismo | 90s | 60 | Área persistente · 12 blocos · 8s: 5 de dano, lança para o alto, lentidão 2. |
| Gigante | Queda da Montanha | 85s | 60 | Chuva de impactos · 10 blocos · 16×: 14 de dano, atordoa 1.5s. |
| Gigante | Punho do Mundo | 80s | 55 | Raio em linha · 30 blocos: 24 de dano, empurra. |
| Gigante | Terremoto Ancestral | 95s | 70 | Explosão ao redor · 14 blocos: 16 de dano, lança para o alto, atordoa 2.0s. |
| Gigante | Golem Primordial | 100s | 70 | Invocação · 1× · 20s: 8 de dano, empurra. |
| Anjo | Julgamento Celestial | 90s | 60 | Chuva de impactos · 10 blocos · 16×: 12 de dano, atordoa 1.0s, sagrado. |
| Anjo | Arcanjo | 100s | 70 | Em você: resistência 3, regeneração 3, força 2, +16 de vida extra. |
| Anjo | Sol Nascente | 85s | 60 | Explosão ao redor · 12 blocos: 14 de dano, cega, incendeia, sagrado. |
| Anjo | Milagre | 110s | 80 | Em você e aliados · 16 blocos: cura 40, limpa efeitos ruins, +12 de vida extra. |
| Anjo | Lança dos Céus | 80s | 55 | Raio em linha · 36 blocos: 26 de dano, empurra, sagrado. |
| Demônio | Apocalipse | 90s | 60 | Chuva de impactos · 10 blocos · 14×: 13 de dano, queima 6s, estouro de 3 blocos. |
| Demônio | Portão do Inferno | 85s | 60 | Área persistente · 10 blocos · 10s: 4 de dano, queima 4s, puxa. |
| Demônio | Ira do Arquidemônio | 80s | 55 | Explosão ao redor · 12 blocos: 16 de dano, queima 6s, empurra, medo. |
| Demônio | Contrato Final | 100s | 70 | No alvo da mira · 10 blocos: executa abaixo de 50% de vida, queima 8s, murchar. |
| Demônio | Legião Infernal | 95s | 70 | Invocação · 10× · 10s: 6 de dano, queima 3s. |
| DEUS | Juízo Final | 100s | 70 | Chuva de impactos · 12 blocos · 20×: 18 de dano, atordoa 1.5s, sagrado. |
| DEUS | Gênese | 95s | 70 | Área persistente · 10 blocos · 12s: regeneração 3, resistência 2, +2 de vida extra. |
| DEUS | Sol Divino | 90s | 65 | Explosão ao redor · 14 blocos: 20 de dano, incendeia, cega, sagrado. |
| DEUS | Espada do Firmamento | 85s | 60 | Raio em linha · 40 blocos: 32 de dano, empurra, sagrado. |
| DEUS | Exército Celestial | 110s | 80 | Invocação · 12× · 12s: 8 de dano, sagrado. |
| TREVAS | Fim de Tudo | 100s | 70 | Explosão ao redor · 14 blocos: 22 de dano, vira cinzas, murchar. |
| TREVAS | Buraco Negro | 90s | 65 | Redemoinho · 12 blocos · 8s: puxa, 5 de dano, silencia 2.0s. |
| TREVAS | Noite sem Fim | 95s | 70 | Área persistente · 12 blocos · 12s: escuridão, 4 de dano, decomposição 1s, silencia quem está dentro. |
| TREVAS | Ceifa das Almas | 85s | 60 | Salta entre alvos · 20 blocos · 10×: 14 de dano, vira cinzas, rouba 40% em vida. |
| TREVAS | Legião de Sombras | 110s | 80 | Invocação · 12× · 12s: 7 de dano, escuridão. |
