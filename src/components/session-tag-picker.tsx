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

  return (
    <div className={cn("space-y-3", compact ? "text-xs" : "text-sm")}>
      <div className="flex flex-wrap gap-2">
        {assignedTags.length === 0 ? (
          <span className="text-[var(--muted)]">Sin etiquetas</span>
        ) : null}

        {assignedTags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white/80 px-3 py-1 text-[var(--foreground)]"
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

      <div className={cn("grid gap-2", compact ? "md:grid-cols-1" : "md:grid-cols-[minmax(0,1fr)_auto]")}>
        <select
          className="field"
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
          className="button-secondary"
          onClick={() => {
            void handleAssignTag();
          }}
          disabled={!selectedTagId || busyTagId !== null}
        >
          Añadir
        </button>
      </div>

      <div className={cn("grid gap-2", compact ? "md:grid-cols-1" : "md:grid-cols-[minmax(0,1fr)_auto]")}>
        <input
          className="field"
          value={newTagName}
          onChange={(event) => setNewTagName(event.target.value)}
          placeholder="Crear etiqueta rápida"
          disabled={isCreating}
        />
        <button
          type="button"
          className="button-secondary"
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
