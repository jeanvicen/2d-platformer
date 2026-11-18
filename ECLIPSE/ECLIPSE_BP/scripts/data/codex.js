// Códice do Eclipse — manual do jogador (PT-BR). Somente recursos que existem no add-on.
import { VERSION, CREATOR } from "../core/config.js";

export const CODEX = [
  { t: "1. Introdução ao ECLIPSE", b: `§5ECLIPSE — Shadow Sovereign§r transforma você em um soberano sobrenatural.

Você invoca criaturas que saem da sua sombra, materializa relíquias 3D, voa com asas, muda de forma, cria estruturas temporárias e tem a §dLyra§r, uma companheira de sombra que coleta, caça, explora e constrói por você.

O mundo continua sendo Minecraft: nada aqui substitui os blocos do jogo. Todos os poderes já estão liberados desde o início — a progressão dá níveis, títulos e desafios.` },
  { t: "2. Como despertar o Núcleo", b: `Ao entrar no mundo você recebe o §5Núcleo do Eclipse§r.

§lToque§r com ele na mão para despertá-lo. Você recebe o kit: Códice, Selo da Legião, Selo do Poder, Essência da Forma, Mão da Sombra, Prisma dos Elementos, Laço de Lyra, Asas Negras e o Martelo do Eclipse.

Depois do despertar, o Núcleo não precisa ficar na mão: cada item do kit funciona sozinho. Perdeu o Núcleo? Fabrique outro (obsidiana + ametista + pérola do fim) ou use o comando §7/eclipse:kit§r.` },
  { t: "3. Eclipse, God e Haze", b: `São três §lModos§r (linhagens), cada um com técnicas e passivas próprias e progresso separado:

§5ECLIPSE§r — sombras: Explosão Sombria, Passo Sombrio (teleporte), Manto da Sombra, Aura e Eclipse Supremo.
§6GOD§r — luz divina: Pulso de Luz, Égide Divina, Cura Sagrada, Plataforma de Luz e God Ascendant.
§bHAZE§r — sete elementos: Projétil, Muralha, Manifestação, Afinidade e Haze Ascendant.

§lTrocar de Modo:§r agache e toque com o Núcleo, ou Grimório → Modos. Trocar não apaga o progresso de nenhum Modo.` },
  { t: "4. Como invocar criaturas", b: `Use o §5Selo da Legião§r:
• §lToque§r: invoca (ou recolhe) a criatura ativa.
• §lAgachado + toque§r: escolhe a próxima criatura.

São 10 espécies: Umbra (lobo), Nyx (pantera), Aegis (guardião), Nox (dragão), Vesper (fênix), Corvus (3 corvos), Serpent (serpente), Stag (cervo astral), Golem (colosso) e Manta (arraia voadora).

Elas emergem da sua sombra com animação própria. O limite padrão é de 3 companheiros ativos (o administrador pode mudar).` },
  { t: "5. Como dar ordens", b: `Olhe para a sua criatura: aparece o botão §l"Ordens"§r (no celular, o botão de interação na tela).

Ordens: §lSeguir§r, §lEsperar aqui§r, §lProteger§r (ataca monstros que se aproximarem), §lExplorar a área§r (explora e volta), §lHabilidade especial§r da espécie, §lRecolher à sombra§r e §lRenomear§r.

As criaturas também agem sozinhas: seguem você, defendem quando você apanha e voltam se ficarem longe ou presas.` },
  { t: "6. Alternar a criatura ativa", b: `§lAgachado + toque§r com o Selo da Legião percorre as 10 espécies. A barra de ação mostra qual está selecionada e se já está ativa.

No Grimório → Legião você vê todas as criaturas manifestadas e o estado de cada uma.` },
  { t: "7. Equipar e abrir asas", b: `As asas são equipadas no §lslot de peito§r (como uma armadura). Coloque-as lá pelo inventário ou segure e use.

Conjuntos: §8Asas Negras§r, §fAsas Celestiais§r, §5Asas do Vazio§r e §5Asas de Dragão§r — todas em 3D com animações de fechar, abrir, bater, planar e pousar. Peça outras na Forja.` },
  { t: "8. Voar e pousar no celular", b: `Com asas no peito:
• §lPulo duplo§r (pule e toque PULO de novo no ar): abre as asas e começa o voo.
• §lSegurar PULO§r: sobe.
• §lSoltar§r: plana para frente com o joystick.
• §lAgachar§r: mergulha/desce rápido.
• Ao tocar o chão as asas fecham sozinhas, com pouso suave.

Correr (sprint) aumenta a velocidade. Alternativa sem pulo duplo: Grimório → Voar.` },
  { t: "9. Metamorfoses", b: `Use a §5Essência da Forma§r:
• §lAgachado + toque§r: escolhe a forma (Lobo, Pantera, Águia, Serpente, Titã, Guardião).
• §lToque§r: transforma. Já transformado, o toque usa a habilidade da forma.
• §lAgachado + toque§r transformado: volta à forma normal.

Como funciona: o Bedrock não deixa trocar o esqueleto do jogador por script. A forma é um modelo 3D completo vestido em você enquanto sua pele fica oculta; sua câmera e controles continuam iguais. Sua peça de peito é guardada no inventário e volta quando você desfaz a forma. Emergência: §7/eclipse:voltar§r.` },
  { t: "10. Materializar relíquias", b: `As relíquias são objetos 3D: Martelo e Machado do Eclipse, Espada Sombria, Lança Astral, Foice, Arco Celestial, Escudo do Guardião, Manoplas do Titã e Correntes de Sombra.

Peça qualquer uma na §lForja de Sombras§r (Grimório → Forja). Ela surge na mão com partículas, silhueta e som. Ao trocar de slot para uma relíquia, a materialização também acontece.` },
  { t: "11. Martelo do Eclipse", b: `§lToque§r com o Martelo: ele é lançado girando até onde você mira. No impacto: estrondo, raio estilizado e dano a monstros próximos (sem fogo e sem destruir blocos).

O martelo fica no chão, visível. No lugar dele aparece na sua mão o §5Chamado da Relíquia§r: §ltoque nele§r e o martelo volta voando direto para a sua mão.

Ele nunca duplica: ou está na sua mão, ou lançado. Se a região descarregar ou você trocar de dimensão, ele volta "pelas sombras".` },
  { t: "12. Machado do Eclipse", b: `Funciona como o Martelo (lançar e chamar de volta pelo Chamado), mas gira em espiral, crava no alvo e desacelera inimigos. A §lLança Astral§r também é lançável: ela atravessa vários inimigos em linha e volta sozinha.` },
  { t: "13. Forja de Sombras", b: `Abra pelo Grimório → Forja. Duas formas:
• §lCatálogo§r por categoria: Relíquias, Ferramentas, Equipamentos, Asas, Companheiros, Elementos e Construções.
• §lCampo de texto§r: escreva o que quer, do seu jeito ("martelo", "asas de anjo", "lobo", "ponte").

O assistente da Forja é local e funciona sem internet: ele entende nomes e sinônimos do catálogo — não gera objetos inexistentes.` },
  { t: "14. Comandos e sinônimos", b: `Exemplos reconhecidos pela Forja:
"martelo", "hammer", "thor" → Martelo · "machado" → Machado · "espada", "katana" → Espada · "asas", "voar" → Asas · "lobo", "cão sombrio" → Umbra · "dragão" → Nox · "ponte", "plataforma", "escada" → construções.

Comandos digitáveis (opcionais, funcionam sem cheats):
§7/eclipse:menu · /eclipse:codice · /eclipse:lyra "pedido" · /eclipse:kit · /eclipse:voltar · /eclipse:limpar§r` },
  { t: "15. Criações temporárias", b: `Use a §8Mão da Sombra§r:
• §lToque§r: cria a construção selecionada.
• §lAgachado + toque§r: troca entre Plataforma, Ponte, Escadaria, Barreira, Pilar Ascendente, Lanterna, Cúpula de Refúgio, Puxar Itens e Telecinese.

Elas só ocupam espaço vazio (nunca trocam blocos do mundo nem prendem ninguém) e somem sozinhas depois de alguns minutos. Para limpar as suas: Grimório → Configurações → Limpar criações.` },
  { t: "16. XP, níveis e desbloqueios", b: `Você ganha XP de domínio explorando regiões e biomas novos, usando poderes, comandando criaturas, construindo com a Lyra e cumprindo desafios — não só lutando.

Cada Modo tem nível próprio, com títulos: Desperto, Invocador, Moldador, Alado, Metamorfo, Soberano, Ascendente e Eclipse Supremo. Por padrão §ltudo já está liberado§r; o administrador pode ativar a progressão clássica (técnicas liberadas por nível).` },
  { t: "17. Recargas", b: `Cada técnica tem recarga própria (mostrada na barra de ação se você tentar antes da hora). Habilidades supremas (Eclipse Supremo, God Ascendant, Haze Ascendant) têm 5 minutos de recarga.` },
  { t: "18. Criatura presa", b: `As criaturas se recuperam sozinhas: se ficarem presas ou muito longe, reaparecem perto de você. Se uma criatura ficar num lugar que o mundo descarregou, ela retorna ao seu lado.

Ainda assim? Recolha (Selo da Legião) e invoque de novo.` },
  { t: "19. Item temporário sumido", b: `Relíquia lançada desaparecida? Toque no §5Chamado da Relíquia§r: se o martelo não puder voltar voando, ele volta pelas sombras direto para a mão.

Se você saiu do mundo com a relíquia no chão, ela é devolvida quando você entrar de novo. Emergência: §7/eclipse:voltar§r recupera tudo.` },
  { t: "20. Desempenho", b: `Grimório → Configurações → Efeitos visuais:
• §lVISUAL§r: aura e rastros completos.
• §lEQUILIBRADO§r (padrão): bom para a maioria dos celulares.
• §lDESEMPENHO§r: mínimo de partículas.

Você também pode desligar a aura e os sons do add-on. Celulares com pouca memória começam no modo DESEMPENHO automaticamente.` },
  { t: "21. Multiplayer", b: `Cada jogador tem perfil, criaturas, relíquias e Lyra próprios. Ninguém comanda as criaturas de outro jogador, e relíquias só voltam para o dono.

Poderes não ferem jogadores a menos que o administrador ligue o PvP, e nunca destroem construções. Administradores (operadores) têm opções de limite de criaturas, efeitos e diagnóstico.` },
  { t: "22. Perguntas frequentes", b: `§lAs asas não abrem?§r Confira se estão no slot de peito e faça o pulo duplo no ar.
§lO toque não faz nada?§r Toque mirando o céu ou o chão com o item na mão.
§lA Lyra não constrói?§r Escolha um terreno aberto; ela não demole construções. Se faltar madeira, ela vai buscar.
§lFiquei preso numa forma?§r Agache + toque com a Essência, ou §7/eclipse:voltar§r.
§lMuitas partículas?§r Use o preset DESEMPENHO.` },
  { t: "23. Créditos", b: `§5ECLIPSE — Shadow Sovereign§r v${VERSION}

§fCriado por §d§l${CREATOR}§r

Modelos, texturas, animações, sons e sistemas feitos especialmente para este add-on. Para Minecraft Bedrock (celular Android e outras plataformas), sem experimentos.` },
];
