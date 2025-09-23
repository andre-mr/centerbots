Below está um plano em patches coesos, numerados, para aplicar incrementalmente. Cada etapa compila e roda sozinha, preparando o terreno para a seguinte. Não há alterações no projeto neste momento; é apenas o roteiro para você executar em modo dev e testar a cada patch.

Patch 1 — Mensagens: scheduled → schedule (TEXT) e remoção de image na tabela

Objetivo: alinhar o modelo Message e a tabela messages à nova semântica sem tocar em schedules ainda.
Banco:
Em db-connection.ts: no bloco migrate() da versão 5, recriar a tabela messages:
Remover a coluna image (BLOB).
Renomear a coluna scheduled (INTEGER) para schedule (TEXT) durante a cópia de dados (script de recriação).
Recriar índices que porventura existam para messages.
Em db-commands.ts: atualizar CRUD de mensagens para:
Ler/gravar a coluna schedule como string | null (sem mapear booleans).
Ignorar qualquer atributo Image/Video ao persistir.
Modelos e UI:
Em message-model.ts: substituir o campo Scheduled: boolean por Schedule: string | null (sem introduzir Video ainda).
Em BotMessage.tsx: onde mostrava “Agendamento”, exibir o valor de message.Schedule (se existir).
Em wa-manager.ts: remover coerções “!!message.Scheduled”; usar truthiness de message.Schedule se houver lógica condicional.
Observação: esta etapa mantém todo o restante intocado (schedules continuam como estão).
Patch 2 — Suporte a vídeo no modelo e envio condicional

Objetivo: preparar o pipeline de envio para lidar com vídeo sem ainda mexer em schedules.
Modelos:
Em message-model.ts: adicionar Video?: Buffer | null mantendo Image existente.
Envio (WA):
Em wa-manager.ts:
No ponto de envio, se houver message.Video, enviar via sendMessage({ video, caption, mimetype }) com prioridade sobre imagem.
Se não houver vídeo e houver Image, enviar como hoje.
Ao registrar no banco, chamar createMessage com uma cópia do objeto zerando Image/Video (buffers nulos).
Persistência:
Em db-commands.ts: garantir que createMessage/updateMessage ignorem buffers (não há coluna image em messages após o Patch 1).
Patch 3 — Serviço de armazenamento de mídia (disco)

Objetivo: criar utilitários para salvar/ler/deletar mídias no userData com o padrão de nomes.
Novo módulo:
Criar src/main/media-storage.ts com funções:
sanitizeSlug(description) → slug.
resolveBaseDir() → app.getPath('userData')/media.
getNextSeq(scheduleId, slug, type) → próximo número sequencial.
saveImageFromBase64(scheduleId, descriptionSlug, ext, base64) → "image/<scheduleId>-<slug>-<seq>.<ext>".
copyFileToMedia(scheduleId, descriptionSlug, type, sourcePath) → "image/..."/"video/...".
resolveAbsolutePath(relPath) → caminho completo no disco.
deleteMedia(relPath) → remove arquivo.
inferKindFromPath(relPath) → "image" | "video" baseado no prefixo.
Convenção:
Strings com prefixo: "image/<scheduleId>-<slug>-<seq>.<ext>" e "video/<scheduleId>-<slug>-<seq>.<ext>" dentro da raiz userData/media.
Patch 4 — Redesenho do schema de schedules (contents/medias JSON)

Objetivo: substituir tabelas auxiliares por colunas JSON e atualizar comandos do banco. A UI ainda pode continuar funcionando via compat de IPC no patch seguinte.
Banco:
Em db-connection.ts:
No schema base e na migrate() v5: criar a tabela schedules já com as colunas contents TEXT NOT NULL DEFAULT '[]' e medias TEXT NOT NULL DEFAULT '[]'.
Não criar schedule_contents e schedule_images.
Em db-commands.ts:
Atualizar tipos de retorno e mapeamento para usar Schedule.Contents: string[] e Schedule.Medias: string[] (JSON parse/stringify).
Remover todo o código de INSERT/DELETE em schedule_contents/schedule_images.
Modelos:
Em schedule-model.ts: substituir Images: Buffer[] por Medias: string[].
Observação: não tocar na UI nem no IPC ainda; a próxima etapa cobre a compatibilidade.
Patch 5 — IPC para schedules com mídias em disco e compat UI atual

Objetivo: adaptar o main process para trabalhar com Medias, mantendo a UI atual respirando até a troca de tela.
IPC:
Em ipc-handlers.ts:
schedules:create/update:
Receber os conteúdos atuais (texts) e, para imagens vindas como base64 (ImagesBase64 do renderer atual), usar media-storage.saveImageFromBase64 para gravar e popular Medias (apenas "image/...").
Aceitar uma lista opcional de “media ops” (quando a UI nova chegar) mas ignorar por enquanto.
Ao atualizar, comparar a lista Medias antiga com a nova para deletar arquivos removidos (media-storage.deleteMedia).
schedules:getById:
Retornar o Schedule com Medias strings.
Para manter a UI atual (que espera base64 de imagem), incluir no payload um campo complementar ImagesBase64 apenas para itens do tipo image, lendo do disco (custo baixo, thumbnails continuam opcionais).
Tipos:
Em preload.d.ts: ajustar tipos dos retornos para refletir Medias: string[] (e o extra ImagesBase64 no payload de getById como campo auxiliar).
Observação: este patch mantém a ScheduleDetailsPage.tsx atual funcional para imagens.
Patch 6 — Renderer: ScheduleDetailsPage com imagens e vídeos

Objetivo: atualizar a UI para anexar e gerenciar vídeos/imagens, sem novas libs e com UX simples.
UI:
Em ScheduleDetailsPage.tsx:
Input file com accept="image/\*,video/mp4,video/webm" (sem ffmpeg).
Preview:
Para imagem: mostrar thumbnail como hoje.
Para vídeo: exibir apenas o nome do arquivo (ou <video controls> se playback suportar, mas não obrigatório).
Colagem (paste):
Manter apenas para imagem (clipboard).
Lista de mídias:
Exibir índice, tipo (por prefixo image/ ou video/), nome do arquivo.
Permitir remover itens; ao remover, mandar a intenção para o IPC que apagará o arquivo.
Validação: aceitar conteúdo textual OU pelo menos uma mídia (imagem ou vídeo).
Em App.tsx: onde prepara schedule para detalhes, parar de depender de ImagesBase64 no estado (usando Medias).
Preload:
Em preload.ts e preload.d.ts: se necessário, expor chamadas auxiliares do IPC para anexar mídias (ou reusar as atuais create/update com payload adequado).
Observação: a partir daqui, remover gradualmente a dependência de ImagesBase64 do lado do renderer.
Patch 7 — Schedule Manager: leitura de disco, escolha de mídia e marcação de schedule

Objetivo: usar as novas Medias no disparo dos agendamentos e respeitar o novo Message.Schedule.
Em schedule-manager.ts:
Carregar o Schedule completo e escolher um texto (conteúdos) e uma mídia (quando houver).
Se a mídia começar por "image/", ler o arquivo e preencher msg.Image (Buffer) e jpegThumbnail (com sharp) como hoje.
Se a mídia começar por "video/", ler o arquivo e preencher msg.Video (Buffer). Sem thumbnail obrigatória.
Setar msg.Schedule = schedule.Description.
Chamar createMessage com cópia do objeto sem buffers (Image/Video nulos); para enfileirar, usar a versão com buffers (enqueueMessage).
Observação: manter lógica de seleção aleatória e fila como hoje.
Patch 8 — Limpeza e remoção de caminhos legados

Objetivo: retirar sobras do fluxo antigo e consolidar o novo desenho.
Main:
Em ipc-handlers.ts: remover caminhos de compat que geravam ImagesBase64 para a UI antiga (se já não utilizados).
Em db-commands.ts: garantir que não há mais referências a schedule_contents/schedule_images, nem a Images: Buffer[].
Renderer:
Em ScheduleDetailsPage.tsx: remover quaisquer resquícios de ImagesBase64.
Docs:
Em README.md e baileys.md: ajustar menções a mídias em schedules se necessário.
Notas e decisões já incorporadas

Prefixo no nome do arquivo: manter “image/” e “video/” no início da string para identificação do tipo sem checar extensão.
Padrão de nome: "<type>/<scheduleId>-<slug>-<seq>.<ext>" com seq sempre crescente. Ao remover, não renumerar; ao adicionar, seguir do último maior seq.
Nenhuma dependência nova (sem ffmpeg). Preview de vídeo é opcional; pode exibir apenas o nome do arquivo.
Mensagens de agendamento: Message.Schedule guarda a Description do Schedule; a UI passa a exibir esse texto no lugar do label fixo.
Arquivos impactados por patch (referência)

Banco: db-connection.ts, db-commands.ts
Modelos: message-model.ts, schedule-model.ts
IPC: ipc-handlers.ts, preload.ts, preload.d.ts
Envio: wa-manager.ts, schedule-manager.ts
UI: ScheduleDetailsPage.tsx, BotMessage.tsx, App.tsx
Se quiser, posso começar pelo Patch 1.
