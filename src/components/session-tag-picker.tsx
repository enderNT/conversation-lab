"use client";

import Link from "next/link";
import { startTransition, useState } from "react";
import {
  assignSessionTagToSession,
  createSessionTagAndAssign,
  removeSessionTagFromSession,
} from "@/app/actions";
import { useToast } from "@/components/toast-provider";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

type SessionTagOption = {
  id: string;
  name: string;
};

export function SessionTagPicker({
  projectId,
  sessionId,
  assignedTags,
  availableTags,
  compact = false,
  showManageLink = false,
}: {
  projectId: string;
  sessionId: string;
  assignedTags: SessionTagOption[];
  availableTags: SessionTagOption[];
  compact?: boolean;
  showManageLink?: boolean;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [selectedTagId, setSelectedTagId] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [busyTagId, setBusyTagId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showCompactComposer, setShowCompactComposer] = useState(false);
  const assignableTags = availableTags.filter(
    (tag) => !assignedTags.some((assignedTag) => assignedTag.id === tag.id),
  );

  async function handleAssignTag() {
    if (!selectedTagId || busyTagId) {
      return;
    }

    setBusyTagId(selectedTagId);

    try {
      const result = await assignSessionTagToSession(projectId, sessionId, selectedTagId);

      if (!result.ok) {
        pushToast({
          title: "No fue posible asignar la etiqueta",
          description: result.error,
          variant: "error",
          durationMs: 7000,
        });
        return;
      }

      setSelectedTagId("");
      setShowCompactComposer(false);
      pushToast({
        title: "Etiqueta asignada",
        description: "La sesión ya usa esta etiqueta.",
        variant: "success",
        durationMs: 4000,
      });
      startTransition(() => {
        router.refresh();
      });
    } catch {
      pushToast({
        title: "No fue posible asignar la etiqueta",
        description: "No fue posible actualizar la sesión.",
        variant: "error",
        durationMs: 7000,
      });
    } finally {
      setBusyTagId(null);
    }
  }

  async function handleRemoveTag(tagId: string) {
    if (busyTagId) {
      return;
    }

    setBusyTagId(tagId);

    try {
      const result = await removeSessionTagFromSession(projectId, sessionId, tagId);

      if (!result.ok) {
        pushToast({
          title: "No fue posible remover la etiqueta",
          description: result.error,
          variant: "error",
          durationMs: 7000,
        });
        return;
      }

      pushToast({
        title: "Etiqueta removida",
        description: "La sesión dejó de usar esa etiqueta.",
        variant: "success",
        durationMs: 4000,
      });
      startTransition(() => {
        router.refresh();
      });
    } catch {
      pushToast({
        title: "No fue posible remover la etiqueta",
        description: "No fue posible actualizar la sesión.",
        variant: "error",
        durationMs: 7000,
      });
    } finally {
      setBusyTagId(null);
    }
  }

  async function handleCreateAndAssign() {
    const trimmedName = newTagName.trim();

    if (!trimmedName || isCreating) {
      return;
    }

    setIsCreating(true);

    try {
      const result = await createSessionTagAndAssign(projectId, sessionId, {
        name: trimmedName,
      });

      if (!result.ok) {
        pushToast({
          title: "No fue posible crear la etiqueta",
          description: result.error,
          variant: "error",
          durationMs: 7000,
        });
        return;
      }

      setNewTagName("");
      setShowCompactComposer(false);
      pushToast({
        title: "Etiqueta creada",
        description: `La etiqueta "${trimmedName}" quedó asignada a la sesión.`,
        variant: "success",
        durationMs: 5000,
      });
      startTransition(() => {
        router.refresh();
      });
    } catch {
      pushToast({
        title: "No fue posible crear la etiqueta",
        description: "No fue posible crear o asignar la etiqueta.",
        variant: "error",
        durationMs: 7000,
      });
    } finally {
      setIsCreating(false);
    }
  }

  if (compact) {
    return (
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-2">
          {assignedTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-2 rounded-full border border-[color:rgba(15,95,92,0.08)] bg-[color:rgba(207,233,229,0.9)] px-3 py-1 text-[var(--foreground)]"
            >
              <span>{tag.name}</span>
              <button
                type="button"
                className="text-[var(--muted)] transition hover:text-rose-600"
                onClick={() => {
                  void handleRemoveTag(tag.id);
                }}
                disabled={busyTagId === tag.id}
                aria-label={`Quitar etiqueta ${tag.name}`}
                title={`Quitar etiqueta ${tag.name}`}
              >
                ×
              </button>
            </span>
          ))}

          {assignedTags.length === 0 ? (
            <span className="rounded-full border border-[var(--line)] bg-white/72 px-3 py-1 text-[var(--muted)]">
              Sin etiquetas
            </span>
          ) : null}

          <button
            type="button"
            className="inline-flex items-center rounded-full border border-transparent bg-[var(--background)] px-3 py-1 text-[var(--muted-strong)] transition hover:border-[var(--line)] hover:text-[var(--foreground)]"
            onClick={() => setShowCompactComposer((current) => !current)}
            aria-expanded={showCompactComposer}
          >
            + Tag
          </button>
        </div>

        {showCompactComposer ? (
          <div className="space-y-2 rounded-[1.35rem] border border-[var(--line)] bg-white/75 p-3 shadow-[0_10px_24px_rgba(24,35,47,0.05)]">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <select
                className="field min-h-11 rounded-full border-transparent bg-white px-4 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.58)]"
                value={selectedTagId}
                onChange={(event) => setSelectedTagId(event.target.value)}
                disabled={assignableTags.length === 0 || busyTagId !== null}
              >
                <option value="">Asignar etiqueta existente</option>
                {assignableTags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="button-secondary min-h-11 rounded-full px-4"
                onClick={() => {
                  void handleAssignTag();
                }}
                disabled={!selectedTagId || busyTagId !== null}
              >
                Añadir
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input
                className="field min-h-11 rounded-full border-transparent bg-white px-4 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.58)]"
                value={newTagName}
                onChange={(event) => setNewTagName(event.target.value)}
                placeholder="Crear etiqueta rápida"
                disabled={isCreating}
              />
              <button
                type="button"
                className="button-secondary min-h-11 rounded-full px-4"
                onClick={() => {
                  void handleCreateAndAssign();
                }}
                disabled={newTagName.trim().length === 0 || isCreating}
              >
                {isCreating ? "Creando..." : "Crear"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-2">
        {assignedTags.length === 0 ? (
          <span
            className={cn(compact ? "rounded-full border border-[var(--line)] bg-white/72 px-3 py-1 text-[var(--muted)]" : "text-[var(--muted)]")}
          >
            Sin etiquetas
          </span>
        ) : null}

        {assignedTags.map((tag) => (
          <span
            key={tag.id}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[var(--foreground)]",
              compact
                ? "border-[color:rgba(15,95,92,0.08)] bg-[color:rgba(207,233,229,0.9)]"
                : "border-[var(--line)] bg-white/80",
            )}
          >
            <span>{tag.name}</span>
            <button
              type="button"
              className="text-[var(--muted)] transition hover:text-rose-600"
              onClick={() => {
                void handleRemoveTag(tag.id);
              }}
              disabled={busyTagId === tag.id}
              aria-label={`Quitar etiqueta ${tag.name}`}
              title={`Quitar etiqueta ${tag.name}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <div className={cn("grid gap-2", compact ? "sm:grid-cols-[minmax(0,1fr)_auto]" : "md:grid-cols-[minmax(0,1fr)_auto]")}>
        <select
          className={cn(
            "field",
            compact &&
              "min-h-11 rounded-full border-transparent bg-white px-4 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.58)]",
          )}
          value={selectedTagId}
          onChange={(event) => setSelectedTagId(event.target.value)}
          disabled={assignableTags.length === 0 || busyTagId !== null}
        >
          <option value="">Asignar etiqueta existente</option>
          {assignableTags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={cn("button-secondary", compact && "min-h-11 rounded-full px-4")}
          onClick={() => {
            void handleAssignTag();
          }}
          disabled={!selectedTagId || busyTagId !== null}
        >
          Añadir
        </button>
      </div>

      <div className={cn("grid gap-2", compact ? "sm:grid-cols-[minmax(0,1fr)_auto]" : "md:grid-cols-[minmax(0,1fr)_auto]")}>
        <input
          className={cn(
            "field",
            compact &&
              "min-h-11 rounded-full border-transparent bg-white px-4 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.58)]",
          )}
          value={newTagName}
          onChange={(event) => setNewTagName(event.target.value)}
          placeholder="Crear etiqueta rápida"
          disabled={isCreating}
        />
        <button
          type="button"
          className={cn("button-secondary", compact && "min-h-11 rounded-full px-4")}
          onClick={() => {
            void handleCreateAndAssign();
          }}
          disabled={newTagName.trim().length === 0 || isCreating}
        >
          {isCreating ? "Creando..." : "Crear"}
        </button>
      </div>

      {showManageLink ? (
        <Link href="/session-tags" className="inline-flex text-xs font-semibold text-[var(--accent)] underline underline-offset-4">
          Gestionar etiquetas
        </Link>
      ) : null}
    </div>
  );
}
