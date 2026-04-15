"use client";

import Link from "next/link";
import { useEffect, useRef, useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import { sendSessionMessage, updateSessionSystemPrompt } from "@/app/actions";
import { FormLabel } from "@/components/form-label";
import { useToast } from "@/components/toast-provider";
import { cn, formatDate } from "@/lib/utils";

type SelectableMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  orderIndex: number;
  createdAt: string;
};

type SessionSelectionProps = {
  projectId: string;
  sessionId: string;
  messages: SelectableMessage[];
  chatModel: string;
  chatEnabled: boolean;
  chatProviderLabel: string;
  chatBaseUrl: string | null;
  systemPrompt: string;
};

export function SessionSelection({
  projectId,
  sessionId,
  messages,
  chatModel,
  chatEnabled,
  chatProviderLabel,
  chatBaseUrl,
  systemPrompt,
}: SessionSelectionProps) {
  const router = useRouter();
  const [anchorIndex, setAnchorIndex] = useState<number | null>(null);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [systemPromptDraft, setSystemPromptDraft] = useState(systemPrompt);
  const [isSending, setIsSending] = useState(false);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const { pushToast } = useToast();

  const selectionRange =
    anchorIndex === null || focusIndex === null
      ? null
      : {
          start: Math.min(anchorIndex, focusIndex),
          end: Math.max(anchorIndex, focusIndex),
        };

  const selectedMessages = selectionRange
    ? messages.filter(
        (message) =>
          message.orderIndex >= selectionRange.start &&
          message.orderIndex <= selectionRange.end,
      )
    : [];

  const caseHref = selectionRange
    ? `/projects/${projectId}/sessions/${sessionId}/cases/new?start=${selectionRange.start}&end=${selectionRange.end}`
    : "#";

  useEffect(() => {
    const container = messagesRef.current;

    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [messages.length]);

  useEffect(() => {
    setSystemPromptDraft(systemPrompt);
  }, [systemPrompt]);

  function handleSelect(orderIndex: number) {
    if (anchorIndex === null) {
      setAnchorIndex(orderIndex);
      setFocusIndex(orderIndex);
      return;
    }

    setFocusIndex(orderIndex);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = draft.trim();

    if (!text || isSending || !chatEnabled) {
      return;
    }

    setIsSending(true);
    setErrorMessage(null);

    try {
      const result = await sendSessionMessage(projectId, sessionId, { text });

      if (!result.ok) {
        setErrorMessage(result.error);
        pushToast({
          title: "No fue posible enviar el mensaje",
          description: result.error,
          variant: "error",
          durationMs: 7000,
        });
        return;
      }

      setDraft("");
      pushToast({
        title: "Mensaje enviado",
        description: "La conversación se actualizó correctamente.",
        variant: "success",
        durationMs: 7000,
      });
      textareaRef.current?.focus();
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setErrorMessage("No fue posible enviar el mensaje al modelo.");
      pushToast({
        title: "No fue posible enviar el mensaje",
        description: "No fue posible enviar el mensaje al modelo.",
        variant: "error",
        durationMs: 7000,
      });
    } finally {
      setIsSending(false);
    }
  }

  async function handleSavePrompt() {
    if (isSavingPrompt) {
      return;
    }

    setIsSavingPrompt(true);

    try {
      const result = await updateSessionSystemPrompt(projectId, sessionId, {
        systemPrompt: systemPromptDraft,
      });

      if (!result.ok) {
        pushToast({
          title: "No fue posible guardar el prompt",
          description: result.error,
          variant: "error",
          durationMs: 7000,
        });
        return;
      }

      pushToast({
        title: systemPromptDraft.trim()
          ? "Prompt guardado"
          : "Prompt eliminado",
        description: systemPromptDraft.trim()
          ? "La sesión usará este prompt de comportamiento en los siguientes turnos."
          : "La sesión volvió a conversar sin prompt adicional.",
        variant: "success",
        durationMs: 7000,
      });

      startTransition(() => {
        router.refresh();
      });
    } catch {
      pushToast({
        title: "No fue posible guardar el prompt",
        description: "No fue posible actualizar el prompt de comportamiento.",
        variant: "error",
        durationMs: 7000,
      });
    } finally {
      setIsSavingPrompt(false);
    }
  }

  const promptIsDirty = systemPromptDraft.trim() !== systemPrompt.trim();

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="space-y-6">
        <form ref={formRef} onSubmit={handleSubmit} className="surface rounded-[1.75rem] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Conversation chat</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Escribe como usuario. La app guardará tu turno y la respuesta del modelo como mensajes separados.
              </p>
            </div>

            <div className="rounded-[1.25rem] border border-[var(--line)] bg-white/65 px-4 py-3 text-sm text-[var(--muted)]">
              <p>Proveedor: {chatProviderLabel}</p>
              <p className="mt-1">Modelo: {chatModel}</p>
              <p className="mt-1 break-all">
                Base URL: {chatBaseUrl || "https://api.openai.com/v1"}
              </p>
            </div>
          </div>

          <label className="mt-5 block space-y-2">
            <FormLabel>Behavior prompt (optional)</FormLabel>
            <textarea
              className="field min-h-28"
              value={systemPromptDraft}
              onChange={(event) => setSystemPromptDraft(event.target.value)}
              placeholder="Déjalo vacío para conversar sin prompt adicional. Si lo completas, se aplicará como instrucción de sistema en los siguientes turnos."
              disabled={isSavingPrompt}
            />
          </label>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--muted)]">
              El prompt es opcional y solo afecta las siguientes respuestas del modelo en esta sesión.
            </p>
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                void handleSavePrompt();
              }}
              disabled={isSavingPrompt || !promptIsDirty}
            >
              {isSavingPrompt ? "Saving prompt..." : "Save prompt"}
            </button>
          </div>

          <label className="mt-5 block space-y-2">
            <FormLabel required>Your message</FormLabel>
            <textarea
              ref={textareaRef}
              className="field min-h-32"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  formRef.current?.requestSubmit();
                }
              }}
              placeholder="Escribe tu mensaje para iniciar o continuar la conversación con el modelo."
              required
              disabled={!chatEnabled || isSending}
            />
          </label>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--muted)]">
              {chatEnabled
                ? "Enter envía. Shift+Enter agrega una nueva línea."
                : "Completa la configuración del proveedor en variables de entorno para habilitar el chat."}
            </p>
            <button
              type="submit"
              className="button-primary"
              disabled={!chatEnabled || isSending || draft.trim().length === 0}
            >
              {isSending ? "Sending..." : "Send"}
            </button>
          </div>

          {errorMessage ? (
            <div className="mt-4 rounded-[1.25rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}
        </form>

        <section className="surface rounded-[1.75rem] p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Conversation turns</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Primer clic: ancla. Segundo clic: define el rango consecutivo para review manual.
            </p>
          </div>
          <button
            type="button"
            className="button-secondary"
            onClick={() => {
              setAnchorIndex(null);
              setFocusIndex(null);
            }}
          >
            Clear selection
          </button>
        </div>

          <div ref={messagesRef} className="flex max-h-[52rem] flex-col gap-3 overflow-y-auto pr-1">
          {messages.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-[var(--line)] px-5 py-8 text-sm text-[var(--muted)]">
              Esta sesión todavía no tiene conversación. Envía un mensaje para generar el primer intercambio con el modelo.
            </div>
          ) : null}

          {messages.map((message) => {
            const isSelected =
              selectionRange !== null &&
              message.orderIndex >= selectionRange.start &&
              message.orderIndex <= selectionRange.end;

            return (
              <button
                key={message.id}
                type="button"
                onClick={() => handleSelect(message.orderIndex)}
                className={cn(
                  "rounded-[1.5rem] border p-4 text-left transition duration-150 hover:-translate-y-0.5",
                  message.role === "user"
                    ? "ml-0 bg-[var(--user-bubble)]"
                    : "ml-4 bg-[var(--assistant-bubble)]",
                  isSelected
                    ? "border-amber-300 bg-[var(--selection)] ring-2 ring-amber-200"
                    : "border-[var(--line)]",
                )}
              >
                <div className="mb-2 flex items-center justify-between gap-4 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  <span>
                    {message.role} • Turn {message.orderIndex + 1}
                  </span>
                  <span className="mono normal-case tracking-normal">
                    {formatDate(message.createdAt)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-7 text-slate-800">
                  {message.text}
                </p>
              </button>
            );
          })}
          </div>
        </section>
      </section>

      <aside className="surface rounded-[1.75rem] p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Selection summary</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Conversa primero con el modelo y luego etiqueta solo el slice que quieras conservar.
        </p>

        <div className="mt-5 rounded-[1.5rem] border border-[var(--line)] bg-white/65 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
            Consecutive slice
          </p>
          <p className="mt-2 text-sm font-semibold">
            {selectionRange
              ? `Turnos ${selectionRange.start + 1} a ${selectionRange.end + 1}`
              : "Sin selección"}
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {selectedMessages.length} turno(s) listo(s) para etiquetar.
          </p>
        </div>

        <div className="mt-5 space-y-3">
          {selectedMessages.map((message) => (
            <div key={message.id} className="rounded-2xl border border-[var(--line)] bg-white/60 p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                {message.role}
              </p>
              <p className="mt-2 line-clamp-3 text-sm leading-6">{message.text}</p>
            </div>
          ))}
        </div>

        <Link
          href={caseHref}
          aria-disabled={!selectionRange}
          className={cn(
            "mt-6 inline-flex w-full items-center justify-center rounded-full px-4 py-3 text-sm font-semibold",
            selectionRange
              ? "button-primary"
              : "cursor-not-allowed bg-slate-300 text-slate-500",
          )}
        >
          Create Case from Selection
        </Link>
      </aside>
    </div>
  );
}