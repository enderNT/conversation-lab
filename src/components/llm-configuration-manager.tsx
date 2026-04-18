"use client";

import { useActionState, useState } from "react";
import {
  createLlmConfigurationWithFeedback,
  deleteLlmConfigurationWithFeedback,
  updateLlmConfigurationWithFeedback,
} from "@/app/actions";
import { FormLabel } from "@/components/form-label";
import { FormSubmitButton } from "@/components/form-submit-button";
import { useActionFeedbackToast } from "@/components/use-action-feedback-toast";
import { EMPTY_ACTION_FORM_STATE } from "@/lib/form-state";
import { formatDate } from "@/lib/utils";

type LlmConfigurationItem = {
  id: string;
  name: string;
  chatModel: string;
  chatBaseUrl: string;
  chatApiKey: string;
  systemPrompt: string;
  createdAt: string;
  updatedAt: string;
};

export function LlmConfigurationManager({
  configurations,
}: {
  configurations: LlmConfigurationItem[];
}) {
  const [createState, createAction] = useActionState(
    createLlmConfigurationWithFeedback,
    EMPTY_ACTION_FORM_STATE,
  );

  useActionFeedbackToast(createState, {
    errorTitle: "No fue posible guardar la configuración",
    successTitle: "Configuración LLM guardada",
  });

  return (
    <section className="space-y-6">
      <div>
        <form action={createAction} className="surface max-w-xl rounded-[1.75rem] p-5 sm:p-6">
          <h3 className="text-lg font-semibold">Nueva configuración</h3>
          <div className="mt-4 space-y-4">
            <label className="block space-y-2">
              <FormLabel required>Nombre</FormLabel>
              <input name="name" className="field" placeholder="OpenAI producción" required />
            </label>
            <label className="block space-y-2">
              <FormLabel required>Chat model</FormLabel>
              <input name="chatModel" className="field" placeholder="gpt-4.1-mini" required />
            </label>
            <label className="block space-y-2">
              <FormLabel>Chat URL</FormLabel>
              <input name="chatBaseUrl" className="field mono" placeholder="https://api.openai.com/v1" />
            </label>
            <label className="block space-y-2">
              <FormLabel>Chat API key</FormLabel>
              <input name="chatApiKey" type="password" className="field mono" placeholder="Bearer token opcional" />
            </label>
            <label className="block space-y-2">
              <FormLabel>Behavior prompt</FormLabel>
              <textarea
                name="systemPrompt"
                className="field min-h-28"
                placeholder="Prompt opcional para reutilizar junto con esta configuración."
              />
            </label>
            <FormSubmitButton type="submit" className="button-primary w-full" pendingLabel="Guardando configuración...">
              Guardar configuración
            </FormSubmitButton>
          </div>
        </form>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {configurations.length === 0 ? (
          <div className="surface col-span-full rounded-[1.75rem] p-8 text-sm text-[var(--muted)]">
            Todavía no hay configuraciones LLM globales guardadas.
          </div>
        ) : null}

        {configurations.map((configuration) => (
          <EditableLlmConfigurationCard key={configuration.id} configuration={configuration} />
        ))}
      </div>
    </section>
  );
}

function EditableLlmConfigurationCard({
  configuration,
}: {
  configuration: LlmConfigurationItem;
}) {
  const [name, setName] = useState(configuration.name);
  const [chatModel, setChatModel] = useState(configuration.chatModel);
  const [chatBaseUrl, setChatBaseUrl] = useState(configuration.chatBaseUrl);
  const [chatApiKey, setChatApiKey] = useState(configuration.chatApiKey);
  const [systemPrompt, setSystemPrompt] = useState(configuration.systemPrompt);
  const [updateState, updateAction] = useActionState(
    updateLlmConfigurationWithFeedback.bind(null, configuration.id),
    EMPTY_ACTION_FORM_STATE,
  );
  const [deleteState, deleteAction] = useActionState(
    deleteLlmConfigurationWithFeedback.bind(null, configuration.id),
    EMPTY_ACTION_FORM_STATE,
  );

  useActionFeedbackToast(updateState, {
    errorTitle: "No fue posible actualizar la configuración",
    successTitle: "Configuración LLM actualizada",
  });
  useActionFeedbackToast(deleteState, {
    errorTitle: "No fue posible eliminar la configuración",
    successTitle: "Configuración LLM eliminada",
  });

  return (
    <article className="surface rounded-[1.75rem] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-[var(--foreground)]">{configuration.name}</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Actualizada {formatDate(configuration.updatedAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-[var(--muted)]">
          <span className="rounded-full border border-[var(--line)] bg-white/70 px-3 py-1">
            Creada {formatDate(configuration.createdAt)}
          </span>
          <span className="rounded-full border border-[var(--line)] bg-white/70 px-3 py-1">
            API key {configuration.chatApiKey ? "configurada" : "vacía"}
          </span>
          <span className="rounded-full border border-[var(--line)] bg-white/70 px-3 py-1">
            Prompt {configuration.systemPrompt ? "configurado" : "vacío"}
          </span>
        </div>
      </div>

      <form action={updateAction} className="mt-5 space-y-4">
        <label className="block space-y-2">
          <FormLabel required>Nombre</FormLabel>
          <input name="name" className="field" value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label className="block space-y-2">
          <FormLabel required>Chat model</FormLabel>
          <input
            name="chatModel"
            className="field"
            value={chatModel}
            onChange={(event) => setChatModel(event.target.value)}
            required
          />
        </label>
        <label className="block space-y-2">
          <FormLabel>Chat URL</FormLabel>
          <input
            name="chatBaseUrl"
            className="field mono"
            value={chatBaseUrl}
            onChange={(event) => setChatBaseUrl(event.target.value)}
          />
        </label>
        <label className="block space-y-2">
          <FormLabel>Chat API key</FormLabel>
          <input
            name="chatApiKey"
            type="password"
            className="field mono"
            value={chatApiKey}
            onChange={(event) => setChatApiKey(event.target.value)}
          />
        </label>
        <label className="block space-y-2">
          <FormLabel>Behavior prompt</FormLabel>
          <textarea
            name="systemPrompt"
            className="field min-h-28"
            value={systemPrompt}
            onChange={(event) => setSystemPrompt(event.target.value)}
          />
        </label>

        <FormSubmitButton type="submit" className="button-secondary" pendingLabel="Actualizando...">
          Actualizar
        </FormSubmitButton>
      </form>

      <form action={deleteAction} className="mt-3">
        <FormSubmitButton type="submit" className="button-danger" pendingLabel="Eliminando...">
          Eliminar
        </FormSubmitButton>
      </form>
    </article>
  );
}
