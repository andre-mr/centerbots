# CenterBots

**CenterBots** é uma aplicação desktop baseada em Electron e TypeScript que permite criar, gerenciar e operar múltiplos bots de WhatsApp utilizando a biblioteca [Baileys](https://github.com/WhiskeySockets/Baileys). O projeto oferece uma interface moderna, persistência local via SQLite e integrações para automação de mensagens, gerenciamento de grupos, envio de mídia e muito mais.

---

## ✨ Proposta

- Automatizar interações no WhatsApp via bots multi-dispositivo.
- Gerenciar múltiplos números/bots simultaneamente em uma única aplicação.
- Oferecer interface desktop multiplataforma (Windows, macOS, Linux).
- Persistir dados e configurações localmente com banco SQLite.
- Facilitar integrações e extensões para casos de uso variados (atendimento, notificações, marketing autorizado, etc).

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
- **Outras**: Node.js, PostCSS, scripts utilitários.

---

## 🚀 Funcionalidades Principais

- **Gerenciamento de múltiplos bots**: Cada bot opera com credenciais isoladas, permitindo múltiplos números de WhatsApp.
- **Reconexão automática**: Persistência de sessão e lógica de reconexão inteligente.
- **Envio e recebimento de mensagens**: Texto, mídia (imagens, áudios, vídeos, documentos), enquetes, reações, etc.
- **Mensagens temporárias**: Ativação/desativação e detecção de mensagens efêmeras.
- **Gerenciamento de grupos**: Criação, adição/remoção de participantes, obtenção de metadados.
- **Confirmação de entrega/leitura**: Recebimento de recibos (ticks cinza/azul) e marcação de mensagens como lidas.
- **Cache local de grupos/contatos**: Sincronização eficiente com o WhatsApp.
- **Interface desktop**: Experiência de uso moderna, multiplataforma e responsiva.
- **Scripts de build, lint, typecheck e empacotamento**.

---

## 📦 Estrutura do Projeto

```
├── src/                # Código-fonte principal (Electron, bots, models, etc)
├── dev/                # Scripts, backups e utilitários de desenvolvimento
├── resources/          # Recursos estáticos (ícones, imagens)
├── doc/                # Documentação técnica detalhada (ex: Baileys)
├── package.json        # Dependências e scripts npm
├── electron.vite.config.ts
├── tailwind.config.js
├── tsconfig*.json
└── README.md
```

---

## 🖥️ Como Rodar o Projeto

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

## 📝 Scripts NPM Úteis

- `format` — Formata o código com Prettier.
- `lint` — Analisa problemas de estilo/código com ESLint.
- `typecheck` — Checa tipos TypeScript (Node + Web).
- `dev` — Inicia Electron em modo desenvolvimento.
- `start` — Preview de produção.
- `build` — Build de produção.
- `build:win|mac|linux` — Empacota para cada SO.
- Veja [dev/scripts-npm.md](dev/scripts-npm.md) para detalhes.

---

## 📚 Documentação

- [doc/baileys.md](doc/baileys.md): Guia técnico completo sobre a biblioteca Baileys, exemplos de uso, eventos, tipos, melhores práticas e dicas para evitar banimentos.
- [dev/scripts-npm.md](dev/scripts-npm.md): Explicação dos scripts npm do projeto.

---

## 🔒 Boas Práticas e Avisos

- **Evite spam e automações abusivas**: O uso de bots não-oficiais pode violar os termos do WhatsApp. Use de forma ética e responsável.
- **Atualize sempre o Baileys**: Para manter compatibilidade com o WhatsApp Web.
- **Gerencie credenciais com cuidado**: Cada bot deve ter seu diretório de autenticação.
- **Respeite privacidade**: Não armazene mensagens temporárias além do prazo definido.

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

**CenterBots** — Automação de WhatsApp com robustez, flexibilidade e foco em boas
