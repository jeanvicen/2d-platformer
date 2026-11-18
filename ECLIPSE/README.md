# ECLIPSE — Shadow Sovereign

**Add-On para Minecraft Bedrock (celular Android e demais plataformas) · criado por 0neajx · v1.0.0**

Fantasia sombria com cara de Minecraft premium. Inclui:
- 10 criaturas 3D que saem da sua sombra;
- a **Lyra**, uma companheira que coleta, caça, explora e constrói casas e até mansões;
- relíquias 3D, com o Martelo do Eclipse que você lança e chama de volta;
- asas para voar, 6 metamorfoses;
- 3 Modos de poder (Eclipse, God e Haze);
- Forja com busca em português e o Códice com o manual completo dentro do jogo.

Tudo vem **liberado desde o início**. Não precisa de experimentos nem de internet.

## Download e instalação (Android)
1. Baixe `dist/ECLIPSE_Shadow_Sovereign.mcaddon`.
2. Toque no arquivo e escolha abrir com **Minecraft**. O jogo importa os dois pacotes.
3. Crie ou edite um mundo. Em **Pacotes de comportamento**, ative *ECLIPSE — Shadow Sovereign (BP)*; o pacote de recursos é ativado junto.
4. Entre no mundo. Aparece a mensagem *"Mod criado por 0neajx"* e você recebe o **Núcleo do Eclipse**. Toque com ele para despertar.

Se o .mcaddon não abrir, importe os dois `.mcpack` da pasta `dist/`, um de cada vez.

## Compatibilidade
- Alvo: Minecraft Bedrock **26.30 ou mais novo** (estável da Play Store). Verificado contra o servidor oficial **1.26.65.1**.
- Script API estável: `@minecraft/server` **2.8.0** e `@minecraft/server-ui` **2.1.0**, versões fixas e sem módulos beta.
- `min_engine_version`: 1.26.30. Nenhum experimento é necessário.

## Controles (touchscreen)
| Item | Toque | Agachado + toque |
|---|---|---|
| Núcleo do Eclipse | despertar / abrir o Grimório | trocar de Modo |
| Selo da Legião | invocar/recolher criatura | escolher criatura |
| Selo do Poder | usar técnica do Modo | trocar técnica |
| Essência da Forma | transformar / habilidade | escolher forma / voltar |
| Mão da Sombra | criar construção temporária | trocar construção |
| Prisma dos Elementos | próximo elemento (Haze) | elemento anterior |
| Laço de Lyra | chamar / falar com a Lyra | Seguir → Esperar → Proteger |
| Martelo / Machado / Lança | lançar | — (toque no **Chamado** para voltar) |

- **Asas:** equipe-as no peito e faça um pulo duplo no ar. Segure PULO para subir, use AGACHAR para descer e o joystick para dirigir.
- **Criaturas:** olhe para elas e toque em "Ordens". Para falar com a Lyra, olhe para ela e toque em "Falar".
- **Comandos opcionais** (funcionam sem cheats): `/eclipse:menu`, `/eclipse:codice`, `/eclipse:forja`, `/eclipse:lyra "pedido"`, `/eclipse:kit`, `/eclipse:voltar`, `/eclipse:limpar`.

## Limitações conhecidas (honestas)
- **Metamorfose:** o Bedrock estável não permite trocar o esqueleto do jogador por script. A forma é um modelo 3D completo vestido no peito, com a sua pele escondida; câmera e controles continuam os seus.
- **Montaria do dragão:** não existe voo pilotado confiável via API estável. O Nox faz um "Transporte Sombrio" e leva você voando até onde você olha. Não é montaria.
- **Assistente de texto:** a Forja e a Lyra usam um interpretador local de português, sem IA na nuvem. Eles entendem pedidos e sinônimos do catálogo, mas não inventam modelos novos.
- **Teste no aparelho:** o alinhamento fino das relíquias na mão e os rastros de partícula ainda precisam ser conferidos num celular. Veja o `TEST_REPORT.md`.
- A Lyra extrai pedra e minério "pelas sombras", sem abrir túneis. Ela nunca demole construções de jogadores.

## Estrutura
```
ECLIPSE/
  ECLIPSE_BP/   comportamento + scripts (scripts/ modular: core, modes, summoning, lyra, abilities, systems, ui, lib)
  ECLIPSE_RP/   modelos 3D, texturas, animações, attachables, partículas, sons
  tools/        gerador de assets, validador, testes, empacotador, harness do servidor oficial
  dist/         .mcaddon + .mcpack + SHA256SUMS
```
Para reconstruir: `python3 tools/build_assets.py && python3 tools/validate_project.py && python3 tools/package_mcaddon.py`.
