# Baileys – Biblioteca TypeScript para WhatsApp Web (Análise Técnica)

## Introdução e Visão Geral

Baileys é uma biblioteca TypeScript baseada em WebSockets para interagir com a API do WhatsApp Web. Em outras palavras, ela se comporta como um cliente WhatsApp Web não-oficial, permitindo que desenvolvedores automatizem o WhatsApp através de código. A comunicação ocorre via sockets usando o mesmo protocolo do WhatsApp Web (incluindo criptografia ponta-a-ponta), garantindo alta compatibilidade com as funcionalidades oferecidas oficialmente no cliente web do WhatsApp.

**Principais recursos automatizáveis com Baileys incluem:**

- **Envio e recebimento de mensagens de texto:** enviar mensagens para contatos ou grupos e receber mensagens em tempo real via eventos.
- **Envio de diversos tipos de mídia:** suporte a imagens, áudios (incluindo notas de voz), vídeos, documentos e figurinhas (stickers).
- **Gerenciamento de grupos:** criar grupos, adicionar/remover participantes, obter informações de grupos e acompanhar alterações (mudança de assunto, participações).
- **Confirmações de entrega e leitura:** receber notificações de mensagens entregues/lidas e marcar mensagens como lidas (check azul).
- **Link previews e mensagens interativas:** enviar mensagens contendo links com preview (título, descrição e imagem) e mensagens do tipo enquetes (polls), respostas de botões, etc.
- **Suporte a mensagens temporárias (disappearing messages):** detectar e configurar mensagens que desaparecem após certo tempo em chats compatíveis.
- **Eventos em tempo real:** arquitetura orientada a eventos para receber atualizações de conexão, novas mensagens, reações, status de presença, alterações em contatos e grupos, chamadas, entre outros.
- **Multi-dispositivos:** compatível com o WhatsApp multi-device, permitindo conectar mesmo com o celular offline após pareamento inicial. Vários bots (múltiplas instâncias) podem rodar simultaneamente na mesma aplicação (detalhado adiante).
- **Reconexão automática e persistência de sessão:** manutenção do estado de autenticação para não precisar escanear QR a cada vez, e lógica de reconexão em caso de perda de conexão.

Como a biblioteca emula o WhatsApp Web oficial, ela precisa acompanhar frequentemente mudanças no protocolo. Os desenvolvedores da Baileys recomendam usar sempre a versão mais recente para minimizar incompatibilidades e reduzir riscos de banimento. Por exemplo, pode-se obter a versão mais recente suportada do WhatsApp Web dinamicamente com `fetchLatestBaileysVersion()` antes de conectar.

### Exemplo de Bot Mínimo em TypeScript

Abaixo está um exemplo completo de um **bot mínimo** utilizando Baileys. Este bot realiza autenticação via QR Code, se reconecta automaticamente em caso de desconexão e consegue enviar e receber mensagens simples.

```typescript
import P from "pino";
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";

async function iniciarBot() {
  // Configura armazenamento da autenticação em vários arquivos (preserva sessão entre execuções)
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
  // Obtém a versão mais recente suportada do WhatsApp Web
  const { version } = await fetchLatestBaileysVersion();

  // Inicializa o socket de conexão com WhatsApp
  const sock = makeWASocket({
    version, // versão do WA Web a usar
    logger: P().child({ level: "error" }), // logger (pino) com nível de erro para simplificar
    printQRInTerminal: true, // imprime o QR Code no terminal para escanear
    auth: state, // usa o estado de autenticação (creds e keys)
  });

  // Escuta eventos de atualização de conexão
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      console.log("QR Code recebido, escaneie no app WhatsApp:", qr);
    }
    if (connection === "close") {
      // Reconecta automaticamente, a menos que seja loggedOut
      const shouldReconnect =
        (lastDisconnect?.error as any)?.output?.statusCode !==
        DisconnectReason.loggedOut;
      if (shouldReconnect) {
        iniciarBot();
      } else {
        console.log("Sessão encerrada. É necessário escanear o QR novamente.");
      }
    } else if (connection === "open") {
      console.log("Conectado com sucesso ao WhatsApp!");
    }
  });

  // Escuta eventos de novas mensagens recebidas
  sock.ev.on("messages.upsert", async (msgUpdate) => {
    const [novaMsg] = msgUpdate.messages;
    if (!novaMsg.key.fromMe && novaMsg.message) {
      // Extrai o texto da mensagem (suporta texto simples e mensagem estendida)
      const texto =
        novaMsg.message.conversation ||
        novaMsg.message.extendedTextMessage?.text;
      console.log(`Mensagem recebida de ${novaMsg.key.remoteJid}: ${texto}`);
      // Responde a mensagem recebida com um texto fixo
      await sock.sendMessage(novaMsg.key.remoteJid!, {
        text: "Olá! Recebi sua mensagem.",
      });
      // Marca a mensagem como lida para enviar confirmação de leitura (check azul)
      await sock.readMessages([novaMsg.key]);
    }
  });

  // Salva credenciais toda vez que forem atualizadas (ex: ao renovar a sessão)
  sock.ev.on("creds.update", saveCreds);
}

iniciarBot().catch((err) => console.error(err));
```

**Como funciona:** Ao executar `iniciarBot()`, o bot carrega/gera credenciais e abre uma conexão com o WhatsApp Web. O QR code será mostrado no terminal (graças a `printQRInTerminal: true`), e deve ser escaneado com o WhatsApp do celular (em _Aparelhos Conectados_). Após escanear, o evento `connection.update` indicará `connection: 'open'` (conectado). A partir daí, o bot escuta novas mensagens (`messages.upsert`) e responde automaticamente com um cumprimento. O código também marca as mensagens como lidas usando `readMessages` para enviar a confirmação de leitura ao remetente. Em caso de desconexão, se não for devido a logout explícito, o bot chama `iniciarBot()` novamente para restabelecer a conexão. As credenciais são salvas periodicamente (evento `creds.update`) para permitir reconexões sem novo QR.

## Gerenciamento de Conexões e Reconexões

Baileys gerencia a conexão com os servidores do WhatsApp Web via WebSocket, emitindo eventos para mudanças de estado. Os estados típicos são `'connecting'` (conectando), `'open'` (conectado) e `'close'` (desconectado). O desenvolvedor deve tratar esses eventos para assegurar reconexão quando possível e lidar com logouts.

No exemplo acima, usamos `sock.ev.on('connection.update', ...)` para reagir a mudanças. Vamos detalhar a lógica de reconexão e outros aspectos importantes do ciclo de conexão:

- **Conexão bem-sucedida:** Quando estabelecida, `connection.update` traz `connection: 'open'`. Nesse momento, o WhatsApp pode enviar histórico de mensagens pendentes e outros dados. A biblioteca também emite `receivedPendingNotifications: true` quando terminou de processar notificações offline. Você pode usar esse sinal para saber que todas as mensagens atrasadas foram recebidas.

- **QR Code:** Durante a conexão inicial (login não registrado), a biblioteca fornece um QR code que deve ser escaneado. No código, definimos `printQRInTerminal: true`, o que imprime o QR no terminal automaticamente. Alternativamente, poderíamos escutar `update.qr` no evento de conexão e exibir o QR de outra forma (ex. gerar imagem). O objeto de update pode conter a string do QR em `update.qr` antes de `connection: 'open'`. Este QR expira após \~60 segundos se não escaneado, e um novo é gerado automaticamente (Baileys gerencia isso internamente). Caso o QR expire, `connection.update` emitirá um novo `qr` com outro código.

- **Reconexão automática:** Quando `connection.update` indica `connection: 'close'`, deve-se inspecionar o motivo. Baileys fornece em `update.lastDisconnect.error` detalhes do erro (geralmente um objeto **Boom** do `@hapi/boom`). O código de status em `lastDisconnect.error.output?.statusCode` corresponde a um enum `DisconnectReason`. No exemplo, verificamos se o código não é `DisconnectReason.loggedOut` antes de reconectar. Isso porque se o usuário se deslogou (ou as credenciais foram invalidada pelo WhatsApp, por exemplo ao remover o dispositivo conectado), tentar reconectar com as mesmas credenciais falhará – nesse caso é necessário obter novo QR (nova autenticação). Para outros códigos (ex.: conexão perdida, erro transient), podemos simplesmente chamar novamente a função de inicialização para reconectar.

- **Manutenção do socket:** Baileys internamente envia “keep alive” pings periodicamente (`keepAliveIntervalMs`, padrão 30s) para manter a conexão ativa. Caso a conexão caia por instabilidade de rede, a biblioteca tentará reconectar algumas vezes automaticamente. Entretanto, é recomendado que a aplicação do desenvolvedor implemente sua lógica de reconexão (como no exemplo) para retomar fluxos após quedas prolongadas ou após recuperar a internet.

- **Fechamento intencional:** Se você precisar encerrar a conexão manualmente (por exemplo, ao desligar o bot), pode usar `sock.ws.close()`, ou de forma mais limpa, chamar `await sock.logout()` se quiser encerrar também a sessão no WhatsApp (desconectando o dispositivo). O `logout()` remove as credenciais e informa ao WhatsApp que o device foi deslogado.

Em resumo, a gestão de conexão consiste em monitorar `connection.update` e reagir apropriadamente: **reconectar quando possível**, ou resetar autenticação quando necessário. Usar a persistência de credenciais (via `useMultiFileAuthState` ou similar) é fundamental para reconectar sem intervenção do usuário – as credenciais salvas permitem retomar a sessão imediatamente, evitando escanear QR a cada execução.

## Múltiplos Bots em uma Única Aplicação

É possível executar múltiplas instâncias do Baileys simultaneamente, permitindo controlar **vários números de WhatsApp** em uma única aplicação Node.js. Cada instância da conexão (socket) opera de forma independente, então precisamos fornecer **credenciais separadas** para cada bot.

Para gerenciar múltiplos bots no mesmo processo, recomenda-se:

- **Estados de autenticação distintos:** Utilize diretórios ou nomes diferentes ao chamar `useMultiFileAuthState`. Por exemplo, um bot pode usar `useMultiFileAuthState('auth_bot1')` e outro `useMultiFileAuthState('auth_bot2')`, garantindo que cada um tenha seu arquivo/caminho de armazenamento de credenciais. Assim, os tokens e chaves não se confundem entre si.

- **Inicialização de múltiplos sockets:** Instancie cada bot chamando `makeWASocket` separadamente, cada qual com suas credenciais. Exemplo simplificado:

  ```typescript
  const bot1Auth = await useMultiFileAuthState("auth_bot1");
  const bot2Auth = await useMultiFileAuthState("auth_bot2");
  const bot1 = makeWASocket({ auth: bot1Auth.state /* demais configs... */ });
  const bot2 = makeWASocket({ auth: bot2Auth.state /* demais configs... */ });
  ```

  Cada socket terá seu próprio `sock.ev` para eventos. Você pode diferenciá-los armazenando em variáveis diferentes (bot1, bot2) e registrando event handlers para cada um separadamente.

- **Isolamento de eventos:** Ao usar múltiplos bots, lembre-se de que cada instância emitirá todos os eventos (mensagens, conexão, etc.) referentes àquele número. Estruture seu código para tratar esses eventos por bot. Por exemplo, se ambos bots devem responder mensagens, registre um listener em `bot1.ev.on('messages.upsert', ...)` e outro em `bot2.ev.on('messages.upsert', ...)`. Isso evita misturar mensagens de origens diferentes.

- **Recursos de hardware:** Múltiplas conexões aumentarão o uso de memória e CPU. Baileys é relativamente eficiente, mas cada instância mantém criptografia e caches independentes. Certifique-se de dimensionar adequadamente seu servidor se planeja escalar para muitos bots simultâneos. Em alguns casos, usar processos separados (um por bot) pode melhorar isolamento, embora seja possível rodar diversos em um só processo.

- **Limites do WhatsApp:** Oficialmente, o WhatsApp Web permite até 4 sessões ativas por conta principal (no modo multi-device). Baileys não evita isso – se você tentar conectar mais dispositivos que o WhatsApp permitir, o mais antigo pode ser desconectado. Portanto, múltiplos bots geralmente implicam múltiplos números de telefone (cada qual com seu QR pareado). Tenha isso em mente na sua arquitetura (um número de telefone por instância de bot).

Resumidamente, a biblioteca suporta múltiplos bots facilmente, desde que gerenciemos separadamente o estado de cada conexão. O isolamento de credenciais e de tratadores de eventos são os pontos-chave para uma operação correta de vários bots dentro da mesma aplicação.

## Envio de Mídia

Enviar mídia (imagens, vídeos, áudio, documentos, etc.) com Baileys é tão simples quanto enviar texto – basta fornecer o conteúdo de mídia na chamada `sendMessage` que a biblioteca cuida do restante. Baileys faz o upload do arquivo para os servidores do WhatsApp e envia a mensagem com os metadados necessários. Internamente, ele obtém um **media connection** (endereço de upload) válido e utiliza a API do WhatsApp para armazenar o arquivo na nuvem antes do envio.

**Exemplo 1: Enviando uma imagem** (com legenda):

```typescript
import fs from "fs";
const imagem = fs.readFileSync("caminho/para/imagem.jpg"); // Buffer do arquivo
await sock.sendMessage("<numero>@s.whatsapp.net", {
  image: imagem,
  caption: "Esta é uma foto de teste",
});
```

No objeto de mensagem, usamos a chave `image` para indicar que é uma imagem. A biblioteca detecta o tipo e automaticamente cuida do upload. Podemos passar um Buffer (como no exemplo acima), um Stream legível, ou até um objeto `{ url: 'https://...' }` que a biblioteca fará o download e então o upload. Opcionalmente, incluímos `caption` para enviar texto junto à imagem. A Baileys inferirá o MIME type (`image/jpeg` neste caso) automaticamente.

**Exemplo 2: Enviando um áudio** (nota de voz):

```typescript
const audio = fs.readFileSync("caminho/para/audio.ogg");
await sock.sendMessage("<numero>@s.whatsapp.net", {
  audio: audio,
  mimetype: "audio/ogg",
  ptt: true,
});
```

Aqui usamos a chave `audio`. Definimos explicitamente o `mimetype` do arquivo (neste caso, OGG Opus) e `ptt: true` para que seja enviado como uma nota de voz (PTT, _Push-to-Talk_, no WhatsApp) em vez de um arquivo de áudio comum. Baileys suporta também outros formatos como MP3 ou AAC – apenas ajuste o mimetype conforme o arquivo (ex.: `'audio/mpeg'` para MP3).

**Exemplo 3: Enviando um documento PDF:**

```typescript
const documento = fs.readFileSync("arquivo.pdf");
await sock.sendMessage("<grupo>@g.us", {
  document: documento,
  mimetype: "application/pdf",
  fileName: "arquivo.pdf",
});
```

Usamos a chave `document` indicando o Buffer do arquivo e fornecemos o tipo MIME e um nome para exibição (`fileName`). O WhatsApp exibirá o nome e tipo do documento para os destinatários.

Baileys também permite enviar **vídeos** (`video`), **figurinhas** (`sticker`) e até mensagens localização (`location`). O padrão é semelhante: fornecer a chave correspondente em `sendMessage`. Para vídeos, pode-se marcar `gifPlayback: true` se for um MP4 curtinho para ser tratado como GIF animado. Para figurinhas, defina `sticker: <buffer>` e opcionalmente `isAnimated: true` se for WEBP animado.

Durante o envio de mídia, alguns detalhes técnicos ocorrem automaticamente:

- **Upload e criptografia:** A biblioteca solicita um endereço de upload e chave de criptografia ao WhatsApp. O arquivo é criptografado (em AES-GCM) e enviado. Depois obtém-se um `directPath` e `mediaKey` para composição da mensagem. Tudo isso é transparente para o desenvolvedor – apenas _Buffers in, message out_.
- **Tamanho e fragmentação:** WhatsApp tem limites de tamanho (\~100MB para vídeos/documentos). Baileys não fragmenta arquivos automaticamente além desse limite. Certifique-se de enviar arquivos dentro dos limites. Imagens enviadas muito grandes podem ser recomprimidas pelo WhatsApp.
- **Thumbnais (miniaturas):** Para imagens, vídeos e links, Baileys pode gerar thumbnails. Você pode fornecer manualmente `jpegThumbnail` (Buffer da imagem miniatura) no conteúdo para usar uma específica. Caso contrário, ele extrairá de vídeos ou gerará a partir de imagens se necessário.
- **Confirmação de envio:** A chamada `sendMessage` retorna um objeto com a mensagem enviada (incluindo seu ID). Você pode usar isso para rastrear a mensagem enviada no seu log ou armazenar em cache.

Após o envio, aguarde os eventos de _delivery_ e _read_ para confirmar entrega, conforme seção a seguir. Em resumo, enviar mídia com Baileys envolve fornecer o arquivo (ou link) na função de envio – a biblioteca lida com todos os passos de preparação, garantindo que o destinatário receba o conteúdo como se fosse enviado pelo aplicativo oficial.

## Confirmação de Entrega de Mensagens

O WhatsApp fornece recibos de entrega e leitura que podemos utilizar para acompanhar o status das mensagens enviadas e recebidas:

- **Confirmação de recebimento (entre um tick e dois ticks cinzas):** Quando você, atuando como cliente, envia uma mensagem com Baileys, inicialmente ela fica com status "enviada ao servidor" (um tick). Quando o servidor entrega ao destinatário, você recebe um evento indicando entrega (dois ticks). Baileys representa atualizações de status de envio através do evento `'messages.update'`. Esse evento traz um array de objetos contendo as chaves da mensagem e campos atualizados. Por exemplo, ao entregar, o campo `update.status` da mensagem pode mudar para `WAMessageStatus.DELIVERY_ACK` (entregue). Você pode inspecionar esses eventos para saber quando sua mensagem foi entregue.

- **Confirmação de leitura (dois ticks azuis):** Quando o destinatário visualiza a mensagem, o WhatsApp emite recibos de leitura. Em Baileys, para mensagens individuais, isso pode refletir como um `messages.update` com status `READ` (ou via evento `'message-receipt.update'` especialmente em grupos, onde recebemos quem leu). No caso de grupos, `'message-receipt.update'` fornece detalhes de cada participante que leu a mensagem. Por exemplo, você pode receber:

  ```json
  {
    "userJid": "<participante>",
    "receiptType": "read",
    "timestamp": 1672531199
  }
  ```

  indicando que um participante marcou como lida sua mensagem naquele horário.

- **Marcar mensagens como lidas:** Para as mensagens **recebidas pelo bot**, é responsabilidade do desenvolvedor enviar a confirmação de leitura de volta ao WhatsApp (caso deseje simular a leitura, similar ao ato de clicar na conversa no app). No exemplo do bot, usamos `sock.readMessages([msg.key])` após responder. Esse método notifica ao WhatsApp que a mensagem listada em `msg.key` foi lida (resultando em dois checks azuis para o remetente original). Alternativamente, pode-se usar `sock.sendReadReceipt(jid, participant, [msgId])` se precisar controle fino, mas `readMessages` facilita passando diretamente as keys obtidas no evento.

- **Confirmação de reprodução de áudio:** Existe também um recibo para quando uma mensagem de áudio (nota de voz) é reproduzida (ícone de microfone azul). Baileys trata isso como um tipo de recibo `'played'` em `message-receipt.update`, análogo a 'read'. Se necessário, você pode chamar `sock.sendPresenceUpdate('playing', jid)` ao iniciar reprodução e depois `sock.sendPresenceUpdate('available', jid)` – embora isso geralmente seja gerido pelo WhatsApp Web e não crítico para bots.

- **Verificando status manualmente:** A estrutura de mensagem (`WAMessage`) possui um campo `status` que indica seu estado local (isso é diferente dos recibos dos outros aparelhos). Por exemplo, logo após enviar, pode ser `PENDING`, depois `SERVER_ACK`, `DELIVERY_ACK` e finalmente `READ` (conforme o progresso). Esses statuses seguem `proto.WebMessageInfo.Status`. Entretanto, normalmente você não precisa consultar isso diretamente – usar os eventos citados acima é mais prático.

Em resumo, para garantir confirmações de entrega/leitura:

- Marque explicitamente mensagens recebidas como lidas usando `readMessages` (ou confirme leitura via `sendReadReceipt`), caso contrário o remetente não verá os dois ticks azuis.

- Escute eventos `'messages.update'` e `'message-receipt.update'` para reagir a quando suas mensagens enviadas forem entregues e lidas. Por exemplo, você pode registrar:

  ```typescript
  sock.ev.on("messages.update", (updates) => {
    for (const { key, update } of updates) {
      if (update.status) {
        console.log(
          `Msg ${key.id} para ${key.remoteJid} teve status alterado: ${update.status}`
        );
      }
    }
  });
  ```

  Assim, você acompanha cada mudança de status.

- Lembre-se: em grupos, a confirmação de leitura completa (todos membros leram) só ocorre quando todos membros ativos visualizam, mas você recebe recibos individuais conforme cada um vai lendo.

## Gerenciamento de Cache de Grupos e Participantes

Baileys fornece eventos e métodos para gerenciar informações de grupos e seus membros, permitindo manter um **cache local atualizado** dessas informações. Isso é útil para, por exemplo, saber rapidamente quem são os participantes de um grupo ou o nome de um grupo sem precisar consultar o servidor toda vez.

**1. Eventos relacionados a grupos:** Assim que conectado, o WhatsApp Web envia dados dos grupos nos quais sua conta participa. Baileys emite:

- `'groups.upsert'`: quando obtém informações iniciais de um ou mais grupos (fornece um array de `GroupMetadata` completos).
- `'groups.update'`: para alterações em grupos existentes (fornece um array de atualizações parciais, por exemplo mudança de nome ou descrição).
- `'group-participants.update'`: quando participantes entram ou saem de um grupo, ou têm seus papéis alterados (admin/promover, etc.). Este evento inclui o `id` do grupo, a ação (`'add'`, `'remove'`, `'promote'`, `'demote'`), a lista de participantes afetados e quem efetuou a mudança (`author`).

Exemplo de uso do evento de participantes:

```typescript
sock.ev.on("group-participants.update", ({ id, participants, action }) => {
  if (action === "add") {
    participants.forEach((jid) =>
      console.log(`Participante ${jid} entrou no grupo ${id}`)
    );
  } else if (action === "remove") {
    participants.forEach((jid) =>
      console.log(`Participante ${jid} saiu/foi removido do grupo ${id}`)
    );
  }
});
```

Com esses eventos, você pode atualizar um cache local de participantes por grupo. Por exemplo, mantendo um objeto `{ [groupJid]: Set<participantJid> }` e adicionando/removendo conforme os eventos.

**2. Métodos para consultar grupos:** Baileys expõe funções para obter dados de grupos:

- `sock.groupMetadata(jidGrupo)`: Retorna um objeto `GroupMetadata` completo com informações atualizadas daquele grupo (assunto, descrição, lista de participantes, etc.) fazendo uma requisição em tempo real se necessário. Útil para obter detalhes sob demanda.
- `sock.groupFetchAllParticipating()`: Faz uma consulta para listar **todos os grupos** que sua conta participa e retorna um dicionário mapeando `groupJid -> GroupMetadata`. Baileys automaticamente chama isso em segundo plano quando detecta mudanças globais nos grupos (um evento "dirty" do WhatsApp), e em seguida emite `'groups.update'` para todos. Você pode chamar manualmente se quiser recarregar todo o cache de grupos de uma vez.

**3. Estrutura do GroupMetadata:** O objeto de metadata de grupo contém campos importantes, por exemplo:

```typescript
interface GroupMetadata {
  id: string; // JID do grupo
  subject: string; // Nome (assunto) do grupo
  owner?: string; // JID do dono (criador, superadmin)
  creation?: number; // timestamp de criação
  desc?: string; // descrição do grupo
  participants: GroupParticipant[]; // lista de participantes
  size?: number; // número de participantes
  announce?: boolean; // se "apenas admins podem enviar mensagens"
  restrict?: boolean; // se "apenas admins podem alterar informações do grupo"
  // ... outros campos omitidos para brevidade
}
```

Cada `GroupParticipant` combina informações de contato com indicações de privilégio, ex:

```typescript
type GroupParticipant = Contact & { isAdmin?: boolean; isSuperAdmin?: boolean };
```

Onde `Contact` inclui o `id` (JID do membro) e eventualmente nome salvos, etc. Os campos `isAdmin` e `isSuperAdmin` indicam se o membro é admin comum ou o dono.

**4. Cache local vs. consulta ao vivo:** Decida se sua aplicação precisa manter um cache persistente. Para bots simples, pode bastar consultar `groupMetadata` quando necessário. Mas para aplicações que frequentemente precisam de dados de grupo ou offline, vale a pena popular um cache local ao conectar:

- Ouvir `'groups.upsert'` logo após a conexão para salvar os grupos iniciais.
- Ouvir `'group-participants.update'` para manter o cache de participantes atualizado.
- Ouvir `'groups.update'` para atualizar campos como nome ou descrição quando mudam.
- Opcionalmente, salvar esse cache em banco de dados ou em memória persistente se precisar reter entre execuções.

**5. Exemplo prático:** Suponha que seu bot precise saber se um usuário X está em um grupo Y antes de enviar uma mensagem. Você pode:

- Manter um cache `grupo->participantes` populado pelos eventos acima e simplesmente checar `cacheGrupo[Y].has(X)`.
- Ou chamar `await sock.groupMetadata(Y)` e percorrer os participantes para encontrar X, se preferir consulta on-demand (menos eficiente se fizer isso muito frequentemente).

Em geral, Baileys facilita o gerenciamento fornecendo as **peças brutas** (eventos e métodos). Cabe ao desenvolvedor montar a estratégia de cache conforme a necessidade da aplicação. A boa notícia é que o protocolo WhatsApp Web fornece sinais suficientes para mantermos uma visão local quase em tempo real do estado dos grupos.

## Envio de Mensagens com Link Preview

Uma funcionalidade útil é enviar mensagens com **preview de link** – aquelas em que o WhatsApp exibe uma caixinha com título, descrição e imagem do site quando há um link na mensagem. Baileys suporta isso automaticamente e de forma configurável.

Por padrão, se você enviar um texto contendo uma URL, o WhatsApp pode ou não gerar um preview. No app oficial, o cliente que envia costuma fazer uma requisição HTTP para obter metadados (OpenGraph, etc.) do link e anexar junto com a mensagem. Baileys pode fazer o mesmo.

Para habilitar previews, especifique a opção `generateHighQualityLinkPreview: true` na configuração do socket. No exemplo do bot mínimo, fizemos isso. Com essa flag, ao usar `sock.sendMessage` com um texto que contenha URL, a biblioteca tentará buscar informações do link para incluir na mensagem. Ela utiliza uma função interna `getUrlInfo` (que por sua vez usa axios/fetch) para obter título, descrição e uma imagem em miniatura do site.

**Exemplo:**

```typescript
await sock.sendMessage("<numero>@s.whatsapp.net", {
  text: "Confira este site: https://example.com/materia",
});
```

Se `generateHighQualityLinkPreview` estiver ativado, a mensagem enviada já incluirá o preview (caso o site responda a tempo às requisições de metadata). O resultado no WhatsApp do destinatário será uma cartela mostrando o título da página "Example Domain", possivelmente uma descrição, e alguma imagem (favicon ou outra) se disponível.

Caso não ative a geração de preview, é provável que nenhum preview seja exibido para o destinatário, ou apenas um preview básico (por vezes o próprio WhatsApp pode tentar gerar no aparelho do receptor, mas não é garantido). Portanto, **para garantir a melhor experiência**, recomenda-se manter `generateHighQualityLinkPreview: true` se sua aplicação envia links regularmente.

**Dica:** A função de preview faz requisição com timeout curto (\~3 segundos) para não atrasar muito o envio. Se o site demorar ou falhar, a mensagem é enviada mesmo assim (só que sem preview) e o log avisa falha na geração do link. Você pode personalizar esse comportamento modificando a função `getUrlInfo` ou preparando você mesmo o objeto de preview:
Baileys permite passar um campo `linkPreview` manual em `sendMessage` contendo um objeto com as informações (`WAUrlInfo`). Isso é avançado – na maioria dos casos deixar a biblioteca fazer automaticamente é suficiente.

Em resumo, basta inserir URLs em suas mensagens de texto que Baileys cuidará de enriquecer o conteúdo para mostrar o preview ao destinatário, similar ao app oficial. Certifique-se apenas de habilitar a opção de preview de link de alta qualidade na configuração do socket (ou usar a configuração padrão do `DEFAULT_CONNECTION_CONFIG` que já pode ativar dependendo da versão).

## Uso de Eventos da Biblioteca

Baileys é orientada a eventos: praticamente tudo que ocorre – desde conexões, novas mensagens, atualizações de contatos/grupos, até chamadas de voz – é emitido via um **event emitter** acessível em `sock.ev`. Compreender e utilizar esses eventos é fundamental para construir lógicas reativas no seu bot.

Alguns dos eventos mais importantes e comuns:

- **`connection.update`:** Atualização no estado da conexão (conectando, aberto, fechado, novos QR, etc.). Já abordamos no tópico de conexões – use para reconectar e indicar status ao usuário.
- **`messages.upsert`:** Chegada de novas mensagens ou inserção de histórico. O objeto evento tem a forma `{ messages: WAMessage[], type: 'notify' | 'append' | 'latest' | 'notify' }`. O tipo 'notify' indica novas mensagens em tempo real (por exemplo, recebidas de outros usuários). Esse é o evento ideal para ler e responder mensagens. Cada `WAMessage` traz os detalhes da mensagem (veremos estrutura adiante). No exemplo do bot, utilizamos esse evento para detectar e responder novas mensagens recebidas.
- **`messages.update`:** Atualizações em mensagens já existentes. Isso inclui mudanças de status (envio/entrega/leitura) e também alterações como edição de mensagem (WhatsApp permite editar mensagens recentes) ou revogação (deleção para todos). Você pode inspecionar as propriedades de update para determinar o que ocorreu (por exemplo `update.pollUpdates` no caso de enquetes, ou `update.status` no caso de recibos).
- **`message-receipt.update`:** Eventos de recibos de mensagem, principalmente úteis em grupos para saber quem leu sua mensagem. Em chats individuais, as leituras apareciam via `messages.update` (status), mas esse evento unificado fornece detalhes inclusive de playback de áudio (`receiptType: 'played'`).
- **`messages.reaction`:** Indica que alguém reagiu (com emoji) a uma mensagem. O evento traz a key da mensagem reagida e o conteúdo da reação (quem reagiu e com qual emoji).
- **`chats.upsert` / `chats.update` / `chats.delete`:** Informam sobre novas conversas adicionadas (por exemplo, quando recebe mensagem de um contato novo), atualizações em chats (mudança de último texto, lido/não lido, arquivamento) ou deleção de chats. Isso pode ser útil se o bot mantém uma interface ou precisa saber quais chats existem.
- **`contacts.upsert` / `contacts.update`:** Similar aos de chat, mas para contatos. Ao conectar, Baileys pode enviar uma lista de contatos conhecidos. Updates ocorrem quando, por exemplo, um contato muda seu nome ou foto de perfil (nesse caso, a propriedade `imgUrl` pode aparecer modificada, conforme exemplificado no código de exemplo).
- **`groups.upsert` / `groups.update`:** Eventos de grupos (já detalhados na seção anterior). Use-os para acompanhar criação de grupos ou mudanças nas propriedades (nome, descrição, etc.).
- **`group-participants.update`:** Evento específico para entrada/saída/promover/demitir participantes em grupos.
- **`call`:** Eventos de chamadas de voz/vídeo recebidas. O objeto traz detalhes da chamada (se foi perdida, rejeitada, etc.). Útil caso seu bot precise, por exemplo, rejeitar automaticamente chamadas (chamadas de voz de terceiros em bots costumam ser indesejadas, e Whatsapp pode banir se muitas não são atendidas).
- **`creds.update`:** Disparado sempre que as credenciais de autenticação são alteradas ou atualizadas. Deve-se salvar o estado (como com `saveCreds`) neste momento para não perder a sessão.
- **Outros:** Há eventos para atualizações de presença (`presence.update` quando alguém está digitando/online em um chat), edição/associação de etiquetas (labels, recurso do WhatsApp Business), notificações de histórico (`messaging-history.set` quando recebe histórico inicial ou sob demanda), e assim por diante.

**Como usar os eventos:** Você pode escutar individualmente com `sock.ev.on('nome.do.evento', callback)`. Por exemplo:

```typescript
sock.ev.on("messages.reaction", (reactions) => {
  reactions.forEach(({ key, reaction }) => {
    console.log(
      `Mensagem ${key.id} recebeu reação: ${reaction.reaction.text} de ${reaction.key?.participant}`
    );
  });
});
```

No caso acima, quando qualquer reação for recebida, logamos qual emoji e quem reagiu.

Outra forma avançada é usar `sock.ev.process(async events => { ... })`, que processa um “lote” de eventos de uma vez. Isso é útil para eficiência, pois vários eventos podem chegar quase simultaneamente. Dentro de `ev.process`, você pode checar se `events['tipo.evento']` existe e então tratar. O exemplo oficial usa essa abordagem, acumulando tudo que chegou em um tick do loop:

```typescript
sock.ev.process(async(events) => {
  if(events['messages.upsert']) { ... }
  if(events['presence.update']) { ... }
  // etc.
});
```

O uso de `process` é interessante para alto volume, mas para muitos casos usar `.on` diretamente é suficiente e mais simples de entender.

**Boas práticas com eventos:**

- Sempre trate `connection.update` e `creds.update` (conforme detalhado).
- Para mensagens, prefira `messages.upsert` em vez de `messages.all` (obsoleto) – ele já distingue mensagens novas (`notify`) de históricas (`append`).
- Remova listeners não necessários ou use condicional se reutilizar o mesmo código para múltiplas instâncias de socket, para evitar duplicar reação a um mesmo evento.
- Lembre que alguns eventos podem fornecer dados incrementais. Ex: `contacts.update` pode trazer apenas campos modificados (e não todos do contato). Então combine com seu cache existente para ter dados completos.
- Consulte a definição completa de eventos em `BaileysEventMap` dentro do código fonte para ver todos disponíveis e as estruturas de dados que entregam.

Em suma, a API de eventos do Baileys dá um controle fino e em tempo real sobre praticamente tudo que ocorre no WhatsApp. A chave para usar efetivamente é registrar callbacks para os eventos de interesse e manter o estado que você precisa (por exemplo, armazenar mensagens recebidas, atualizar caches, reagir em tempo real a interações, etc.).

## Boas Práticas para Evitar Banimentos

O WhatsApp não autoriza oficialmente automações via engenharia reversa (como Baileys) e historicamente pode banir números que abusam ou se comportam de maneira não humana. Embora muitos desenvolvedores usem Baileys sem problemas, é importante seguir algumas **boas práticas para mitigar riscos de banimento:**

- **Não envie spam ou conteúdo em massa:** Evite enviar mensagens idênticas para muitos destinatários em curto intervalo, ou criar grupos indiscriminadamente. Essas ações disparadas podem acionar algoritmos anti-spam do WhatsApp. Mantenha a automação dentro de casos de uso legítimos (ex.: respostas a usuários que iniciaram contato, notificações solicitadas, etc.).

- **Respeite limites de velocidade:** Implemente _delays_ entre mensagens enviadas. Por exemplo, não envie 100 mensagens simultâneas; coloque pequenas pausas, mesmo que frações de segundo, entre elas. No exemplo do bot, há uso de `delay(500)` antes de enviar presença e a mensagem, simulando o tempo de digitação. Isso também ajuda a não parecer um robô disparando instantaneamente. Tente imitar padrões humanos (digitar, pausar, etc., se fizer sentido).

- **Use o recurso de presença e recebimento:** Atualizar status de presença (digitando, gravando áudio) via `sock.sendPresenceUpdate()` e marcar mensagens como lidas quando apropriado demonstra um comportamento semelhante ao do app oficial. Isso pode não ser estritamente necessário, mas **pode ajudar a evitar** que o WhatsApp detecte um cliente não-oficial. No código de exemplo, a função `sendMessageWTyping` ilustra isso, enviando eventos "composing" (digitando) e "paused" antes da mensagem.

- **Mantenha a biblioteca atualizada:** Os desenvolvedores do Baileys atualizam frequentemente o projeto para acompanhar mudanças do WhatsApp Web. Utilize sempre a versão mais recente do Baileys (ou atualize seu clone) e considere usar `fetchLatestBaileysVersion()` para conectar na versão correta do WhatsApp Web. Uma incompatibilidade de versão pode resultar em comportamentos estranhos que o WhatsApp detecte como anômalos.

- **Não abuse de dispositivos múltiplos:** Embora seja possível conectar vários dispositivos (até 4) em uma conta WhatsApp, não fique desconectando e conectando repetidamente, nem exceda o limite. Atividades como gerar dezenas de QR codes em sequência para o mesmo número podem levantar bandeira vermelha. Mantenha as sessões ativas e reconecte com a mesma credencial em vez de criar novas todo momento.

- **Identificação e user-agent:** Baileys define um "browser" padrão (ex: `Chrome` genérico em Ubuntu) para se identificar. Não há necessidade de alterar isso, mas tome cuidado caso modifique para algo obviamente falso. O WhatsApp pode verificar a consistência do ambiente.

- **Envio responsável de mídia:** Não tente enviar arquivos mal-formados ou explorar possíveis brechas no protocolo. Envie mídias em formatos suportados e tamanhos razoáveis.

- **Monitoramento de respostas do WhatsApp:** Se o WhatsApp começar a responder com códigos de erro incomuns ou mensagens de aviso, leve a sério. Por exemplo, erros 403/419 em `lastDisconnect.error` indicam que a sessão foi fechada possivelmente por violação. Se receber isso, evite continuar reconectando imediatamente – pode ser prelúdio de ban.

- **Tenha comportamento similar a usuário comum:** Por exemplo, se seu bot apenas envia mensagens sem nunca receber/responder, isso pode ser suspeito. Idealmente, tenha fluxos de interação reais. Caso use para notificações unilaterais, ainda assim envie apenas a quem optou por recebê-las.

- **Evite funcionalidades sensíveis:** Algumas operações, como automação de spam em grupos públicos ou uso de número virtual, são mais propensas a ban. Mantenha o uso dentro do razoável.

Lembre-se que, mesmo seguindo tudo, **não há garantia de imunidade a banimento**, pois é contra os termos do WhatsApp usar clientes não-oficiais. Os mantenedores do Baileys deixam claro que é por conta e risco do usuário. As práticas acima, entretanto, são o que a comunidade considera úteis para passar despercebido e operar bots úteis sem problemas.

## Modos de Autenticação (QR Code e Telefone + Código)

Baileys suporta dois modos principais de autenticar sua sessão do WhatsApp:

1. **Autenticação via QR Code:** É o método padrão, igual ao WhatsApp Web normal. Ao iniciar o socket sem credenciais previamente registradas, o WhatsApp gera uma sequência para QR. Escaneando o QR com o aplicativo do celular, você vincula o _device_ (no caso, o Baileys) à sua conta WhatsApp. Esse processo usa o **multi-device** do WhatsApp – após pareado, o bot funciona mesmo com o celular offline. No Baileys, habilitamos o QR no terminal (`printQRInTerminal`) ou capturamos `update.qr` no evento de conexão para mostrar de outra forma. Após escanear corretamente, o evento `connection.update` indicará `isNewLogin: true` e o campo `qr` ficará `undefined`, e em seguida `connection: 'open'`. As credenciais (chaves, etc.) são então salvas via `creds.update`. Esse modo é conveniente durante o desenvolvimento e para operações manuais. Cada vez que precisar logar novamente (ex.: se desconectou todos aparelhos), um novo QR será necessário.

2. **Autenticação via telefone + código (pairing code):** Este é um novo modo introduzido pelo WhatsApp para facilitar conexões de dispositivos sem usar o QR. Nele, você fornece o número de telefone e recebe um código numérico de confirmação. O Baileys expõe isso através do método `sock.requestPairingCode(phoneNumber)`. No exemplo fornecido no repositório, se o parâmetro `--use-pairing-code` for passado, ele pergunta pelo número do telefone e então:

   ```typescript
   const code = await sock.requestPairingCode(phoneNumber);
   console.log(`Pairing code: ${code}`);
   ```

   Esse código de pareamento (geralmente 6 dígitos) deve então ser inserido no aplicativo WhatsApp do celular para confirmar a vinculação do novo dispositivo. Na prática, no WhatsApp do telefone, você iria em “Aparelhos Conectados” -> “Conectar um aparelho” -> opção de usar código (ao invés de QR) e digitaria o código gerado pelo Baileys. Após isso, a sessão autentica. Internamente, o Baileys gera o código e prepara as chaves de sessão necessárias, enviando para o WhatsApp a requisição de pareamento e retornando o código. Essa abordagem é útil em ambientes onde não se pode lidar com QR (por exemplo, servidores sem interface gráfica) ou para automação total do processo de login (via integração de envio do código ao administrador de outra forma).

Alguns pontos sobre os modos de autenticação:

- Ambos os modos resultam na mesma coisa: credenciais válidas salvas (ID do dispositivo, chave Noise, etc.) no `authState`. Ou seja, depois do primeiro login seja por QR ou código, você pode reutilizar as credenciais salvas para futuras conexões automáticas.
- O método do código telefônico requer que o número de telefone possua o WhatsApp multi-device habilitado e atualizado (esses códigos passaram a ser suportados a partir de 2022/2023). Pode haver regiões ou contas sem essa opção, embora hoje seja amplamente disponível.
- **registered vs unregistered:** Baileys possui `sock.authState.creds.registered` que indica se aquela autenticação já completou registro. No exemplo, eles checam `if (usePairingCode && !sock.authState.creds.registered)` antes de gerar o código, ou seja, só solicita o código se ainda não estiver logado.
- **Reautenticação:** Se as credenciais ficarem inválidas (por exemplo, você clicou em “Sair de todos os aparelhos” no celular, ou a sessão expirou), será necessário repetir o processo de login – QR ou pairing code. Tenha lógica no seu bot para detectar isso (se receber um erro 401/403 ao conectar, ou `lastDisconnect.error.output.statusCode === DisconnectReason.loggedOut`) e então limpar as credenciais salvas e iniciar do zero para pegar um novo QR/código.

Para a maioria dos casos de uso, o **QR code** é suficiente e simples. Já o **método de código numérico** traz conveniência em ambientes sem acesso visual. A biblioteca oferece ambos e a escolha pode depender do fluxo do seu projeto. É importante orientar o responsável pelo número do WhatsApp (o “dono” da conta) sobre qual método usar para linkar o bot, fornecendo o QR visualmente ou o código de forma segura.

## Mensagens Temporárias (Ephemeral)

Mensagens temporárias são aquelas que desaparecem automaticamente após um período determinado (por exemplo, 24 horas, 7 dias, etc.) em conversas que tenham esse modo ativado. O WhatsApp permite ativar isso por chat/grupo, e Baileys suporta tanto _detectar_ quanto _configurar_ essa funcionalidade.

**1. Ativar/Desativar o modo temporário em um chat/grupo:** Através do Baileys, podemos programaticamente alterar a duração das mensagens temporárias de um chat usando o mesmo mecanismo do WhatsApp Web:

- Utilize `sock.sendMessage` passando `{ disappearingMessagesInChat: <valor> }` como conteúdo. O `<valor>` pode ser:

  - `true` para ativar com a duração padrão (no WhatsApp atual, 7 dias por padrão).
  - `false` para desativar mensagens temporárias (voltando o chat ao modo normal).
  - Um número representando segundos para definir uma duração específica suportada (por exemplo, `86400` para 24h, `604800` para 7 dias, `2592000` para 30 dias).

Exemplos:

```typescript
// Ativar mensagens temporárias (duração padrão, ex.: 7 dias)
await sock.sendMessage(jidChat, { disappearingMessagesInChat: true });
// Ativar com duração de 1 dia (24h)
await sock.sendMessage(jidChat, { disappearingMessagesInChat: 86400 });
// Desativar mensagens temporárias
await sock.sendMessage(jidChat, { disappearingMessagesInChat: false });
```

Ao chamar isso, o WhatsApp Web envia internamente um comando de alteração de configuração do chat. No Baileys, esse método é conveniente porque você não precisa chamar algo diferente – é a mesma função de enviar mensagem. A biblioteca reconhece a chave especial `disappearingMessagesInChat` e executa a ação de toggle em vez de mandar uma mensagem comum. Ou seja, sob o capô ele envia um IQ de grupo com tag `<ephemeral>` configurando a duração, usando `groupToggleEphemeral`.

- Importante: Só funciona em grupos se o bot for admin (pois somente admins podem alterar duração de mensagem temporária em grupos, ou o próprio usuário em chat individual).

**2. Recebendo mensagens temporárias:** Se um chat está com temporário ativo, as mensagens que chegam têm uma indicação e “validade”. Para o bot que recebe via Baileys, não há muita diferença no processamento inicial – você receberá o conteúdo normalmente via `messages.upsert`. Entretanto, vale lembrar:

- Essas mensagens **só ficam disponíveis enquanto o dispositivo (bot) está conectado**. Se você desconectar e reconectar depois que expiraram, não verá mais no histórico.
- O WhatsApp Web não deleta automaticamente as mensagens temporárias da memória quando expiram (no app móvel elas somem). Como Baileys é um cliente, possivelmente receberá um evento quando uma mensagem expirar e for removida. No API Web antigo isso vinha como um evento de "message delete" (revoke) enviado pelo próprio sistema. Fique atento a eventos `messages.delete` que podem aparecer quando mensagens temporárias são removidas.
- Se você mantém cache local de mensagens, deve respeitar a política de autoapagamento – não guarde indefinidamente conteúdo de mensagens temporárias, pois isso contraria a expectativa de privacidade. Limpe-as após o período, se seu aplicativo as armazenou.

**3. Identificando mensagens temporárias via código:** Dentro de um `WAMessage`, você pode detectar se ele é temporário olhando o campo `messageStubType` e conteúdo especial. Por exemplo, quando alguém ativa ou altera o timer, o WhatsApp envia uma mensagem de sistema (stub) do tipo `EPHEMERAL_SETTING` com informações do novo prazo. Baileys intercepta isso e representa como um `protocolMessage` no evento. No código de exemplo do repositório há lógica comentada para tratar `msg.message?.protocolMessage?.type === proto.Message.ProtocolMessage.Type.HISTORY_SYNC_NOTIFICATION` etc., relacionado a histórico e temporários. Para uso comum, talvez não seja necessário mergulhar nisso – apenas saiba que essas mensagens de aviso aparecem. Se quiser ignorá-las, cheque `if (msg.message?.protocolMessage) { continue; }` no loop de mensagens recebidas.

Para uma mensagem de usuário temporária em si (não o aviso de setar timer), o campo `messageTimestamp` e a duração do chat determinam até quando ela fica. A Baileys não abstrai isso em nível alto, mas você poderia calcular: se chat está com 24h, então timestamp + 86400 = expiração.

**4. Modo temporário vs. visualização única:** Não confunda mensagens temporárias de chat com mídias de visualização única (aquela foto ou vídeo que só pode ser visto uma vez). Este último caso é indicado por `viewOnce: true` no conteúdo de mídia. Baileys suporta enviar mídia de visualização única definindo `{ image: buffer, caption: '...', viewOnce: true }` por exemplo. A recepção de uma mídia “view once” vem como mensagem normal, mas após baixar e abrir, se pedir de novo via Baileys não será possível (o WhatsApp não reenvia). Portanto, ambos são “efêmeros”, porém em contextos diferentes.

Em resumo, **Baileys permite controlar o recurso de desaparecimento de mensagens** de forma simples (usando sendMessage com `disappearingMessagesInChat`). Seu bot pode tanto ativar/desativar essa opção em grupos que administra, quanto respeitar mensagens temporárias recebidas (sabendo que elas sumirão). Como boa prática, ajuste seu comportamento – ex.: não armazene permanentemente conteúdo que deveria sumir. A biblioteca em si cuida de enviar os comandos corretos e notificar via eventos as mudanças nessa configuração.

## Estrutura dos Principais Tipos e Dados

Nesta seção final, vamos mapear os principais tipos de dados que você encontrará ao usar Baileys e como extrair informações deles. Entender a estrutura dos objetos de mensagem, eventos e metadados ajuda a navegar pelos dados corretamente e evitar erros comuns.

### Mensagens (objeto WAMessage)

Toda mensagem recebida ou enviada no WhatsApp é representada por um objeto do tipo `WAMessage` (definido em Baileys como um alias para `proto.WebMessageInfo`). Este objeto tem diversas propriedades, mas as principais são:

- **`key`:** Informações de identificação da mensagem:

  - `key.remoteJid`: O JID (ID Jabber) do chat onde a mensagem foi enviada. Para contatos individuais, é algo como `551199999999@s.whatsapp.net`; para grupos, termina em `@g.us`.
  - `key.participant`: (presente somente em grupos) JID do autor da mensagem dentro do grupo.
  - `key.id`: ID único da mensagem (string gerada pelo WhatsApp).
  - `key.fromMe`: booleano indicando se a mensagem foi enviada **pela instância atual** (ou seja, pelo seu bot) ou não. Útil para ignorar e não responder mensagens que seu próprio bot enviou.

- **`message`:** O conteúdo da mensagem em si, geralmente um objeto com um único campo setado representando o tipo. Exemplos:

  - `{ conversation: "Olá" }` para texto simples.
  - `{ extendedTextMessage: { text: "Olá", contextInfo: { ... } } }` para texto formatado ou que é uma resposta a outra mensagem.
  - `{ imageMessage: { mimetype: "image/jpeg", caption: "Veja isso", ... } }` para imagem.
  - `{ videoMessage: { mimetype: "video/mp4", caption: "...", fileLength: 12345, ... } }` para vídeo.
  - `{ documentMessage: { title: "file.pdf", ... } }` para documento, etc.
  - `{ reactionMessage: { key: <msgKey>, text: "😃" } }` para reação.
  - `{ protocolMessage: {...} }` para mensagens de protocolo/sistema (ex.: remoção, história, etc.).

  Como apenas um desses estará presente por vez, você deve verificar qual propriedade existe para saber o tipo da mensagem.

- **`messageTimestamp`:** Timestamp (em segundos) do envio da mensagem.

- **`pushName`:** Nome do usuário remetente, conforme enviado pelo WhatsApp (pode ser vazio se não disponível).

- **`status`:** Status local da mensagem (no contexto do envio pelo seu cliente). Por exemplo, se você enviou, pode ser 0 (erro), 1 (enviando), 2 (enviada), 3 (entregue), 4 (lida). Para mensagens recebidas de outros, normalmente será undefined ou 0.

- **`messageStubType` e `messageStubParameters`:** Se a mensagem é do tipo "stub" (sistema), esses campos indicam o que foi (ex.: `messageStubType: "GROUP_PARTICIPANT_ADD"` quando alguém é adicionado num grupo, e os parâmetros contêm os JIDs envolvidos). Baileys abstrai muitos stubs em eventos específicos (como group-participants.update), mas às vezes você verá mensagens stub no feed.

**Acessando o conteúdo de mensagem:** O desenvolvedor geralmente quer extrair texto, ou baixar mídia. Para texto, use a técnica mostrada antes:

```typescript
const conteudo =
  msg.message?.conversation ||
  msg.message?.extendedTextMessage?.text ||
  msg.message?.imageMessage?.caption ||
  msg.message?.videoMessage?.caption;
```

No caso acima, estamos tentando pegar texto de diferentes possíveis locais: texto puro, texto de mensagem estendida (por exemplo com formatação), ou legenda de imagem/vídeo. Isso cobre muitos casos. Para ser mais rigoroso, cheque cada tipo explicitamente:

```typescript
if (msg.message?.conversation) {
  // texto simples
  texto = msg.message.conversation;
} else if (msg.message?.extendedTextMessage) {
  texto = msg.message.extendedTextMessage.text;
} else if (msg.message?.imageMessage) {
  texto = msg.message.imageMessage.caption;
  // aqui você trataria também de baixar a imagem, ver abaixo
} else if (msg.message?.buttonsResponseMessage) {
  // etc...
}
```

**Baixando mídia recebida:** Quando `msg.message` contém um tipo de mídia (imagem, vídeo, áudio, documento, sticker), os campos geralmente presentes são:

- `msg.message.imageMessage` por exemplo terá `mimetype`, `fileSha256`, `fileLength`, `mediaKey`, `directPath`, possivelmente uma thumb (jpegThumbnail) e outros metadados. **Não contém o arquivo bruto** – é preciso baixá-lo dos servidores do WhatsApp.
- Use a função utilitária `downloadContentFromMessage(message.message.<mediaMessage>, 'image')` (por exemplo) que Baileys provê para obter um stream do conteúdo de mídia de entrada. Você pode então salvar em arquivo ou juntar em um Buffer. Exemplo:

  ```typescript
  import { downloadContentFromMessage } from "@whiskeysockets/baileys";
  if (msg.message?.imageMessage) {
    const stream = await downloadContentFromMessage(
      msg.message.imageMessage,
      "image"
    );
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }
    fs.writeFileSync("foto_recebida.jpg", buffer);
  }
  ```

  O procedimento para vídeo, áudio, documento, etc. é análogo, apenas ajuste o segundo parâmetro ('video', 'audio', 'document', 'sticker'). Essa função usa as informações de `mediaKey` e `directPath` dentro do message para baixar e decifrar o conteúdo corretamente.

**Exemplo de estrutura de WAMessage:** (formato JSON simplificado)

```json
{
  "key": {
    "remoteJid": "551199999999@s.whatsapp.net",
    "fromMe": false,
    "id": "ABCD12345..."
  },
  "pushName": "Fulano",
  "messageTimestamp": 1673030303,
  "message": {
    "conversation": "Olá, tudo bem?"
  }
}
```

Esse exemplo seria uma mensagem de texto recebida de um contato. Já em grupo, `key.remoteJid` seria algo como "[551112345678-1598551234@g.us](mailto:551112345678-1598551234@g.us)" e haveria `"participant": "5511988887777@s.whatsapp.net"` dentro de `key` indicando quem enviou.

### Eventos e Atualizações (BaileysEventMap)

Como vimos, `sock.ev` emite diferentes tipos de eventos. Cada evento carrega dados em formatos específicos. A interface `BaileysEventMap` no código define os tipos de cada evento. Conhecer isso ajuda a usar corretamente os dados:

- Eventos que trazem listas (array) de itens:

  - `'chats.upsert'` -> `Chat[]`: uma lista de conversas adicionadas. Cada Chat tem campos como id (jid), name (se disponível), leitura, etc.
  - `'contacts.upsert'` -> `Contact[]`: lista de contatos adicionados (jid e talvez nome).
  - `'messages.upsert'` -> objeto com `{ messages: WAMessage[], type: MessageUpsertType }`. Usamos principalmente quando `type === 'notify'`.
  - `'messages.update'` -> `WAMessageUpdate[]`: cada item tem `{ key: WAMessageKey, update: Partial<WAMessage> }`. Aqui geralmente `update.status` ou `update.pollUpdates`, etc.
  - `'message-receipt.update'` -> `MessageUserReceiptUpdate[]`: cada um indicando recebimento/leitura por um usuário de uma mensagem.
  - `'groups.upsert'` -> `GroupMetadata[]`: lista de grupos.
  - `'groups.update'` -> `Partial<GroupMetadata>[]`: lista com modificações (pode ter id e alguns campos como subject, etc., somente os que mudaram).
  - `'group-participants.update'` -> um objeto por evento (não lista) com { id: string, participants: string\[], action: ParticipantAction }.
  - ... e assim por diante.

- Eventos de estado ou únicos:

  - `'connection.update'` -> `Partial<ConnectionState>`: objeto com campos como connection, lastDisconnect, qr, isOnline, etc. (todos opcionais porque podem vir fragmentados).
  - `'creds.update'` -> `Partial<AuthenticationCreds>`: geralmente traz as novas credenciais (ou partes delas) após alterações. No mínimo, após login bem-sucedido, trará `me` (seu próprio contato) e `isRegistered` por exemplo.
  - `'presence.update'` -> `{ id: string, presences: { [participantJid: string]: PresenceData } }`: indica mudança de presença (online/offline, digitando) de participantes de um chat.
  - `'call'` -> `WACallEvent[]`: array de chamadas (caso várias ocorram juntas, mas geralmente 1). Cada call event tem info se foi "offer", "accept", "reject", quem chamou, etc.
  - `'labels.edit'` / `'labels.association'`: relacionados a etiquetas do WhatsApp Business, provavelmente raros de usar.

Para usar esses dados, muitas vezes você consultará os tipos TypeScript enquanto desenvolve. Se não estiver usando TypeScript, vale imprimir no console para ver estrutura real. A documentação interna (como essa) também auxilia.

**Exemplo:** No evento `'chats.update'`, você recebe algo como:

```json
[{ "id": "551199999999@s.whatsapp.net", "mute": "Infinity" }]
```

Isso indicaria que o chat com aquele contato foi silenciado para sempre (campo `mute` sendo `'Infinity'`). Pode haver vários campos possíveis em ChatUpdate: por isso é um Partial<Chat>. Sempre verifique quais campos existem antes de usar.

Outro exemplo: `'contacts.update'` poderia vir como:

```json
[
  {
    "id": "551199999999@s.whatsapp.net",
    "notify": "Fulano",
    "imgUrl": "https://pps.whatsapp.net/v/t...jpg"
  }
]
```

Isso sugere que o contato atualizou o nome de notificação para "Fulano" e tem uma nova foto de perfil (imgUrl). No exemplo de código do repositório, eles mostraram como, ao detectar `contact.imgUrl` alterado, é possível chamar `sock.profilePictureUrl(contact.id)` para obter a URL atual da foto em tamanho maior.

### Grupos e Participantes (GroupMetadata e afins)

Já discutimos bastante na seção de cache de grupos, mas recapitulando os **tipos principais de grupos**:

- **`GroupMetadata`:** Informações de um grupo. Campos chave:

  - `id`: JID do grupo.
  - `subject`: nome do grupo.
  - `participants`: lista de `GroupParticipant`.
  - Outros campos: `owner` (criador), `desc` (descrição), flags de configurações (announce, restrict, etc.), `size` (tamanho, embora isso pode ser derivado de participants.length).
  - Pode conter campos de comunidade se o grupo for parte de uma (por ex., `linkedParent` se houver um grupo linkado pai).

- **`GroupParticipant`:** Combina `Contact` com info de admin:

  - `id`: JID do participante.
  - `isAdmin`/`isSuperAdmin`: booleanos indicando privilégios (no WhatsApp, o "dono" do grupo geralmente vem como isSuperAdmin).
  - Pode herdar de Contact propriedades como `notify` (nome), mas muitas vezes o importante é só o JID e status admin.

- **Eventos de participantes e grupos:**

  - `'group-participants.update'`: já explicamos, carrega a lista de participantes afetados e a ação.
  - `'groups.update'`: carrega um Partial<GroupMetadata> – por exemplo `{ id, subject: 'Novo Nome' }` se o nome mudou.
  - `'groups.upsert'`: dá GroupMetadata completo, geralmente no início ou quando você é adicionado em um novo grupo.

- **Métodos utilitários:**

  - `sock.groupCreate(subject, participantsIds)` -> Cria um novo grupo com o assunto e participantes dados. Retorna GroupMetadata do grupo criado. Útil se seu bot tiver função de criação de grupos.
  - `sock.groupLeave(jidGrupo)` -> Sai de um grupo específico.
  - `sock.groupInviteCode(jidGrupo)` -> Obtém o código de convite de um grupo (se disponível).
  - `sock.groupParticipantsUpdate(jidGrupo, participants, action)` -> Atalhos para adicionar/remover/promover/demover participantes (internamente faz a IQ necessária). Por exemplo, `action: 'add'` para adicionar números ao grupo.
  - Esses métodos podem não estar explicitamente documentados, mas existem em versões anteriores. No clone atual, a função `groupParticipantsUpdate` parece ter sido substituída pelo evento de update apenas – talvez as ações sejam via outros métodos dedicados (`groupAdd`, etc.). Consulte a documentação ou o código-fonte (arquivo `groups.ts`) para a versão exata.

**Navegando pelas estruturas de grupo:**
Se você tem um GroupMetadata e quer listar os números dos participantes:

```typescript
group.participants.forEach((p) => console.log(p.id, p.isAdmin ? "admin" : ""));
```

Lembre que `p.id` é o número no formato JID completo. Se quiser formatações amigáveis (como número puro), pode remover o `@s.whatsapp.net`.

Se você quer achar um participante específico:

```typescript
const part = group.participants.find((p) => p.id === someJid);
if (part) {
  console.log("Encontrado, admin =", part.isAdmin);
}
```

Como GroupMetadata pode não ser atualizado em tempo real (dependendo do cache), use junto com os eventos. Por exemplo, após receber um `'group-participants.update'` de remoção, atualize seu objeto GroupMetadata local removendo os ids correspondentes.

Vale notar que **contatos (Contact)** e **grupos** são tipos diferentes no WhatsApp, mas ambos possuem JIDs e podem aparecer em algumas mesmas listas (ex.: contatos podem incluir grupos no WA?). Em Baileys, geralmente tratamos grupos separadamente.

### Estado de Conexão e Autenticação

Por fim, alguns tipos relacionados à conexão e credenciais:

- **`ConnectionState`:** Conforme visto, é um objeto com campos:

  - `connection`: 'connecting' | 'open' | 'close'
  - `lastDisconnect`: objeto com `error` e `date` da última desconexão.
  - `qr`: string do QR code (quando disponível para escanear) – aparece apenas temporariamente quando gerado.
  - `isNewLogin`: booleano indicando se esta conexão resultou de um login novo (qr ou pairing code).
  - `receivedPendingNotifications`: booleano que indica se já recebeu todas as notifs offline pendentes.
  - `isOnline`: booleano indicando se o socket está marcado como online (Baileys marca como online ao conectar por padrão, mantendo-o "ativo").
  - Campos legacy (legado) que se aplicavam ao WhatsApp Web antigo com telefone conectado (não relevantes em multi-device).

  Você normalmente não precisa construir um ConnectionState – ele é fornecido nos eventos. Mas é útil entender ao imprimir, por exemplo:

  ```json
  { "connection": "close", "lastDisconnect": { "error": [Error: Stream Errored (REBLOBED)] } }
  ```

  Algo assim indicaria porque fechou. Já um:

  ```json
  { "connection": "open", "isNewLogin": true }
  ```

  indica login novo.

- **`AuthenticationCreds` e `AuthenticationState`:** Representam as credenciais persistentes. Contêm:

  - Chaves de identificação e criptografia (noise key, identity key, signed pre-key, etc.).
  - `me`: seu contato (jid e nome).
  - `account`: detalhes da conta para multi-device.
  - `registered`: boolean se a sessão já foi registrada (true após QR pareado com sucesso).
  - Outros campos técnicos (ID de dispositivo, etc.).

  Esses tipos são complexos e normalmente manipulados apenas via os métodos `useMultiFileAuthState`, `saveCreds`, etc., sem precisar acessar manualmente. Basta saber que `state.creds` fornece as credenciais e `state.keys` o store de chaves de sessão. Quando você salva credenciais, tudo isso (geralmente em JSON ou arquivos) é armazenado para futuro login.

- **`WAVersion`:** Um tuplet \[major, minor, patch] indicando a versão do WhatsApp Web que está usando. Por exemplo \[2, 2335, 4]. No início da conexão, usamos `fetchLatestBaileysVersion()` que retorna `{ version: WAVersion, isLatest: boolean }`. Passamos essa versão na config para garantir compatibilidade.

- **`SocketConfig`:** Configurações passadas para `makeWASocket`. Muitos são opcionais ou possuem default (ver Defaults). Já mencionamos alguns:

  - `auth`: obrigatório, estado de autenticação.
  - `logger`: para logs (pino logger).
  - `version`: versão WA Web.
  - `browser`: representação do "user agent" (pode deixar default).
  - `printQRInTerminal`: para fins de debug (exibindo QR, hoje deprecado).
  - `msgRetryCounterCache`: se fornecido, um cache para contagem de tentativas de reenviar msg quando falha de criptografia (no exemplo usam NodeCache para isso).
  - `generateHighQualityLinkPreview`: já discutido.
  - `shouldIgnoreJid`: função para ignorar certos chats (no exemplo, eles comentam ignorar broadcasts).
  - `getMessage`: função para suprir mensagens do seu armazenamento local se o WhatsApp solicitar (por ex, para decifrar reações ou history sync). No exemplo, eles deixam padrão e retorna proto.Message vazio. Em usos avançados, se você guarda mensagens, implemente para retornar a mensagem original quando library precisar.

  A maioria desses configs avançados tem a ver com otimização e casos especiais. Para começar, focar em auth, version, logger e talvez linkPreview já é suficiente.

Em resumo, Baileys manipula internamente muita complexidade do protocolo, mas expõe para o desenvolvedor objetos estruturados:

- Mensagens (WAMessage) com subcampos claros para cada tipo de mensagem.
- Eventos bem definidos com payloads (ver `BaileysEventMap`).
- Objetos de metadados (GroupMetadata, Contact, Chat) para informações de estado.
- Configurações e credenciais para manter a sessão.

Ao iterar no desenvolvimento, use as definições de tipos do próprio Baileys (se estiver em TS) ou esta documentação como referência rápida. Quando em dúvida, imprimir no console um objeto completo de mensagem ou evento ajuda a esclarecer a estrutura recebida. Com prática, você rapidamente reconhece os padrões – por exemplo, saber que `message.extendedTextMessage.contextInfo` contém a citação quando é uma resposta, ou que `messages.update` com `update.pollUpdates` traz resultados de enquete.

## Conclusão

Neste relatório, realizamos uma análise detalhada da biblioteca Baileys, cobrindo desde conceitos gerais de funcionamento até exemplos práticos e estruturas internas. Com esse conhecimento, desenvolvedores podem utilizar a biblioteca de forma mais eficaz e consciente:

- Configurando bots com reconexão automática e múltiplas instâncias quando necessário.
- Enviando todo tipo de mensagem suportada pelo WhatsApp (texto, mídia, links com preview, enquetes, etc.).
- Tratando eventos em tempo real para responder usuários e atualizar estado interno (mensagens, grupos, contatos).
- Seguindo boas práticas para longevidade do bot e redução de riscos.
- Explorando funcionalidades adicionais do WhatsApp (autenticação via código, mensagens temporárias, reações, chamadas) com o suporte que Baileys provê.
- Entendendo a estrutura dos dados trafegados para extrair informações corretas (por exemplo, diferenciar mensagens de texto de sistema, baixar anexos, verificar recibos).

Vale lembrar que Baileys está em constante evolução, assim como o WhatsApp Web. Recomenda-se acompanhar o repositório oficial (WhiskeySockets/Baileys) para novidades, correções e atualizações de API. A documentação comunitária (baileys.wiki) também pode trazer exemplos e dicas atualizadas.

Com a base apresentada aqui em português e focada no código-fonte, esperamos que desenvolvedores de todos os níveis consigam criar e manter seus bots WhatsApp de maneira robusta, utilizando todo o potencial da biblioteca Baileys. Boa codificação e bom bate-papo automatizado!
