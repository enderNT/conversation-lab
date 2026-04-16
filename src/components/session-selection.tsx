"use client";

import Link from "next/link";
import { useEffect, useRef, useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import {
  clearSessionChat,
  deleteSession,
  sendSessionMessage,
  updateSessionChatModel,
  updateSessionSystemPrompt,
  verifySessionChatConnection,
} from "@/app/actions";
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
  chatRuntimeEnabled: boolean;
  chatRuntimeDisabledReason: string | null;
  chatProviderLabel: string;
  chatBaseUrl: string | null;
  chatConnectionCheckedAt: string | null;
  chatConnectionVerifiedAt: string | null;
  chatConnectionError: string | null;
  caseCount: number;
  systemPrompt: string;
};

export function SessionSelection({
  projectId,
  sessionId,
  messages,
  chatModel,
  chatRuntimeEnabled,
  chatRuntimeDisabledReason,
  chatProviderLabel,
  chatBaseUrl,
  chatConnectionCheckedAt,
  chatConnectionVerifiedAt,
  chatConnectionError,
  caseCount,
  systemPrompt,
}: SessionSelectionProps) {
  const router = useRouter();
  const [anchorIndex, setAnchorIndex] = useState<number | null>(null);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [chatModelDraft, setChatModelDraft] = useState(chatModel);
  const [systemPromptDraft, setSystemPromptDraft] = useState(systemPrompt);
  const [isSending, setIsSending] = useState(false);
  const [isSavingModel, setIsSavingModel] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [isClearingChat, setIsClearingChat] = useState(false);
  const [isDeletingSession, setIsDeletingSession] = useState(false);
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
    setChatModelDraft(chatModel);
  }, [chatModel]);

  useEffect(() => {
    setSystemPromptDraft(systemPrompt);
  }, [systemPrompt]);

  const modelIsDirty = chatModelDraft.trim() !== chatModel.trim();
  const chatModelIsConfigured = chatModel.trim().length > 0;
  const chatConnectionIsVerified = Boolean(chatConnectionVerifiedAt) && !chatConnectionError;
  const chatEnabled =
    chatRuntimeEnabled &&
    chatModelIsConfigured &&
    chatConnectionIsVerified &&
    !modelIsDirty;

  const chatAvailabilityMessage = !chatRuntimeEnabled
    ? chatRuntimeDisabledReason || "La configuración del proveedor no es válida."
    : modelIsDirty
      ? "Guarda o vuelve a probar el modelo antes de enviar mensajes."
      : !chatModelIsConfigured
        ? "Define un modelo para esta sesión antes de habilitar el chat."
        : chatConnectionError
          ? "La última prueba de conexión falló. Corrige el modelo o el backend y vuelve a probar."
          : !chatConnectionVerifiedAt
            ? "Prueba la conexión del modelo antes de usar el chat."
            : "Enter envía. Shift+Enter agrega una nueva línea.";

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

  async function handleSaveChatModel() {
    if (isSavingModel) {
      return;
    }

    setIsSavingModel(true);

    try {
      const result = await updateSessionChatModel(projectId, sessionId, {
        chatModel: chatModelDraft,
      });

      if (!result.ok) {
        pushToast({
          title: "No fue posible guardar el modelo",
          description: result.error,
          variant: "error",
          durationMs: 7000,
        });
        return;
      }

      pushToast({
        title: chatModelDraft.trim() ? "Modelo guardado" : "Modelo eliminado",
        description: chatModelDraft.trim()
          ? "La sesión guardó el modelo y dejó pendiente una nueva verificación de conexión."
          : "La sesión quedó sin modelo configurado.",
        variant: "success",
        durationMs: 7000,
      });

      startTransition(() => {
        router.refresh();
      });
    } catch {
      pushToast({
        title: "No fue posible guardar el modelo",
        description: "No fue posible actualizar el modelo configurado para esta sesión.",
        variant: "error",
        durationMs: 7000,
      });
    } finally {
      setIsSavingModel(false);
    }
  }

  async function handleVerifyConnection() {
    if (isTestingConnection) {
      return;
    }

    setIsTestingConnection(true);

    try {
      const result = await verifySessionChatConnection(projectId, sessionId, {
        chatModel: chatModelDraft,
      });

      if (!result.ok) {
        pushToast({
          title: "Conexión no verificada",
          description: result.error,
          variant: "error",
          durationMs: 8000,
        });
        return;
      }

      pushToast({
        title: "Conexión verificada",
        description: result.message,
        variant: "success",
        durationMs: 7000,
      });

      startTransition(() => {
        router.refresh();
      });
    } catch {
      pushToast({
        title: "Conexión no verificada",
        description: "No fue posible comprobar la conexión con el proveedor del chat.",
        variant: "error",
        durationMs: 8000,
      });
    } finally {
      setIsTestingConnection(false);
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

  async function handleClearChat() {
    if (isClearingChat || messages.length === 0) {
      return;
    }

    const shouldClear = window.confirm(
      caseCount > 0
        ? "Esto eliminará todos los mensajes de esta sesión, pero conservará los casos ya guardados. ¿Quieres continuar?"
        : "Esto eliminará todos los mensajes de esta sesión. ¿Quieres continuar?",
    );

    if (!shouldClear) {
      return;
    }

    setIsClearingChat(true);
    setErrorMessage(null);

    try {
      const result = await clearSessionChat(projectId, sessionId);

      if (!result.ok) {
        pushToast({
          title: "No fue posible limpiar el chat",
          description: result.error,
          variant: "error",
          durationMs: 7000,
        });
        return;
      }

      setAnchorIndex(null);
      setFocusIndex(null);
      setDraft("");
      pushToast({
        title: "Chat limpiado",
        description: result.message,
        variant: "success",
        durationMs: 7000,
      });

      startTransition(() => {
        router.refresh();
      });
    } catch {
      pushToast({
        title: "No fue posible limpiar el chat",
        description: "No fue posible eliminar los mensajes de la sesión.",
        variant: "error",
        durationMs: 7000,
      });
    } finally {
      setIsClearingChat(false);
    }
  }

  async function handleDeleteSession() {
    if (isDeletingSession) {
      return;
    }

    const shouldDelete = window.confirm(
      caseCount > 0
        ? `Esto eliminará la sesión completa junto con ${caseCount} caso(s) asociado(s). Esta acción no se puede deshacer. ¿Quieres continuar?`
        : "Esto eliminará la sesión completa. Esta acción no se puede deshacer. ¿Quieres continuar?",
    );

    if (!shouldDelete) {
      return;
    }

    setIsDeletingSession(true);
    setErrorMessage(null);

    try {
      const result = await deleteSession(projectId, sessionId);

      if (!result.ok) {
        pushToast({
          title: "No fue posible eliminar el chat",
          description: result.error,
          variant: "error",
          durationMs: 7000,
        });
        return;
      }

      pushToast({
        title: "Chat eliminado",
        description: result.message,
        variant: "success",
        durationMs: 7000,
      });

      startTransition(() => {
        router.push(result.redirectTo);
      });
    } catch {
      pushToast({
        title: "No fue posible eliminar el chat",
        description: "No fue posible eliminar la sesión seleccionada.",
        variant: "error",
        durationMs: 7000,
      });
    } finally {
      setIsDeletingSession(false);
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
              <p className="mt-1">Modelo guardado: {chatModel || "Sin definir"}</p>
              <p className="mt-1 break-all">
                Base URL: {chatBaseUrl || "https://api.openai.com/v1"}
              </p>
            </div>
          </div>

          <label className="mt-5 block space-y-2">
            <FormLabel>Chat model</FormLabel>
            <input
              className="field"
              value={chatModelDraft}
              onChange={(event) => setChatModelDraft(event.target.value)}
              placeholder="Ejemplo: gpt-5-mini o el identificador expuesto por tu backend"
              disabled={isSavingModel || isTestingConnection}
            />
          </label>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-[var(--muted)]">
              {chatConnectionVerifiedAt ? (
                <p>Conexión verificada: {formatDate(chatConnectionVerifiedAt)}</p>
              ) : chatConnectionCheckedAt ? (
                <p>Última prueba: {formatDate(chatConnectionCheckedAt)}</p>
              ) : (
                <p>Esta sesión todavía no verificó la conexión del chat.</p>
              )}
              {chatConnectionError ? (
                <p className="mt-1 text-rose-700">{chatConnectionError}</p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="button-secondary"
                onClick={() => {
                  void handleSaveChatModel();
                }}
                disabled={isSavingModel || isTestingConnection || !modelIsDirty}
              >
                {isSavingModel ? "Saving model..." : "Save model"}
              </button>
              <button
                type="button"
                className="button-primary"
                onClick={() => {
                  void handleVerifyConnection();
                }}
                disabled={
                  isSavingModel ||
                  isTestingConnection ||
                  !chatRuntimeEnabled ||
                  chatModelDraft.trim().length === 0
                }
              >
                {isTestingConnection ? "Testing..." : "Test connection"}
              </button>
            </div>
          </div>

          <div
            className={cn(
              "mt-4 rounded-[1.25rem] border px-4 py-3 text-sm",
              chatEnabled
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-amber-200 bg-amber-50 text-amber-900",
            )}
          >
            {chatEnabled
              ? "El chat está habilitado para este modelo verificado."
              : chatAvailabilityMessage}
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
              disabled={!chatEnabled || isSending || isClearingChat || isDeletingSession}
            />
          </label>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--muted)]">
              {chatAvailabilityMessage}
            </p>
            <button
              type="submit"
              className="button-primary"
              disabled={
                !chatEnabled ||
                isSending ||
                isClearingChat ||
                isDeletingSession ||
                draft.trim().length === 0
              }
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

        <section className="mt-6 rounded-[1.5rem] border border-rose-200 bg-rose-50/70 p-4 text-rose-900">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em]">Danger zone</h3>
          <p className="mt-2 text-sm leading-6 opacity-85">
            Puedes vaciar la conversación manteniendo la sesión, o eliminar la sesión completa.
          </p>
          <div className="mt-4 space-y-3">
            <button
              type="button"
              className="w-full rounded-full border border-rose-300 px-4 py-3 text-sm font-semibold text-rose-900 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => {
                void handleClearChat();
              }}
              disabled={isClearingChat || isDeletingSession || messages.length === 0}
            >
              {isClearingChat ? "Limpiando chat..." : "Limpiar chat"}
            </button>
            <button
              type="button"
              className="w-full rounded-full bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => {
                void handleDeleteSession();
              }}
              disabled={isDeletingSession || isClearingChat}
            >
              {isDeletingSession ? "Eliminando chat..." : "Eliminar chat"}
            </button>
          </div>
        </section>
      </aside>
    </div>
  );
}