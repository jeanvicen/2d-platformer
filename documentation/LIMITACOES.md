# Limitações reais (sem promessas falsas)

| Tema | Situação | Como foi resolvido |
|---|---|---|
| Capturar o chat | `world.beforeEvents.chatSend` **não é estável** (só beta) | `/sombra <ordem>` (comando custom estável, sem cheats) + menus com campo de texto |
| `/sombra` sem namespace | o atalho depende de não haver outro comando com o mesmo nome | sempre funciona como `/shadowbound:sombra` |
| Navegação nas tarefas | a API não tem "ande até X" para entidades | A* próprio + seguidor com teleportes curtos a cada tick (velocidade de jogador). Ao seguir o dono, usa a IA nativa (`follow_owner`, que abre portas e teleporta quando longe) |
| Fabricação | uma entidade não abre a interface da bancada | receitas lógicas executadas **ao lado de uma bancada real** (ela coloca uma se precisar). Só receitas da lista |
| Fundição | — | usa o **inventário real** da fornalha/defumador/alto-forno. Não mexe em fornalha ocupada |
| Fome | NPC não tem fome de verdade | fome simulada com valores vanilla de comida |
| Armadura | depende do jogo desenhar armaduras no modelo customizado | a proteção é aplicada como efeito de Resistência proporcional aos pontos de armadura |
| Equipamento visível | `EntityEquippableComponent` em mobs pode não estar disponível | fallback automático para `replaceitem` |
| Olhos brilhantes | material `entity_emissive_alpha` | se não brilhar em algum aparelho, o olho continua desenhado normalmente na textura |
| Árvores altas | ela alcança cerca de 4,5 blocos, como um jogador | troncos fora do alcance são pulados (avisa se nada foi alcançável) |
| Construção alta | alcance de 5,5 blocos para construir | torre padrão de 4 de altura; blocos fora de alcance são informados como não colocados |
| Mineração | só blocos expostos, ou escada segura até 16 degraus | para perto de lava ou água; nunca cava o próprio chão nem os degraus da saída |
| Chunks descarregados | não dá pra acessar | ela não entra em área não carregada e avisa |
| IA generativa | `@minecraft/server-net` só existe no **Bedrock Dedicated Server** | addon 100% offline; ponte opcional só para BDS (`optional/`) |
| Testes no jogo | esta sessão não tem Minecraft | testado com typings oficiais, validador de pacotes e simulador. Checklist manual em `TESTES.md` |
