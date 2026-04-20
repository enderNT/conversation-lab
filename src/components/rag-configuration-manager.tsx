"use client";

import { useActionState, useState } from "react";
import {
  createRagConfigurationWithFeedback,
  deleteRagConfigurationWithFeedback,
  updateRagConfigurationWithFeedback,
} from "@/app/actions";
import { FormLabel } from "@/components/form-label";
import { FormSubmitButton } from "@/components/form-submit-button";
import { useActionFeedbackToast } from "@/components/use-action-feedback-toast";
import { EMPTY_ACTION_FORM_STATE } from "@/lib/form-state";
import { formatDate } from "@/lib/utils";

type RagConfigurationItem = {
  id: string;
  name: string;
  qdrantBaseUrl: string;
  qdrantApiKey: string;
  collectionName: string;
  vectorName: string;
  queryModel: string;
  payloadPath: string;
  createdAt: string;
  updatedAt: string;
};

export function RagConfigurationManager({
  configurations,
}: {
  configurations: RagConfigurationItem[];
}) {
  const [createState, createAction] = useActionState(
    createRagConfigurationWithFeedback,
    EMPTY_ACTION_FORM_STATE,
  );

  useActionFeedbackToast(createState, {
    errorTitle: "No fue posible guardar la configuración",
    successTitle: "Configuración RAG guardada",
  });

  return (
    <section className="surface rounded-[2.5rem] px-6 py-8 sm:px-8 lg:px-10">
      <div className="grid gap-8 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-6">
          <div>
            <h2 className="editorial-heading text-[2.7rem] leading-none text-[var(--foreground)]">
              Retrieval Config
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-7 text-[var(--muted)]">
              Registra conexiones reutilizables hacia Qdrant para poblar campos con RAG usando siempre el primer resultado disponible.
            </p>
          </div>

          <form
            action={createAction}
            className="rounded-[1.8rem] border border-[var(--line)] bg-white/82 p-5 shadow-[0_16px_36px_rgba(24,35,47,0.08)] sm:p-6"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-[var(--background-glow)] text-[var(--accent)]">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-[1.8]">
                  <path d="M12 4v16" strokeLinecap="round" />
                  <path d="M4 12h16" strokeLinecap="round" />
                  <rect x="5" y="5" width="14" height="14" rx="3.5" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-[var(--foreground)]">New Retrieval</h3>
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">Register Qdrant access</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block space-y-2">
                <FormLabel required className="text-[0.68rem] uppercase tracking-[0.22em] text-[var(--muted)]">
                  Provider Name
                </FormLabel>
                <input name="name" className="field rounded-[1rem]" placeholder="Qdrant soporte" required />
              </label>
              <label className="block space-y-2">
                <FormLabel required className="text-[0.68rem] uppercase tracking-[0.22em] text-[var(--muted)]">
                  Qdrant URL
                </FormLabel>
                <input
                  name="qdrantBaseUrl"
                  className="field mono rounded-[1rem]"
                  placeholder="https://cluster-example.qdrant.io:6333"
                  required
                />
              </label>
              <label className="block space-y-2">
                <FormLabel required className="text-[0.68rem] uppercase tracking-[0.22em] text-[var(--muted)]">
                  Collection
                </FormLabel>
                <input name="collectionName" className="field rounded-[1rem]" placeholder="knowledge_base" required />
              </label>
              <label className="block space-y-2">
                <FormLabel className="text-[0.68rem] uppercase tracking-[0.22em] text-[var(--muted)]">
                  Vector Name
                </FormLabel>
                <input name="vectorName" className="field rounded-[1rem]" placeholder="dense o default vacío" />
              </label>
              <label className="block space-y-2">
                <FormLabel className="text-[0.68rem] uppercase tracking-[0.22em] text-[var(--muted)]">
                  Query Model
                </FormLabel>
                <input
                  name="queryModel"
                  className="field rounded-[1rem]"
                  placeholder="qdrant/bm25 o openai/text-embedding-3-small"
                />
              </label>
              <label className="block space-y-2">
                <FormLabel className="text-[0.68rem] uppercase tracking-[0.22em] text-[var(--muted)]">
                  Payload Path
                </FormLabel>
                <input name="payloadPath" className="field mono rounded-[1rem]" placeholder="answer.text o chunk" />
              </label>
              <label className="block space-y-2">
                <FormLabel className="text-[0.68rem] uppercase tracking-[0.22em] text-[var(--muted)]">
                  API Key
                </FormLabel>
                <input name="qdrantApiKey" type="password" className="field mono rounded-[1rem]" placeholder="Opcional" />
              </label>
              <FormSubmitButton
                type="submit"
                className="button-primary inline-flex w-full items-center justify-center px-5 py-3 text-sm uppercase tracking-[0.18em]"
                pendingLabel="Guardando configuración..."
              >
                Register Retrieval
              </FormSubmitButton>
            </div>
          </form>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <span className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--muted-strong)]">
              Active Collections
            </span>
            <div className="h-px flex-1 bg-[var(--line)]" />
          </div>

          {configurations.length === 0 ? (
            <div className="rounded-[1.8rem] border border-dashed border-[var(--line)] bg-white/55 px-6 py-8 text-sm leading-7 text-[var(--muted)]">
              Todavía no hay configuraciones RAG globales guardadas. Registra una para reutilizar colecciones de Qdrant en el editor de dataset examples.
            </div>
          ) : (
            <div className="space-y-4">
              {configurations.map((configuration) => (
                <EditableRagConfigurationCard key={configuration.id} configuration={configuration} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function EditableRagConfigurationCard({
  configuration,
}: {
  configuration: RagConfigurationItem;
}) {
  const [name, setName] = useState(configuration.name);
  const [qdrantBaseUrl, setQdrantBaseUrl] = useState(configuration.qdrantBaseUrl);
  const [qdrantApiKey, setQdrantApiKey] = useState(configuration.qdrantApiKey);
  const [collectionName, setCollectionName] = useState(configuration.collectionName);
  const [vectorName, setVectorName] = useState(configuration.vectorName);
  const [queryModel, setQueryModel] = useState(configuration.queryModel);
  const [payloadPath, setPayloadPath] = useState(configuration.payloadPath);
  const [updateState, updateAction] = useActionState(
    updateRagConfigurationWithFeedback.bind(null, configuration.id),
    EMPTY_ACTION_FORM_STATE,
  );
  const [deleteState, deleteAction] = useActionState(
    deleteRagConfigurationWithFeedback.bind(null, configuration.id),
    EMPTY_ACTION_FORM_STATE,
  );

  useActionFeedbackToast(updateState, {
    errorTitle: "No fue posible actualizar la configuración",
    successTitle: "Configuración RAG actualizada",
  });
  useActionFeedbackToast(deleteState, {
    errorTitle: "No fue posible eliminar la configuración",
    successTitle: "Configuración RAG eliminada",
  });

  return (
    <article className="rounded-[1.8rem] border border-[var(--line)] bg-white/84 p-5 shadow-[0_16px_36px_rgba(24,35,47,0.08)] sm:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--background-glow)] text-[var(--accent)]">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-[1.8]">
              <path d="M5 7.5h14" strokeLinecap="round" />
              <path d="M7 12h10" strokeLinecap="round" />
              <path d="M9 16.5h6" strokeLinecap="round" />
              <rect x="4.5" y="4.5" width="15" height="15" rx="3.5" />
            </svg>
          </div>
          <div>
            <h3 className="editorial-heading text-[2rem] leading-none text-[var(--foreground)]">{configuration.name}</h3>
            <p className="mt-2 text-sm font-medium text-[var(--muted-strong)]">{configuration.collectionName}</p>
            <p className="mono mt-1 text-xs text-[var(--muted)]">{configuration.qdrantBaseUrl}</p>
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
            API key {configuration.qdrantApiKey ? "set" : "empty"}
          </span>
          <span className="rounded-full border border-[var(--line)] bg-[var(--background)] px-3 py-1">
            Top K fixed at 1
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
            Collection
          </FormLabel>
          <input
            name="collectionName"
            className="field"
            value={collectionName}
            onChange={(event) => setCollectionName(event.target.value)}
            required
          />
        </label>
        <label className="block space-y-2 md:col-span-2">
          <FormLabel required className="text-[0.68rem] uppercase tracking-[0.22em] text-[var(--muted)]">
            Qdrant URL
          </FormLabel>
          <input
            name="qdrantBaseUrl"
            className="field mono"
            value={qdrantBaseUrl}
            onChange={(event) => setQdrantBaseUrl(event.target.value)}
            required
          />
        </label>
        <label className="block space-y-2">
          <FormLabel className="text-[0.68rem] uppercase tracking-[0.22em] text-[var(--muted)]">
            Vector Name
          </FormLabel>
          <input
            name="vectorName"
            className="field"
            value={vectorName}
            onChange={(event) => setVectorName(event.target.value)}
          />
        </label>
        <label className="block space-y-2">
          <FormLabel className="text-[0.68rem] uppercase tracking-[0.22em] text-[var(--muted)]">
            Query Model
          </FormLabel>
          <input
            name="queryModel"
            className="field"
            value={queryModel}
            onChange={(event) => setQueryModel(event.target.value)}
          />
        </label>
        <label className="block space-y-2">
          <FormLabel className="text-[0.68rem] uppercase tracking-[0.22em] text-[var(--muted)]">
            Payload Path
          </FormLabel>
          <input
            name="payloadPath"
            className="field mono"
            value={payloadPath}
            onChange={(event) => setPayloadPath(event.target.value)}
          />
        </label>
        <label className="block space-y-2">
          <FormLabel className="text-[0.68rem] uppercase tracking-[0.22em] text-[var(--muted)]">
            API Key
          </FormLabel>
          <input
            name="qdrantApiKey"
            type="password"
            className="field mono"
            value={qdrantApiKey}
            onChange={(event) => setQdrantApiKey(event.target.value)}
          />
        </label>

        <div className="md:col-span-2 flex flex-wrap items-center gap-3 pt-1">
          <FormSubmitButton
            type="submit"
            className="button-secondary inline-flex items-center justify-center px-5 py-3 text-sm uppercase tracking-[0.16em]"
            pendingLabel="Actualizando..."
          >
            Update Retrieval
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
