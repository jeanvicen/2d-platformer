# Changelog

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
