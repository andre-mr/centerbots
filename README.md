# CenterBots

CenterBots é um app desktop (Electron + TypeScript) para replicar mensagens recebidas para múltiplos grupos do WhatsApp. Suporta múltiplos números (bots), fila de envios e armazenamento local em SQLite.

---

## Proposta

- Replicar mensagens recebidas de fontes autorizadas para vários grupos do WhatsApp.
- Gerenciar múltiplos números/bots em uma única aplicação.
- Interface desktop multiplataforma (Windows, macOS, Linux).
- Persistência local (SQLite) com foco em praticidade e segurança.

---

## Tecnologias

- Electron, TypeScript, Vite, React, TailwindCSS
- Baileys (WhatsApp Web), SQLite, Pino
- ESLint + Prettier

---

## Funcionalidades

- Múltiplos bots com credenciais isoladas.
- Disparo para grupos acionado por mensagem de número autorizado (texto, imagem ou vídeo).
- Números autorizados e seleção de grupos por bot.
- Fila de envio por bot (reordenar e remover itens).
- Status em tempo real (Online, Enviando, Desconectado, etc.).
- Modos de origem: Todas, Privadas ou Grupos.
- Métodos de envio: Texto, Imagem ou Encaminhar.
- Parâmetros UTM opcionais em links (`utm_source`, `utm_medium`).
- Relatórios de envio (opcional) para os números autorizados.
- Pausas configuráveis entre grupos e entre mensagens.
- Agendamentos (único, diário, semanal, mensal) com mídia e variação automática de conteúdos cadastrados.
- Proxy HTTP(S) opcional por bot.
- Histórico recente e estado da fila por bot.
- Backup e restauração do banco de dados (em Configurações).
- Atualizações automáticas.

---

## Como Usar

1. Pré‑requisitos: Node.js v18+ e npm.
2. Instalar dependências: `npm install`.
3. Desenvolvimento: `npm run dev`.
4. Preview de produção: `npm run start`.
5. Build: `npm run build`.
6. Empacotar: `npm run build:win` | `npm run build:mac` | `npm run build:linux`.

---

## Configuração

- Variáveis de ambiente: defina `MAIN_VITE_API_URL` (arquivos `.env.*`) para o endpoint de licença/sincronização.
- Licença e plano: em Configurações, informe ID do usuário e Chave de acesso. Status: Ativo, Expirado ou Inativo. Planos: Básico, Completo e Corporativo (recursos como sincronização/estatísticas e agendamentos podem depender do plano).
- Dados locais: o SQLite é salvo em `userData/centerbots.db` (pasta de dados do Electron por SO). Cada bot possui autenticação isolada. Há opção de backup/restauração em Configurações.

---

## Fluxo de Uso

1. Adicionar um bot: clique em Adicionar Bot, salve e ative para ler o QR Code com o WhatsApp do número desejado.
2. Configurar: defina Números autorizados, pausas, origem das mensagens, método de envio, parâmetros de link e proxy (opcional). Exclua o bot ou desvincule WhatsApp removendo credenciais.
3. Grupos de destino: selecione os grupos por bot.
4. Iniciar disparo: envie mensagem (texto, imagem ou vídeo) de um número autorizado para o bot.
5. Acompanhar: veja a fila em Mensagens. Envie “status” ao bot via WhatsApp para um resumo rápido.

---

## Documentação

- doc/baileys.md: guia técnico sobre a biblioteca Baileys.

---

## Boas Práticas

- Evite disparos excessivos (risco de bloqueio).
- Use com consentimento dos participantes dos grupos.
- Não utilize para spam.
- Mantenha o Baileys atualizado.
- Cuide das credenciais (um diretório por bot).

---

## Contribuição

Contribuições são bem‑vindas. Siga o padrão do projeto e abra um PR.

---

## Licença

MIT. Veja o arquivo LICENSE.

---

## Contato

Dúvidas, sugestões ou problemas? Abra uma issue no repositório.

---

CenterBots — replicação de mensagens para grupos do WhatsApp, simples e eficiente.
