"use client";

import { useMemo, useState } from "react";
import { DatasetSpecImportForm } from "@/components/dataset-spec-import-form";
import { DatasetSpecForm, type DatasetSpecCatalogRecord } from "@/components/dataset-spec-form";
import { cn } from "@/lib/utils";

const VISIBILITY_FILTERS = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
] as const;

type DatasetSpecVisibility = (typeof VISIBILITY_FILTERS)[number]["value"];

function formatUpdatedAtLabel(date: string) {
  const target = new Date(date);
  const diffMs = target.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);
  const relativeFormatter = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) {
    return relativeFormatter.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (Math.abs(diffHours) < 24) {
    return relativeFormatter.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);

  if (Math.abs(diffDays) < 30) {
    return relativeFormatter.format(diffDays, "day");
  }

  const diffMonths = Math.round(diffDays / 30);

  if (Math.abs(diffMonths) < 12) {
    return relativeFormatter.format(diffMonths, "month");
  }

  return relativeFormatter.format(Math.round(diffMonths / 12), "year");
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-[1.8]">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16 21 21" strokeLinecap="round" />
    </svg>
  );
}

function buildDatasetSpecExportHref(ids: string[]) {
  const params = new URLSearchParams();

  ids.forEach((id) => {
    params.append("ids", id);
  });

  const query = params.toString();

  return query ? `/api/dataset-specs/export?${query}` : "/api/dataset-specs/export";
}

function HeaderActionLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const className = cn(
    "inline-flex shrink-0 items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition",
    disabled
      ? "cursor-not-allowed border border-[var(--line)] bg-white/60 text-[var(--muted)]"
      : "border border-[var(--line)] bg-white/80 text-[var(--foreground)] hover:-translate-y-px hover:border-[color-mix(in_srgb,var(--foreground)_16%,transparent)] hover:bg-white",
  );

  if (disabled) {
    return (
      <span aria-disabled="true" className={className}>
        {children}
      </span>
    );
  }

  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

export function DatasetSpecManager({
  datasetSpecs,
}: {
  datasetSpecs: DatasetSpecCatalogRecord[];
}) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(datasetSpecs[0]?.id ?? null);
  const [isCreating, setIsCreating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [visibility, setVisibility] = useState<DatasetSpecVisibility>("active");

  const catalogSummary = useMemo(
    () => ({
      active: datasetSpecs.filter((spec) => spec.isActive).length,
      archived: datasetSpecs.filter((spec) => !spec.isActive).length,
      totalExamples: datasetSpecs.reduce((sum, spec) => sum + spec.datasetExampleCount, 0),
    }),
    [datasetSpecs],
  );

  const filteredSpecs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return datasetSpecs.filter((spec) => {
      if (visibility === "active" && !spec.isActive) {
        return false;
      }

      if (visibility === "archived" && spec.isActive) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [spec.name, spec.slug, spec.description].some((value) =>
        value.toLowerCase().includes(query),
      );
    });
  }, [datasetSpecs, search, visibility]);

  const selectedSpec = isCreating
    ? null
    : filteredSpecs.find((spec) => spec.id === selectedId) ??
      datasetSpecs.find((spec) => spec.id === selectedId) ??
      null;
  const selectedExportHref = useMemo(
    () => buildDatasetSpecExportHref(selectedSpec ? [selectedSpec.id] : []),
    [selectedSpec],
  );
  const visibleExportHref = useMemo(
    () => buildDatasetSpecExportHref(filteredSpecs.map((spec) => spec.id)),
    [filteredSpecs],
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[24rem_minmax(0,1fr)] xl:items-start">
      <section className="surface overflow-hidden rounded-[1.9rem]">
        <div className="border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--card)_80%,white_24%)] px-5 py-6 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="mono text-[0.68rem] uppercase tracking-[0.28em] text-[var(--muted)]">
                Registry
              </p>
              <h1 className="editorial-heading mt-3 text-3xl font-semibold leading-none text-[var(--foreground)] sm:text-[2.15rem]">
                Dataset Specs
              </h1>
              <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--muted)]">
                Contratos finales para definir el esquema, el mapeo y la validacion de cada dataset.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <HeaderActionLink href={selectedExportHref} disabled={!selectedSpec}>
                Exportar seleccionado
              </HeaderActionLink>
              <HeaderActionLink href={visibleExportHref} disabled={filteredSpecs.length === 0}>
                Exportar visibles
              </HeaderActionLink>
              <button
                type="button"
                className="inline-flex shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-white/80 px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:-translate-y-px hover:border-[color-mix(in_srgb,var(--foreground)_16%,transparent)] hover:bg-white"
                onClick={() => setIsImporting((currentValue) => !currentValue)}
              >
                Importar JSON
              </button>
              <button
                type="button"
                className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-[var(--accent-strong)]"
                onClick={() => {
                  setIsCreating(true);
                  setSelectedId(null);
                }}
              >
                <span aria-hidden="true" className="text-base leading-none">
                  +
                </span>
                Nuevo spec
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="rounded-[1.2rem] border border-[var(--line)] bg-white/70 px-3 py-3">
              <p className="mono text-[0.62rem] uppercase tracking-[0.22em] text-[var(--muted)]">
                Active
              </p>
              <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                {catalogSummary.active}
              </p>
            </div>
            <div className="rounded-[1.2rem] border border-[var(--line)] bg-white/70 px-3 py-3">
              <p className="mono text-[0.62rem] uppercase tracking-[0.22em] text-[var(--muted)]">
                Archived
              </p>
              <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                {catalogSummary.archived}
              </p>
            </div>
            <div className="rounded-[1.2rem] border border-[var(--line)] bg-white/70 px-3 py-3">
              <p className="mono text-[0.62rem] uppercase tracking-[0.22em] text-[var(--muted)]">
                Examples
              </p>
              <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                {catalogSummary.totalExamples}
              </p>
            </div>
          </div>

          <label className="mt-5 block space-y-2">
            <span className="mono text-[0.62rem] uppercase tracking-[0.22em] text-[var(--muted)]">
              Search catalog
            </span>
            <span className="relative block">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--muted)]">
                <SearchIcon />
              </span>
              <input
                className="field mono border-[color-mix(in_srgb,var(--line)_90%,white_10%)] bg-white/85 pl-10 text-sm"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nombre, slug o descripcion"
              />
            </span>
          </label>

          <div className="mt-5 inline-flex w-full rounded-[1rem] border border-[var(--line)] bg-white/80 p-1">
            {VISIBILITY_FILTERS.map((filter) => {
              const active = visibility === filter.value;

              return (
                <button
                  key={filter.value}
                  type="button"
                  className={cn(
                    "flex-1 rounded-[0.8rem] px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.18em] transition",
                    active
                      ? "bg-[color-mix(in_srgb,var(--foreground)_6%,white_94%)] text-[var(--foreground)]"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]",
                  )}
                  onClick={() => setVisibility(filter.value)}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="dataspec-scrollbar max-h-[calc(100dvh-20rem)] space-y-3 overflow-y-auto p-4 sm:p-5 xl:max-h-[calc(100dvh-15rem)]">
          {filteredSpecs.map((spec) => {
            const active = selectedId === spec.id && !isCreating;

            return (
              <button
                key={spec.id}
                type="button"
                onClick={() => {
                  setSelectedId(spec.id);
                  setIsCreating(false);
                }}
                className={cn(
                  "group relative w-full overflow-hidden rounded-[1.4rem] border px-4 py-4 text-left transition",
                  active
                    ? "border-[color-mix(in_srgb,var(--accent)_36%,transparent)] bg-white shadow-[0_14px_32px_rgba(15,95,92,0.12)]"
                    : "border-[var(--line)] bg-[color-mix(in_srgb,var(--card)_86%,white_18%)] hover:border-[color-mix(in_srgb,var(--foreground)_20%,transparent)] hover:bg-white",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-y-0 left-0 w-1 transition",
                    active
                      ? "bg-[var(--accent)]"
                      : "bg-transparent group-hover:bg-[color-mix(in_srgb,var(--accent)_42%,transparent)]",
                  )}
                />

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="editorial-heading text-[1.45rem] font-medium leading-tight text-[var(--foreground)] transition group-hover:text-[var(--accent-strong)]">
                      {spec.name}
                    </h3>
                    <div className="mono mt-2 flex flex-wrap items-center gap-2 text-[0.72rem] uppercase tracking-[0.18em] text-[var(--muted)]">
                      <span>{spec.slug}</span>
                      <span className="size-1 rounded-full bg-[color-mix(in_srgb,var(--foreground)_18%,transparent)]" />
                      <span>v{spec.version}</span>
                    </div>
                  </div>

                  <span
                    className={cn(
                      "mono rounded-full border px-2.5 py-1 text-[0.62rem] uppercase tracking-[0.2em]",
                      spec.isActive
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-stone-300 bg-stone-100 text-stone-600",
                    )}
                  >
                    {spec.isActive ? "Active" : "Archived"}
                  </span>
                </div>

                <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--muted-strong)]">
                  {spec.description || "Sin descripcion. Define aqui el contrato final que usara la curacion."}
                </p>

                <div className="mt-4 flex items-center justify-between border-t border-[var(--line)] pt-3">
                  <div className="mono text-[0.68rem] uppercase tracking-[0.18em] text-[var(--muted)]">
                    {spec.datasetExampleCount} exs
                  </div>
                  <div className="mono text-[0.68rem] uppercase tracking-[0.18em] text-[var(--muted)]">
                    Upd {formatUpdatedAtLabel(spec.updatedAt)}
                  </div>
                </div>
              </button>
            );
          })}

          {filteredSpecs.length === 0 ? (
            <div className="rounded-[1.4rem] border border-dashed border-[var(--line)] bg-white/50 px-4 py-8 text-center text-sm text-[var(--muted)]">
              No hay specs que coincidan con el filtro actual.
            </div>
          ) : null}
        </div>
      </section>

      <section className="surface relative overflow-hidden rounded-[1.9rem]">
        <div className="dataspec-workspace absolute inset-0 opacity-80" aria-hidden="true" />
        <div className="relative p-6 sm:p-8 lg:p-10">
          <div>
            <div className="mono flex flex-wrap items-center gap-2 text-[0.68rem] uppercase tracking-[0.24em] text-[var(--muted)]">
              <span>Catalog</span>
              <span aria-hidden="true">/</span>
              <span className="text-[var(--accent)]">
                {isCreating ? "New Specification" : selectedSpec ? selectedSpec.slug : "Editor"}
              </span>
            </div>
            <h2 className="editorial-heading mt-4 text-4xl font-semibold leading-none text-[var(--foreground)] sm:text-[3rem]">
              {isCreating
                ? "Author Dataset Spec"
                : selectedSpec
                  ? `Edit ${selectedSpec.name}`
                  : "Select a dataset spec"}
            </h2>
            <p className="mt-3 max-w-3xl text-base leading-8 text-[var(--muted)] sm:text-[1.05rem]">
              Define el schema, la guia de mapeo y el contrato de exportacion que usara el operador o el agente de extraccion.
            </p>

            {!isCreating && selectedSpec ? (
              <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-[var(--muted)]">
                <span className="mono rounded-full border border-[var(--line)] bg-white/75 px-3 py-1 uppercase tracking-[0.16em]">
                  {selectedSpec.datasetFormat}
                </span>
                <span className="mono rounded-full border border-[var(--line)] bg-white/75 px-3 py-1 uppercase tracking-[0.16em]">
                  v{selectedSpec.version}
                </span>
                <span className="mono rounded-full border border-[var(--line)] bg-white/75 px-3 py-1 uppercase tracking-[0.16em]">
                  {selectedSpec.datasetExampleCount} examples
                </span>
              </div>
            ) : null}
          </div>

          <div className="mt-10 space-y-6">
            {isImporting ? (
              <DatasetSpecImportForm
                onClose={() => {
                  setIsImporting(false);
                }}
              />
            ) : null}

            <DatasetSpecForm
              key={selectedSpec?.id ?? "new-dataset-spec"}
              datasetSpec={selectedSpec}
              onCancel={() => {
                setIsCreating(false);
                setSelectedId(selectedSpec?.id ?? datasetSpecs[0]?.id ?? null);
              }}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
