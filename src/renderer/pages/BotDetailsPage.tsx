import React, { useState, useEffect } from "react";
import { Bot } from "../../models/bot-model";
import {
  Status,
  WhatsAppSources,
  SendMethods,
  LinkParameters,
} from "../../models/bot-options-model";
import {
  MdCheckCircle,
  MdError,
  MdHighlightOff,
  MdPowerSettingsNew,
} from "react-icons/md";
import { IoSync } from "react-icons/io5";

interface BotDetailsProps {
  bot: Bot;
  onCancel: () => void;
  isNew?: boolean;
}

const botStatusTranslations = {
  [Status.Online]: "Online",
  [Status.Sending]: "Enviando",
  [Status.Disconnected]: "Desconectado",
  [Status.LoggedOut]: "Desautorizado",
  [Status.Offline]: "Offline",
};

const messageListenModesTranslations = {
  [WhatsAppSources.All]: "Todas",
  [WhatsAppSources.Direct]: "Privadas",
  [WhatsAppSources.Group]: "Grupos",
};

const sendMethodsTranslations = {
  [SendMethods.Text]: "Texto",
  [SendMethods.Image]: "Imagem",
  [SendMethods.Forward]: "Encaminhar",
};

const linkParametersTranslations = {
  [LinkParameters.All]: "Todos",
  [LinkParameters.Source]: "Origem",
  [LinkParameters.Medium]: "Grupo",
  [LinkParameters.None]: "Nenhum",
};

const enumToOptions = (
  enumObject: object,
  translationMap: Record<string, string>
) => {
  return Object.values(enumObject).map((value) => {
    const stringValue = String(value);
    return (
      <option className="" key={stringValue} value={stringValue}>
        {translationMap[stringValue] || stringValue}
      </option>
    );
  });
};

const statusIcon = (status: Status) => {
  switch (status) {
    case Status.Online:
      return (
        <MdCheckCircle
          className="text-2xl text-green-500 dark:text-green-400"
          title="Online"
        />
      );
    case Status.Sending:
      return (
        <IoSync
          className="animate-spin text-2xl text-blue-500 dark:text-blue-400"
          title="Enviando"
        />
      );
    case Status.Disconnected:
      return (
        <MdHighlightOff
          className="text-2xl text-yellow-500 dark:text-yellow-400"
          title="Desconectado"
        />
      );
    case Status.LoggedOut:
      return (
        <MdError
          className="animate-pulse text-2xl text-red-500 dark:text-red-400"
          title="Deslogado"
        />
      );
    case Status.Offline:
    default:
      return (
        <MdPowerSettingsNew
          className="text-2xl text-gray-400 dark:text-gray-500"
          title="Offline"
        />
      );
  }
};

const BotDetailsPage: React.FC<BotDetailsProps> = ({
  bot,
  onCancel,
  isNew,
}) => {
  const [formData, setFormData] = useState<Bot>(bot);
  const [authorizedNumbersStr, setAuthorizedNumbersStr] = useState<string>(
    bot.AuthorizedNumbers?.join(", ") || ""
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    setFormData(bot);
    setAuthorizedNumbersStr(bot.AuthorizedNumbers?.join(", ") || "");
  }, [bot, isNew]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;

    if (name === "AuthorizedNumbers") {
      setAuthorizedNumbersStr(value);
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" ? parseFloat(value) || 0 : value,
    }));
  };

  const handleAuthorizedNumbersBlur = () => {
    setFormData((prev) => ({
      ...prev,
      AuthorizedNumbers: authorizedNumbersStr
        .split(",")
        .map((n) => n.trim())
        .filter((n) => !!n),
    }));
  };

  const handleSave = async () => {
    setIsLoading(true);
    setError(null);

    const botToSave = {
      ...formData,
      AuthorizedNumbers: authorizedNumbersStr
        .split(",")
        .map((n) => n.trim())
        .filter((n) => !!n),
    };

    if (!botToSave) {
      setError("Dados do bot inválidos.");
      setIsLoading(false);
      return;
    }

    try {
      if (isNew) {
        await window.appApi.createBot(botToSave);
      } else {
        await window.appApi.updateBot(botToSave);
      }
      onCancel();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : `Ocorreu um erro ao ${isNew ? "criar" : "salvar"}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await window.appApi.deleteBot(formData.Id);
      onCancel();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Ocorreu um erro ao excluir"
      );
    } finally {
      setIsLoading(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <div className="flex h-full flex-col justify-between gap-6 bg-white p-0 dark:bg-gray-900">
      <div className="flex flex-col">
        <div className="flex items-center justify-between">
          <h2 className="pb-2 text-2xl font-bold text-emerald-700 dark:text-emerald-400">
            {isNew
              ? "Adicionar Novo Bot"
              : `Configurando: ${formData.Campaign || formData.WaNumber}`}
          </h2>
          <div className="flex pb-1">
            <span className="mr-2 text-gray-700 dark:text-gray-200">
              {Object.entries(botStatusTranslations)
                .filter(([key]) => key === formData.Status)
                .map(([, value]) => value)}
            </span>
            {statusIcon(formData.Status)}
          </div>
        </div>
        {error && (
          <p className="mb-2 text-center text-red-500 dark:text-red-400">
            Erro: {error}
          </p>
        )}
        <form className="mt-8 grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1">
            <label
              className="font-semibold text-gray-700 dark:text-gray-200"
              htmlFor="waNumber"
            >
              Número WhatsApp
            </label>
            <input
              id="waNumber"
              name="WaNumber"
              type="text"
              className="cursor-not-allowed rounded border px-2 py-2 font-bold text-whatsapp-teal dark:bg-gray-800 dark:text-gray-100"
              placeholder="(atribuído automaticamente)"
              value={formData.WaNumber ?? ""}
              disabled
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              className="font-semibold text-gray-700 dark:text-gray-200"
              htmlFor="campaign"
            >
              Nome da campanha
            </label>
            <input
              id="campaign"
              name="Campaign"
              type="text"
              className="rounded border bg-white px-2 py-2 dark:bg-gray-800 dark:text-gray-100"
              placeholder="Ex: Black Friday"
              value={formData.Campaign || ""}
              onChange={handleChange}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              className="font-semibold text-gray-700 dark:text-gray-200"
              htmlFor="authorizedNumbers"
            >
              Números autorizados
            </label>
            <input
              id="authorizedNumbers"
              name="AuthorizedNumbers"
              type="text"
              className="rounded border bg-white px-2 py-2 dark:bg-gray-800 dark:text-gray-100"
              placeholder="Ex: 553499990001,553499990002"
              value={authorizedNumbersStr}
              onChange={handleChange}
              onBlur={handleAuthorizedNumbersBlur}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              className="font-semibold text-gray-700 dark:text-gray-200"
              htmlFor="sendMethod"
            >
              Método de envio
            </label>
            <select
              id="sendMethod"
              name="SendMethod"
              className="rounded border bg-white px-1.5 py-2 dark:bg-gray-800 dark:text-gray-100"
              value={formData.SendMethod}
              onChange={(e) => {
                handleChange(e);
              }}
            >
              {enumToOptions(SendMethods, sendMethodsTranslations)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label
              className="font-semibold text-gray-700 dark:text-gray-200"
              htmlFor="delayBetweenGroups"
            >
              Pausa entre grupos (segundos)
            </label>
            <input
              id="delayBetweenGroups"
              name="DelayBetweenGroups"
              type="number"
              className="rounded border bg-white px-2 py-2 dark:bg-gray-800 dark:text-gray-100"
              placeholder="Ex: 2"
              value={formData.DelayBetweenGroups}
              onChange={handleChange}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              className="font-semibold text-gray-700 dark:text-gray-200"
              htmlFor="delayBetweenMessages"
            >
              Pausa entre mensagens (segundos)
            </label>
            <input
              id="delayBetweenMessages"
              name="DelayBetweenMessages"
              type="number"
              className="rounded border bg-white px-2 py-2 dark:bg-gray-800 dark:text-gray-100"
              placeholder="Ex: 10"
              value={formData.DelayBetweenMessages}
              onChange={handleChange}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              className="font-semibold text-gray-700 dark:text-gray-200"
              htmlFor="whatsAppSources"
            >
              Origem das mensagens
            </label>
            <select
              id="whatsAppSources"
              name="WhatsAppSources"
              className="rounded border bg-white px-1.5 py-2 dark:bg-gray-800 dark:text-gray-100"
              value={formData.WhatsAppSources}
              onChange={handleChange}
            >
              {enumToOptions(WhatsAppSources, messageListenModesTranslations)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label
              className="font-semibold text-gray-700 dark:text-gray-200"
              htmlFor="linkRequired"
            >
              Somente com links
            </label>
            <select
              id="linkRequired"
              name="LinkRequired"
              className="rounded border bg-white px-1.5 py-2 dark:bg-gray-800 dark:text-gray-100"
              value={formData.LinkRequired ? "true" : "false"}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  LinkRequired: e.target.value === "true",
                }))
              }
            >
              <option value="true">Ativado</option>
              <option value="false">Desativado</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label
              className="font-semibold text-gray-700 dark:text-gray-200"
              htmlFor="linkParameters"
            >
              Adicionar parâmetros
            </label>
            <select
              id="linkParameters"
              name="LinkParameters"
              className="rounded border bg-white px-1.5 py-2 dark:bg-gray-800 dark:text-gray-100"
              value={formData.LinkParameters}
              onChange={handleChange}
            >
              {enumToOptions(LinkParameters, linkParametersTranslations)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label
              className="font-semibold text-gray-700 dark:text-gray-200"
              htmlFor="sendingReport"
            >
              Relatório de envios
            </label>
            <select
              id="sendingReport"
              name="SendingReport"
              className="rounded border bg-white px-1.5 py-2 dark:bg-gray-800 dark:text-gray-100"
              value={formData.SendingReport ? "true" : "false"}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  SendingReport: e.target.value === "true",
                }))
              }
            >
              <option value="true">Ativado</option>
              <option value="false">Desativado</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label
              className="font-semibold text-gray-700 dark:text-gray-200"
              htmlFor="proxy"
            >
              Proxy (opcional)
            </label>
            <input
              id="proxy"
              name="Proxy"
              type="text"
              className="rounded border bg-white px-2 py-2 dark:bg-gray-800 dark:text-gray-100"
              placeholder="Ex: https://user:password@br.decodo.com:10000"
              value={formData.Proxy || ""}
              onChange={handleChange}
            />
          </div>
        </form>
      </div>
      <div className="flex justify-between gap-2">
        <div className="flex space-x-2">
          {!isNew && (
            <button
              className="rounded-full bg-red-400 px-4 py-2 text-white hover:bg-red-500 dark:bg-red-600 dark:hover:bg-red-700"
              onClick={() => setShowDeleteModal(true)}
              disabled={isLoading}
            >
              Excluir
            </button>
          )}
        </div>
        <div className="flex space-x-4">
          <button
            className="rounded-full bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            onClick={onCancel}
            disabled={isLoading}
          >
            Voltar
          </button>
          <button
            className="rounded-full bg-emerald-500 px-4 py-2 text-white hover:bg-emerald-600 dark:bg-emerald-700 dark:hover:bg-emerald-800"
            onClick={handleSave}
            disabled={isLoading}
          >
            Salvar
          </button>
        </div>
      </div>
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded bg-white p-6 shadow-lg dark:bg-gray-800">
            <h2 className="mb-4 text-xl font-bold">Confirmar exclusão</h2>
            <p className="mb-2">
              Tem certeza que deseja excluir o bot{" "}
              <span className="font-semibold">
                "{formData.Campaign || formData.WaNumber}"
              </span>
              ?
            </p>
            <p className="mb-6 text-red-600 dark:text-red-400">
              Esta ação não poderá ser desfeita!
            </p>
            <div className="flex justify-between gap-2">
              <button
                className="rounded bg-gray-200 px-4 py-2"
                onClick={() => setShowDeleteModal(false)}
                disabled={isLoading}
              >
                Cancelar
              </button>
              <button
                className="rounded bg-red-500 px-4 py-2 text-white"
                onClick={handleDelete}
                disabled={isLoading}
              >
                Confirmar exclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BotDetailsPage;
