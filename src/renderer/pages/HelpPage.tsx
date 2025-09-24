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
          O <b>CenterBots</b> replica automaticamente mensagens de{" "}
          <b>números autorizados</b> para <b>múltiplos grupos</b> do WhatsApp.
          Não envia para listas de contatos. Suporta mensagens de <b>texto</b>,
          <b> imagem</b> e <b>vídeo</b>.
        </p>
      </section>

      <hr className="mb-4 border-gray-300 dark:border-gray-700" />

      <section className="mb-6">
        <h3 className="mb-2 text-xl font-semibold text-gray-800 dark:text-gray-100">
          🚀 Como usar
        </h3>
        <ol className="ml-6 list-inside list-decimal space-y-2 text-gray-700 dark:text-gray-300">
          <li>
            <b>Adicionar um bot:</b> clique em
            <span className="rounded bg-gray-100 px-1 font-mono dark:bg-gray-800">
              {" "}
              Adicionar Bot{" "}
            </span>
            , salve, ative e leia o QR Code no WhatsApp da conta que será o bot.
          </li>
          <li>
            <b>Configurar:</b> em
            <span className="rounded bg-gray-100 px-1 font-mono dark:bg-gray-800">
              {" "}
              Configurar{" "}
            </span>
            , informe <b>Números autorizados</b> e ajuste <b>Origem</b>
            (Todas/Privadas/Grupos), <b>Método de envio</b> (Texto, Imagem ou
            Encaminhar), <b>Somente com links</b>, <b>Parâmetros</b> (UTM),
            <b> Pausas</b> e <b>Proxy</b> (opcional).
          </li>
          <li>
            <b>Grupos de destino:</b> no card do bot, clique em
            <span className="rounded bg-gray-100 px-1 font-mono dark:bg-gray-800">
              {" "}
              Grupos{" "}
            </span>
            e selecione os grupos. Carregar todos os grupos pode levar alguns
            instantes após a ativação.
          </li>
          <li>
            <b>Iniciar envio:</b> do WhatsApp de um número autorizado, envie
            <b> texto, imagem ou vídeo</b> para o número do bot.
          </li>
          <li>
            <b>Acompanhar:</b> a mensagem entra na fila e o disparo inicia para
            os grupos. Acompanhe em
            <span className="rounded bg-gray-100 px-1 font-mono dark:bg-gray-800">
              {" "}
              Mensagens{" "}
            </span>
            . Se o bot não ficar online após o QR, desative-o e ative novamente
            para uma nova conexão. Envie <b>status</b> (WhatsApp) para um resumo
            rápido quando a origem for <b>Todas</b> ou <b>Privadas</b>.
          </li>
        </ol>
      </section>

      <hr className="mb-4 border-gray-300 dark:border-gray-700" />

      <section className="mb-6">
        <h3 className="mb-2 text-xl font-semibold text-gray-800 dark:text-gray-100">
          ⚙️ Funcionalidades
        </h3>
        <ul className="ml-6 list-inside list-disc space-y-1 text-gray-700 dark:text-gray-300">
          <li>
            Múltiplos bots (números de WhatsApp) com credenciais isoladas.
          </li>
          <li>
            Disparo para grupos acionado por mensagem de fonte autorizada.
          </li>
          <li>Números autorizados, seleção de grupos e fila por bot.</li>
          <li>Status em tempo real; modos de origem e métodos de envio.</li>
          <li>UTM em links, relatório de envios e pausas configuráveis.</li>
          <li>Proxy opcional e histórico recente por bot.</li>
          <li>
            <b>Backup e restauração</b> em Configurações.
          </li>
        </ul>
      </section>

      <hr className="mb-4 border-gray-300 dark:border-gray-700" />

      <section className="mb-6">
        <h3 className="mb-2 text-xl font-semibold text-gray-800 dark:text-gray-100">
          🗓️ Agendamentos
        </h3>
        <p className="ml-6 text-gray-700 dark:text-gray-300">
          Cadastre envios automáticos com um ou mais conteúdos (texto e mídia),
          selecione os bots e defina a periodicidade: <b>único</b>,{" "}
          <b>diário</b>,<b> semanal</b> ou <b>mensal</b>.
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
              <b>Online:</b> conectado e pronto para enviar.
            </span>
          </li>
          <li className="flex items-center gap-2">
            <IoSync className="animate-spin text-2xl text-blue-500 dark:text-blue-400" />
            <span>
              <b>Enviando:</b> enviando mensagens aos grupos.
            </span>
          </li>
          <li className="flex items-center gap-2">
            <MdHighlightOff className="animate-pulse text-2xl text-yellow-500 dark:text-yellow-400" />
            <span>
              <b>Desconectado:</b> tentando reconectar ao WhatsApp.
            </span>
          </li>
          <li className="flex items-center gap-2">
            <span className="relative flex items-center justify-center">
              <span className="absolute inline-flex h-5 w-5 animate-ping rounded-full bg-red-400 opacity-60"></span>
              <MdError className="relative text-2xl text-red-500 dark:text-red-400" />
            </span>
            <span>
              <b>Deslogado:</b> precisa autorizar novamente por QR Code.
            </span>
          </li>
          <li className="flex items-center gap-2">
            <MdPowerSettingsNew className="text-2xl text-gray-400 dark:text-gray-500" />
            <span>
              <b>Offline:</b> desativado e inoperante.
            </span>
          </li>
        </ul>

        <h4 className="mb-2 mt-4 text-lg font-semibold text-gray-800 dark:text-gray-100">
          ⏯️ Pausar/Retomar
        </h4>
        <ul className="ml-4 list-inside list-disc space-y-2 text-gray-700 dark:text-gray-300">
          <li className="flex items-center gap-2">
            <MdPauseCircleFilled className="text-2xl text-yellow-500 dark:text-yellow-400" />
            <span>
              <b>Pausado:</b> ativo, porém temporariamente parado.
            </span>
          </li>
          <li className="flex items-center gap-2">
            <MdPlayCircleFilled className="text-2xl text-green-500 dark:text-green-400" />
            <span>
              <b>Retomado:</b> pronto para operar.
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
            Informe <b>ID do usuário</b> e <b>chave de acesso</b> em
            Configurações.
          </li>
          <li>
            Status: <b>Ativo</b>, <b>Expirado</b> ou <b>Inativo</b>.
          </li>
          <li>
            Alguns recursos dependem do plano (ex.: sincronização/estatísticas).
          </li>
          <li>
            O app verifica e instala <b>atualizações</b> automaticamente.
          </li>
        </ul>
      </section>

      <section className="mb-6">
        <h3 className="mb-2 text-xl font-semibold text-gray-800 dark:text-gray-100">
          🛡️ Boas práticas
        </h3>
        <ul className="ml-6 list-inside list-disc space-y-1 text-gray-700 dark:text-gray-300">
          <li>Evite disparos excessivos para reduzir risco de bloqueio.</li>
          <li>Use apenas com consentimento dos participantes dos grupos.</li>
          <li>Não use para spam ou fins proibidos pelos termos do WhatsApp.</li>
          <li>Os dados ficam armazenados localmente no seu computador.</li>
        </ul>
      </section>

      <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
        © 2025 CenterBots — replicação de mensagens para grupos do WhatsApp,
        simples e eficiente.
      </div>
    </div>
  );
};

export default HelpPage;
