// Descrições dos PODERES ASSINATURA (3.2): 10 por raça, cada um com código próprio em signature.js
// (nada de "forma + efeito" genérico). Inspirados no folclore/mitologia de cada raça:
//   Vampiro — folclore centro-europeu e Drácula: névoa, morcegos e lobos, olhar hipnótico, sede.
//   Gigante — jötnar nórdicos (Ymir, gigantes de gelo e de fogo de Muspel), titãs que racham a terra.
//   Anjo    — serafins e querubins: espada flamejante, trombetas, asas que cobrem, julgamento.
//   Demônio — pactos, possessão, correntes do abismo, enxofre e fogo do inferno, legiões.
//   Deus    — criação, tempo, raio dos céus, palavra que fere, juízo final.
//   Trevas  — vazio, eclipse, colheita de almas, entropia, buraco negro.
// Arquivo só de dados (sem @minecraft/server) para o catálogo e os testes unitários lerem.
export const SIG_TEXT = {
  // VAMPIRO
  v_mist: "Vira névoa rubra por 6 s: invisível, rápido, NÃO leva dano nem queima no sol. Volta com um estouro de sangue.",
  v_hypno: "Olhar hipnótico: a criatura na mira vira sua serva por 15 s — não te ataca e parte para cima dos outros monstros (eles revidam nela).",
  v_bats: "Solta uma revoada de 6 morcegos de sangue que caçam os inimigos sozinhos; cada mordida rouba vida para você.",
  v_feast: "Banquete Rubro: por 3 s suga TODOS os inimigos em volta (8 blocos) ao mesmo tempo, com fios de sangue até a sua boca.",
  v_bloodmoon: "SUPREMA: a noite cai na hora e a lua fica rubra. 20 s de força, regeneração e cada golpe seu rouba 30% em vida.",
  v_wolves: "Chama uma matilha de 3 lobos domados que lutam por você por 30 s e depois somem na névoa.",
  v_claws: "Garras Carmesins: salta de inimigo em inimigo (até 5), rasgando cada um e fazendo sangrar.",
  v_shadowstep: "Passo da Noite: aparece nas costas do alvo e crava as presas (golpe forte + cegueira).",
  v_coffin: "Sono do Caixão: por 30 s, o golpe que te mataria vira névoa — você sobrevive com metade da vida.",
  v_lance: "Lança de sangue coagulado que atravessa até 3 inimigos, prende e faz sangrar; estoura em cristais rubros.",
  // GIGANTE
  g_quake: "Terremoto de Ymir: três ondas de choque saem de você (4, 8 e 12 blocos), lançando tudo para o alto e rachando o chão.",
  g_boulder: "Arranca uma rocha do chão e arremessa em arco: estoura em estilhaços, racha o chão e esmaga quem estiver perto.",
  g_stomp: "Pisão Colossal: o chão afunda em volta — atordoa, lança e machuca tudo em 7 blocos. A tela treme.",
  g_hurl: "Mão de Jötunn: agarra a criatura na mira, ergue acima da cabeça e arremessa longe; ela esmaga quem estiver onde cair.",
  g_wall: "Muralha da Montanha: uma parede de pedra sobe do chão camada por camada na sua frente (some depois de 10 s).",
  g_frost: "Sopro de Hrímthurs (gigante de gelo): cone de geada que congela a água, deixa lento e machuca.",
  g_muspel: "Lâmina de Muspel (gigante de fogo): três cortes de fogo gigantes em volta que incendeiam tudo.",
  g_roar: "Rugido Colossal: os monstros em 14 blocos são jogados longe e ficam fracos de medo.",
  g_titan: "SUPREMA: Fúria Titânica — você cresce AINDA MAIS (6,3×) por 15 s, com força e resistência enormes.",
  g_spikes: "Espinhos da Terra: uma fileira de estalagmites brota do chão para a frente, furando e lançando quem estiver no caminho.",
  // ANJO
  a_judgment: "Julgamento: um selo dourado marca o chão e uma coluna de luz desce do céu (sagrado: dobra contra trevas/demônios/mortos-vivos).",
  a_flamesword: "Espada Flamejante do Querubim: três cortes de fogo sagrado seguidos à sua frente.",
  a_trumpet: "Trombeta Celestial: três ondas douradas atordoam os inimigos e curam os aliados.",
  a_wings: "Asas Protetoras: você se cobre com as asas por 3 s e NÃO leva dano; quem bater é empurrado.",
  a_guardian: "Anjo da Guarda: por 60 s, o golpe que te mataria é anulado — você volta com a vida cheia.",
  a_sanctuary: "Santuário: domo de luz de 7 blocos por 10 s. Monstros são expulsos e queimam; aliados regeneram.",
  a_feathers: "Tempestade de Penas: 12 penas afiadas que perseguem os inimigos à sua frente.",
  a_ascend: "Ascensão: sobe aos céus num salto de luz e, ao pousar, solta uma onda sagrada.",
  a_choir: "SUPREMA: Coro dos Serafins — 6 luzes giram em volta por 12 s disparando raios sagrados e curando aliados.",
  a_breath: "Sopro da Vida: cura totalmente você e os aliados em 12 blocos, limpa efeitos ruins e dá escudo.",
  // DEMÔNIO
  d_pact: "Pacto Infernal: paga 40% da sua vida atual e ganha 20 s de força III, velocidade e aura de fogo.",
  d_possess: "Possessão: a criatura na mira vira sua marionete por 15 s e ataca os outros; quando o demônio sai, ela explode.",
  d_chains: "Correntes do Abismo: prende até 4 inimigos com correntes e depois arrasta todos até você.",
  d_hellgate: "Portão do Inferno: abre um selo no chão que cospe gêiseres de fogo por 7 s.",
  d_brimstone: "Chuva de Enxofre: 10 meteoros de fogo caem do céu na área mirada.",
  d_hellfire: "Onda de Fogo Negro: chamas negras correm pelo chão queimando e fazendo murchar.",
  d_damnation: "Marca da Danação: marca o alvo (leva +25% de dano) e em 5 s ele explode em fogo infernal.",
  d_legion: "Legião: invoca 4 diabretes de fogo que voam em volta e atiram bolas de fogo nos inimigos.",
  d_wingdash: "Asas de Brasa: dispara voando para a frente deixando um rastro de fogo que queima quem passa por perto.",
  d_archdemon: "SUPREMA: Coroa do Inferno — 15 s de arquidemônio: anel de fogo infernal em volta, força, resistência e medo.",
  // DEUS
  o_timestop: "Parar o Tempo: por 6 s tudo em 24 blocos CONGELA no lugar (criaturas e flechas). Só você se mexe.",
  o_genesis: "Gênese: a vida brota em 10 blocos — plantações maduras, flores e grama — e os aliados se curam.",
  o_smite: "Ira dos Céus: raios DE VERDADE caem em até 5 inimigos, com dano sagrado extra.",
  o_word: "Palavra Divina: cada inimigo em 16 blocos perde 35% da vida máxima (chefes: dano fixo).",
  o_sun: "Sol Nascente: um pequeno sol aparece no alto por 10 s, ilumina, queima inimigos (mortos-vivos mais) e cura aliados.",
  o_creation: "Criação: ergue na hora um templo de cristal à sua volta (pilares e teto) por 20 s, onde você regenera.",
  o_stars: "Coroa de Estrelas: 8 estrelas giram em volta por 10 s e disparam raios nos inimigos.",
  o_rewind: "Rebobinar: volta para onde você estava 5 s atrás, com a vida que tinha (se era maior).",
  o_doom: "SUPREMA: Juízo Final — um selo imenso se abre e 12 colunas de luz caem por toda a área.",
  o_breath: "Sopro Divino: cura total, limpa efeitos ruins, escudo grande e resistência para você e aliados em 16 blocos.",
  // TREVAS
  k_blackhole: "Buraco Negro: uma singularidade puxa tudo em 10 blocos por 5 s e no fim colapsa numa explosão.",
  k_eclipse: "Eclipse: 15 s de escuridão — você fica invisível e forte; os inimigos perto ficam cegos.",
  k_harvest: "Colheita de Almas: giro da foice em 360°; cada alma colhida orbita você e te cura.",
  k_voidstep: "Passo do Vazio: rasga o espaço e aparece até 30 blocos à frente; quem estava no caminho é ferido e murcha.",
  k_clones: "Sombras Vivas: 3 sombras suas saem caçando e golpeando os inimigos por 10 s.",
  k_entropy: "Entropia: o alvo apodrece por dentro (murchar forte e decomposição); se ficar fraco, vira cinza.",
  k_rift: "Fenda do Vazio: abre uma fenda de 12 blocos à frente — criaturas fracas viram cinza, as outras sofrem e ficam no escuro.",
  k_nightmare: "Pesadelo: o alvo fica paralisado de medo por 4 s e os outros perto fogem.",
  k_nullify: "Anular: tira os efeitos bons dos inimigos em 12 blocos, silencia e revela; limpa os seus efeitos ruins.",
  k_endless: "SUPREMA: Noite Sem Fim — domo de trevas de 10 blocos por 12 s que drena os inimigos para você e termina num colapso.",
};
export const SIG_KEYS = Object.keys(SIG_TEXT);
