# CenterBots

**CenterBots** é uma aplicação desktop baseada em Electron e TypeScript para **replicar mensagens recebidas para múltiplos grupos do WhatsApp**. A aplicação permite que múltiplos números (bots) sejam conectados. Cada bot "escuta" mensagens vindas de números autorizados e, ao receber uma, a coloca em uma fila para ser disparada para uma lista de grupos pré-definida.

---

## ✨ Proposta

- Replicar uma mensagem recebida de uma fonte autorizada para múltiplos grupos do WhatsApp.
- Gerenciar múltiplos números/bots simultaneamente em uma única aplicação.
- Interface desktop multiplataforma (Windows, macOS, Linux).
- Persistir dados e configurações localmente com banco SQLite.
- Foco em praticidade, controle da fila de envio e segurança dos dados.

---

## ⚙️ Tecnologias Utilizadas

- **Electron**: Plataforma para aplicações desktop com Node.js + Chromium.
- **TypeScript**: Tipagem estática e robustez no código.
- **Baileys**: Biblioteca TypeScript para integração com WhatsApp Web.
- **SQLite**: Banco de dados local, leve e eficiente.
- **Vite**: Build tool rápida para projetos web/electron.
- **TailwindCSS**: Utilitários CSS para UI moderna.
- **ESLint & Prettier**: Padronização e qualidade do código.
- **Pino**: Logger eficiente para Node.js.

---

## 🚀 Funcionalidades Principais

- **Gerenciamento de múltiplos bots**: Cada bot opera com credenciais isoladas, permitindo múltiplos números de WhatsApp.
- **Disparo para grupos acionado por mensagem**: O envio é iniciado quando o bot recebe uma mensagem (texto, imagem, etc.) de um número autorizado.
- **Controle de números autorizados**: Defina quais números de WhatsApp podem "comandar" um bot para iniciar os disparos.
- **Gerenciamento de grupos de destino**: Para cada bot, selecione para quais grupos as mensagens serão replicadas.
- **Fila de envio por bot**: Visualize, reordene e remova mensagens da fila de envio.
- **Visualização de status em tempo real**: Acompanhe o status de cada bot (Online, Enviando, Desconectado).
- **Modos de origem**: Filtre por mensagens de **Todas**, apenas **Privadas** ou apenas **Grupos**.
- **Métodos de envio**: **Texto**, **Imagem** (gera miniatura a partir da mídia ou do link) ou **Encaminhar** a mensagem original.
- **Links com parâmetros UTM**: Opcionalmente adicione `utm_source` (ex.: whatsapp) e `utm_medium` (nome do grupo) aos links.
- **Relatórios de envio**: Envio opcional de resumo ao final do lote para os números autorizados.
- **Pausas configuráveis**: Intervalos entre grupos e entre mensagens para reduzir riscos de bloqueio.
- **Agendamentos**: Cadastre conteúdos para execução única, diária, semanal ou mensal; selecione um ou mais bots (respeita o plano da licença).
- **Proxy opcional**: Configure proxy HTTP(S) por bot para a conexão com os servidores da Meta.
- **Histórico**: Consulte o histórico recente e o estado atual da fila por bot.

---

## 🖥️ Como Usar

1. **Pré-requisitos**:

   - Node.js (recomendado v18+)
   - npm

2. **Instale as dependências**:

   ```bash
   npm install
   ```

3. **Desenvolvimento (hot reload)**:

   ```bash
   npm run dev
   ```

4. **Preview de produção**:

   ```bash
   npm run start
   ```

5. **Build de produção**:

   ```bash
   npm run build
   ```

6. **Empacotar para Windows/macOS/Linux**:
   ```bash
   npm run build:win    # Windows
   npm run build:mac    # macOS
   npm run build:linux  # Linux
   ```

---

## 🔧 Configuração

- **Variáveis de ambiente**: defina `MAIN_VITE_API_URL` nos arquivos `.env.*` para o endpoint de licença/sincronização (já apontando para produção por padrão).
- **Licença e plano**: em `Configurações`, informe `ID do usuário` e `Chave de acesso`. O status pode ser `Ativo`, `Expirado` ou `Inativo`. Planos: `Básico`, `Completo` e `Corporativo` (alguns recursos, como sincronização/estatísticas e agendamentos, dependem do plano).
- **Dados locais**: o banco **SQLite** é salvo em `userData/centerbots.db` (pasta de dados do Electron por SO). Credenciais de cada bot ficam isoladas.

---

## 📝 Fluxo de Uso

1. **Adicionar um bot**: Clique em <kbd>Adicionar Bot</kbd>, preencha as informações e ative-o para ler o QR Code com o WhatsApp do número desejado.
2. **Configurar o bot**:
   - Na tela de configuração, defina os **"Números autorizados"**. Apenas mensagens vindas desses números irão acionar os envios.
   - Configure outras opções, como pausas entre envios.
3. **Selecionar grupos de destino**: Clique no botão <kbd>Grupos</kbd> no card do bot e selecione para quais grupos ele deve enviar as mensagens recebidas.
4. **Iniciar um disparo**: Envie uma mensagem (texto, imagem, etc.) de um dos **números autorizados** para o número do bot.
5. **Acompanhar o envio**: A aplicação adiciona a mensagem à fila do bot e inicia o envio para os grupos selecionados. Acompanhe o progresso e gerencie a fila na tela de <kbd>Mensagens</kbd>. Envie <kbd>status</kbd> para o bot (via WhatsApp) para receber um resumo rápido.

---

## 📚 Documentação

- [doc/baileys.md](doc/baileys.md): Guia técnico sobre a biblioteca Baileys.
- [dev/scripts-npm.md](dev/scripts-npm.md): Explicação dos scripts npm do projeto.

---

## 🔒 Boas Práticas e Avisos

- **Evite disparos excessivos**: O uso abusivo pode resultar em bloqueio do número pelo WhatsApp.
- **Use com consentimento**: Certifique-se de que os membros dos grupos de destino concordam em receber as mensagens.
- **Não utilize para spam**.
- **Atualize sempre o Baileys**: Para manter compatibilidade com o WhatsApp Web.
- **Gerencie credenciais com cuidado**: Cada bot tem seu diretório de autenticação.
- **Os dados ficam armazenados localmente**.
 - **Atualizações automáticas**: o aplicativo verifica e instala atualizações quando disponíveis.

---

## 🤝 Contribuição

Contribuições são bem-vindas! Siga as boas práticas de código, mantenha o padrão do projeto e abra um Pull Request.

---

## 📄 Licença

Este projeto é distribuído sob licença MIT. Consulte o arquivo LICENSE para mais detalhes.

---

## ✉️ Contato

Dúvidas, sugestões ou problemas? Abra uma issue ou entre em contato pelo repositório.

---

**CenterBots** — Replicação de mensagens para grupos do WhatsApp, de forma simples e eficiente.
