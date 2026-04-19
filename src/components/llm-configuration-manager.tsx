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
    <section className="surface rounded-[2.5rem] px-6 py-8 sm:px-8 lg:px-10">
      <div className="grid gap-8 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-6">
          <div>
            <h2 className="editorial-heading text-[2.7rem] leading-none text-[var(--foreground)]">Laboratory Config</h2>
            <p className="mt-4 max-w-sm text-sm leading-7 text-[var(--muted)]">
              Define modelos, endpoints y prompts reutilizables para preparar futuras sesiones de chat y flujos de extracción.
            </p>
          </div>

          <form action={createAction} className="rounded-[1.8rem] border border-[var(--line)] bg-white/82 p-5 shadow-[0_16px_36px_rgba(24,35,47,0.08)] sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-[var(--background-glow)] text-[var(--accent)]">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-[1.8]">
                  <path d="M12 4v16" strokeLinecap="round" />
                  <path d="M4 12h16" strokeLinecap="round" />
                  <rect x="5" y="5" width="14" height="14" rx="3.5" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-[var(--foreground)]">New Provider</h3>
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">Register reusable access</p>
              </div>
            </div>
            <div className="mt-5 space-y-4">
              <label className="block space-y-2">
                <FormLabel required className="text-[0.68rem] uppercase tracking-[0.22em] text-[var(--muted)]">
                  Provider Name
                </FormLabel>
                <input name="name" className="field rounded-[1rem]" placeholder="OpenAI producción" required />
              </label>
              <label className="block space-y-2">
                <FormLabel required className="text-[0.68rem] uppercase tracking-[0.22em] text-[var(--muted)]">
                  Chat Model
                </FormLabel>
                <input name="chatModel" className="field rounded-[1rem]" placeholder="gpt-4.1-mini" required />
              </label>
              <label className="block space-y-2">
                <FormLabel className="text-[0.68rem] uppercase tracking-[0.22em] text-[var(--muted)]">
                  Base URL
                </FormLabel>
                <input name="chatBaseUrl" className="field mono rounded-[1rem]" placeholder="https://api.openai.com/v1" />
              </label>
              <label className="block space-y-2">
                <FormLabel className="text-[0.68rem] uppercase tracking-[0.22em] text-[var(--muted)]">
                  API Key
                </FormLabel>
                <input name="chatApiKey" type="password" className="field mono rounded-[1rem]" placeholder="Bearer token opcional" />
              </label>
              <label className="block space-y-2">
                <FormLabel className="text-[0.68rem] uppercase tracking-[0.22em] text-[var(--muted)]">
                  Prompt Template
                </FormLabel>
                <textarea
                  name="systemPrompt"
                  className="field min-h-32 rounded-[1rem]"
                  placeholder="Prompt opcional para reutilizar junto con esta configuración."
                />
              </label>
              <FormSubmitButton
                type="submit"
                className="button-primary inline-flex w-full items-center justify-center px-5 py-3 text-sm uppercase tracking-[0.18em]"
                pendingLabel="Guardando configuración..."
              >
                Register Config
              </FormSubmitButton>
            </div>
          </form>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <span className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--muted-strong)]">
              Active Endpoints
            </span>
            <div className="h-px flex-1 bg-[var(--line)]" />
          </div>

          {configurations.length === 0 ? (
            <div className="rounded-[1.8rem] border border-dashed border-[var(--line)] bg-white/55 px-6 py-8 text-sm leading-7 text-[var(--muted)]">
              Todavía no hay configuraciones LLM globales guardadas. Registra una para reutilizarla en sesiones futuras.
            </div>
          ) : (
            <div className="space-y-4">
              {configurations.map((configuration) => (
                <EditableLlmConfigurationCard key={configuration.id} configuration={configuration} />
              ))}
            </div>
          )}
        </div>
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
    <article className="rounded-[1.8rem] border border-[var(--line)] bg-white/84 p-5 shadow-[0_16px_36px_rgba(24,35,47,0.08)] sm:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--background-glow)] text-[var(--accent)]">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-[1.8]">
              <circle cx="12" cy="12" r="2.6" />
              <path d="M12 4.25v2.1" strokeLinecap="round" />
              <path d="M12 17.65v2.1" strokeLinecap="round" />
              <path d="M19.75 12h-2.1" strokeLinecap="round" />
              <path d="M6.35 12h-2.1" strokeLinecap="round" />
              <path d="M17.48 6.52l-1.49 1.49" strokeLinecap="round" />
              <path d="M8.01 15.99l-1.49 1.49" strokeLinecap="round" />
              <path d="M17.48 17.48l-1.49-1.49" strokeLinecap="round" />
              <path d="M8.01 8.01l-1.49-1.49" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h3 className="editorial-heading text-[2rem] leading-none text-[var(--foreground)]">{configuration.name}</h3>
            <p className="mt-2 text-sm font-medium text-[var(--muted-strong)]">{configuration.chatModel}</p>
            <p className="mono mt-1 text-xs text-[var(--muted)]">
              {configuration.chatBaseUrl || "Default provider URL"}
            </p>
            <p className="mt-2 text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
              Updated {formatDate(configuration.updatedAt)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-[var(--muted)]">
          <span className="rounded-full border border-[var(--line)] bg-[var(--background)] px-3 py-1">
            Created {formatDate(configuration.createdAt)}
          </span>
          <span className="rounded-full border border-[var(--line)] bg-[var(--background)] px-3 py-1">
            API key {configuration.chatApiKey ? "set" : "empty"}
          </span>
          <span className="rounded-full border border-[var(--line)] bg-[var(--background)] px-3 py-1">
            Prompt {configuration.systemPrompt ? "set" : "empty"}
          </span>
        </div>
      </div>

      <form action={updateAction} className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="block space-y-2">
          <FormLabel required className="text-[0.68rem] uppercase tracking-[0.22em] text-[var(--muted)]">
            Name
          </FormLabel>
          <input name="name" className="field" value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label className="block space-y-2">
          <FormLabel required className="text-[0.68rem] uppercase tracking-[0.22em] text-[var(--muted)]">
            Chat Model
          </FormLabel>
          <input
            name="chatModel"
            className="field"
            value={chatModel}
            onChange={(event) => setChatModel(event.target.value)}
            required
          />
        </label>
        <label className="block space-y-2">
          <FormLabel className="text-[0.68rem] uppercase tracking-[0.22em] text-[var(--muted)]">
            Base URL
          </FormLabel>
          <input
            name="chatBaseUrl"
            className="field mono"
            value={chatBaseUrl}
            onChange={(event) => setChatBaseUrl(event.target.value)}
          />
        </label>
        <label className="block space-y-2">
          <FormLabel className="text-[0.68rem] uppercase tracking-[0.22em] text-[var(--muted)]">
            API Key
          </FormLabel>
          <input
            name="chatApiKey"
            type="password"
            className="field mono"
            value={chatApiKey}
            onChange={(event) => setChatApiKey(event.target.value)}
          />
        </label>
        <label className="block space-y-2 md:col-span-2">
          <FormLabel className="text-[0.68rem] uppercase tracking-[0.22em] text-[var(--muted)]">
            Behavior Prompt
          </FormLabel>
          <textarea
            name="systemPrompt"
            className="field min-h-28"
            value={systemPrompt}
            onChange={(event) => setSystemPrompt(event.target.value)}
          />
        </label>

        <div className="md:col-span-2 flex flex-wrap items-center gap-3 pt-1">
          <FormSubmitButton
            type="submit"
            className="button-secondary inline-flex items-center justify-center px-5 py-3 text-sm uppercase tracking-[0.16em]"
            pendingLabel="Actualizando..."
          >
            Update Config
          </FormSubmitButton>
        </div>
      </form>

      <form action={deleteAction} className="mt-3 flex justify-end">
        <FormSubmitButton
          type="submit"
          className="button-danger inline-flex items-center justify-center px-5 py-3 text-sm uppercase tracking-[0.16em]"
          pendingLabel="Eliminando..."
        >
          Delete
        </FormSubmitButton>
      </form>
    </article>
  );
}
