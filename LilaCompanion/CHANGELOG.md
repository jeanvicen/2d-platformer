# Changelog

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
