"use client";

import { useActionState } from "react";
import { importDatasetSpecsWithFeedback } from "@/app/actions";
import { FormSubmitButton } from "@/components/form-submit-button";
import { useActionFeedbackToast } from "@/components/use-action-feedback-toast";
import { EMPTY_DATASET_SPEC_IMPORT_ACTION_STATE } from "@/lib/form-state";
import type { DatasetSpecImportSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

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
  status: DatasetSpecImportSummary["results"][number]["status"];
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em]",
        status === "imported" &&
          "bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-200",
        status === "versioned" &&
          "bg-sky-100 text-sky-800 ring-1 ring-inset ring-sky-200",
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
  summary,
}: {
  summary: DatasetSpecImportSummary;
}) {
  return (
    <section className="rounded-[1.6rem] border border-[var(--line)] bg-white/70 p-5 sm:p-6">
      <div>
        <p className="mono text-[0.68rem] uppercase tracking-[0.24em] text-[var(--muted)]">
          Último lote
        </p>
        <h3 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          {summary.fileName}
        </h3>
        <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
          {summary.results.length} specs procesados en este archivo.
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <SummaryMetric label="Importados" value={summary.importedCount} />
        <SummaryMetric label="Versionados" value={summary.versionedCount} />
        <SummaryMetric label="Rechazados" value={summary.rejectedCount} />
      </div>

      <div className="mt-6 space-y-3">
        {summary.results.map((result) => (
          <article
            key={`${result.index}:${result.slug}:${result.status}:${result.message}`}
            className="rounded-[1.25rem] border border-[var(--line)] bg-white/70 p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-[var(--foreground)]">
                    #{result.index} {result.name || result.slug || "Dataset spec"}
                  </p>
                  <ResultStatusBadge status={result.status} />
                </div>

                <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">
                  {result.message}
                </p>

                <div className="mono mt-3 flex flex-wrap gap-2 text-[0.7rem] uppercase tracking-[0.16em] text-[var(--muted)]">
                  {result.slug ? <span>Slug origen {result.slug}</span> : null}
                  {result.finalSlug ? <span>Slug final {result.finalSlug}</span> : null}
                  {result.version > 0 ? <span>v{result.version}</span> : null}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function DatasetSpecImportForm({
  onClose,
}: {
  onClose?: () => void;
}) {
  const [state, formAction] = useActionState(
    importDatasetSpecsWithFeedback,
    EMPTY_DATASET_SPEC_IMPORT_ACTION_STATE,
  );

  useActionFeedbackToast(state, {
    errorTitle: "No fue posible importar el JSON",
    successTitle: "Importación de dataset specs completada",
  });

  return (
    <div className="space-y-6">
      <form
        action={formAction}
        className="rounded-[1.8rem] border border-[var(--line)] bg-[color-mix(in_srgb,var(--card)_84%,white_18%)] p-5 shadow-sm sm:p-6"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-[1.2rem] bg-[color-mix(in_srgb,var(--accent)_10%,white_84%)] text-[var(--accent)]">
              <UploadIcon />
            </span>

            <div>
              <p className="mono text-[0.68rem] uppercase tracking-[0.24em] text-[var(--muted)]">
                JSON Import
              </p>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                Importa dataset specs desde un bundle
              </h3>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
                Sube un archivo <code>.json</code> exportado por la app con el shape{" "}
                <code>{`{"schemaVersion":1,"specs":[...]}`}</code>. Cada spec se procesa por separado
                para que un error no bloquee todo el lote.
              </p>
            </div>
          </div>

          {onClose ? (
            <button type="button" className="button-secondary shrink-0" onClick={onClose}>
              Cerrar
            </button>
          ) : null}
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <label className="space-y-2">
            <span className="text-sm font-medium text-[var(--foreground)]">Archivo</span>
            <input
              type="file"
              name="datasetSpecFile"
              accept=".json,application/json"
              className="field min-h-14 cursor-pointer file:mr-4 file:rounded-full file:border-0 file:bg-[var(--accent)] file:px-4 file:py-2 file:font-semibold file:text-white"
              required
            />
            <p className="text-xs leading-6 text-[var(--muted)]">
              El import conserva el contrato del spec y versiona automáticamente si el slug ya existe.
            </p>
          </label>

          <FormSubmitButton
            type="submit"
            className="button-primary inline-flex min-h-12 items-center justify-center gap-3 px-6"
            pendingLabel="Importando specs..."
          >
            <span>Importar JSON</span>
            <UploadIcon />
          </FormSubmitButton>
        </div>
      </form>

      {state.summary ? <ImportSummaryPanel summary={state.summary} /> : null}
    </div>
  );
}
