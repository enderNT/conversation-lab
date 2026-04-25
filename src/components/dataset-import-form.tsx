"use client";

import Link from "next/link";
import { useActionState } from "react";
import { importDatasetExamplesWithFeedback } from "@/app/actions";
import { FormSubmitButton } from "@/components/form-submit-button";
import { useActionFeedbackToast } from "@/components/use-action-feedback-toast";
import { EMPTY_DATASET_IMPORT_ACTION_STATE } from "@/lib/form-state";
import type { DatasetImportSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

type DatasetImportSpecOption = {
  id: string;
  name: string;
  slug: string;
  version: number;
};

type DatasetImportSessionOption = {
  id: string;
  title: string;
};

function UploadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-[1.9]">
      <path d="M12 16V5" strokeLinecap="round" />
      <path d="m7.5 9.5 4.5-4.5 4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 18.5h15" strokeLinecap="round" />
    </svg>
  );
}

function ResultStatusBadge({
  status,
}: {
  status: DatasetImportSummary["results"][number]["status"];
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em]",
        status === "imported" &&
          "bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-200",
        status === "duplicate" &&
          "bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-200",
        status === "rejected" &&
          "bg-rose-100 text-rose-800 ring-1 ring-inset ring-rose-200",
      )}
    >
      {status}
    </span>
  );
}

function SummaryMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-[1.2rem] border border-[var(--line)] bg-white/75 px-4 py-4">
      <p className="mono text-[0.65rem] uppercase tracking-[0.24em] text-[var(--muted)]">{label}</p>
      <p className="mt-3 text-3xl font-semibold leading-none text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function ImportSummaryPanel({
  projectId,
  summary,
}: {
  projectId: string;
  summary: DatasetImportSummary;
}) {
  return (
    <section className="surface rounded-[1.8rem] p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mono text-[0.68rem] uppercase tracking-[0.24em] text-[var(--muted)]">
            Último lote
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            {summary.fileName}
          </h2>
          <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
            Spec: {summary.datasetSpecName} • {summary.results.length} filas procesadas
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href={`/dataset-examples?projectId=${projectId}`}
            className="button-secondary inline-flex items-center justify-center"
          >
            Ver dataset examples
          </Link>
          {summary.sessionId ? (
            <Link
              href={`/projects/${projectId}/sessions/${summary.sessionId}`}
              className="button-primary inline-flex items-center justify-center"
            >
              Abrir sesión de importación
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <SummaryMetric label="Importados" value={summary.importedCount} />
        <SummaryMetric label="Duplicados" value={summary.duplicateCount} />
        <SummaryMetric label="Rechazados" value={summary.rejectedCount} />
      </div>

      <div className="mt-6 space-y-3">
        {summary.results.map((result) => (
          <article
            key={`${result.lineNumber}:${result.status}:${result.message}`}
            className="rounded-[1.25rem] border border-[var(--line)] bg-white/70 p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-[var(--foreground)]">Línea {result.lineNumber}</p>
                  <ResultStatusBadge status={result.status} />
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">{result.message}</p>
              </div>

              {result.datasetExampleId ? (
                <Link
                  href={`/dataset-examples/${result.datasetExampleId}`}
                  className="button-secondary inline-flex shrink-0 items-center justify-center"
                >
                  Abrir editor
                </Link>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function DatasetImportForm({
  projectId,
  datasetSpecs,
  projectSessions,
}: {
  projectId: string;
  datasetSpecs: DatasetImportSpecOption[];
  projectSessions: DatasetImportSessionOption[];
}) {
  const [state, formAction] = useActionState(
    importDatasetExamplesWithFeedback.bind(null, projectId),
    EMPTY_DATASET_IMPORT_ACTION_STATE,
  );

  useActionFeedbackToast(state, {
    errorTitle: "No fue posible importar el JSONL",
    successTitle: "Importación completada",
  });

  return (
    <div className="space-y-6">
      <form
        action={formAction}
        className="surface rounded-[1.8rem] p-5 sm:p-6"
      >
        <div className="flex items-start gap-4">
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-[1.2rem] bg-[color-mix(in_srgb,var(--accent)_10%,white_84%)] text-[var(--accent)]">
            <UploadIcon />
          </span>

          <div>
            <p className="mono text-[0.68rem] uppercase tracking-[0.24em] text-[var(--muted)]">
              JSONL Import
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Importa dataset examples desde un archivo
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
              Sube un archivo <code>.jsonl</code> o <code>.ndjson</code> con filas que sigan la forma{" "}
              <code>{`{"input": {...}, "output": {...}, "metadata"?: {...}}`}</code>. Cada fila válida se
              guarda como dataset example editable en estado <code>draft</code>.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <label className="space-y-2">
            <span className="text-sm font-medium text-[var(--foreground)]">Archivo</span>
            <input
              type="file"
              name="datasetFile"
              accept=".jsonl,.ndjson,application/x-ndjson"
              className="field min-h-14 cursor-pointer file:mr-4 file:rounded-full file:border-0 file:bg-[var(--accent)] file:px-4 file:py-2 file:font-semibold file:text-white"
              required
            />
            <p className="text-xs leading-6 text-[var(--muted)]">
              Se procesan una fila por línea y se ignoran líneas vacías.
            </p>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-[var(--foreground)]">Dataset spec</span>
            <select name="datasetSpecId" className="field min-h-14" defaultValue={datasetSpecs[0]?.id ?? ""} required>
              {datasetSpecs.map((datasetSpec) => (
                <option key={datasetSpec.id} value={datasetSpec.id}>
                  {datasetSpec.name} ({datasetSpec.slug}) • v{datasetSpec.version}
                </option>
              ))}
            </select>
            <p className="text-xs leading-6 text-[var(--muted)]">
              La firma se resuelve manualmente por archivo en esta primera versión.
            </p>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-[var(--foreground)]">Sesión de chat</span>
            <select name="sessionId" className="field min-h-14" defaultValue="">
              <option value="">Usar sesión técnica fallback</option>
              {projectSessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.title} ({session.id.slice(0, 8)})
                </option>
              ))}
            </select>
            <p className="text-xs leading-6 text-[var(--muted)]">
              Si eliges una sesión, los examples importados quedarán vinculados ahí desde el inicio.
            </p>
          </label>
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-[var(--line)] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-7 text-[var(--muted)]">
            Si no eliges sesión, los imports se guardan en la sesión técnica `Dataset Imports`.
          </p>

          <FormSubmitButton
            type="submit"
            className="button-primary inline-flex min-h-12 items-center justify-center gap-3 px-6"
            pendingLabel="Importando archivo..."
          >
            <span>Importar JSONL</span>
            <UploadIcon />
          </FormSubmitButton>
        </div>
      </form>

      {state.summary ? <ImportSummaryPanel projectId={projectId} summary={state.summary} /> : null}
    </div>
  );
}
