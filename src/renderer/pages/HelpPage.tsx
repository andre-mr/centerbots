import React from "react";
import {
  MdCheckCircle,
  MdError,
  MdPowerSettingsNew,
  MdHighlightOff,
  MdPauseCircleFilled,
  MdPlayCircleFilled,
} from "react-icons/md";
import { IoSync } from "react-icons/io5";
import packageJson from "../../../package.json";

const HelpPage: React.FC = () => {
  return (
    <div className="flex h-full flex-col overflow-y-auto bg-white px-2 py-2 dark:bg-gray-900">
      <div className="mb-6 flex items-center gap-2">
        <span className="text-3xl">🤖</span>
        <h2 className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">
          Guia Rápido - CenterBots
          <span className="ml-4 text-xl text-gray-500 dark:text-gray-400">
            {` (v${packageJson.version})`}
          </span>
        </h2>
      </div>

      <section className="mb-6">
        <h3 className="mb-2 text-xl font-semibold text-gray-800 dark:text-gray-100">
          O que é o CenterBots?
        </h3>
        <p className="ml-6 text-gray-700 dark:text-gray-300">
          O <b>CenterBots</b> é uma aplicação para{" "}
          <b>replicar mensagens para múltiplos grupos</b> do WhatsApp. Ele não
          envia mensagens para listas de contatos. O foco é receber uma mensagem
          de um número autorizado e retransmiti-la automaticamente para uma
          lista de grupos que você definir.
        </p>
      </section>

      <hr className="mb-4 border-gray-300 dark:border-gray-700" />

      <section className="mb-6">
        <h3 className="mb-2 text-xl font-semibold text-gray-800 dark:text-gray-100">
          🚀 Como usar
        </h3>
        <ol className="ml-6 list-inside list-decimal space-y-2 text-gray-700 dark:text-gray-300">
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

      <hr className="mb-4 border-gray-300 dark:border-gray-700" />

      <section className="mb-6">
        <h3 className="mb-2 text-xl font-semibold text-gray-800 dark:text-gray-100">
          ⚙️ Funcionalidades disponíveis
        </h3>
        <ul className="ml-6 list-inside list-disc space-y-1 text-gray-700 dark:text-gray-300">
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
          <li>
            Proxy opcional para conexão com os servidores da meta por outro IP.
          </li>
        </ul>
      </section>

      <hr className="mb-4 border-gray-300 dark:border-gray-700" />

      <section className="mb-6">
        <h3 className="mb-2 text-xl font-semibold text-gray-800 dark:text-gray-100">
          🛠️ Status dos bots
        </h3>
        <ul className="ml-4 list-inside list-disc space-y-2 text-gray-700 dark:text-gray-300">
          <li className="flex items-center gap-2">
            <MdCheckCircle className="text-2xl text-green-500 dark:text-green-400" />
            <span>
              <b>Online:</b> O bot está conectado e pronto para enviar
              mensagens.
            </span>
          </li>
          <li className="flex items-center gap-2">
            <IoSync className="animate-spin text-2xl text-blue-500 dark:text-blue-400" />
            <span>
              <b>Enviando:</b> O bot está atualmente enviando mensagens para os
              grupos.
            </span>
          </li>
          <li className="flex items-center gap-2">
            <MdHighlightOff className="animate-pulse text-2xl text-yellow-500 dark:text-yellow-400" />
            <span>
              <b>Desconectado:</b> O bot perdeu a conexão com o WhatsApp e está
              tentando se reconectar.
            </span>
          </li>
          <li className="flex items-center gap-2">
            <span className="relative flex items-center justify-center">
              <span className="absolute inline-flex h-5 w-5 animate-ping rounded-full bg-red-400 opacity-60"></span>
              <MdError className="relative text-2xl text-red-500 dark:text-red-400" />
            </span>
            <span>
              <b>Deslogado:</b> O bot foi desconectado da conta e precisa ser
              autorizado novamente por QR Code.
            </span>
          </li>
          <li className="flex items-center gap-2">
            <MdPowerSettingsNew className="text-2xl text-gray-400 dark:text-gray-500" />
            <span>
              <b>Offline:</b> O bot está desativado e não está operando.
            </span>
          </li>
        </ul>

        <h4 className="mb-2 mt-4 text-lg font-semibold text-gray-800 dark:text-gray-100">
          ⏯️ Botão de Pausa/Retomada
        </h4>
        <ul className="ml-4 list-inside list-disc space-y-2 text-gray-700 dark:text-gray-300">
          <li className="flex items-center gap-2">
            <MdPauseCircleFilled className="text-2xl text-yellow-500 dark:text-yellow-400" />
            <span>
              <b>Pausado:</b> O bot está ativo, mas temporariamente pausado.
            </span>
          </li>
          <li className="flex items-center gap-2">
            <MdPlayCircleFilled className="text-2xl text-green-500 dark:text-green-400" />
            <span>
              <b>Retomado:</b> O bot foi retomado e está pronto para operar.
            </span>
          </li>
        </ul>
      </section>

      <hr className="mb-4 border-gray-300 dark:border-gray-700" />

      <section className="mb-6">
        <h3 className="mb-2 text-xl font-semibold text-gray-800 dark:text-gray-100">
          🛡️ Boas práticas
        </h3>
        <ul className="ml-6 list-inside list-disc space-y-1 text-gray-700 dark:text-gray-300">
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
