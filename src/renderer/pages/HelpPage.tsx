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
            . Após salvar, ative-o e leia o QR Code pelo WhatsApp da conta que
            será o bot.
          </li>
          <li>
            <b>Configurar o bot:</b> Clique em{" "}
            <span className="rounded bg-gray-100 px-1 font-mono dark:bg-gray-800">
              Configurar
            </span>
            . No campo <b>"Números autorizados"</b>, insira os números de
            WhatsApp que terão permissão para "comandar" este bot. Ajuste, se
            necessário, as opções de <b>Origem das mensagens</b> (Todas,
            Privadas, Grupos), o <b>Método de envio</b> (Texto, Imagem ou
            Encaminhar), <b>Somente com links</b>, <b>Adicionar parâmetros</b>
            (UTM) e as <b>Pausas</b> entre grupos e entre mensagens. Opcional:
            informe um <b>Proxy</b> para a conexão do bot.
          </li>
          <li>
            <b>Selecionar grupos de destino:</b> No card do bot, clique em{" "}
            <span className="rounded bg-gray-100 px-1 font-mono dark:bg-gray-800">
              Grupos
            </span>{" "}
            e marque todos os grupos para os quais este bot deverá enviar as
            mensagens. O carregamento de todos os grupos pode levar um tempo
            após ativação.
          </li>
          <li>
            <b>Iniciar um envio:</b> Usando o WhatsApp de um dos números
            autorizados, envie uma mensagem (texto ou imagem) para o número do
            bot.
          </li>
          <li>
            <b>Acompanhar o processo:</b> O CenterBots irá detectar a mensagem,
            adicioná-la à fila e começar o disparo para os grupos selecionados.
            Você pode ver a fila e o progresso na tela de{" "}
            <span className="rounded bg-gray-100 px-1 font-mono dark:bg-gray-800">
              Mensagens
            </span>
            . Após a ativação por QR Code, caso o bot não fique online no
            celular, ou não responda a mensagem, desative-o e reinicie a
            aplicação para realizar uma nova conexão com os servidores do
            WhatsApp após a autorização do dispositivo. Envie a mensagem{" "}
            <b>status</b> para o bot a partir do WhatsApp de um dos números
            autorizados, ele deve responder em alguns segundos, desde que a
            origem das mensagens nas configurações esteja <b>Todas</b> ou{" "}
            <b>Privadas</b>.
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
          <li>Modos de origem: Todas, Privadas ou Grupos.</li>
          <li>Métodos de envio: Texto, Imagem ou Encaminhar.</li>
          <li>
            Parâmetros de link automáticos (utm_source/utm_medium) opcionais.
          </li>
          <li>Relatório de envios para números autorizados (opcional).</li>
          <li>Pausas configuráveis entre grupos e entre mensagens.</li>
          <li>Proxy opcional para conexão por outro IP.</li>
          <li>Histórico recente de mensagens e fila por bot.</li>
        </ul>
      </section>

      <hr className="mb-4 border-gray-300 dark:border-gray-700" />

      <section className="mb-6">
        <h3 className="mb-2 text-xl font-semibold text-gray-800 dark:text-gray-100">
          🗓️ Agendamentos
        </h3>
        <p className="ml-6 text-gray-700 dark:text-gray-300">
          Na seção <b>Agendamentos</b>, cadastre envios automáticos com um ou
          mais conteúdos e imagens, selecione os bots e defina a periodicidade:
          <b> único</b>, <b>diário</b>, <b>semanal</b> ou <b>mensal</b>.
          Execuções respeitam o plano da licença vigente.
        </p>
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
              <b>Desconectado:</b> O bot perdeu a conexão com os servidores do
              WhatsApp e está tentando se reconectar.
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
          🔑 Licença e planos
        </h3>
        <ul className="ml-6 list-inside list-disc space-y-1 text-gray-700 dark:text-gray-300">
          <li>
            Informe <b>ID do usuário</b> e <b>chave de acesso</b> nas
            <b> Configurações</b> para ativar. Status: Ativo, Expirado ou
            Inativo.
          </li>
          <li>
            Alguns recursos dependem do plano (ex.: sincronização/estatísticas
            de grupos).
          </li>
          <li>O aplicativo verifica atualizações e pode se atualizar.</li>
        </ul>
      </section>

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
