"use client";

import Link from "next/link";
import { startTransition, useEffect, useRef, useState } from "react";
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
import { StatusBadge } from "@/components/status-badge";
import { useToast } from "@/components/toast-provider";
import { cn, formatDate } from "@/lib/utils";

type SelectableMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  orderIndex: number;
  createdAt: string;
};

type SessionCasePreview = {
  id: string;
  title: string;
  status: string;
  lastUserMessage: string;
  updatedAt: string;
};

type ConfirmState =
  | {
      action: "clear-chat" | "delete-session";
      title: string;
      description: string;
      confirmLabel: string;
      tone: "warning" | "danger";
    }
  | null;

type SessionSelectionProps = {
  projectId: string;
  sessionId: string;
  projectName: string;
  sessionTitle: string;
  sessionCreatedAt: string;
  messages: SelectableMessage[];
  recentCases: SessionCasePreview[];
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
  projectName,
  sessionTitle,
  sessionCreatedAt,
  messages,
  recentCases,
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
  const { pushToast } = useToast();
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
  const [activePanel, setActivePanel] = useState<"cases" | "settings" | null>(null);
  const [contextTab, setContextTab] = useState<"selection" | "cases">("selection");
  const [toolsOpen, setToolsOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);

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

  const selectionPreview = selectedMessages.slice(0, 6);
  const hasBlockingOverlay = activePanel !== null || confirmState !== null;
  const caseHref = selectionRange
    ? `/projects/${projectId}/sessions/${sessionId}/cases/new?start=${selectionRange.start}&end=${selectionRange.end}`
    : "#";
  const caseLibraryHref = `/cases?projectId=${projectId}`;

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

  useEffect(() => {
    if (!hasBlockingOverlay) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [hasBlockingOverlay]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      if (confirmState) {
        setConfirmState(null);
        return;
      }

      if (activePanel) {
        setActivePanel(null);
        return;
      }

      if (toolsOpen) {
        setToolsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activePanel, confirmState, toolsOpen]);

  useEffect(() => {
    if (!toolsOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (toolsRef.current?.contains(event.target as Node)) {
        return;
      }

      setToolsOpen(false);
    };

    window.addEventListener("mousedown", handlePointerDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [toolsOpen]);

  const modelIsDirty = chatModelDraft.trim() !== chatModel.trim();
  const promptIsDirty = systemPromptDraft.trim() !== systemPrompt.trim();
  const chatModelIsConfigured = chatModelDraft.trim().length > 0;
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

  function clearSelection() {
    setAnchorIndex(null);
    setFocusIndex(null);
  }

  function handleSelect(orderIndex: number) {
    if (anchorIndex === null) {
      setAnchorIndex(orderIndex);
      setFocusIndex(orderIndex);
      return;
    }

    setFocusIndex(orderIndex);
  }

  function openCasesPanel() {
    setContextTab(selectionRange ? "selection" : "cases");
    setActivePanel("cases");
    setToolsOpen(false);
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
        durationMs: 5000,
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
        durationMs: 5000,
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
        durationMs: 5000,
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
        title: systemPromptDraft.trim() ? "Prompt guardado" : "Prompt eliminado",
        description: systemPromptDraft.trim()
          ? "La sesión usará este prompt de comportamiento en los siguientes turnos."
          : "La sesión volvió a conversar sin prompt adicional.",
        variant: "success",
        durationMs: 5000,
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

    setConfirmState(null);
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

      clearSelection();
      setDraft("");
      pushToast({
        title: "Chat limpiado",
        description: result.message,
        variant: "success",
        durationMs: 5000,
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

    setConfirmState(null);
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
        durationMs: 5000,
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

  const connectionSummary = chatEnabled
    ? "Listo para conversar"
    : chatConnectionError
      ? "Revisar conexión"
      : !chatModelIsConfigured
        ? "Modelo pendiente"
        : !chatConnectionVerifiedAt
          ? "Prueba pendiente"
          : modelIsDirty
            ? "Cambios sin guardar"
            : "Chat pausado";

  return (
    <>
      <section className="surface relative flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-none border-y border-x-0">
        <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_right,rgba(15,95,92,0.16),transparent_44%)]" />

        <header className="theme-strong-surface relative border-b border-[var(--line)] px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <Link
                href={`/projects/${projectId}`}
                className="text-sm text-[var(--muted)] underline underline-offset-4"
              >
                Back to project
              </Link>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight sm:text-[2rem]">
                  {sessionTitle}
                </h1>
                <StatusPill tone={chatEnabled ? "success" : "warning"} label={connectionSummary} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[var(--muted)]">
                <span>Proyecto: {projectName}</span>
                <span>{formatDate(sessionCreatedAt)}</span>
                <span>{messages.length} mensaje(s)</span>
                <span>{caseCount} caso(s)</span>
                <span className="break-all">{chatProviderLabel}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-start gap-3 xl:justify-end">
              {selectionRange ? (
                <button
                  type="button"
                  className="button-secondary"
                  onClick={clearSelection}
                >
                  Limpiar selección
                </button>
              ) : null}

              <button type="button" className="button-secondary" onClick={openCasesPanel}>
                Casos y selección
              </button>

              <button
                type="button"
                className="button-secondary"
                onClick={() => {
                  setToolsOpen(false);
                  setActivePanel("settings");
                }}
              >
                Configuración LLM
              </button>

              <div ref={toolsRef} className="relative">
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setToolsOpen((currentValue) => !currentValue)}
                  aria-expanded={toolsOpen}
                >
                  Herramientas
                </button>

                {toolsOpen ? (
                  <div className="theme-drawer absolute right-0 top-[calc(100%+0.75rem)] z-30 w-[calc(100vw-2rem)] max-w-80 rounded-[1.25rem] border border-[var(--line)] p-2">
                    <div className="rounded-[1rem] px-3 py-2 text-sm text-[var(--muted)]">
                      Acciones de baja frecuencia para esta sesión.
                    </div>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-[1rem] px-3 py-3 text-left text-sm font-medium transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => {
                        setToolsOpen(false);
                        setConfirmState({
                          action: "clear-chat",
                          title: "Limpiar toda la conversación",
                          description:
                            caseCount > 0
                              ? "Esto eliminará todos los mensajes de esta sesión, pero conservará los casos ya guardados."
                              : "Esto eliminará todos los mensajes de esta sesión.",
                          confirmLabel: "Limpiar chat",
                          tone: "warning",
                        });
                      }}
                      disabled={isClearingChat || isDeletingSession || messages.length === 0}
                    >
                      <span>Limpiar chat</span>
                      <span className="text-[var(--muted)]">Mantiene la sesión</span>
                    </button>
                    <Link
                      href={caseLibraryHref}
                      className="flex items-center justify-between rounded-[1rem] px-3 py-3 text-sm font-medium transition hover:bg-black/5"
                      onClick={() => setToolsOpen(false)}
                    >
                      <span>Biblioteca de casos</span>
                      <span className="text-[var(--muted)]">Abrir</span>
                    </Link>
                    <button
                      type="button"
                      className="mt-1 flex w-full items-center justify-between rounded-[1rem] bg-rose-600 px-3 py-3 text-left text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => {
                        setToolsOpen(false);
                        setConfirmState({
                          action: "delete-session",
                          title: "Eliminar chat por completo",
                          description:
                            caseCount > 0
                              ? `Esto eliminará la sesión completa junto con ${caseCount} caso(s) asociado(s). Esta acción no se puede deshacer.`
                              : "Esto eliminará la sesión completa. Esta acción no se puede deshacer.",
                          confirmLabel: "Eliminar chat",
                          tone: "danger",
                        });
                      }}
                      disabled={isDeletingSession || isClearingChat}
                    >
                      <span>Eliminar chat</span>
                      <span className="text-rose-100">Permanente</span>
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <MetricChip label="Modelo" value={chatModel || "Sin definir"} />
            <MetricChip label="Conexión" value={chatConnectionVerifiedAt ? "Verificada" : "Pendiente"} />
            <MetricChip label="Base URL" value={chatBaseUrl || "https://api.openai.com/v1"} truncate />
            {selectionRange ? (
              <button
                type="button"
                className="rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
                onClick={openCasesPanel}
              >
                Turnos {selectionRange.start + 1} a {selectionRange.end + 1} seleccionados
              </button>
            ) : (
              <span className="rounded-full border border-[var(--line)] bg-white/65 px-4 py-2 text-sm text-[var(--muted)]">
                Selecciona mensajes directamente en el transcript para crear un caso.
              </span>
            )}
          </div>
        </header>

        {errorMessage ? (
          <div className="relative border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:px-6 lg:px-8">
            {errorMessage}
          </div>
        ) : null}

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div
            ref={messagesRef}
            className="flex h-full min-w-0 w-full flex-col gap-4 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8"
          >
            {messages.length === 0 ? (
              <div className="theme-soft-surface mx-auto flex min-h-full w-full max-w-3xl flex-1 items-center justify-center rounded-[2rem] border border-dashed border-[var(--line)] px-6 py-16 text-center text-sm leading-7 text-[var(--muted)]">
                Esta sesión todavía no tiene conversación. Configura el modelo si hace falta y envía el primer mensaje desde el compositor inferior.
              </div>
            ) : null}

            {messages.map((message) => {
              const isSelected =
                selectionRange !== null &&
                message.orderIndex >= selectionRange.start &&
                message.orderIndex <= selectionRange.end;

              return (
                <div
                  key={message.id}
                  className={cn(
                    "flex w-full",
                    message.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => handleSelect(message.orderIndex)}
                    aria-pressed={isSelected}
                    className={cn(
                      "group relative w-full max-w-3xl rounded-[1.75rem] border px-4 py-4 text-left shadow-[0_12px_32px_rgba(15,23,42,0.06)] transition duration-150 hover:-translate-y-0.5 sm:px-5",
                      message.role === "user"
                        ? "bg-[var(--user-bubble)]"
                        : "bg-[var(--assistant-bubble)]",
                      isSelected
                        ? "border-amber-300 ring-2 ring-amber-200"
                        : "border-[var(--line)] hover:border-[var(--accent)]",
                    )}
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-1 text-[10px] font-semibold",
                            message.role === "user"
                              ? "bg-white/75 text-[var(--foreground)]"
                              : "bg-[rgba(15,95,92,0.12)] text-[var(--accent-strong)]",
                          )}
                        >
                          {message.role === "user" ? "Usuario" : "Asistente"}
                        </span>
                        <span>Turno {message.orderIndex + 1}</span>
                      </div>
                      <span className="mono normal-case tracking-normal">{formatDate(message.createdAt)}</span>
                    </div>

                    <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--muted-strong)] sm:text-[15px]">
                      {message.text}
                    </p>

                    {isSelected ? (
                      <div className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-amber-900">
                        Incluido en la selección actual
                      </div>
                    ) : null}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <footer className="theme-strong-surface relative border-t border-[var(--line)] px-4 py-4 sm:px-6 lg:px-8">
          <div className="w-full min-w-0">
            {selectionRange ? (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <div>
                  <p className="font-semibold">
                    Slice activo: turnos {selectionRange.start + 1} a {selectionRange.end + 1}
                  </p>
                  <p className="mt-1 text-amber-800">
                    {selectedMessages.length} mensaje(s) listo(s) para revisar o convertir en caso.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button type="button" className="button-secondary" onClick={openCasesPanel}>
                    Ver preview
                  </button>
                  <Link
                    href={caseHref}
                    className="button-primary inline-flex items-center justify-center"
                    onClick={(event) => {
                      if (!selectionRange) {
                        event.preventDefault();
                      }
                    }}
                  >
                    Crear caso
                  </Link>
                </div>
              </div>
            ) : null}

            {!chatEnabled ? (
              <div className="mb-3 rounded-[1.5rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {chatAvailabilityMessage}
              </div>
            ) : null}

            <form ref={formRef} onSubmit={handleSubmit} className="rounded-[1.75rem] border border-[var(--line)] bg-white/80 p-3 shadow-[0_12px_36px_rgba(15,23,42,0.08)] backdrop-blur">
              <textarea
                ref={textareaRef}
                className="min-h-7 w-full resize-none bg-transparent px-2 py-1 text-sm leading-5 text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    formRef.current?.requestSubmit();
                  }
                }}
                placeholder="Escribe aquí para conversar con el modelo. Enter envía, Shift+Enter agrega otra línea."
                required
                disabled={!chatEnabled || isSending || isClearingChat || isDeletingSession}
              />

              <div className="mt-3 flex flex-col gap-3 border-t border-[var(--line)] px-2 pt-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="text-sm text-[var(--muted)]">
                  {chatEnabled ? chatAvailabilityMessage : "Abre la configuración LLM si necesitas ajustar modelo, conexión o prompt de comportamiento."}
                </div>
                <button
                  type="submit"
                  className="button-primary inline-flex items-center justify-center"
                  disabled={
                    !chatEnabled ||
                    isSending ||
                    isClearingChat ||
                    isDeletingSession ||
                    draft.trim().length === 0
                  }
                >
                  {isSending ? "Enviando..." : "Enviar mensaje"}
                </button>
              </div>
            </form>
          </div>
        </footer>
      </section>

      <SideDrawer
        open={activePanel === "cases"}
        title="Casos y selección"
        description="Revisa el slice activo y consulta los casos recientes sin sacrificar espacio del transcript."
        onClose={() => setActivePanel(null)}
      >
        <div className="space-y-6">
          <DrawerTabs
            value={contextTab}
            options={[
              { id: "selection", label: "Selección actual" },
              { id: "cases", label: "Casos recientes" },
            ]}
            onChange={setContextTab}
          />

          {contextTab === "selection" ? (
            <div className="space-y-5">
              <div className="rounded-[1.5rem] border border-[var(--line)] bg-white/65 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  Slice consecutivo
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {selectionRange
                    ? `Turnos ${selectionRange.start + 1} a ${selectionRange.end + 1}`
                    : "Sin selección activa"}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  {selectionRange
                    ? `${selectedMessages.length} mensaje(s) listo(s) para revisión manual o creación de caso.`
                    : "Selecciona mensajes directamente desde el transcript para generar un slice consecutivo."}
                </p>

                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    href={caseHref}
                    aria-disabled={!selectionRange}
                    className={cn(
                      "inline-flex items-center justify-center rounded-full px-4 py-3 text-sm font-semibold",
                      selectionRange
                        ? "button-primary"
                        : "cursor-not-allowed bg-slate-300 text-slate-500",
                    )}
                    onClick={(event) => {
                      if (!selectionRange) {
                        event.preventDefault();
                      }
                    }}
                  >
                    Crear caso desde selección
                  </Link>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={clearSelection}
                    disabled={!selectionRange}
                  >
                    Limpiar selección
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {selectionPreview.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-dashed border-[var(--line)] px-4 py-6 text-sm text-[var(--muted)]">
                    Todavía no hay mensajes seleccionados para preview.
                  </div>
                ) : null}

                {selectionPreview.map((message) => (
                  <article key={message.id} className="rounded-[1.5rem] border border-[var(--line)] bg-white/70 p-4">
                    <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                      <span>{message.role === "user" ? "Usuario" : "Asistente"}</span>
                      <span className="mono normal-case tracking-normal">
                        {formatDate(message.createdAt)}
                      </span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--muted-strong)]">
                      {message.text}
                    </p>
                  </article>
                ))}

                {selectedMessages.length > selectionPreview.length ? (
                  <p className="text-sm text-[var(--muted)]">
                    Mostrando {selectionPreview.length} de {selectedMessages.length} mensaje(s) seleccionados.
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-[var(--muted)]">
                  {caseCount === 0
                    ? "Esta sesión todavía no tiene casos guardados."
                    : `${caseCount} caso(s) asociado(s) a esta sesión.`}
                </p>
                <Link href={caseLibraryHref} className="button-secondary">
                  Abrir biblioteca
                </Link>
              </div>

              {recentCases.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-[var(--line)] px-4 py-6 text-sm text-[var(--muted)]">
                  Todavía no se han guardado casos para esta sesión.
                </div>
              ) : null}

              {recentCases.map((caseItem) => (
                <article key={caseItem.id} className="rounded-[1.5rem] border border-[var(--line)] bg-white/70 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-base font-semibold">{caseItem.title}</h3>
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        Updated {formatDate(caseItem.updatedAt)}
                      </p>
                    </div>
                    <StatusBadge status={caseItem.status} />
                  </div>
                  <p className="mt-4 line-clamp-4 text-sm leading-7 text-[var(--muted-strong)]">
                    {caseItem.lastUserMessage}
                  </p>
                  <Link href={`/cases/${caseItem.id}`} className="button-primary mt-5 inline-flex">
                    Abrir caso
                  </Link>
                </article>
              ))}

              {caseCount > recentCases.length ? (
                <p className="text-sm text-[var(--muted)]">
                  Mostrando {recentCases.length} caso(s) reciente(s). Usa la biblioteca para ver el resto.
                </p>
              ) : null}
            </div>
          )}
        </div>
      </SideDrawer>

      <CenteredSheet
        open={activePanel === "settings"}
        title="Configuración y test del modelo"
        description="Ajusta el modelo, verifica la conexión y define el prompt de comportamiento sin sacar al transcript del foco principal."
        onClose={() => setActivePanel(null)}
      >
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-3">
            <InfoCard label="Proveedor" value={chatProviderLabel} />
            <InfoCard label="Modelo guardado" value={chatModel || "Sin definir"} />
            <InfoCard label="Base URL" value={chatBaseUrl || "https://api.openai.com/v1"} compact />
          </div>

          <label className="block space-y-2">
            <FormLabel>Chat model</FormLabel>
            <input
              className="field"
              value={chatModelDraft}
              onChange={(event) => setChatModelDraft(event.target.value)}
              placeholder="Ejemplo: gpt-5-mini o el identificador expuesto por tu backend"
              disabled={isSavingModel || isTestingConnection}
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[1.5rem] border border-[var(--line)] bg-white/60 p-4">
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
                {isSavingModel ? "Guardando modelo..." : "Guardar modelo"}
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
                {isTestingConnection ? "Probando..." : "Probar conexión"}
              </button>
            </div>
          </div>

          <div
            className={cn(
              "rounded-[1.5rem] border px-4 py-3 text-sm",
              chatEnabled
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-amber-200 bg-amber-50 text-amber-900",
            )}
          >
            {chatEnabled
              ? "El chat está habilitado para este modelo verificado."
              : chatAvailabilityMessage}
          </div>

          <label className="block space-y-2">
            <FormLabel>Behavior prompt (optional)</FormLabel>
            <textarea
              className="field min-h-36"
              value={systemPromptDraft}
              onChange={(event) => setSystemPromptDraft(event.target.value)}
              placeholder="Déjalo vacío para conversar sin prompt adicional. Si lo completas, se aplicará como instrucción de sistema en los siguientes turnos."
              disabled={isSavingPrompt}
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3">
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
              {isSavingPrompt ? "Guardando prompt..." : "Guardar prompt"}
            </button>
          </div>
        </div>
      </CenteredSheet>

      <ConfirmationModal
        state={confirmState}
        isBusy={isClearingChat || isDeletingSession}
        onCancel={() => setConfirmState(null)}
        onConfirm={() => {
          if (confirmState?.action === "clear-chat") {
            void handleClearChat();
            return;
          }

          if (confirmState?.action === "delete-session") {
            void handleDeleteSession();
          }
        }}
      />
    </>
  );
}

function MetricChip({
  label,
  value,
  truncate = false,
}: {
  label: string;
  value: string;
  truncate?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-2 rounded-full border border-[var(--line)] bg-white/65 px-4 py-2 text-sm text-[var(--muted)]",
        truncate ? "min-w-0" : "",
      )}
    >
      <span className="font-semibold text-[var(--foreground)]">{label}:</span>
      <span className={cn(truncate ? "truncate" : "")}>{value}</span>
    </span>
  );
}

function InfoCard({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-[1.5rem] border border-[var(--line)] bg-white/60 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
      <p className={cn("mt-2 font-semibold text-[var(--foreground)]", compact ? "break-all text-sm" : "text-base")}>
        {value}
      </p>
    </div>
  );
}

function StatusPill({
  tone,
  label,
}: {
  tone: "success" | "warning";
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1.5 text-sm font-semibold",
        tone === "success"
          ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border border-amber-200 bg-amber-50 text-amber-900",
      )}
    >
      {label}
    </span>
  );
}

function DrawerTabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: ReadonlyArray<{ id: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={cn(
            "rounded-full px-3 py-1.5 text-sm font-medium transition",
            value === option.id
              ? "bg-[var(--accent)] text-white"
              : "theme-strong-surface border border-[var(--line)] text-[var(--muted)] hover:text-[var(--foreground)]",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function SideDrawer({
  open,
  title,
  description,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="theme-overlay fixed inset-0 z-50 flex items-stretch justify-end backdrop-blur-[1px]">
      <button type="button" aria-label="Cerrar panel" className="flex-1" onClick={onClose} />
      <div className="theme-drawer relative flex h-full w-full max-w-full flex-col border-l border-[var(--line)] sm:max-w-[32rem]">
        <div className="border-b border-[var(--line)] px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                Panel contextual
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                {title}
              </h2>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{description}</p>
            </div>
            <button type="button" className="button-secondary" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
      </div>
    </div>
  );
}

function CenteredSheet({
  open,
  title,
  description,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="theme-overlay fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-[1px] sm:p-6">
      <button type="button" aria-label="Cerrar panel" className="absolute inset-0" onClick={onClose} />
      <div className="theme-drawer relative flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border border-[var(--line)] sm:max-h-[56rem]">
        <div className="border-b border-[var(--line)] px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                Configuración LLM
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                {title}
              </h2>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{description}</p>
            </div>
            <button type="button" className="button-secondary" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
      </div>
    </div>
  );
}

function ConfirmationModal({
  state,
  isBusy,
  onCancel,
  onConfirm,
}: {
  state: ConfirmState;
  isBusy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!state) {
    return null;
  }

  return (
    <div className="theme-overlay fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-[1px] sm:p-6">
      <button type="button" aria-label="Cerrar confirmación" className="absolute inset-0" onClick={onCancel} />
      <div className="theme-drawer relative w-full max-w-lg rounded-[2rem] border border-[var(--line)] p-6 shadow-[0_20px_56px_rgba(15,23,42,0.24)] sm:p-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
          Confirmación requerida
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          {state.title}
        </h2>
        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{state.description}</p>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" className="button-secondary" onClick={onCancel} disabled={isBusy}>
            Cancelar
          </button>
          <button
            type="button"
            className={state.tone === "danger" ? "button-danger" : "button-primary"}
            onClick={onConfirm}
            disabled={isBusy}
          >
            {isBusy ? "Procesando..." : state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}