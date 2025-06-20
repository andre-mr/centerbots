import React from "react";

const HelpPage: React.FC = () => {
  return (
    <div className="flex h-full flex-col overflow-y-auto bg-white px-4 py-6 dark:bg-gray-900">
      <div className="mb-6 flex items-center gap-2">
        <span className="text-3xl">🤖</span>
        <h2 className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">
          Guia Rápido — CenterBots
        </h2>
      </div>

      <section className="mb-6">
        <h3 className="mb-2 text-xl font-semibold text-gray-800 dark:text-gray-100">
          O que é o CenterBots?
        </h3>
        <p className="text-gray-700 dark:text-gray-300">
          O <b>CenterBots</b> é uma aplicação para{" "}
          <b>replicar mensagens para múltiplos grupos</b> do WhatsApp. Ele não
          envia mensagens para listas de contatos. O foco é receber uma mensagem
          de um número autorizado e retransmiti-la automaticamente para uma
          lista de grupos que você definir.
        </p>
      </section>

      <section className="mb-6">
        <h3 className="mb-2 text-xl font-semibold text-gray-800 dark:text-gray-100">
          🚀 Como usar
        </h3>
        <ol className="list-inside list-decimal space-y-2 text-gray-700 dark:text-gray-300">
          <li>
            <b>Adicionar um bot:</b> Clique em{" "}
            <span className="rounded bg-gray-100 px-1 font-mono dark:bg-gray-800">
              Adicionar Bot
            </span>
            . Após salvar, ative-o e leia o QR Code com o WhatsApp do número que
            será o bot.
          </li>
          <li>
            <b>Configurar o bot:</b> Clique em{" "}
            <span className="rounded bg-gray-100 px-1 font-mono dark:bg-gray-800">
              Configurar
            </span>
            . No campo <b>"Números autorizados"</b>, insira os números de
            WhatsApp que terão permissão para "comandar" este bot.
          </li>
          <li>
            <b>Selecionar grupos de destino:</b> No card do bot, clique em{" "}
            <span className="rounded bg-gray-100 px-1 font-mono dark:bg-gray-800">
              Grupos
            </span>{" "}
            e marque todos os grupos para os quais este bot deverá enviar as
            mensagens.
          </li>
          <li>
            <b>Iniciar um envio:</b> Usando um dos <b>números autorizados</b>,
            envie uma mensagem (texto, imagem, etc.) para o número do bot no seu
            WhatsApp.
          </li>
          <li>
            <b>Acompanhar o processo:</b> O CenterBots irá detectar a mensagem,
            adicioná-la à fila e começar o disparo para os grupos selecionados.
            Você pode ver a fila e o progresso na tela de{" "}
            <span className="rounded bg-gray-100 px-1 font-mono dark:bg-gray-800">
              Mensagens
            </span>
            .
          </li>
        </ol>
      </section>

      <section className="mb-6">
        <h3 className="mb-2 text-xl font-semibold text-gray-800 dark:text-gray-100">
          ⚙️ Funcionalidades Disponíveis
        </h3>
        <ul className="list-inside list-disc space-y-1 text-gray-700 dark:text-gray-300">
          <li>Gerenciamento de múltiplos bots (números de WhatsApp).</li>
          <li>
            Disparo para grupos acionado por mensagem recebida de uma fonte
            autorizada.
          </li>
          <li>Configuração de números autorizados para cada bot.</li>
          <li>Seleção de grupos de destino para cada bot.</li>
          <li>
            Fila de envio com controle para reordenar ou excluir mensagens.
          </li>
          <li>Visualização de status de envio em tempo real.</li>
        </ul>
      </section>

      <section className="mb-6">
        <h3 className="mb-2 text-xl font-semibold text-gray-800 dark:text-gray-100">
          🛡️ Boas Práticas
        </h3>
        <ul className="list-inside list-disc space-y-1 text-gray-700 dark:text-gray-300">
          <li>
            Evite disparos excessivos para não ser bloqueado pelo WhatsApp.
          </li>
          <li>
            Use apenas com o consentimento dos participantes dos grupos de
            destino.
          </li>
          <li>
            Não utilize para spam ou fins proibidos pelos termos do WhatsApp.
          </li>
          <li>Os dados ficam armazenados localmente no seu computador.</li>
        </ul>
      </section>

      <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
        CenterBots — Replicação de mensagens para grupos do WhatsApp, de forma
        simples e eficiente.
      </div>
    </div>
  );
};

export default HelpPage;
