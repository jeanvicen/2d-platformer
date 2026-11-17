/**
 * Persona phrase bank (PT-BR). Several variants per situation so the companion does not
 * repeat itself. Placeholders: {n} number, {x} free text. Pure module.
 */
import type { Persona } from "../core/constants";

type Bank = Record<string, string[]>;

const LUNA: Bank = {
  summon: ["Luna chegou~! Pronta pra te ajudar!", "Tchanam! Sua bruxinha favorita está aqui!", "Oi oi! Chamou? Estou aqui!"],
  return_alive: ["Voltei! Não se livra de mim tão fácil~", "Pronto, recomposta! Onde a gente parou?", "Ressurgi das sombras! Vamos continuar?"],
  dismiss: ["Vou descansar nas sombras. Me chama quando precisar!", "Tchauzinho~ Guardei tudo direitinho!"],
  ack: ["Entendido!", "Deixa comigo!", "Pode deixar!", "Certo, vou fazer isso!"],
  follow: ["Vou te seguir!", "Tô logo atrás de você~"],
  protect: ["Entendido. Vou permanecer ao seu lado.", "Ninguém encosta em você enquanto eu estiver aqui!"],
  guard: ["Vou vigiar esta área!", "Ficarei de guarda aqui. Pode ir tranquilo(a)!"],
  stay: ["Ok, fico aqui paradinha.", "Esperando aqui!"],
  cancel: ["Entendido. Cancelando a tarefa e retornando.", "Tá bom, parei tudo!"],
  start_wood: ["Estou procurando árvores próximas.", "Hora de cortar madeira!"],
  start_food: ["Vou procurar comida por perto.", "Deixa eu achar algo gostoso pra gente~"],
  start_mine: ["Vou minerar! Picareta em mãos~", "Partiu mineração!"],
  done: ["Consegui! {x}", "Prontinho! {x}", "Missão cumprida~ {x}"],
  returning: ["Consegui coletar. Estou voltando.", "Terminei! Já estou voltando."],
  delivered: ["Aqui está: {x}.", "Entreguei {x}!"],
  hungry: ["Tô com fome... vou comer um pouquinho.", "Pausa rápida pra um lanchinho!"],
  ate: ["Comi {x}. Bem melhor!", "Nham! {x}. Voltando ao trabalho."],
  no_food: ["Estou com fome e não tenho comida... me dá alguma coisa?", "Minha barriga tá roncando e não tenho nada pra comer..."],
  hurt: ["Ai! Estou ferida, vou recuar um pouco.", "Ugh, levei dano demais. Vou me recuperar."],
  threat: ["Perigo! Indo te proteger!", "Ei! Ninguém ataca você!"],
  full: ["Minha mochila encheu! Vou entregar as coisas e continuar.", "Mochila cheia~ voltando pra entregar."],
  blocked: ["O caminho está bloqueado. Estou tentando encontrar outra rota.", "Hmm, não consigo passar por aqui... procurando outra rota."],
  fail: ["Não consegui: {x}", "Desculpa... {x}"],
  unknown: ["Hmm, não entendi. Tenta de outro jeito? (ex.: 'pegue 16 troncos', 'me proteja', 'construa uma casinha')", "Não entendi direito~ Diga 'ajuda' pra ver o que eu sei fazer."],
  greet: ["Oiii! Precisa de algo?", "Olá! Bora aventurar?"],
  thanks: ["De nada! Sempre que precisar~", "Imagina! Pra isso que eu tô aqui!"],
  compliment: ["Hehe, obrigada~ Agora bora focar na missão!", "Ah, para~ Vamos trabalhar!"],
  died: ["Ugh... vou me desfazer nas sombras... volto já!"],
  tool_broke: ["Minha {x} quebrou!"],
};

const RAVEN: Bank = {
  summon: ["Raven, às suas ordens.", "As sombras me trouxeram. O que precisa?", "Estou aqui. Vamos."],
  return_alive: ["Voltei. Não vai se repetir.", "Recomposta. Retomando.", "Morrer é só um contratempo."],
  dismiss: ["Recolhendo às sombras. Itens guardados.", "Até logo."],
  ack: ["Entendido.", "Considere feito.", "Certo.", "Fácil."],
  follow: ["Te sigo.", "Na sua retaguarda."],
  protect: ["Entendido. Vou permanecer ao seu lado.", "Ninguém passa por mim."],
  guard: ["Perímetro sob vigilância.", "Ficarei de guarda aqui."],
  stay: ["Aguardando aqui.", "Posição mantida."],
  cancel: ["Entendido. Cancelando a tarefa e retornando.", "Tarefa abortada."],
  start_wood: ["Estou procurando árvores próximas.", "Indo cortar madeira."],
  start_food: ["Procurando comida.", "Vou garantir o rango."],
  start_mine: ["Descendo pra minerar.", "Minerando."],
  done: ["Feito. {x}", "Concluído. {x}"],
  returning: ["Consegui coletar. Estou voltando.", "Coleta concluída. Voltando."],
  delivered: ["Tome: {x}.", "Entregue: {x}."],
  hungry: ["Preciso comer. Rápido.", "Pausa pra comer."],
  ate: ["Comi {x}. Seguindo.", "{x}. Energia recuperada."],
  no_food: ["Estou com fome e sem comida. Me passe algo.", "Sem comida na mochila. Isso vai virar problema."],
  hurt: ["Ferida. Recuando pra me recuperar.", "Dano alto. Vou me reagrupar."],
  threat: ["Inimigo perto de você. Interceptando.", "Ameaça detectada."],
  full: ["Mochila cheia. Vou entregar e continuar.", "Sem espaço. Voltando pra entregar."],
  blocked: ["O caminho está bloqueado. Estou tentando encontrar outra rota.", "Rota bloqueada. Recalculando."],
  fail: ["Não deu: {x}", "Falhou: {x}"],
  unknown: ["Não entendi. Seja mais direto. (ex.: 'pegue 16 troncos', 'me proteja')", "Ordem não reconhecida. Diga 'ajuda'."],
  greet: ["E aí.", "Fala."],
  thanks: ["Sem problema.", "Disponha."],
  compliment: ["...Valeu. Foco na missão.", "Hm. Obrigada. Agora, trabalho."],
  died: ["Tch... volto em instantes."],
  tool_broke: ["Minha {x} quebrou."],
};

const BANKS: Record<Persona, Bank> = { luna: LUNA, raven: RAVEN };
const lastIdx = new Map<string, number>();

export function phrase(p: Persona, key: string, x?: string | number): string {
  const list = BANKS[p][key] ?? LUNA[key] ?? [key];
  const k = p + key;
  let i = Math.floor(Math.random() * list.length);
  if (list.length > 1 && i === lastIdx.get(k)) i = (i + 1) % list.length;
  lastIdx.set(k, i);
  return list[i].replace("{x}", x === undefined ? "" : String(x)).replace("{n}", x === undefined ? "" : String(x)).trim();
}

export const HELP_TEXT = [
  "§lO que eu sei fazer:§r",
  "§7Seguir/proteger:§r me siga, me proteja, fique de guarda aqui, fica aqui, volte",
  "§7Coletar:§r pegue 32 troncos, consiga comida, cace vacas, colha o trigo",
  "§7Minerar:§r minere ferro, pegue pedra, cave um buraco 3",
  "§7Fabricar:§r faça tábuas, faça uma picareta de pedra, faça pão, faça tochas",
  "§7Cozinhar:§r cozinhe a carne (precisa de fornalha perto)",
  "§7Construir:§r construa uma casinha / muro / plataforma / ponte / torre (de pedra)",
  "§7Quebrar:§r quebre esse bloco (olhe pra ele)",
  "§7Itens:§r me dá tudo, me entrega a madeira, o que você tem?",
  "§7Controle:§r cancela, pausa, continua, status, por que parou?",
].join("\n");
