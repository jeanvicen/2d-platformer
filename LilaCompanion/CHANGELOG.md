# Changelog

## 3.4.0 — A Maldição protetora: maior, mais solta, abraço que cura, fúria e poderes novos
- **Maior**: a Maldição normal agora tem 1,8× o tamanho (uns 8 blocos). A gigante cresceu junto.
- **Braços soltos**: os braços saem do corpo abertos (antes ficavam grudados no tronco).
- **Sair do chão de verdade**: o surgir ficou 35% mais lento (6,6 s), e o servidor não reinicia mais a
  animação logo depois de ela nascer (era isso que fazia ela "aparecer" inteira por um instante).
- **Abraço protetor**: quando você está quase morrendo (30% de vida), ela vem pelas suas costas, te
  abraça e te regenera. Enquanto te segura, fica fora de controle com tudo em volta: gritos, tremores,
  monstros arremessados, plantas arrancadas. Nunca destrói construção. Quando você se recupera, ela se
  acalma.
- **Fúria**: quando ela fica com pouca vida, cresce, dá um rugido enorme, recupera parte da vida e
  destrói tudo em volta por 20 s.
- **Frases especiais raras** (no máximo uma a cada 2 minutos): "NÃO TOCA EM QUEM É MEU!!", "SAI DE
  PERTO!!!", "...fica comigo.".
- **Poderes novos** (menu Combate), inspirados num espírito protetor de anime, sem copiar:
  - **«NÃO SE MEXAM»**: ordem amaldiçoada, congela todos os monstros em volta;
  - **«CAIAM»**: ordem amaldiçoada, esmaga todos contra o chão;
  - **Grito devastador**: um cone de energia sai da boca dela e arrasa o que estiver na frente;
  - **Esmagar**: agarra o inimigo, ergue acima da cabeça, esmaga e joga no chão;
  - **Abraço** (cura) e **FÚRIA** quando você quiser.
- **Sem invocar** (só com o item, a cabeça dela):
  - **Katana da Maldição**: lâmina negra com fio violeta, dano 15;
  - **Virar fumaça**;
  - **Cura da Maldição**;
  - **«NÃO SE MEXAM»**.
- 5 animações novas: abraço, fúria, acalmar, esmagar e ordem amaldiçoada.
- Testes no servidor oficial 1.26.65.1: com jogadores **50/50** (inclui o abraço que cura de 4 para 20 de vida e a katana sem invocar), sem jogador **60/61** (a falha: um passo de megaconstrução de teste levou 62 ms; o limite é 60).

## 3.3.4 — Animações reconstruídas, bote antes do golpe e raças removidas
- **Animações da Maldição refeitas no formato que o celular aceita.** O arquivo antigo tinha 341 KB numa
  linha só, com mais de 13 mil quadros-chave: o jogo recusava o arquivo inteiro e ela ficava sem NENHUMA
  animação (as partículas, que ficam em outro arquivo, funcionavam — por isso só a fumaça mexia). Agora
  cada animação tem o seu próprio arquivo normal, com poucas poses-chave e passagens suaves entre elas.
  Se uma der problema, as outras continuam.
- **Ela vai até o alvo antes de bater**: dá um bote com rastro de fumaça e cola no inimigo; nada de
  acertar de 4 blocos de distância.
- **Sistema de raças removido por completo** (roleta, núcleo, armas de raça, poderes de raça, mudanças no
  corpo do jogador e a câmera do gigante). Os efeitos visuais genéricos que a Maldição usa continuam.
- Testes no servidor oficial 1.26.65.1: com jogadores **48/48**, sem jogador **60/61** (a falha: um passo de megaconstrução de teste levou 60 ms, no limite). Checagens estáticas e unitários 15/15 ok.

## 3.3.3 — Maldição com vida, voltar da fumaça pelo celular, poderes no corpo dela
- **Voltar da forma de fumaça (funciona no celular)**: olhe para o CHÃO por 1 segundo, ou segure o
  botão de DESCER, ou digite `/hacknd`. Ao virar fumaça aparece um título grande explicando, e a barra de
  baixo mostra sempre como voltar com uma barra de progresso. Antes o painel "Maldição · te seguindo"
  cobria essa mensagem e o agachar não era detectado no espectador.
- **Ela nunca fica parada como estátua**: além do movimento contínuo (agora bem mais forte: tentáculos
  chicoteando, cabeça virando com trancos, boca abrindo, braços e fumaça balançando), de poucos em poucos
  segundos ela faz algo sozinha — **grita** (rugido com tremor), arranha o ar, morde, agarra, soca,
  devora e bate no chão, com som.
- **Poderes feitos pelo corpo dela**: no Escudo ela cobre você com os braços; nas Mãos da maldição ela
  soca junto, virada para onde você bateu; na Boca devoradora ela abre a bocona e engole.
- Ao invocar, ela mostra a versão no chat (`Hacknd v3.3.3`) para você conferir que o pacote novo entrou.
- Testes no servidor oficial 1.26.65.1: com jogadores **48/48** (inclui virar fumaça e voltar ao corpo), sem jogador **60/61** (a falha é um pico de tempo de 100 ms numa megaconstrução instantânea de teste).

## 3.3.2 — Animações vivas, forma de fumaça que volta e voo
- **Animações não ficam mais duras**: a Maldição respira, flutua, torce o tronco, vira e inclina a
  cabeça com trancos, chicoteia os tentáculos, balança os braços, mexe os dedos, abre e estala a boca.
  Os movimentos antes eram de 1 a 4 graus (parecia estátua); agora são de verdade.
- **Corrigido: golpes travados**: a ação era reiniciada a cada tick enquanto ela trabalhava/lutava e a
  animação ficava presa no primeiro quadro. Agora cada golpe toca até o fim.
- **Corrigido: sair do chão bugado**: qualquer ação logo depois de invocar cortava a animação de surgir
  e o corpo pulava para fora da terra. Surgir, afundar, desfazer e remontar não são mais interrompidos.
- **Fumaça de baixo**: os três gomos ondulam como cauda, torcem e pulsam; a poça gira.
- **Voo**: quando ela se move (inclusive subindo/descendo) deita para frente, os braços e tentáculos
  arrastam para trás e a fumaça vira rastro.
- **Corrigido: não dava para sair da forma de fumaça.** No modo espectador o jogo não marca "agachado".
  Agora o botão de agachar é lido direto (segure 1,5 s, com barra de progresso), e também funcionam
  `/hacknd volta` (ou só `/hacknd`) e "volta ao normal". Se o script recarregar com você de fumaça, ele
  reconecta e você consegue voltar.
- Testes no servidor oficial 1.26.65.1: com jogadores **48/48** (inclui virar fumaça e voltar), desligar/ligar (afunda e sai do chão) ok.

## 3.3.1 — A Maldição aparece de verdade + caça de bugs
- **Corrigido: a Maldição não aparecia, só a fumaça.** Uma regra antiga (dos nanorrobôs) escondia todo o corpo
  na forma normal. Agora o modelo inteiro aparece: cabeça, tentáculos, boca, braços e a base de fumaça.
- **Corrigido: fumaça infinita.** Os efeitos da Maldição criavam emissores que nunca acabavam: a cada 2 s
  nascia uma nuvem nova e elas se acumulavam, cobrindo tudo e pesando o jogo. As brasas da forma de fumaça
  também ficavam presas no chão para sempre. Agora cada efeito dura 2 s e é renovado, sem acumular.
- **Desligar = adormecer**: ela afunda na terra e some; ao ligar, sai do chão devagar (antes era o
  montinho de nanorrobôs).
- **Exército de sombras de verdade**: os soldados não são mais robôs com chapéu. São sombras pretas,
  com cabeça alongada, chifres de fumaça, boca com dentes, olhos acesos na cor do tipo, braços com garras
  e pernas que viram fumaça. A Maldição se desfaz animada antes de virar soldados.
- Sem zumbido de abelha (som dos nanorrobôs): agora é sopro de fumaça e grito fantasma.
- Textos que ainda falavam de robô, drone, nanorrobô, laser e canhão foram trocados.
- Caixa de visão maior (a gigante não some da tela quando você está em cima dela).
- Validador novo: confere que toda forma aparece no jogo e que nenhum efeito fica infinito.
- Testes no servidor oficial 1.26.65.1: com jogadores **48/48**, raças **53/53**, sem jogador **60/61**.

## 3.3.0 — A MALDIÇÃO (o drone de nanorrobôs virou um espírito amaldiçoado de fumaça) + escolha livre da raça
- **A Maldição**: modelo 3D novo feito a partir da sua folha de referência (voxel preto e cinza-escuro):
  - cabeça alongada com sulcos e 9 tentáculos;
  - boca enorme com duas fileiras de dentes longos e mandíbula que abre;
  - ombros curvados, braços compridos com 4 dedos-garra e polegar;
  - a parte de baixo é uma coluna de fumaça que se desfaz em cubinhos.
  Tem ~4,5 blocos de altura (do tamanho de um wither) e 93 ossos animáveis.
- **Animações** (geradas com curvas de aceleração, quadro a quadro):
  - **contínuas**: respiração, boca que abre e fecha devagar, tentáculos ondulando como cobra, braços e
    dedos se mexendo, cauda de fumaça balançando, cubinhos subindo e sumindo, inclinação ao deslizar e
    cabeça seguindo o alvo;
  - **16 ações**: soco direito e esquerdo, garra, pancada no chão com as duas mãos, agarrar, mordida,
    rugido, guarda, surgir do chão, afundar na terra, desmanchar, remontar, gancho, arremesso, devorar
    e sequência de socos.
- **Sai do chão** quando é invocada: devagar e assustadora, as mãos primeiro cravando no chão, terra
  estourando, rachaduras, tremor e um rugido no fim. **Afunda na terra** quando você a manda embora.
- **Combate só corpo a corpo** (não atira mais nada): socos, garras, pancada quando tem bando, gancho,
  mordida e sequência de socos, com alcance de braço de verdade. Menu "Combate":
  - atacar o que você mira;
  - pancada no chão, rugido de medo e devorar;
  - guarda (ela cobre você com os braços e você não leva dano).
- **Atmosfera**:
  - ao invocar, faíscas de brasa no ar;
  - com ela por perto, só cinzas caindo;
  - poder **Névoa gigante**: nevoeiro preto que vai junto onde você for, só quando você liga.
- **Poderes da maldição no jogador**:
  - **Asas de fumaça**: a fumaça vem até você e vira duas asas enormes que batem no voo;
  - **Virar fumaça**: modo espectador, você voa e atravessa tudo. Para voltar ao corpo, segure agachar 2 s;
  - **Escudo de fumaça**, **Mãos da maldição**, **Boca devoradora**, **Nuvem voadora** e
    **Ferramentas de sombra** (o antigo modo inteligente).
- **Maldição GIGANTE** no lugar do robô TITÃ: o mesmo modelo, ~15 blocos de altura, você em cima da cabeça.
  - Golpes na barra: soco, garra, pancada, salto, rugido e devorar. O raio do visor saiu.
  - **Mira corrigida**: o golpe vai **onde você está olhando** (bloco ou criatura), até o alcance do
    braço, e ela vira para lá.
- **Exército de sombras** (no lugar do exército básico de robôs):
  - a maldição se desfaz em soldados de fumaça que somem e reaparecem colados no alvo com golpes de
    garra (sem laser nem canhão);
  - **se todos caírem, a maldição se remonta**.
- **Tudo que era nanorrobô virou fumaça**:
  - pele preta com brasas nos veículos e itens;
  - partículas de cinza e fumaça;
  - névoa escura;
  - nomes de sombra (Espada de Sombra, Fumaça da Maldição...).
- **Item "Maldição"** (antigo controle): o ícone é a cabeça dela. Ele invoca e comanda.
- **Raças — escolha livre na primeira vez**:
  - na primeira vez, um menu deixa escolher qualquer uma das 6 raças, sem roleta e sem gastar nada;
  - ele abre ao entrar no mundo ou ao usar uma roleta antes de ter raça;
  - depois disso, trocar de raça é só pela Roleta das Essências.
- **Correções**:
  - poderes de raio, piscar, dreno e alguns poderes assinatura paravam numa flor ou grama alta na sua
    frente (por exemplo, as flores da Gênese). Agora o raio passa por plantas e água;
  - a conferência final das megaconstruções olha o relógio mais vezes e não dá engasgo;
  - virar fumaça não fica preso se a maldição for mandada embora: a volta ao corpo funciona sozinha.
- Testes no servidor oficial 1.26.65.1: raças **53/53**, sem jogador **61/61**, com jogadores **48/48**.

## 3.2.0 — Painel de poderes, modo poder, gigante em 1ª pessoa e 60 poderes assinatura
- **Painel de poderes no canto direito** (meio transparente): mostra a sua raça, a barra de recurso e os
  9 poderes da página, com o escolhido destacado, a recarga em segundos e "×" quando falta recurso.
  Nada de abrir menu para usar poder.
- **Modo poder** (usar o Núcleo da Raça liga/desliga):
  - a **barra de itens (1–9) escolhe o poder** (página 1 = lugares 1–9, página 2 = 10–18);
  - **bater/tocar/quebrar usa o poder escolhido**, e bater no bloco **não quebra** no modo poder;
  - agachar + bater troca a página; agachar + usar o Núcleo abre o grimório (montar a barra, ver os 100).
  - A barra agora tem 18 lugares (2 páginas de 9). Quem já tinha raça ganha a barra nova automaticamente.
- **Gigante em primeira pessoa de verdade**: a câmera fica nos olhos do gigante (~7,3 blocos do chão),
  sem ir para a 3ª pessoa. A cabeça dele some só na tela dele (os outros veem o gigante inteiro).
  Ajuste de altura dos olhos e opção de câmera normal em "Sua raça e ajustes".
- **60 poderes assinatura** (10 por raça), com código e visual próprios, inspirados no folclore/mitologia:
  - Vampiro: Forma de Névoa, Olhar Hipnótico (o monstro vira seu servo), Revoada de Morcegos,
    Banquete Rubro, Lua de Sangue (a noite cai), Matilha Noturna (3 lobos domados), Garras Carmesins,
    Passo da Noite, Sono do Caixão (escapa da morte) e Lança Hemática.
  - Gigante: Terremoto de Ymir, Rocha Arrancada, Pisão Colossal, Mão de Jötunn (agarra e arremessa),
    Muralha da Montanha (sobe camada por camada), Sopro de Hrímthurs (congela a água), Lâmina de
    Muspel, Rugido Colossal, Fúria Titânica (cresce para 6,3×) e Espinhos da Terra.
  - Anjo: Julgamento, Espada Flamejante do Querubim, Trombeta Celestial, Asas Protetoras (sem dano),
    Anjo da Guarda (anula o golpe fatal), Santuário, Tempestade de Penas, Ascensão, Coro dos Serafins
    e Sopro da Vida.
  - Demônio: Pacto Infernal, Possessão, Correntes do Abismo, Portão do Inferno, Chuva de Enxofre,
    Onda de Fogo Negro, Marca da Danação, Legião de Diabretes, Asas de Brasa e Coroa do Inferno.
  - DEUS: Parar o Tempo (tudo congela, até flechas), Gênese, Ira dos Céus (raios de verdade), Palavra
    Divina, Sol Nascente, Criação (templo de cristal), Coroa de Estrelas, Rebobinar (volta 5 s no
    tempo), Juízo Final e Sopro Divino.
  - TREVAS: Buraco Negro, Eclipse, Colheita de Almas, Passo do Vazio, Sombras Vivas, Entropia,
    Fenda do Vazio, Pesadelo, Anular e Noite Sem Fim.
  - Os 10 de cada raça já vêm na barra. Saíram 10 ataques genéricos por raça para continuar 100.
- **Efeitos visuais refeitos**: 28 partículas novas coloridas pela raça (orbe de energia, clarão,
  faíscas, onda de choque no chão, **selo mágico girando** (um desenho por raça), coluna de luz/trevas,
  corte em meia-lua, feixe grosso, raio em zigue-zague, corrente de elos, rachadura no chão,
  redemoinho, domo, runas, gotas de sangue, estilhaços de rocha, penas, brasas, estrelas e fumaça do
  vazio). Cada forma de poder tem o seu visual, os impactos fortes tremem a tela e as supremas abrem
  um selo enorme com coluna e onda. Ícones dos poderes assinatura com o selo da raça e moldura dourada.
- **Erros corrigidos**: barra antiga apontando para poderes errados depois da mudança do catálogo
  (agora é refeita); nomes repetidos entre poderes; a megaconstrução do farol usava `minecraft:map`
  (que não existe no Bedrock) e agora usa mapa vazio; efeitos da suprema do gigante deixavam testes
  instáveis; o autoteste de raças agora desliga o nascimento de monstros (um zumbi da noite
  atrapalhava as medições).
- Testes no servidor oficial 1.26.65.1: raças **52/52**, sem jogador **60/60**, com jogadores **45/45**.

## 3.1.0 — Roleta das Essências (Sistema de Raças)
- **Item novo: Roleta das Essências** (bancada: 4 ametistas, 2 ouros, 2 olhos do fim, 1 diamante; e no
  inventário criativo). Use para sortear uma raça. Ela tem modelo 3D na mão, e uma **roda 3D gira na
  sua frente**, desacelera e para no resultado, com o letreiro e os cliques sincronizados.
- **Sorteio exato, no servidor** (pontos-base, soma 10 000): Vampiro 28%, Gigante 24%, Anjo 22%,
  Demônio 24%, **DEUS 1%**, **TREVAS 1%**. As chances aparecem na roleta. Gasta exatamente 1 roleta
  (no criativo não gasta). Se você já tem raça, ela pede confirmação, e cancelar não gasta nada.
  Clique duplo é travado. Desconectar no meio não perde nem duplica nada.
- **Transformação**: tela com a cor da raça, coluna de luz/vazio, partículas próprias, sons e título.
  As asas e a auréola nascem crescendo com elástico.
- **Visual no corpo do jogador** (modelos 3D desenhados com o próprio corpo, seguindo as animações do jogo):
  - Vampiro: olhos vermelhos, presas, gola e capa que balança.
  - Gigante: escala 4,5 (≈ 8 blocos, 3 golens), hitbox de verdade 2,6 × 8,1, armadura de bronze e
    pedra, passos que tremem.
  - Anjo: auréola dourada e asas brancas que crescem.
  - Demônio: coroa rubra com espinhos e asas de membrana com garras.
  - DEUS: coroa de luz e asas enormes com cristais.
  - TREVAS: coroa negra e asas sombrias com cristais violeta.
  - Asas: dobradas no chão, batendo no voo, planando na queda.
  - Poses ao usar poderes: lançar, pisão, corte, dreno, rugido, prece, avanço.
- **Vampiro**:
  - O sol direto queima, mas capacete ou forma de morcego protegem.
  - Vira um morcego de verdade, pequeno e voando.
  - Dreno de sangue segurando o botão: para se o alvo fugir, sair da mira ou você soltar.
  - Corre 2× (5× na Rajada); super pulo; visão noturna automática; regenera 2×.
- **Gigante**: 3× força, 3× resistência, 3× velocidade, estilhaços grandes ao quebrar, impacto ao cair.
- **Anjo/Demônio**:
  - As asas crescem com XP próprio (0→20). Não gastam o seu XP e nunca encolhem.
  - Voo e regeneração 5×.
  - Pontos fracos opostos (o Anjo sofre com demônio/trevas; o Demônio, com o sagrado e com água/chuva).
- **DEUS**: regeneração 10× e **Lâmina Divina** 3D (30 de dano, presa ao dono, sem duplicar).
- **TREVAS**:
  - Regeneração 10× em pulsos pesados e resistência 20× (10× no sol).
  - **Foice do Vazio** 3D (35 de dano): o que ela quebra vira cinza, só onde o jogo deixou quebrar.
    Nunca baú, cama, portal, comando ou rocha-mãe. Em outro jogador: 35 + sombra fragmentada, sem apagar nada.
- **600 poderes de verdade (100 por raça)**:
  - Feitos de 48 formas (projétil, raio, cone, onda, cruz, coluna, chuva, corrente, agarrar,
    arremessar, meteoro, avanço, teleporte, gancho, lâminas girando, zonas, redemoinho, armadilha,
    domo, muro, invocação, ponte...) combinadas com 48 efeitos.
  - Nenhum dos 100 de uma raça repete o comportamento de outro (teste automático).
  - Recarga e custo de recurso próprio (Sangue, Fúria, Graça, Energia Infernal, Energia Divina,
    Vazio), tudo validado no servidor. A recarga não zera ao relogar.
- **Controle pensado para celular**: item **Núcleo da Raça**.
  - Bater = usa o poder ativo.
  - Usar = painel com os 20 da sua barra (ícone, recarga e custo).
  - Agachado + usar = grimório com os 100: categorias, busca e detalhes; montar a barra (trocar, subir,
    descer, esvaziar).
  - 600 ícones próprios, com selo do efeito principal.
- O enxame Hacknd e os robôs continuam iguais.

## 3.0.0 — Hacknd
- **O add-on agora se chama Hacknd** e é um **enxame de nanorrobôs**. O corpo de robô saiu: na forma
  normal existe só a nuvem de robozinhos do tamanho de poeira. Mesmo pacote (mesmos IDs), então o
  mundo e o inventário continuam.
- **Movimento de inseto** (pesquisado: abelhas e mosquitos não voam alinhados como pássaros, voam em
  zigue-zague turbulento — o "ruído de curl" usado em simulação de enxames). Cada robozinho tem um lar
  num elipsoide, gira devagar em volta do centro, respira junto com a nuvem e faz zigue-zague em duas
  frequências. Por cima, uma névoa quase transparente dá a sensação de milhões, e fica um rastro de
  poeira por onde a nuvem passa.
- **Não trava:** a nuvem roda no aparelho de quem joga (partículas presas à entidade, em espaço local).
  O servidor não manda nada por quadro para desenhar o enxame. As fumaças que o script mandava a cada
  poucos ticks foram removidas.
- **Invocar = descem do céu:** milhares de pontinhos em ~9 correntes, vindos de lugares diferentes,
  fazem curva e espiral até formar a nuvem. **Ligar** também. **Desligar:** o campo cai e a poeira
  desce num montinho que fica brilhando fraquinho no chão.
- **Tudo feito de nanorrobôs:** veículos, TITÃ, torreta, soldados do exército e o controle ganharam
  material de enxame (grafite granulado, grade de células microscópicas, um resto da cor original e
  pontinhos ciano que brilham no escuro), com robozinhos soltos deslizando pela superfície de cada forma.
- **Transformar:** a nuvem gira e compacta na forma. **Voltar:** a forma se desfaz em poeira. O exército
  sai de uma explosão macia de poeira, cada soldado compactando a partir dela, e ao juntar eles viram
  poeira de novo.
- **Golpes de enxame:** o soco virou um punho de nanorrobôs que voa até o alvo, o tiro virou um dardo
  de poeira e a construção virou um fio de nanorrobôs até o bloco.
- **Os poderes do enxame valem sempre** (escudo, asas, prancha, mãos gigantes, devorador, ferramentas
  automáticas, martelo, proteção de queda, luz, muralha/ponte/escada/cúpula/tornado...): não precisa
  mais "virar enxame". "Cancelar" desmancha formas e ferramentas e volta ao modo inteligente.
- Comando novo **`/hacknd`** (o `/drone` continua). Pacote: `Hacknd.mcaddon`.

## 2.3.0
- **Pilotar sem abrir o controle:** os poderes de cada veículo e da TITÃ ficam na **barra de itens**.
  Troque o slot (1, 2, 3…) para escolher o poder e **bata** para usar; a tela mostra a lista com o
  escolhido em amarelo. TITÃ: soco · raio do visor · salto com pisão · onda de choque · pose de poder.
- **Pular não tira mais você do veículo** (no celular o "descer" ficava no lugar do pulo): enquanto
  você pilota, o "descer" do jogo fica travado. **Só agachar sai.**
- **TITÃ:** câmera em terceira pessoa automática (dá pra ver o robô e o caminho), assento mais alto e
  corrimão escondido. **Não trava mais ao andar:** ele mede o terreno em 5 pontos da largura do corpo,
  sobe morros de até 9 blocos de forma suave e **atravessa paredes e árvores** (abre caminho na largura
  do corpo, respeitando "pode destruir"). Se ficar preso, ele força o passo.
- **Transformações mais bonitas:** o robô carrega energia (espiral de partículas, mãos tremendo), dá um
  clarão com anel de choque e a forma nova aparece crescendo com elástico, girando e assentando com um
  quique.
- **Forma normal passeia por perto** em vez de ficar rodando em volta de você: escolhe um ponto a 4–9
  blocos (do lado ou atrás), paira olhando em volta, segue quando você anda e volta se você for longe.
- **Torreta fica parada e atira de longe:** cravada no chão (não anda, não teleporta), alcance de ~60
  blocos, animação nova de armar (pernas abrem, arma sobe, radar e canos estendem), giro dos canos e
  servo ao parar.
- **Construções:** menu **Construir…** único e legível no celular (botões grandes de 2 linhas, nada de
  lista cortada): megaconstruções + as 6 categorias do catálogo + Surpresa. **Tudo mobiliado:** vila
  (casas e lojas do catálogo + igreja), cidade (prédios com andares de escritório e apartamento,
  hotel, hospital…), castelo (torre do castelinho mobiliada + ferreiro + estábulo), casa tecnológica,
  arranha-céu futurista de 30 andares com heliponto, pirâmide (câmara do faraó), farol (quarto do
  faroleiro). **Autocorreção:** no fim de toda obra ele confere bloco por bloco e recoloca o que
  faltou (inclusive a metade de cima das portas e a cabeceira das camas).
- **Exército:**
  - **menos lag** (a lista de robôs fica em cache e a busca de inimigos é uma só por rodada; antes era
    uma varredura de 256 blocos a cada 5 ticks + uma busca por robô). Corrigido também um bug que
    deixava a maioria dos robôs sem atirar.
  - **5 tipos de robô** com cor e acessório próprios: soldado (laser), construtor (capacete; obra
    rápida), artilheiro (canhão de ombro, de longe, estouro em área), médico (mochila com cruz; cura
    você e os robôs), ninja (katana; some na fumaça e aparece nas costas do inimigo).
  - **Estilos de exército**: misto, só soldados, ninjas, artilharia, construtores, médicos ("exército
    de ninjas", ou o menu).
  - **O exército constrói junto:** castelos, megaconstruções e o catálogo inteiro. Cada robô voa até um
    pedaço da obra e solda os blocos com o laser (construtores valem por dois), e no fim todos conferem
    a obra. "Cancelar" para só a obra.
  - Formações novas: **linha de frente** e **V**.
- **Enxame de nanorrobôs refeito do zero:**
  - **Leve:** fumaça escura com brilhos (poucas partículas que duram mais) em vez de milhares orbitando.
  - **Atmosfera:** nanorrobôs minúsculos espalhados pelo ar em volta de você (não orbitam) e uma névoa
    levíssima no horizonte.
  - **Inteligente, sem controle:** de mão vazia, bata num bloco e eles se juntam na sua mão virando a
    ferramenta certa — **machado** (derruba a árvore inteira), **picareta** (veio inteiro de minério ou
    túnel 3×3), **pá** (3×3), **enxada**. Bata num bicho e vira **espada** (corte em área). As ferramentas
    se desfazem quando você para de usar ou larga no chão.
  - **Martelo de nanorrobôs:** use para arremessar; explode no que acertar e volta voando para a mão.
  - **Modos** (item **Núcleo do enxame** na sua barra — use para trocar, agachado volta; ou fale):
    **Inteligente**, **Escudo** (barreira girando: nada passa e nada te acerta; eles não atacam),
    **Asas** enormes nas costas (voe para onde olha), **Prancha voadora**, **Mãos gigantes** atrás de
    você que socam junto com você, **Devorador** (come tudo por onde você passa; agachado, o chão também).
  - **Proteção automática:** almofada de nanorrobôs nas quedas (sem dano de queda), plataforma sobre
    lava/vazio, luz que te acompanha no escuro, fôlego debaixo d'água, apagam o fogo e remendam você
    com a vida baixa. Projéteis perto de você somem no ar.
  - Continuam: muralha, ponte, escada, cúpula, punho do céu, lâmina giratória, tornado, elevador, ataca.

## 2.2.1
- **Sem engrenagens voando**: o robô ficou só com cabeça, tronco e as duas mãos, presos por magnetismo.
- **Animações com física de verdade** (calculada no próprio jogo, a cada quadro): cada peça é uma massa
  presa por uma "mola magnética" com amortecimento. Acelerou, as mãos e a cabeça ficam pra trás;
  freou, elas passam do ponto e voltam quicando; na curva o corpo deita pra dentro e as peças pendem
  pra fora; voando rápido as mãos vão pra trás pelo arrasto e o corpo inclina pra frente. A cabeça
  olha macio para quem está perto. Levitação em repouso com duas frequências e um zumbido fino.
- **Golpes com peso:** soco com preparação, impacto que passa do ponto e recuo (o tronco e a cabeça
  levam um tranco); tiro do núcleo com coice e quique; martelar com impacto seco; construir alcançando
  o bloco; carregar energia com as mãos tremendo no campo.
- **Desligar**: cada peça cai com aceleração e **quica** no chão; os brilhos falham e apagam.
  **Ligar**: as peças sobem em arco girando, tremem com o campo e **encaixam com um estalo
  magnético** (passam um pouco do lugar e voltam); os olhos acendem piscando.
- **Veículos com suspensão de mola**: carro, moto, caminhão e tanque empinam ao acelerar e mergulham
  na freada; lancha levanta o bico; helicóptero, nave e disco inclinam com a aceleração.
- Novo teste automático do Molang (`tests/check_molang.py`): parênteses, funções e toda variável lida
  precisa existir.

## 2.2.0
- **DR-0N agora é um robô de peças flutuantes** (no lugar do drone de hélices): cabeça arredondada de
  pedra-metal com olhos ciano e boca brilhando, tronco cúbico com núcleo de energia, duas mãos soltas
  com dedos. Cada parte flutua com o seu ritmo; voando ele inclina,
  as mãos ficam pra trás e a cabeça olha para quem está perto. **Soco forte** (a mão voa no alvo,
  dano alto e arremesso) alternado com **tiro do núcleo do peito**; mãos martelando ao quebrar,
  alcançando o bloco ao construir, guarda erguida na torreta.
- **Desligar / ligar:** botão no controle (ou "desliga" / "liga"). Desligado, ele desmonta no chão
  — a cabeça cai primeiro, depois as mãos e o tronco e os brilhos apagam — e
  fica quieto (não segue, não ataca, não obedece até ligar). Ao ligar, o tronco sobe, as mãos e a
  cabeça voam girando em arco até o lugar e os olhos acendem piscando.
- **Visão livre nos veículos:** a cabine/capota (vidro e teto) do helicóptero, carro, escavadeira,
  jato e de todos os veículos novos recolhe quando alguém entra — quem pilota enxerga tudo em volta.
  Bancos, painel e volante por dentro; turbina e rotor do helicóptero subiram para não tapar a cabeça.
- **Sair = agachar** (o jeito normal do jogo). O add-on não bloqueia mais o "descer". Saindo no alto
  (voadores e TITÃ), você ganha queda lenta. **Pular = o veículo pula** (terrestres e lancha), sobe
  (voadores), pós-combustor (jatos) ou salto com pisão (TITÃ).
- **Veículos de chão muito mais rápidos — bug corrigido:** a velocidade era lida de volta da entidade
  depois do atrito do chão, e o carro ficava preso em ~15% do que devia (≈3 blocos/s). Agora a
  velocidade é comandada (e compensa o atrito do chão): carro ~23 blocos/s, moto ~26, caminhão ~20,
  tanque ~11, escavadeira ~9,
  com aceleração, freio, perda de velocidade ao bater e pulinho automático em degraus. Voadores
  sobem/descem para onde você olha.
- **TITÃ virou um robô gigante humanoide** (original: armadura branca e vermelha, visor em T, reator
  no peito, ombreiras, mochila com propulsores). Você vai **em cima da cabeça** (plataforma com
  corrimão baixo, visão 360°, ~26 blocos de altura); passageiros nas ombreiras e na mochila. Bater
  perto = soco; mirar longe = raio do visor; pular = salto com propulsores e onda de choque ao cair.
  Animações novas (passada com joelho, soco com giro do tronco, salto, pose de poder, ajoelhar).
- **6 veículos novos:** nave espacial (lasers gêmeos, voo 3D), disco voador (raio desintegrador e
  raio trator que abduz quem estiver embaixo), submarino (mergulha olhando pra baixo, torpedos com
  rastro de bolhas; quem está dentro respira e enxerga debaixo d'água), lancha (voa na água, boia,
  salta ondas, turbo), caminhão-monstro (rodas gigantes, pulo alto, passa por cima de monstros) e caça
  supersônico furtivo (o mais rápido, mísseis). Carro, moto, caminhão e lancha ganharam turbo.
- **Modo ENXAME de nanorrobôs:** o DR-0N vira milhares de robozinhos (nuvem de partículas orbitando).
  Continua fazendo tudo que o drone faz e ainda: **escudo em volta de você** (você não leva dano,
  flechas/bolas de fogo somem, monstros são empurrados e picados), pica sozinho os monstros perto de
  você, e vira **muralha, ponte, escada, cúpula** (blocos de nanorrobô que se desmancham depois),
  **punho gigante, espada giratória, tornado, asas, elevador**, ataca o que você olha e **devora tudo**
  em volta. "Cancelar" desmancha tudo.
- **Catálogo com 4851 construções diferentes** (65 tipos × 21 estilos × 3 tamanhos + 30 objetos ×
  21 estilos): casas, sobrados, mansões, prédios, hotel, padaria, açougue, ferreiro, farmácia,
  livraria, taverna, restaurante, mercado, banco, shopping, posto, escola, hospital, delegacia,
  bombeiros, igreja, biblioteca, museu, teatro, cinema, estação, academia, prisão, quartel, celeiro,
  estábulo, silo, moinho, estufa, farol, coreto, piscina, cais, arena, parquinho... e objetos (fonte,
  estátua, poste, banco de praça, barraca de feira, ponto de ônibus, jardim zen...). Estilos:
  medieval, rústico, moderno, futurista, japonês, desértico, nórdico, tropical, gótico, colonial,
  castelo, infernal, gelo, mansão, rural, praiano, steampunk, élfico, industrial, colorido, savana.
  **Interior arrumado** em todas: quarto com cama e criados-mudos, cozinha com fogão, pia e
  armários, sala com sofá e TV, banheiro, escritório, loja com balcão e mercadoria do tipo certo,
  sala de aula com carteiras e lousa, igreja com bancos e altar, celas, baias, estufa com plantação...
  Escada de mão entre andares, portas com as duas metades, janelas, telhado do estilo, caminho e
  luzes. A porta fica virada para você. Por texto ("faz uma padaria pequena estilo japonês") ou pelo
  menu **Catálogo**. Construído à mão como as megaconstruções.
- Portas antigas das megaconstruções usavam um estado de bloco velho (podiam sair só com a metade de
  baixo): corrigido.

## 2.1.0
- **Constrói à mão, bloco por bloco** (novo padrão): nas megaconstruções e nos biomas o DR-0N voa
  até cada ponto e coloca/quebra bloco por bloco, parte por parte (quadrados de 24×24), de baixo para
  cima, em zigue-zague, com feixe de construção, som do material e poeira — como um jogador
  construindo voando. Velocidade em Configurações (ou "constrói devagar/rápido/na hora"):
  à mão ~10 blocos/s · normal ~60 · rápido ~500 · instantâneo (o jeito antigo). Ele avisa quanto
  tempo a obra vai levar.
- **Aplainar / destruir em volta**: "deixa tudo plano" tira tudo que é natural acima do chão num raio
  (12 a 64), tapa buracos com terra/grama e deixa plano; "destrói tudo" (ou a opção no menu) tira
  TUDO, inclusive construções — menos baús, camas e blocos que guardam itens.
- **Recolher os itens do chão**: "recolhe os itens do chão" — ele voa até os itens e aspira tudo
  (ficam com ele; peça "me dá tudo"). Também roda no fim do aplainar.
- **Correção importante (vinha de versões antigas):** a rotina que "sente" perigo rodava num tick
  deslocado e a checagem interna nunca disparava — ele só reagia depois que você apanhava. Agora o
  modo proteger caça de verdade antes do monstro chegar. O mesmo bug travava "ficar de olho em você",
  pegar itens ao passar e a regeneração de vida.
- Construindo, se ele bater numa árvore/parede que ele mesmo colocou, passa por cima em vez de ficar
  batendo.
- **Animações revisadas**: drone inclina suave conforme a velocidade e deita nas curvas; animação
  própria de construção (inclina para o bloco, "bicos" mirando para baixo, olho pulsando) e de
  quebrar; torres do tanque/escavadeira/torreta giram macio; helicóptero e jato inclinam suave;
  passada do colosso entra e sai sem tranco; robô não mistura parado com andando.

## 2.0.0 — DR-0N Mega Drone
- **A Lila saiu.** O add-on agora é só o DR-0N (pacotes renomeados para "DR-0N Mega Drone";
  arquivo `DR-0N_Mega_Drone.mcaddon`). Registros antigos da Lila são ignorados.
- **Itens infinitos (criativo):** qualquer item do jogo por nome ("me dá um élitro") ou pelo menu;
  o planejador materializa o que faltar na hora; "me fortalece" veste netherita encantada e entrega
  armas, élitro, totem, maçãs e efeitos. Mais vida (300).
- **Formas** (mesma entidade, troca hitbox, gravidade, assentos, escala e modelo): helicóptero
  (metralhadora), carro esportivo, escavadeira (cava), tanque (torre gira com seu olhar, canhão),
  caça a jato (mísseis), moto. Você entra no volante sozinho; agachar 2× sai e ele volta a ser drone.
  Outros jogadores pegam carona; só o dono pilota (o "agachar = descer" fica desligado enquanto você
  pilota, e volta sempre ao sair).
- **Colosso TITÃ** (mecha-kaiju original, escala 3,4 ≈ 25 blocos): cabine na cabeça (piloto quase
  imortal), cabines para passageiros, soco que destrói, pisão com onda de choque, raio de plasma,
  rugido, passos que tremem a tela e derrubam o que estiver na frente. Fica colosso até "Cancelar".
- **Torreta gigante:** pousa e vira uma arma fincada (metralhadora rotativa de 6 canos, lança-mísseis,
  radar), mira em monstros e em quem te atacar.
- **Proteção de verdade:** no modo proteger ataca primeiro (até 32 blocos); quem bater em você ou
  nele vira alvo — jogadores também; bater nele você mesmo = lição de leve (configurável).
- **Modo exército:** sobe, explode num clarão e vira 10 robôs-soldado (até 24) que seguem, protegem,
  atiram laser, obedecem (atacar o que você olha, ir até lá, círculo, ficar) e trazem o que você
  precisa (cura, comida, armadura, visão noturna, respiração, fogo, queda). "Cancelar" junta tudo.
- **Construções gigantes:** castelo, cidade, vila, montanha-russa (trilhos funcionando + carrinho),
  poço, labirinto, casa inteligente, montanha, pirâmide, farol, arranha-céu e estádio, com material
  infinito, por partes (sem travar) e sem derrubar construção de jogador.
- **Biomas:** neve, deserto, selva, cerejeiras, cogumelos, flores, floresta e pântano (raio 36).
- **"Cancelar tudo" volta ao normal** de qualquer forma/modo.
- **13 sons originais** sintetizados + novas partículas (clarão, fumaça, onda de choque, plasma,
  poeira, fogo, faíscas de construção).

## 1.5.0
- **Entende muito mais**: 102 jeitos comuns de falar viraram teste fixo ("bora", "cola em mim",
  "corre aqui", "fica de guarda", "faz o que quiser", "o que vc tem", "quero comida"...).
  "Para" sozinho para; "carne"/"comida" sempre é pra você (a não ser "come você").
- **Comida chega na sua mão**: o DR-0N abate o bicho de longe e agora **desce e recolhe a carne**
  (antes deixava no chão); a coleta de itens ignora o que ela mesma te entregou e pega pelo ponto
  do item se ele escorregar. Se não conseguir comida, ela avisa em vez de ficar quieta.
- **Construção muito mais rápida**:
  - materiais flexíveis: parede/chão aceitam qualquer tábua, pedra ou tronco que ela tiver
    (tronco = 4 tábuas); onde o chão já é firme ela aproveita o terreno;
  - vidro e tocha não travam mais a obra (janela fica aberta; tocha só se tiver carvão);
  - plantação começa com até 8 sementes e **não exige balde** (sem balde usa terra arada molhada);
  - fundação com terra em vez de minerar pedra; colocar bloco 2× mais rápido; alcança mais longe;
    obra em zigue-zague (anda menos); se faltar bloco no fim, busca e completa os buracos.
  - quebra blocos mais rápido (Lila 2,6× · DR-0N 5× o ritmo de um jogador sem efeito).
- **Modo torreta de verdade**: o DR-0N pousa suave até encostar no chão, encaixa no bloco e **se
  transforma** — tripé desce e crava no chão, braços e hélices recolhem, abre escudo frontal,
  canhão duplo sobe e o olho fica vermelho (transição animada). Pernas travadas: se empurrarem,
  volta pro lugar. Ao sair, desmonta e decola.

## 1.4.0
- **Novo companheiro: DR-0N**, drone-robô grande com controle próprio (ferro, vidro, redstone e
  diamante). Mesmo cérebro da Lila (planeja, coleta, minera, fabrica, constrói, planta), porém
  voa (motor de voo: direto, por cima de obstáculos ou por terra), é ~2× mais rápido, minera 2×
  mais rápido, enxerga mais longe, tem 160 de vida e inventário de 54 espaços.
- **Metralhadora e modo torreta** (pousa, trava as pernas e metralha monstros num raio grande).
- **Carona**: suba nele (toque de mão vazia ou "me dá carona"); você pilota olhando e andando,
  pular sobe; agachar desce e ele volta ao que estava fazendo. Atira em monstros durante o voo.
- **Escaneamento** do dono, **memórias** (diário + lugares lembrados) e **missões** com progresso.
- **"Cancelar tarefas"** no topo do menu dos dois controles.
- `/drone <ordem>`; HUD mostra os dois na mesma linha; Lila e DR-0N podem estar juntos.

## 1.3.0
- **Seguir como um mob de verdade**: ela é ligada ao dono (`tame`) e usa a IA nativa do jogo
  (`follow_owner`) para te acompanhar — pula degraus, nada, abre portas e contorna sozinha.
  Se empacar, o motor próprio assume por um trecho. Subir ladeira de degraus: 15 ticks no teste.
- **Motor próprio mais suave**: degrau de 1 bloco vira um pulinho em arco (não fica batendo na
  quina), não freia no centro de cada bloco em linha reta, resgate de travamento 2× mais rápido.
- **Perto primeiro, longe só se precisar**: olha em volta (10 → 24 blocos) antes de usar a
  memória; enxerga recursos expostos até 40 blocos; volta a lugares onde já viu o recurso;
  explora em anéis crescentes (18 → 68 blocos) em vez de sair andando longe direto.
- Mais "amiga": olha mais pra você quando está perto e acena se você agachar olhando pra ela.

## 1.2.0
- **Animações voltaram**: o efeito de partícula da animação de invocar estava em formato de lista;
  o jogo exige linha do tempo (`{"0.0": ...}`) e por causa disso rejeitava o arquivo de animações
  inteiro — ela ficava dura e a pálpebra do piscar cobria os olhos (rosto "bugado").
  O validador agora confere o formato de cada campo de animação/controlador.
- **Rosto**: a pálpebra fica escondida dentro da cabeça e só aparece quando pisca; tamanhos das
  peças em pixels inteiros (sem sangrar cor de outra parte da textura).
- **Comida muito mais rápida**: entrega o que já tem na hora; senão colhe maduro, caça os animais
  que estão perto e entrega (35 s no teste, antes 3 min); avisa no chat o que está fazendo.
- **Testes com jogador de verdade** (jogador simulado do GameTest, só no servidor de teste):
  seguir, "vem aqui", "pega madeira", "arranja comida", "faz uma picareta", "me dá tudo".

## 1.1.0
- **Corrigido o crash "exceção de vigia de script"**: a mineração profunda podia entrar num laço
  infinito quando a escadaria ficava cercada (blocos que ela não pode quebrar, lava, chunk não
  carregado). Agora todo laço cede pelo menos um tick e a escadaria desiste com segurança.
- **Menos engasgo**: orçamento de CPU por tick (A* fatiado por tempo, varreduras de blocos com
  limite e do centro para fora, obras grandes cedem o tick). Passo mais lento medido: 12 ms.
- **Movimento com física** (impulso, pulo nos degraus, nado) em vez de teleporte a cada tick:
  suave no celular e as animações de andar/correr também respondem à velocidade real.
- **Mais esperta**: vai junto quando você está viajando, trabalha por perto quando você para,
  fica com você nos primeiros 30 s, põe tochas quando você está no escuro, leva comida se você
  estiver com pouca vida, avisa o que vai fazer; reconhece mais blocos naturais (raízes,
  musgo pálido, azaleia, nylium...). Distância padrão para explorar sozinha: 64 blocos.
- Avisos no log limitados a 1 a cada 30 s por área (não enchem a tela).

## 1.0.0
- Personagem original **Lila**: modelo humanoide (ossos padrão de jogador), cabelo volumoso em
  camadas com franja recortada, presilha de folha, vestido com saia em duas camadas; textura
  pixel art 2× com rosto desenhado à mão e piscar animado.
- Animações de jogadora: andar, correr, agachar, nadar, escalar, cair, minerar, cortar, cavar,
  colocar, atacar, comer, fabricar, plantar, acenar, pensar, comemorar, sentar, dormir, derrota,
  invocação; cabelo e saia com movimento secundário.
- **Controle da Lila** (item 3D, infinito) com receita de ferro ou cobre; menu com campo de texto
  e botões rápidos; `/lila <ordem>`.
- Cérebro: reconhecedor de intenções pt-BR, planejador por encadeamento para trás com receitas
  reais, bancada e fornalha de verdade, mineração por escadaria/túnel, construção por plantas,
  plantação, comida, proteção, sono, IA autônoma por utilidade.
- Derrota sem morte e retorno em 20 s com inventário e plano preservados; dispensar/invocar sem
  perdas (estruturas do mundo).
- HUD localizador (barra de ação + barra de localização nativa).
- Testes: unitários, validação de IDs, validação cruzada de pacotes, typecheck e autoteste no
  servidor oficial do Bedrock.
