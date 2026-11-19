# Changelog

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
