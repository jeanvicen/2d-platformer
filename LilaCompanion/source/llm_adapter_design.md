# Adaptador opcional de IA na nuvem — só desenho (desligado, não incluído no pacote)

**Status:** não implementado no `.mcaddon`. Nenhuma chave, URL ou credencial está no pacote.

## Por que não vem ligado
- Add-ons do Bedrock (scripts) não fazem requisições HTTP no celular; `@minecraft/server-net`
  só existe em servidor dedicado e é Beta.
- Uma chave de API embutida no pacote vazaria para qualquer jogador.

## Desenho (para servidores dedicados próprios)
1. Um serviço externo do dono do servidor recebe `{texto, inventárioResumo, posição, objetivoAtual}`
   e devolve **apenas** intenções no mesmo formato de `lib/intent.js`
   (`{type:"gather", item:{id:"minecraft:iron_ingot"}, count:8}` …).
2. As intenções passam pelo mesmo validador e pelo mesmo planejador determinístico; a IA nunca
   executa comandos diretamente.
3. A chave fica no serviço externo (variável de ambiente do servidor), nunca no add-on.
4. Configuração por `server-net` (Beta) apenas em BDS, com timeout e fallback para o
   reconhecedor local.
