# Testes

## Como rodar
```bash
npm install
npm run typecheck   # tipos estritos contra @minecraft/server 2.3.0 / server-ui 2.1.0 (as versões do manifest)
npm test            # unitários + integração (cérebro real rodando no simulador tests/mock)
npm run build       # valida os pacotes e gera dist/*.mcaddon
```

## Resultado automático (registrado em 2026-11-17)
Typecheck: **0 erros**. Validador de pacotes: **OK** (2 geometrias, 19 animações, 2 partículas, 0 avisos).

```
✔ inventário: empilha, respeita capacidade e devolve o que não coube
✔ inventário: ferramentas com durabilidade não se fundem
✔ inventário: consumo atômico não perde itens
✔ receitas: tronco -> tábuas -> gravetos -> picareta de madeira
✔ receitas: pão a partir de trigo
✔ plantas: casinha tem porta e telhado, rotação correta
✔ fome: come pão sozinha, guarda reserva e evita comida arriscada
✔ A*: contorna parede e sobe degrau
✔ A*: falha honesta quando cercado
✔ A*: não entra em chunk descarregado
✔ IA externa: só aceita intenções da lista fechada
✔ catálogo: minérios, tempo de quebra e ferramentas
✔ recebe o Invocador das Sombras ao entrar
✔ 1-3) invocar, vínculo ao dono, impedir segunda invocação
✔ 4) outro jogador é ignorado e não acessa a sombra
✔ 5) seguir: modo nativo follow ativo
✔ 7/11) coleta madeira DE VERDADE, volta e entrega
✔ 9) come pão sozinha quando está com fome (e o dono pode dar itens)
✔ 12) cancelar e substituir tarefas
✔ perguntas: status, inventário, por que parou
✔ 15) persistência: registro salvo no mundo
✔ 14) morre e ressuscita sem duplicar itens nem corpos
✔ construção: casinha de madeira com materiais reais
✔ 13) falha honesta e recuperação: sem árvores, explica o motivo
✔ 8) obtém comida DE VERDADE: colhe trigo maduro, replanta e faz pão na bancada
✔ 10) equipa uma ferramenta suportada
✔ 6) protege contra inimigos perto do dono
✔ mineração: fabrica picareta na bancada, cava escada segura e entrega pedra
✔ 15/13) sai do mundo no meio da tarefa, volta, e ela retoma do estado salvo
✔ 16) funciona sem internet (nenhuma chamada de rede) e sem erros de script
✔ normalização: acentos e números por extenso
✔ frases diferentes para madeira viram o mesmo pedido (seção 5)
✔ pedido combinado: madeira, comida e depois volte
✔ quantidade e retorno: 'Pegue 32 troncos e volte'
✔ modos e controle
✔ perguntas de estado (seção 15)
✔ ambiguidade importante gera pergunta, não chute
✔ construção, fabricação, mineração, entrega
✔ combate e caça exigem ordem explícita para passivos
✔ comer e frases de conversa
✔ 'depois...' adiciona à fila em vez de substituir
ℹ tests 41
ℹ pass 41
ℹ fail 0
```

### Bugs reais encontrados pelos testes e corrigidos
1. Ao fabricar a picareta, a bancada era feita **depois** de separar as tábuas e o material acabava. Agora a estação vem primeiro.
2. Ao minerar, ela quebrava o **degrau da própria escada** e ficava presa. Agora nunca quebra o chão onde pisa nem os degraus da saída.
3. Árvore com a base já cortada não era reconhecida, e ela desistia da tarefa. Agora reconhece o resto da árvore (e continua exigindo folhas naturais).
4. Voltar ao dono usava só a IA nativa a partir de 7 blocos. Agora usa A* até 30 blocos e a IA nativa fica de reserva.

## Mapa dos testes obrigatórios (seção 18 do prompt)
| # | Teste | Automático (simulador) | No jogo |
|---|---|---|---|
| 1 | Invocar uma sombra | ✅ | ⬜ pendente |
| 2 | Impedir segunda invocação | ✅ | ⬜ |
| 3 | Vincular ao dono correto (id persistente + `tame`) | ✅ | ⬜ |
| 4 | Ignorar comandos de outro jogador / acesso negado | ✅ | ⬜ **multiplayer real** |
| 5 | Seguir o dono | ✅ (modo nativo ligado) | ⬜ movimento nativo |
| 6 | Proteger contra inimigos | ✅ (detecção + raio + IA nativa ligada) | ⬜ combate corpo a corpo nativo |
| 7 | Coletar madeira de verdade | ✅ (quebra real, drop real, entrega real) | ⬜ |
| 8 | Obter alimentos de verdade | ✅ (colhe, replanta, pão na bancada) | ⬜ |
| 9 | Comer pão com fome simulada | ✅ | ⬜ |
| 10 | Equipar ferramenta suportada | ✅ | ⬜ visual na mão |
| 11 | Armazenar e entregar itens | ✅ | ⬜ |
| 12 | Cancelar e substituir tarefas | ✅ | ⬜ |
| 13 | Recuperar tarefa após falha | ✅ (falha honesta + retomada após recarregar) | ⬜ |
| 14 | Ressuscitar sem duplicar itens | ✅ | ⬜ |
| 15 | Salvar e recuperar ao reabrir o mundo | ✅ (agente recriado do disco no meio da tarefa) | ⬜ fechar/abrir o mundo de verdade |
| 16 | Funcionar sem internet | ✅ (nenhuma chamada de rede no addon) | ⬜ |

> ✅ no simulador **não** é o mesmo que testado no jogo. O simulador modela blocos, entidades, itens, eventos e o
> agendador, mas não a física, a IA nativa (seguir/atacar), a renderização nem as animações.

## Checklist manual no jogo (preencha ao testar)
1. Importar o `.mcaddon`, ativar no mundo, entrar → recebeu o Invocador? Algum erro no **Log de conteúdo** (Configurações → Criador → Log de conteúdo)?
2. Invocar a Luna → animação de surgir, olhos brilhando, piscando, nome rosa acima da cabeça.
3. Andar → ela segue (andando, não deslizando). Afastar 20+ blocos → ela teleporta pra perto.
4. Zumbi à noite → ela ataca, a Luna solta raios, ela não persegue longe.
5. `/sombra pegue 8 troncos e volte` perto de árvores → corta (animação de machado), recolhe, volta, entrega.
6. Agachar + tocar nela segurando pão → ela guarda. Esperar a fome → ela come sozinha.
7. Matar a sombra (`/kill @e[type=shadowbound:companion]`) → some em fumaça, volta em 20 s com o mesmo inventário e nenhum item no chão.
8. Fechar e reabrir o mundo no meio de uma tarefa → ela reaparece e continua.
9. **Multiplayer**: jogador B tenta `/sombra ...` e tocar na sombra de A → nada acontece / "Acesso negado".
10. `construa uma casinha de madeira` com 69 tábuas → casinha com porta e janelas.
