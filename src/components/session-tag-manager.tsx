"use client";

import { useActionState, useState } from "react";
import {
  createSessionTagWithFeedback,
  deleteSessionTagWithFeedback,
  updateSessionTagWithFeedback,
} from "@/app/actions";
import { FormLabel } from "@/components/form-label";
import { FormSubmitButton } from "@/components/form-submit-button";
import { useActionFeedbackToast } from "@/components/use-action-feedback-toast";
import { EMPTY_ACTION_FORM_STATE } from "@/lib/form-state";
import { formatDate } from "@/lib/utils";

type SessionTagItem = {
  id: string;
  name: string;
  sessionCount: number;
  createdAt: string;
  updatedAt: string;
};

export function SessionTagManager({ tags }: { tags: SessionTagItem[] }) {
  const [createState, createAction] = useActionState(
    createSessionTagWithFeedback,
    EMPTY_ACTION_FORM_STATE,
  );

  useActionFeedbackToast(createState, {
    errorTitle: "No fue posible guardar la etiqueta",
    successTitle: "Etiqueta guardada",
  });

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <form action={createAction} className="surface rounded-[1.75rem] p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Nueva etiqueta</h2>
          <div className="mt-4 space-y-4">
            <label className="block space-y-2">
              <FormLabel required>Nombre</FormLabel>
              <input name="name" className="field" placeholder="Urgente" required />
            </label>
            <FormSubmitButton type="submit" className="button-primary w-full" pendingLabel="Guardando etiqueta...">
              Guardar etiqueta
            </FormSubmitButton>
          </div>
        </form>

        <div className="surface rounded-[1.75rem] p-5 sm:p-6">
          <p className="text-sm uppercase tracking-[0.22em] text-[var(--muted)]">
            Etiquetas de sesiones
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
            Administra la taxonomía global de chats.
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--muted)]">
            Desde aquí puedes crear, renombrar o eliminar etiquetas. Luego podrás usarlas rápidamente desde el listado de sesiones del proyecto o desde el chat actual.
          </p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {tags.length === 0 ? (
          <div className="surface col-span-full rounded-[1.75rem] p-8 text-sm text-[var(--muted)]">
            Todavía no hay etiquetas globales para sesiones.
          </div>
        ) : null}

        {tags.map((tag) => (
          <EditableSessionTagCard key={tag.id} tag={tag} />
        ))}
      </section>
    </div>
  );
}

function EditableSessionTagCard({ tag }: { tag: SessionTagItem }) {
  const [name, setName] = useState(tag.name);
  const [updateState, updateAction] = useActionState(
    updateSessionTagWithFeedback.bind(null, tag.id),
    EMPTY_ACTION_FORM_STATE,
  );
  const [deleteState, deleteAction] = useActionState(
    deleteSessionTagWithFeedback.bind(null, tag.id),
    EMPTY_ACTION_FORM_STATE,
  );

  useActionFeedbackToast(updateState, {
    errorTitle: "No fue posible actualizar la etiqueta",
    successTitle: "Etiqueta actualizada",
  });
  useActionFeedbackToast(deleteState, {
    errorTitle: "No fue posible eliminar la etiqueta",
    successTitle: "Etiqueta eliminada",
  });

  return (
    <article className="surface rounded-[1.75rem] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-[var(--foreground)]">{tag.name}</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {tag.sessionCount} sesión(es) usan esta etiqueta.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-[var(--muted)]">
          <span className="rounded-full border border-[var(--line)] bg-white/70 px-3 py-1">
            Creada {formatDate(tag.createdAt)}
          </span>
          <span className="rounded-full border border-[var(--line)] bg-white/70 px-3 py-1">
            Actualizada {formatDate(tag.updatedAt)}
          </span>
        </div>
      </div>

      <form action={updateAction} className="mt-5 space-y-4">
        <label className="block space-y-2">
          <FormLabel required>Nombre</FormLabel>
          <input
            name="name"
            className="field"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
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
