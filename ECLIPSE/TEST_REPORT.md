# Relatório de testes — ECLIPSE v1.0.0

Ambiente: container Linux, sem celular e sem cliente Minecraft. Nada abaixo foi testado com um jogador real.

## Executados e aprovados
| Teste | Ferramenta | Resultado |
|---|---|---|
| Typecheck de todos os scripts | `tsc --checkJs` contra os typings oficiais `@minecraft/server` 2.8.0 e `server-ui` 2.1.0 | **0 erros** |
| Testes unitários (parser PT-BR, Forja, A*, plantas, economia de materiais, migração de perfil, rotação) | `node --test` | **12/12** |
| Validação cruzada (JSON, manifests, UUIDs, geometria ↔ animações ↔ ossos, texturas e proporção, partículas, sons, ícones, blocos, receitas, imports, queries Molang) | `tools/validate_project.py` | **0 erros** (11 avisos de chaves internas) |
| IDs de blocos e itens vanilla usados pela Lyra | `@minecraft/vanilla-data` 1.26.60 | todos válidos |
| Carregamento no **Bedrock Dedicated Server oficial 1.26.65.1** | `tools/bds_test/run_bds_test.py` | pack carregado, **0 erros de conteúdo** |
| Controle do teste acima: item propositalmente inválido | mesmo servidor | o servidor **detectou** (`[Item] Error Parsing Item`), então o "0 erros" é confiável |
| Autoteste dentro do mundo (servidor oficial) | `scriptevent eclipse:selftest` | **43/44** (detalhe abaixo) |
| Empacotamento | `tools/package_mcaddon.py` | .mcaddon com 424 arquivos (2,17 MB), CRC ok, os dois manifests na raiz de cada pasta |

O que o autoteste 43/44 cobriu no motor real:
- parser e Forja (11 casos) e persistência com JSON fatiado de 70 KB;
- as 10 criaturas: nascimento, troca de estado STAY→GUARD, fase e componente de dono;
- as 3 entidades de relíquia lançada, e o projétil elemental voando 10 blocos;
- os 10 blocos temporários com estado de idade;
- a Lyra: inventário de 36 slots, **contornou um muro com A\***, **cortou uma árvore e recolheu 4 troncos** e **construiu um abrigo com 99 de 99 blocos**.

A única falha foi do próprio teste: ele lia a propriedade no mesmo tick em que ela foi definida, e o motor só aplica no tick seguinte. O teste foi corrigido.

## Não executados (pendentes)
- **Testes ampliados no motor** (caça e cozimento, extração de pedra, autodestruição dos blocos): o código foi escrito e passou no typecheck. Na hora de rodar, o container passou a impedir o servidor de abrir porta, então não rodaram.
- **Tudo que exige jogador:**
  - toque nos itens no celular, voo, metamorfose;
  - lançar e chamar o martelo;
  - formulários e partículas na tela;
  - multiplayer com 2 jogadores, persistência ao sair e voltar.

  O servidor de teste não tem jogadores conectados.
- **Visual no cliente:** animações, attachables (relíquias na mão em 1ª e 3ª pessoa, asas, formas) e materiais emissivos. A geometria foi conferida com renderizador próprio e as convenções seguem a documentação oficial "Using Attachables", mas o alinhamento fino na mão precisa ser visto no aparelho.
- **Desempenho (FPS) em Android real.**

## Como testar no celular (checklist rápido)
1. Despertar o Núcleo e escolher um Modo.
2. Usar o Selo da Legião em cada criatura e dar as ordens Seguir, Esperar e Proteger.
3. Equipar as asas, fazer o pulo duplo, voar e pousar.
4. Lançar o Martelo, ver o raio e tocar no Chamado: o martelo deve voltar e não duplicar.
5. Chamar a Lyra e pedir "pega 16 madeiras" e depois "faz uma cabana aqui".
6. Transformar-se e voltar (Essência, agachado + toque).
7. Sair e entrar de novo no mundo e conferir que o perfil, a Lyra e a relíquia continuam.
8. Como administrador: `/eclipse:autoteste`.
