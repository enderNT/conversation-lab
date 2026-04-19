"use client";

import { useMemo, useState } from "react";
import { DatasetSpecForm, type DatasetSpecCatalogRecord } from "@/components/dataset-spec-form";
import { StatusBadge } from "@/components/status-badge";
import { cn, formatDate } from "@/lib/utils";

export function DatasetSpecManager({
  datasetSpecs,
}: {
  datasetSpecs: DatasetSpecCatalogRecord[];
}) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(datasetSpecs[0]?.id ?? null);
  const [isCreating, setIsCreating] = useState(false);

  const filteredSpecs = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return datasetSpecs;
    }

    return datasetSpecs.filter((spec) =>
      [spec.name, spec.slug, spec.description].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [datasetSpecs, search]);

  const selectedSpec = isCreating
    ? null
    : filteredSpecs.find((spec) => spec.id === selectedId) ??
      datasetSpecs.find((spec) => spec.id === selectedId) ??
      null;

  return (
    <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
      <section className="surface rounded-[1.75rem] p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-[var(--muted)]">
              Dataset Specs
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              Contratos finales para mapear desde chat hacia firmas DSPy.
            </h1>
          </div>

          <button
            type="button"
            className="button-primary"
            onClick={() => {
              setIsCreating(true);
              setSelectedId(null);
            }}
          >
            Nuevo spec
          </button>
        </div>

        <label className="mt-5 block space-y-2">
          <span className="text-sm font-medium">Buscar</span>
          <input
            className="field"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nombre, slug o descripción"
          />
        </label>

        <div className="mt-5 space-y-3">
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
                  "w-full rounded-[1.5rem] border p-4 text-left transition",
                  active
                    ? "border-[var(--accent)] bg-[rgba(15,95,92,0.08)]"
                    : "border-[var(--line)] bg-white/70 hover:border-[var(--accent)]",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-semibold text-[var(--foreground)]">{spec.name}</p>
                  <StatusBadge status={spec.isActive ? "approved" : "archived"} />
                </div>
                <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                  {spec.slug} · v{spec.version}
                </p>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--muted)]">
                  {spec.description || "Sin descripción."}
                </p>
                <p className="mt-3 text-xs text-[var(--muted)]">
                  {spec.datasetExampleCount} example(s) · actualizado {formatDate(spec.updatedAt)}
                </p>
              </button>
            );
          })}

          {filteredSpecs.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-[var(--line)] px-4 py-6 text-sm text-[var(--muted)]">
              No hay specs que coincidan con la búsqueda.
            </div>
          ) : null}
        </div>
      </section>

      <section className="surface rounded-[1.75rem] p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-[var(--muted)]">
              Editor
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              {isCreating ? "Nuevo dataset spec" : selectedSpec ? `Editar ${selectedSpec.name}` : "Selecciona un spec"}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Define el contrato final, las sugerencias de mapeo y la configuración de exportación que usará el editor DSPy.
            </p>
          </div>

          {!isCreating ? (
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                setIsCreating(true);
                setSelectedId(null);
              }}
            >
              Duplicar como nuevo
            </button>
          ) : null}
        </div>

        <DatasetSpecForm
          key={selectedSpec?.id ?? "new-dataset-spec"}
          datasetSpec={selectedSpec}
          onCancel={() => {
            setIsCreating(false);
            setSelectedId(datasetSpecs[0]?.id ?? null);
          }}
        />
      </section>
    </div>
  );
}
