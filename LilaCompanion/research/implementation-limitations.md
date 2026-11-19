# Limitações conhecidas (honestas)

1. **Não é um modelo de linguagem.** As ordens em texto são entendidas por um reconhecedor de
   intenções determinístico em português (vocabulário + quantidades + tolerância a erros).
   Frases muito diferentes do vocabulário recebem um pedido para reformular, com exemplos.
2. **Movimento por passos interpolados** (teleporte curto a cada tick ao longo do caminho A*).
   No servidor é suave e determinístico; a aparência no cliente não pôde ser conferida num
   aparelho real neste ambiente (só servidor dedicado, sem cliente gráfico).
3. **Visual não verificado num celular.** Modelo, textura e animações foram validados pelo
   próprio renderizador do projeto e pelo carregamento sem erros no servidor oficial, mas não
   foram vistos rodando num cliente Minecraft real. Pequenos ajustes de pose/rotação podem ser
   necessários depois de testar no jogo.
4. **Item na mão é visual:** uma cópia via `replaceitem` (sem encantamento visível). O item real
   (com durabilidade) fica no inventário dela.
5. **Armadura** que ela fabrica conta para a resistência dela, mas não aparece no modelo.
6. **Ordens pelo chat** precisam do comando `/lila …` (a API estável não lê mensagens comuns).
   `/lila` aceita até 8 palavras; para frases maiores use o campo de texto do controle.
7. **Exploração longe** usa uma área de processamento móvel por Lila (o mundo tem um limite
   global dessas áreas; se acabar, ela continua, mas o lugar dela pode “congelar” quando você
   estiver muito longe).
8. **Camas:** ela só faz cama se tiver lã (tosquia depende de um evento do jogo; se não existir na
   versão, pede para caçar ovelha). Sem cama, dorme perto de você.
9. **Construções grandes demoram como para um jogador:** a mansão precisa de ~400 troncos e ~600
   pedras; ela junta tudo de verdade antes de construir.
10. **Dono offline:** a Lila pausa e espera (não trabalha sozinha com o dono fora do mundo).
11. **Morte por comando (/kill)** é tratada como derrota; o inventário volta pela cópia de
    segurança periódica (pode perder o que ela coletou nos últimos ~5 s).
