"use client";

import Link from "next/link";
import { startTransition, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  clearSessionChat,
  createLlmConfiguration,
  deleteSession,
  retryLastAssistantMessage,
  sendSessionMessage,
  updateSessionMessage,
  updateSessionChatModel,
  updateSessionNotes,
  updateSessionSystemPrompt,
  verifySessionChatConnection,
} from "@/app/actions";
import { FormLabel } from "@/components/form-label";
import { SessionTagPicker } from "@/components/session-tag-picker";
import { SourceSliceDeleteButton } from "@/components/source-slice-delete-button";
import { StatusBadge } from "@/components/status-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/components/toast-provider";
import { cn, formatDate } from "@/lib/utils";

type SelectableMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  orderIndex: number;
  createdAt: string;
  isEdited: boolean;
};

type SessionCasePreview = {
  id: string;
  title: string;
  status: string;
  lastUserMessage: string;
  updatedAt: string;
};

type SavedSourceSlicePreview = {
  id: string;
  title: string;
  lastUserMessage: string;
  sourceSummary: string;
  updatedAt: string;
  linkedExampleCount: number;
  turnCount: number;
};

type SessionHistoryPreview = {
  id: string;
  title: string;
  createdAt: string;
  messageCount: number;
  caseCount: number;
  tags: Array<{ id: string; name: string }>;
};

type SavedLlmConfiguration = {
  id: string;
  name: string;
  chatModel: string;
  chatBaseUrl: string;
  chatApiKey: string;
  systemPrompt: string;
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

type EditConflictState = {
  nextMessageId: string;
} | null;

type FloatingMenuPosition = {
  top: number;
  left: number;
  width: number;
};

type SessionSelectionProps = {
  projectId: string;
  sessionId: string;
  projectName: string;
  sessionTitle: string;
  sessionHistory: SessionHistoryPreview[];
  sessionTags: Array<{ id: string; name: string }>;
  availableSessionTags: Array<{ id: string; name: string }>;
  messages: SelectableMessage[];
  recentCases: SessionCasePreview[];
  savedSlices: SavedSourceSlicePreview[];
  savedLlmConfigurations: SavedLlmConfiguration[];
  chatModel: string;
  chatRuntimeEnabled: boolean;
  chatRuntimeDisabledReason: string | null;
  chatProviderLabel: string;
  chatBaseUrl: string;
  chatApiKey: string;
  chatResolvedBaseUrl: string | null;
  chatConnectionCheckedAt: string | null;
  chatConnectionVerifiedAt: string | null;
  chatConnectionError: string | null;
  caseCount: number;
  curationNotes: string;
  systemPrompt: string;
};

export function SessionSelection({
  projectId,
  sessionId,
  projectName = "",
  sessionTitle = "",
  sessionHistory = [],
  sessionTags = [],
  availableSessionTags = [],
  messages = [],
  recentCases = [],
  savedSlices = [],
  savedLlmConfigurations = [],
  chatModel = "",
  chatRuntimeEnabled,
  chatRuntimeDisabledReason = null,
  chatProviderLabel = "",
  chatBaseUrl = "",
  chatApiKey = "",
  chatResolvedBaseUrl = null,
  chatConnectionCheckedAt = null,
  chatConnectionVerifiedAt = null,
  chatConnectionError = null,
  caseCount = 0,
  curationNotes = "",
  systemPrompt = "",
}: SessionSelectionProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [localMessages, setLocalMessages] = useState(messages);
  const [anchorIndex, setAnchorIndex] = useState<number | null>(null);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editConflictState, setEditConflictState] = useState<EditConflictState>(null);
  const [retryingMessageId, setRetryingMessageId] = useState<string | null>(null);
  const [selectedLlmConfigurationId, setSelectedLlmConfigurationId] = useState("");
  const [newLlmConfigurationName, setNewLlmConfigurationName] = useState("");
  const [chatModelDraft, setChatModelDraft] = useState(chatModel);
  const [chatBaseUrlDraft, setChatBaseUrlDraft] = useState(chatBaseUrl);
  const [chatApiKeyDraft, setChatApiKeyDraft] = useState(chatApiKey);
  const [curationNotesDraft, setCurationNotesDraft] = useState(curationNotes);
  const [systemPromptDraft, setSystemPromptDraft] = useState(systemPrompt);
  const [isSending, setIsSending] = useState(false);
  const [isSavingModel, setIsSavingModel] = useState(false);
  const [isSavingLlmConfiguration, setIsSavingLlmConfiguration] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isClearingChat, setIsClearingChat] = useState(false);
  const [isDeletingSession, setIsDeletingSession] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<"cases" | "notes" | "tags" | "settings" | null>(null);
  const [contextTab, setContextTab] = useState<"selection" | "saved" | "cases">("selection");
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [headerMenuPosition, setHeaderMenuPosition] = useState<FloatingMenuPosition | null>(null);
  const [sessionActionsExpanded, setSessionActionsExpanded] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const headerMenuAnchorRef = useRef<HTMLDivElement>(null);

  const selectionRange =
    anchorIndex === null || focusIndex === null
      ? null
      : {
          start: Math.min(anchorIndex, focusIndex),
          end: Math.max(anchorIndex, focusIndex),
        };

  const selectedMessages = selectionRange
    ? localMessages.filter(
        (message) =>
          message.orderIndex >= selectionRange.start &&
          message.orderIndex <= selectionRange.end,
      )
    : [];

  const selectionPreview = selectedMessages.slice(0, 6);
  const hasBlockingOverlay =
    historyOpen || activePanel !== null || confirmState !== null || editConflictState !== null;
  const caseHref = selectionRange
    ? `/projects/${projectId}/sessions/${sessionId}/dataset/new?start=${selectionRange.start}&end=${selectionRange.end}`
    : "#";
  const caseLibraryHref = `/dataset-examples?projectId=${projectId}`;
  const visibleMessages =
    retryingMessageId === null
      ? localMessages
      : localMessages.filter((message) => message.id !== retryingMessageId);
  const displayedMessages = pendingUserMessage
    ? [
        ...visibleMessages,
        {
          id: "__pending-user-message__",
          role: "user" as const,
          text: pendingUserMessage,
          orderIndex:
            visibleMessages.length > 0 ? visibleMessages[visibleMessages.length - 1]!.orderIndex + 1 : 0,
          createdAt: new Date().toISOString(),
          isEdited: false,
        },
      ]
    : visibleMessages;
  const editingMessage =
    editingMessageId === null
      ? null
      : localMessages.find((message) => message.id === editingMessageId) ?? null;
  const lastConversationMessage = pendingUserMessage ? null : localMessages.at(-1) ?? null;
  const canRetryLastAssistantMessage =
    lastConversationMessage !== null &&
    lastConversationMessage.role === "assistant" &&
    retryingMessageId === null;
  const normalizedEditDraft = editDraft.trim();
  const editIsDirty = editingMessage !== null && normalizedEditDraft !== editingMessage.text;
  const editCanSave =
    editingMessage !== null &&
    normalizedEditDraft.length > 0 &&
    normalizedEditDraft !== editingMessage.text &&
    !isSavingEdit;

  useEffect(() => {
    setLocalMessages(messages);
  }, [messages]);

  useEffect(() => {
    const container = messagesRef.current;

    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [displayedMessages.length]);

  useEffect(() => {
    setChatModelDraft(chatModel);
  }, [chatModel]);

  useEffect(() => {
    setChatBaseUrlDraft(chatBaseUrl);
  }, [chatBaseUrl]);

  useEffect(() => {
    setChatApiKeyDraft(chatApiKey);
  }, [chatApiKey]);

  useEffect(() => {
    setCurationNotesDraft(curationNotes);
  }, [curationNotes]);

  useEffect(() => {
    setSystemPromptDraft(systemPrompt);
  }, [systemPrompt]);

  useEffect(() => {
    if (!editingMessageId) {
      return;
    }

    const textareaElement = editTextareaRef.current;

    if (!textareaElement) {
      return;
    }

    textareaElement.focus();
    textareaElement.setSelectionRange(textareaElement.value.length, textareaElement.value.length);
  }, [editingMessageId]);

  useEffect(() => {
    if (!editingMessageId) {
      return;
    }

    if (localMessages.some((message) => message.id === editingMessageId)) {
      return;
    }

    setEditingMessageId(null);
    setEditDraft("");
    setEditConflictState(null);
  }, [editingMessageId, localMessages]);

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
    if (headerMenuOpen) {
      return;
    }

    setHeaderMenuPosition(null);
  }, [headerMenuOpen]);

  useLayoutEffect(() => {
    if (!headerMenuOpen) {
      return;
    }

    const anchorElement = headerMenuAnchorRef.current;

    if (!anchorElement) {
      return;
    }

    const updateHeaderMenuPosition = () => {
      const rect = anchorElement.getBoundingClientRect();
      const horizontalPadding = 8;
      const maxWidth = Math.min(352, window.innerWidth - horizontalPadding * 2);
      const top = Math.min(rect.bottom + 14, window.innerHeight - 16);
      const left = Math.min(
        Math.max(horizontalPadding, rect.right - maxWidth),
        window.innerWidth - maxWidth - horizontalPadding,
      );

      setHeaderMenuPosition({
        top,
        left,
        width: maxWidth,
      });
    };

    updateHeaderMenuPosition();
    window.addEventListener("resize", updateHeaderMenuPosition);
    window.addEventListener("scroll", updateHeaderMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateHeaderMenuPosition);
      window.removeEventListener("scroll", updateHeaderMenuPosition, true);
    };
  }, [headerMenuOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      if (confirmState) {
        setConfirmState(null);
        return;
      }

      if (editConflictState) {
        setEditConflictState(null);
        return;
      }

      if (editingMessageId) {
        setEditingMessageId(null);
        setEditDraft("");
        return;
      }

      if (activePanel) {
        setActivePanel(null);
        return;
      }

      if (historyOpen) {
        setHistoryOpen(false);
        return;
      }

      if (headerMenuOpen) {
        setHeaderMenuOpen(false);
        setSessionActionsExpanded(false);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activePanel, confirmState, editConflictState, editingMessageId, headerMenuOpen, historyOpen]);

  function normalizeDraftBaseUrl(value: string) {
    return value.trim().replace(/\/+$/, "");
  }

  const modelIsDirty = chatModelDraft.trim() !== chatModel.trim();
  const baseUrlIsDirty = normalizeDraftBaseUrl(chatBaseUrlDraft) !== normalizeDraftBaseUrl(chatBaseUrl);
  const apiKeyIsDirty = chatApiKeyDraft.trim() !== chatApiKey.trim();
  const chatSettingsAreDirty = modelIsDirty || baseUrlIsDirty || apiKeyIsDirty;
  const notesAreDirty = curationNotesDraft.trim() !== curationNotes.trim();
  const promptIsDirty = systemPromptDraft.trim() !== systemPrompt.trim();
  const chatModelIsConfigured = chatModelDraft.trim().length > 0;
  const chatConnectionIsVerified = Boolean(chatConnectionVerifiedAt) && !chatConnectionError;
  const chatEnabled =
    chatRuntimeEnabled &&
    chatModelIsConfigured &&
    chatConnectionIsVerified &&
    !chatSettingsAreDirty;
  const chatComposerBlocked = editingMessageId !== null || isSavingEdit || retryingMessageId !== null;

  const chatAvailabilityMessage = !chatRuntimeEnabled
    ? chatRuntimeDisabledReason || "La configuración del proveedor no es válida."
    : chatSettingsAreDirty
      ? "Guarda o vuelve a probar la configuración antes de enviar mensajes."
      : !chatModelIsConfigured
        ? "Define un modelo para esta sesión antes de habilitar el chat."
        : chatConnectionError
          ? "La última prueba de conexión falló. Corrige el modelo, la URL o el backend y vuelve a probar."
          : !chatConnectionVerifiedAt
            ? "Prueba la conexión de esta configuración antes de usar el chat."
            : "Enter envía. Shift+Enter agrega una nueva línea.";

  function clearSelection() {
    setAnchorIndex(null);
    setFocusIndex(null);
  }

  function startEditingMessage(messageId: string) {
    const message = localMessages.find((candidate) => candidate.id === messageId);

    if (!message) {
      return;
    }

    setEditingMessageId(message.id);
    setEditDraft(message.text);
    setEditConflictState(null);
  }

  function handleCancelEdit() {
    setEditingMessageId(null);
    setEditDraft("");
    setEditConflictState(null);
  }

  function handleRequestEdit(messageId: string) {
    if (isSending || isSavingEdit) {
      return;
    }

    if (editingMessageId === messageId) {
      return;
    }

    if (editIsDirty) {
      setEditConflictState({ nextMessageId: messageId });
      return;
    }

    startEditingMessage(messageId);
  }

  function handleSelect(orderIndex: number) {
    if (anchorIndex === null) {
      setAnchorIndex(orderIndex);
      setFocusIndex(orderIndex);
      return;
    }

    setFocusIndex(orderIndex);
  }

  async function handleSaveEditedMessage(nextMessageId?: string) {
    if (!editingMessage || !editCanSave) {
      return;
    }

    setIsSavingEdit(true);

    try {
      const result = await updateSessionMessage(projectId, sessionId, {
        messageId: editingMessage.id,
        text: normalizedEditDraft,
      });

      if (!result.ok) {
        pushToast({
          title: "No fue posible actualizar el turno",
          description: result.error,
          variant: "error",
          durationMs: 7000,
        });
        return;
      }

      setLocalMessages((currentMessages) =>
        currentMessages.map((message) =>
          message.id === editingMessage.id
            ? {
                ...message,
                text: result.message.text,
                isEdited: true,
              }
            : message,
        ),
      );

      pushToast({
        title: "Turno actualizado",
        description: "El transcript ya usa el texto editado.",
        variant: "success",
        durationMs: 3000,
      });

      if (nextMessageId) {
        startEditingMessage(nextMessageId);
        return;
      }

      setEditingMessageId(null);
      setEditDraft("");
      setEditConflictState(null);
    } catch {
      pushToast({
        title: "No fue posible actualizar el turno",
        description: "No fue posible guardar el texto editado del transcript.",
        variant: "error",
        durationMs: 7000,
      });
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleRetryLastAssistantMessage() {
    if (!canRetryLastAssistantMessage || isSending || isSavingEdit) {
      return;
    }

    const messageToRetry = lastConversationMessage;

    if (!messageToRetry) {
      return;
    }

    setRetryingMessageId(messageToRetry.id);
    setErrorMessage(null);

    try {
      const result = await retryLastAssistantMessage(projectId, sessionId);

      if (!result.ok) {
        setRetryingMessageId(null);
        setErrorMessage(result.error);
        pushToast({
          title: "No fue posible reintentar la respuesta",
          description: result.error,
          variant: "error",
          durationMs: 7000,
        });
        return;
      }

      setLocalMessages((currentMessages) => [
        ...currentMessages.filter((message) => message.id !== messageToRetry.id),
        result.message,
      ]);
      setRetryingMessageId(null);
      pushToast({
        title: "Respuesta regenerada",
        description: "Se reemplazó el último turno del asistente.",
        variant: "success",
        durationMs: 4000,
      });

      startTransition(() => {
        router.refresh();
      });
    } catch {
      setRetryingMessageId(null);
      setErrorMessage("No fue posible regenerar la última respuesta del asistente.");
      pushToast({
        title: "No fue posible reintentar la respuesta",
        description: "No fue posible regenerar la última respuesta del asistente.",
        variant: "error",
        durationMs: 7000,
      });
    }
  }

  function openCasesPanel() {
    setContextTab(selectionRange ? "selection" : "cases");
    setHistoryOpen(false);
    setActivePanel("cases");
    setHeaderMenuOpen(false);
    setSessionActionsExpanded(false);
  }

  function closeHeaderMenu() {
    setHeaderMenuOpen(false);
    setSessionActionsExpanded(false);
  }

  function closeHeaderMenuAndThen(nextAction: () => void) {
    closeHeaderMenu();
    window.requestAnimationFrame(() => {
      nextAction();
    });
  }

  function openSettingsPanel() {
    setHistoryOpen(false);
    closeHeaderMenuAndThen(() => {
      setActivePanel("settings");
    });
  }

  function openNotesPanel() {
    setHistoryOpen(false);
    closeHeaderMenuAndThen(() => {
      setActivePanel("notes");
    });
  }

  function openTagsPanel() {
    setHistoryOpen(false);
    closeHeaderMenuAndThen(() => {
      setActivePanel("tags");
    });
  }

  function openCaseLibrary() {
    closeHeaderMenuAndThen(() => {
      startTransition(() => {
        router.push(caseLibraryHref);
      });
    });
  }

  function openClearChatConfirmation() {
    closeHeaderMenuAndThen(() => {
      setConfirmState({
        action: "clear-chat",
        title: "Limpiar toda la conversación",
        description:
          caseCount > 0
            ? "Esto eliminará todos los mensajes de esta sesión, pero conservará los dataset examples ya guardados."
            : "Esto eliminará todos los mensajes de esta sesión.",
        confirmLabel: "Limpiar chat",
        tone: "warning",
      });
    });
  }

  function openDeleteSessionConfirmation() {
    closeHeaderMenuAndThen(() => {
      setConfirmState({
        action: "delete-session",
        title: "Eliminar chat por completo",
        description:
          caseCount > 0
            ? `Esto eliminará la sesión completa junto con ${caseCount} slice(s) asociados. Esta acción no se puede deshacer.`
            : "Esto eliminará la sesión completa. Esta acción no se puede deshacer.",
        confirmLabel: "Eliminar chat",
        tone: "danger",
      });
    });
  }

  function handleLoadSavedConfiguration() {
    if (!selectedLlmConfigurationId) {
      return;
    }

    const selectedConfiguration = savedLlmConfigurations.find(
      (configuration) => configuration.id === selectedLlmConfigurationId,
    );

    if (!selectedConfiguration) {
      pushToast({
        title: "Configuración no disponible",
        description: "La configuración seleccionada ya no está disponible.",
        variant: "error",
        durationMs: 7000,
      });
      return;
    }

    setChatModelDraft(selectedConfiguration.chatModel);
    setChatBaseUrlDraft(selectedConfiguration.chatBaseUrl);
    setChatApiKeyDraft(selectedConfiguration.chatApiKey);

    if (selectedConfiguration.systemPrompt.trim()) {
      setSystemPromptDraft(selectedConfiguration.systemPrompt);
    }

    pushToast({
      title: "Configuración cargada",
      description: selectedConfiguration.systemPrompt.trim()
        ? `Se cargó "${selectedConfiguration.name}" con su prompt en el borrador de la sesión.`
        : `Se cargó "${selectedConfiguration.name}" en el borrador de la sesión.`,
      variant: "success",
      durationMs: 5000,
    });
  }

  async function handleSaveCurrentConfiguration() {
    const trimmedName = newLlmConfigurationName.trim();

    if (!trimmedName || isSavingLlmConfiguration) {
      return;
    }

    setIsSavingLlmConfiguration(true);

    try {
      const result = await createLlmConfiguration({
        name: trimmedName,
        chatModel: chatModelDraft,
        chatBaseUrl: chatBaseUrlDraft,
        chatApiKey: chatApiKeyDraft,
        systemPrompt: systemPromptDraft,
      });

      if (!result.ok) {
        pushToast({
          title: "No fue posible guardar la configuración",
          description: result.error,
          variant: "error",
          durationMs: 7000,
        });
        return;
      }

      setNewLlmConfigurationName("");
      pushToast({
        title: "Configuración LLM guardada",
        description: `La configuración "${trimmedName}" ya está disponible para cualquier proyecto.`,
        variant: "success",
        durationMs: 5000,
      });

      startTransition(() => {
        router.refresh();
      });
    } catch {
      pushToast({
        title: "No fue posible guardar la configuración",
        description: "No fue posible guardar esta configuración LLM.",
        variant: "error",
        durationMs: 7000,
      });
    } finally {
      setIsSavingLlmConfiguration(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = draft.trim();

    if (!text || isSending || !chatEnabled) {
      return;
    }

    setIsSending(true);
    setErrorMessage(null);
    setPendingUserMessage(text);
    setDraft("");

    try {
      const result = await sendSessionMessage(projectId, sessionId, { text });

      if (!result.ok) {
        setDraft(text);
        setPendingUserMessage(null);
        setErrorMessage(result.error);
        pushToast({
          title: "No fue posible enviar el mensaje",
          description: result.error,
          variant: "error",
          durationMs: 7000,
        });
        return;
      }

      setPendingUserMessage(null);
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
      setDraft(text);
      setPendingUserMessage(null);
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
        chatBaseUrl: chatBaseUrlDraft,
        chatApiKey: chatApiKeyDraft,
      });

      if (!result.ok) {
        pushToast({
          title: "No fue posible guardar la configuración",
          description: result.error,
          variant: "error",
          durationMs: 7000,
        });
        return;
      }

      pushToast({
        title:
          chatModelDraft.trim() || chatBaseUrlDraft.trim() || chatApiKeyDraft.trim()
            ? "Configuración guardada"
            : "Configuración eliminada",
        description:
          chatModelDraft.trim() || chatBaseUrlDraft.trim() || chatApiKeyDraft.trim()
            ? "La sesión guardó el modelo, la URL y la API key, y dejó pendiente una nueva verificación de conexión."
            : "La sesión quedó sin modelo, URL ni API key personalizados.",
        variant: "success",
        durationMs: 5000,
      });

      startTransition(() => {
        router.refresh();
      });
    } catch {
      pushToast({
        title: "No fue posible guardar la configuración",
        description: "No fue posible actualizar el modelo o la URL configurados para esta sesión.",
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
        chatBaseUrl: chatBaseUrlDraft,
        chatApiKey: chatApiKeyDraft,
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

  async function handleSaveNotes() {
    if (isSavingNotes) {
      return;
    }

    setIsSavingNotes(true);

    try {
      const result = await updateSessionNotes(projectId, sessionId, {
        curationNotes: curationNotesDraft,
      });

      if (!result.ok) {
        pushToast({
          title: "No fue posible guardar las notas",
          description: result.error,
          variant: "error",
          durationMs: 7000,
        });
        return;
      }

      pushToast({
        title: curationNotesDraft.trim() ? "Notas guardadas" : "Notas eliminadas",
        description: curationNotesDraft.trim()
          ? "Estas notas quedarán disponibles cuando abras el editor DSPy desde esta conversación."
          : "La sesión ya no tiene notas adicionales para curación.",
        variant: "success",
        durationMs: 5000,
      });

      startTransition(() => {
        router.refresh();
      });
    } catch {
      pushToast({
        title: "No fue posible guardar las notas",
        description: "No fue posible actualizar las notas del chat.",
        variant: "error",
        durationMs: 7000,
      });
    } finally {
      setIsSavingNotes(false);
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
        ? "Configuración pendiente"
        : !chatConnectionVerifiedAt
          ? "Prueba pendiente"
          : chatSettingsAreDirty
            ? "Cambios sin guardar"
            : "Chat pausado";
  const sessionDisplayTitle = sessionTitle.trim() || "Sesión en curso";
  const hasSelection = selectionRange !== null;
  const turnCount = localMessages.length;
  const composerPlaceholder = "Inquire further or define a new slice...";

  return (
    <>
      <section className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[linear-gradient(180deg,rgba(250,247,241,0.98)_0%,rgba(243,238,230,0.98)_100%)]">
        <div className="absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top_left,rgba(15,95,92,0.14),transparent_34%),radial-gradient(circle_at_top_right,rgba(15,95,92,0.08),transparent_36%)]" />

        <header className="relative border-b border-[rgba(24,35,47,0.08)] bg-[rgba(248,245,238,0.88)] px-4 py-4 backdrop-blur-xl sm:px-6 xl:px-8">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_auto] xl:items-center">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href={`/projects/${projectId}`}
                className="inline-flex size-10 items-center justify-center rounded-full border border-[var(--line)] bg-white/80 text-[var(--muted-strong)] shadow-[0_8px_24px_rgba(24,35,47,0.06)] transition hover:-translate-y-px hover:bg-white hover:text-[var(--foreground)]"
                aria-label="Regresar al proyecto"
                title="Regresar al proyecto"
              >
                <BackArrowIcon />
              </Link>
            </div>

            <div className="min-w-0 text-left xl:text-center">
              <p className="editorial-heading truncate text-[1.45rem] leading-[1.05] text-[var(--foreground)] sm:text-[1.8rem]">
                {sessionDisplayTitle}
              </p>
              <div
                className={cn(
                  "mt-2 flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.22em] xl:justify-center",
                  chatEnabled ? "text-emerald-600" : "text-amber-700",
                )}
              >
                <span
                  className={cn(
                    "size-2 rounded-full",
                    chatEnabled ? "bg-emerald-400" : "bg-amber-500",
                  )}
                  aria-hidden="true"
                />
                <span>{chatEnabled ? "LLM connected" : connectionSummary}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <div ref={headerMenuAnchorRef} className="relative">
                <TopIconButton
                  label="Acciones de chat"
                  title="Acciones de chat"
                  onClick={() =>
                    setHeaderMenuOpen((currentValue) => {
                      const nextValue = !currentValue;

                      if (!nextValue) {
                        setSessionActionsExpanded(false);
                      }

                      return nextValue;
                    })
                  }
                  active={headerMenuOpen}
                >
                  <SettingsIcon />
                </TopIconButton>
              </div>
            </div>
          </div>
        </header>

        {errorMessage ? (
          <div className="relative border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:px-6 xl:px-8">
            {errorMessage}
          </div>
        ) : null}

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div className="grid h-full min-h-0 xl:grid-cols-[18.5rem_minmax(0,1fr)]">
            <aside className="hidden min-h-0 border-r border-[rgba(24,35,47,0.07)] bg-[rgba(247,243,236,0.55)] xl:flex xl:flex-col">
              <div className="flex min-h-0 flex-1 flex-col px-6 py-8">
                <div className="flex items-start gap-4">
                  <div className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-[0_14px_32px_rgba(15,95,92,0.18)]">
                    <ArchiveIcon />
                  </div>
                  <div className="min-w-0">
                    <h2 className="editorial-heading text-[2rem] leading-none text-[var(--foreground)]">
                      {sessionDisplayTitle}
                    </h2>
                    <p className="mt-2 text-[0.72rem] uppercase tracking-[0.22em] text-[var(--muted)]">
                      Proyecto
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted-strong)]">{projectName}</p>
                    <p className="mono mt-3 break-all text-[0.68rem] uppercase tracking-[0.16em] text-[var(--muted)]">
                      ID: {sessionId}
                    </p>
                  </div>
                </div>

                <div className="mt-8 min-h-0 flex-1 overflow-hidden">
                  <div className="max-h-full space-y-3 overflow-y-auto pr-1">
                    {sessionHistory.map((historyItem) => {
                      const isCurrentSession = historyItem.id === sessionId;
                      const sessionItemContent = (
                        <>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                                {historyItem.title}
                              </p>
                              <p className="mt-1 text-xs text-[var(--muted)]">
                                {formatCompactDate(historyItem.createdAt)}
                              </p>
                            </div>

                            {isCurrentSession ? (
                              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-900">
                                Actual
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                            <span className="rounded-full border border-[var(--line)] bg-white/78 px-2.5 py-1">
                              {historyItem.messageCount} msg
                            </span>
                            <span className="rounded-full border border-[var(--line)] bg-white/78 px-2.5 py-1">
                              {historyItem.caseCount} slices
                            </span>
                            {historyItem.tags.slice(0, 2).map((tag) => (
                              <span
                                key={tag.id}
                                className="rounded-full border border-[var(--line)] bg-white/78 px-2.5 py-1"
                              >
                                #{tag.name}
                              </span>
                            ))}
                          </div>
                        </>
                      );

                      if (isCurrentSession) {
                        return (
                          <article
                            key={historyItem.id}
                            className="rounded-[1.4rem] border border-emerald-200 bg-emerald-50/85 p-4 shadow-[0_12px_28px_rgba(15,95,92,0.08)]"
                          >
                            {sessionItemContent}
                          </article>
                        );
                      }

                      return (
                        <Link
                          key={historyItem.id}
                          href={`/projects/${projectId}/sessions/${historyItem.id}`}
                          className="block rounded-[1.4rem] border border-[rgba(24,35,47,0.08)] bg-white/72 p-4 transition hover:-translate-y-0.5 hover:border-[rgba(15,95,92,0.24)] hover:shadow-[0_14px_30px_rgba(24,35,47,0.06)]"
                        >
                          {sessionItemContent}
                        </Link>
                      );
                    })}

                    {sessionHistory.length === 0 ? (
                      <div className="rounded-[1.4rem] border border-dashed border-[var(--line)] px-4 py-6 text-sm text-[var(--muted)]">
                        No hay otras sesiones para mostrar.
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-auto space-y-4 pt-8">
                  <SidebarSection title="Metrics overview" soft>
                    <div className="grid grid-cols-2 gap-3">
                      <SidebarStat value={turnCount} label="Messages" />
                      <SidebarStat value={caseCount} label="Slices" />
                    </div>
                  </SidebarSection>

                  {hasSelection ? (
                    <div className="space-y-3">
                      <Link
                        href={caseHref}
                        className="inline-flex w-full items-center justify-center gap-3 rounded-full bg-[var(--accent)] px-5 py-4 text-sm font-semibold uppercase tracking-[0.22em] text-white transition hover:bg-[var(--accent-strong)]"
                      >
                        <span className="text-lg leading-none">+</span>
                        <span>Crear slice</span>
                      </Link>
                      <button type="button" className="button-secondary w-full" onClick={clearSelection}>
                        Limpiar slice
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="inline-flex w-full items-center justify-center gap-3 rounded-full bg-[var(--accent)] px-5 py-4 text-sm font-semibold uppercase tracking-[0.22em] text-white transition hover:bg-[var(--accent-strong)]"
                      onClick={openCasesPanel}
                    >
                      <span className="text-lg leading-none">+</span>
                      <span>Crear slice</span>
                    </button>
                  )}
                </div>
              </div>
            </aside>

            <section className="relative min-h-0 flex min-w-0 flex-col overflow-hidden px-4 py-5 sm:px-6 xl:px-8 xl:py-8">
              <div className="mb-5 flex items-center gap-3">
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-[rgba(15,95,92,0.12)] text-[var(--accent)]">
                  <SparklesIcon />
                </span>
                <div className="min-w-0">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted-strong)]">
                    {chatProviderLabel ? `${chatProviderLabel} · asistente` : "Asistente"}
                  </p>
                  <p className="mt-1 text-[0.68rem] uppercase tracking-[0.22em] text-[var(--muted)]">
                    {chatEnabled ? "LLM conectado y verificado" : connectionSummary}
                  </p>
                </div>
              </div>

              <div ref={messagesRef} className="min-h-0 flex-1 overflow-y-auto pr-1">
                <div className="mx-auto flex w-full max-w-[54rem] flex-col gap-8 pb-8">
                  {displayedMessages.length === 0 ? (
                    <div className="rounded-[2.25rem] border border-dashed border-[rgba(24,35,47,0.12)] bg-[rgba(255,252,246,0.78)] px-8 py-20 text-center shadow-[0_20px_56px_rgba(24,35,47,0.05)]">
                      <p className="editorial-heading text-[2rem] leading-none text-[var(--foreground)]">
                        La sesión está lista para comenzar
                      </p>
                      <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
                        Configura el modelo si hace falta y envía el primer mensaje desde el compositor inferior.
                      </p>
                    </div>
                  ) : null}

                  {displayedMessages.map((message) => {
                    const isSelected =
                      selectionRange !== null &&
                      message.orderIndex >= selectionRange.start &&
                      message.orderIndex <= selectionRange.end;
                    const isEditing = editingMessageId === message.id;
                    const isAssistant = message.role === "assistant";
                    const editButtonDisabled =
                      isSending ||
                      isSavingEdit ||
                      retryingMessageId !== null ||
                      message.id === "__pending-user-message__";
                    const showRetryButton =
                      message.id !== "__pending-user-message__" &&
                      !isEditing &&
                      canRetryLastAssistantMessage &&
                      lastConversationMessage?.id === message.id;

                    return (
                      <div
                        key={message.id}
                        className={cn("flex w-full", isAssistant ? "justify-start" : "justify-end")}
                      >
                        <div
                          className={cn(
                            "group relative w-full",
                            isAssistant ? "max-w-[41rem]" : "max-w-[34rem]",
                          )}
                        >
                          {!isEditing ? (
                            <>
                              {isAssistant ? (
                                <div className="mb-3 flex items-center gap-3 px-2">
                                  <span className="inline-flex size-9 items-center justify-center rounded-full bg-[rgba(15,95,92,0.12)] text-[var(--accent)]">
                                    <SparklesIcon />
                                  </span>
                                  <div className="min-w-0">
                                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted-strong)]">
                                      Asistente
                                    </p>
                                    <p className="mt-1 text-[0.68rem] uppercase tracking-[0.22em] text-[var(--muted)]">
                                      Turno {message.orderIndex + 1}
                                    </p>
                                  </div>
                                </div>
                              ) : null}

                              <button
                                type="button"
                                onClick={() => handleSelect(message.orderIndex)}
                                aria-pressed={isSelected}
                                className={cn(
                                  "w-full rounded-[2rem] border px-5 py-5 text-left shadow-[0_18px_46px_rgba(24,35,47,0.06)] transition duration-150 hover:-translate-y-0.5 sm:px-6 sm:py-6",
                                  isAssistant
                                    ? "bg-[rgba(255,252,246,0.92)]"
                                    : "bg-[var(--accent-strong)] text-white",
                                  isSelected
                                    ? "border-amber-300 ring-2 ring-amber-200"
                                    : isAssistant
                                      ? "border-[rgba(24,35,47,0.06)] hover:border-[rgba(15,95,92,0.28)]"
                                      : "border-[rgba(15,95,92,0.68)] hover:border-[rgba(15,95,92,0.82)]",
                                )}
                              >
                                <div
                                  className={cn(
                                    "mb-4 flex flex-wrap items-center justify-between gap-3 pr-16 text-[10px] font-semibold uppercase tracking-[0.2em]",
                                    isAssistant ? "text-[var(--muted)]" : "text-white/72",
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    <span>{isAssistant ? formatCompactDate(message.createdAt) : `Turno ${message.orderIndex + 1}`}</span>
                                    {message.isEdited ? (
                                      <span
                                        className={cn(
                                          "rounded-full border px-2 py-0.5 text-[9px]",
                                          isAssistant
                                            ? "border-[rgba(24,35,47,0.1)] bg-white/86 text-[var(--muted-strong)]"
                                            : "border-white/20 bg-white/12 text-white/88",
                                        )}
                                      >
                                        Editado
                                      </span>
                                    ) : null}
                                  </div>
                                  <span className="mono normal-case tracking-normal">
                                    {isAssistant ? `#${message.orderIndex + 1}` : formatCompactDate(message.createdAt)}
                                  </span>
                                </div>

                                <p
                                  className={cn(
                                    "whitespace-pre-wrap",
                                    isAssistant
                                      ? "editorial-heading text-[1.32rem] leading-[1.62] tracking-[-0.03em] text-[var(--foreground)] sm:text-[1.48rem]"
                                      : "text-[1rem] leading-[1.75] text-white sm:text-[1.08rem]",
                                  )}
                                >
                                  {message.text}
                                </p>

                                {isSelected ? (
                                  <div
                                    className={cn(
                                      "mt-5 inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]",
                                      isAssistant
                                        ? "border-amber-300 bg-amber-50 text-amber-900"
                                        : "border-white/25 bg-white/12 text-white",
                                    )}
                                  >
                                    Incluido en el slice activo
                                  </div>
                                ) : null}
                              </button>
                            </>
                          ) : (
                            <div
                              className={cn(
                                "w-full rounded-[2rem] border px-5 py-5 text-left shadow-[0_18px_46px_rgba(24,35,47,0.06)] sm:px-6 sm:py-6",
                                isAssistant ? "bg-[rgba(255,252,246,0.94)]" : "bg-[rgba(15,95,92,0.1)]",
                                "border-[var(--accent)] ring-2 ring-[color:color-mix(in_srgb,var(--accent)_22%,white)]",
                              )}
                            >
                              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                                <div className="flex items-center gap-2">
                                  <span>{isAssistant ? "Asistente" : "Usuario"}</span>
                                  <span>Turno {message.orderIndex + 1}</span>
                                  {message.isEdited ? (
                                    <span className="rounded-full border border-[rgba(24,35,47,0.1)] bg-white/86 px-2 py-0.5 text-[9px] text-[var(--muted-strong)]">
                                      Editado
                                    </span>
                                  ) : null}
                                </div>
                                <span className="mono normal-case tracking-normal">{formatCompactDate(message.createdAt)}</span>
                              </div>

                              <textarea
                                ref={editTextareaRef}
                                className="field min-h-32 w-full resize-y bg-white/84"
                                value={editDraft}
                                onChange={(event) => setEditDraft(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === "Escape") {
                                    event.preventDefault();
                                    handleCancelEdit();
                                    return;
                                  }

                                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                                    event.preventDefault();
                                    void handleSaveEditedMessage();
                                  }
                                }}
                                aria-label={`Editar turno ${message.orderIndex + 1}`}
                                disabled={isSavingEdit}
                              />

                              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                                <p className="text-xs text-[var(--muted)]">
                                  <kbd className="rounded border border-[var(--line)] bg-white/70 px-1.5 py-0.5">
                                    Esc
                                  </kbd>{" "}
                                  cancela,{" "}
                                  <kbd className="rounded border border-[var(--line)] bg-white/70 px-1.5 py-0.5">
                                    Cmd/Ctrl + Enter
                                  </kbd>{" "}
                                  guarda.
                                </p>
                                <div className="flex flex-wrap gap-3">
                                  <button
                                    type="button"
                                    className="button-secondary"
                                    onClick={handleCancelEdit}
                                    disabled={isSavingEdit}
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    type="button"
                                    className="button-primary"
                                    onClick={() => {
                                      void handleSaveEditedMessage();
                                    }}
                                    disabled={!editCanSave}
                                  >
                                    {isSavingEdit ? "Guardando..." : "Guardar"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {message.id !== "__pending-user-message__" && !isEditing ? (
                            <button
                              type="button"
                              className="absolute right-3 top-3 inline-flex items-center gap-2 rounded-full border border-[rgba(24,35,47,0.08)] bg-white/94 px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] opacity-0 shadow-sm transition group-hover:opacity-100 focus-visible:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
                              onClick={() => handleRequestEdit(message.id)}
                              disabled={editButtonDisabled}
                              aria-label={`Editar turno ${message.orderIndex + 1}`}
                              title={
                                isSending
                                  ? "No puedes editar mientras el asistente responde"
                                  : `Editar turno ${message.orderIndex + 1}`
                              }
                            >
                              <EditIcon />
                              <span>Editar</span>
                            </button>
                          ) : null}

                          {showRetryButton ? (
                            <div className="mt-3 flex justify-start px-2">
                              <button
                                type="button"
                                className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white/88 px-3 py-1.5 text-xs font-semibold text-[var(--muted-strong)] shadow-sm transition hover:border-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
                                onClick={() => {
                                  void handleRetryLastAssistantMessage();
                                }}
                                disabled={isSending || isSavingEdit || retryingMessageId !== null}
                                aria-label={`Reintentar turno ${message.orderIndex + 1}`}
                                title="Eliminar este último mensaje del asistente y generar uno nuevo"
                              >
                                <RetryIcon />
                                <span>{retryingMessageId === message.id ? "Reintentando..." : "Reintentar"}</span>
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}

                  {isSending || retryingMessageId !== null ? (
                    <div className="flex w-full justify-start">
                      <div className="w-full max-w-[41rem]">
                        <div className="mb-3 flex items-center gap-3 px-2">
                          <span className="inline-flex size-9 items-center justify-center rounded-full bg-[rgba(15,95,92,0.12)] text-[var(--accent)]">
                            <SparklesIcon />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted-strong)]">
                              Asistente
                            </p>
                            <p className="mt-1 text-[0.68rem] uppercase tracking-[0.22em] text-[var(--muted)]">
                              {retryingMessageId !== null ? "Reintentando" : "Escribiendo"}
                            </p>
                          </div>
                        </div>

                        <div className="rounded-[2rem] border border-[rgba(24,35,47,0.06)] bg-[rgba(255,252,246,0.92)] px-5 py-5 shadow-[0_18px_46px_rgba(24,35,47,0.06)] sm:px-6 sm:py-6">
                          <div className="typing-indicator" aria-label="Asistente escribiendo" role="status">
                            <span className="typing-dot" />
                            <span className="typing-dot" />
                            <span className="typing-dot" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mx-auto mt-4 w-full max-w-[54rem]">
                {hasSelection ? (
                  <div className="mb-4 flex flex-col gap-4 rounded-[1.8rem] border border-amber-200 bg-[rgba(252,246,229,0.95)] px-5 py-4 text-amber-950 shadow-[0_16px_36px_rgba(196,146,42,0.08)] sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-amber-700">
                        Slice activo
                      </p>
                      <p className="mt-2 text-lg font-semibold">
                        Turnos {selectionRange.start + 1} a {selectionRange.end + 1}
                      </p>
                      <p className="mt-1 text-sm text-amber-800">
                        {selectedMessages.length} mensaje(s) listos para mapear hacia DSPy.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button type="button" className="button-secondary" onClick={openCasesPanel}>
                        Ver preview
                      </button>
                      <button type="button" className="button-secondary" onClick={clearSelection}>
                        Limpiar slice
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
                        Crear slice
                      </Link>
                    </div>
                  </div>
                ) : null}

                <form
                  ref={formRef}
                  onSubmit={handleSubmit}
                  className="rounded-[1.85rem] border border-[rgba(24,35,47,0.05)] bg-white/96 p-1.5 shadow-[0_20px_54px_rgba(24,35,47,0.08)] backdrop-blur"
                >
                  <div className="flex items-center gap-3 px-2 py-2 sm:px-3">
                    <div className="flex-1 px-3 sm:px-5">
                      <textarea
                        ref={textareaRef}
                        className="min-h-[3.55rem] w-full resize-none bg-transparent py-2 text-[1rem] leading-7 text-[var(--foreground)] outline-none placeholder:text-[color:rgba(102,114,125,0.68)] sm:text-[1.04rem]"
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            formRef.current?.requestSubmit();
                          }
                        }}
                        placeholder={composerPlaceholder}
                        required
                        disabled={
                          !chatEnabled ||
                          chatComposerBlocked ||
                          isSending ||
                          isClearingChat ||
                          isDeletingSession
                        }
                      />
                    </div>

                    <button
                      type="submit"
                      className="inline-flex h-[3.9rem] w-[3.9rem] shrink-0 items-center justify-center rounded-[1.12rem] bg-[var(--accent-strong)] text-white transition hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-45"
                      disabled={
                        !chatEnabled ||
                        chatComposerBlocked ||
                        isSending ||
                        isClearingChat ||
                        isDeletingSession ||
                        draft.trim().length === 0
                      }
                      aria-label={isSending ? "Enviando mensaje" : "Enviar mensaje"}
                      title={isSending ? "Enviando mensaje" : "Enviar mensaje"}
                    >
                      {isSending ? <span className="text-sm font-semibold">...</span> : <SendIcon />}
                    </button>
                  </div>
                </form>
              </div>
            </section>
          </div>
        </div>
      </section>

      <ChatHistoryDrawer
        open={historyOpen}
        title="Historial de chats"
        description="Cambia entre sesiones del proyecto sin salir de esta vista."
        onClose={() => setHistoryOpen(false)}
      >
        <div className="space-y-5">
          <div className="rounded-[1.5rem] border border-[var(--line)] bg-white/65 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Proyecto</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">{projectName}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {sessionHistory.length} chat(s) disponible(s) en este proyecto.
            </p>
          </div>

          {sessionHistory.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-[var(--line)] px-4 py-6 text-sm text-[var(--muted)]">
              Todavía no hay otros chats para mostrar.
            </div>
          ) : null}

          <div className="space-y-3">
            {sessionHistory.map((historyItem) => {
              const isCurrentSession = historyItem.id === sessionId;
              const historyItemContent = (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                        {historyItem.title}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {formatDate(historyItem.createdAt)}
                      </p>
                    </div>

                    {isCurrentSession ? (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-900">
                        Actual
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                    <span className="rounded-full border border-[var(--line)] bg-white/80 px-2.5 py-1">
                      {historyItem.messageCount} mensaje(s)
                    </span>
                    <span className="rounded-full border border-[var(--line)] bg-white/80 px-2.5 py-1">
                      {historyItem.caseCount} slice(s)
                    </span>
                    {historyItem.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="rounded-full border border-[var(--line)] bg-white/80 px-2.5 py-1"
                      >
                        #{tag.name}
                      </span>
                    ))}
                  </div>
                </>
              );

              if (isCurrentSession) {
                return (
                  <article
                    key={historyItem.id}
                    className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50/80 p-4"
                  >
                    {historyItemContent}
                  </article>
                );
              }

              return (
                <Link
                  key={historyItem.id}
                  href={`/projects/${projectId}/sessions/${historyItem.id}`}
                  className="block rounded-[1.5rem] border border-[var(--line)] bg-white/70 p-4 transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)]"
                  onClick={() => setHistoryOpen(false)}
                >
                  {historyItemContent}
                </Link>
              );
            })}
          </div>
        </div>
      </ChatHistoryDrawer>

      <SideDrawer
        open={activePanel === "notes"}
        title="Notas del chat"
        description="Guarda contexto libre de esta sesión para reutilizarlo después cuando abras el editor DSPy."
        onClose={() => setActivePanel(null)}
      >
        <div className="space-y-5">
          <div className="rounded-[1.5rem] border border-[var(--line)] bg-white/65 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Uso</p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Estas notas viven solo en este chat y aparecerán en el panel
              {" "}
              <span className="font-semibold text-[var(--foreground)]">Fuente</span>
              {" "}
              cuando mapees esta conversación a DSPy.
            </p>
          </div>

          <label className="block space-y-2">
            <FormLabel>Notas para curación</FormLabel>
            <textarea
              className="field min-h-48"
              value={curationNotesDraft}
              onChange={(event) => setCurationNotesDraft(event.target.value)}
              placeholder="Añade contexto, criterios o recordatorios útiles para cuando esta sesión pase al editor DSPy."
              disabled={isSavingNotes}
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--muted)]">
              Son opcionales y no cambian el transcript del chat.
            </p>
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                void handleSaveNotes();
              }}
              disabled={isSavingNotes || !notesAreDirty}
            >
              {isSavingNotes ? "Guardando notas..." : "Guardar notas"}
            </button>
          </div>
        </div>
      </SideDrawer>

      <SideDrawer
        open={activePanel === "tags"}
        title="Etiquetas del chat"
        description="Asigna etiquetas existentes, crea nuevas rápidamente y usa la taxonomía global sin salir del chat."
        onClose={() => setActivePanel(null)}
      >
        <div className="space-y-5">
          <div className="rounded-[1.5rem] border border-[var(--line)] bg-white/65 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Sesión actual</p>
            <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">{projectName}</p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Usa etiquetas para clasificar este chat y encontrarlo más rápido después.
            </p>
          </div>

          <SessionTagPicker
            projectId={projectId}
            sessionId={sessionId}
            assignedTags={sessionTags}
            availableTags={availableSessionTags}
            showManageLink
          />
        </div>
      </SideDrawer>

      <SideDrawer
        open={activePanel === "cases"}
        title="Dataset y selección"
        description="Revisa la selección activa, reutiliza slices guardados y consulta los dataset examples recientes sin sacrificar espacio del transcript."
        onClose={() => setActivePanel(null)}
      >
        <div className="space-y-6">
          <DrawerTabs
            value={contextTab}
            options={[
              { id: "selection", label: "Selección actual" },
              { id: "saved", label: "Slices guardados" },
              { id: "cases", label: "Examples recientes" },
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
                    ? `${selectedMessages.length} mensaje(s) listo(s) para revisión manual o mapping DSPy.`
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
                    Mapear a DSPy desde selección
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
          ) : contextTab === "saved" ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-[var(--muted)]">
                  {savedSlices.length === 0
                    ? "Esta sesión todavía no tiene slices guardados."
                    : `${savedSlices.length} slice(s) persistidos en esta sesión.`}
                </p>
                {selectionRange ? (
                  <Link href={caseHref} className="button-secondary">
                    Guardar selección actual
                  </Link>
                ) : null}
              </div>

              {savedSlices.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-[var(--line)] px-4 py-6 text-sm text-[var(--muted)]">
                  Crea un dataset example desde una selección nueva para que ese slice quede disponible aquí.
                </div>
              ) : null}

              {savedSlices.map((sourceSlice) => (
                <article key={sourceSlice.id} className="rounded-[1.5rem] border border-[var(--line)] bg-white/70 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-base font-semibold">{sourceSlice.title}</h3>
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        Actualizado {formatDate(sourceSlice.updatedAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                      <span className="rounded-full border border-[var(--line)] bg-white/80 px-2.5 py-1">
                        {sourceSlice.turnCount} turno(s)
                      </span>
                      <span className="rounded-full border border-[var(--line)] bg-white/80 px-2.5 py-1">
                        {sourceSlice.linkedExampleCount} example(s)
                      </span>
                    </div>
                  </div>

                  <p className="mt-4 line-clamp-4 text-sm leading-7 text-[var(--muted-strong)]">
                    {sourceSlice.sourceSummary || sourceSlice.lastUserMessage || "Sin resumen ni mensaje de usuario."}
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <Link
                      href={`/projects/${projectId}/sessions/${sessionId}/dataset/new?sourceSliceId=${sourceSlice.id}`}
                      className="button-primary inline-flex items-center justify-center"
                    >
                      Crear dataset example
                    </Link>
                    <SourceSliceDeleteButton
                      sourceSliceId={sourceSlice.id}
                      sourceSliceName={sourceSlice.title}
                      linkedExampleCount={sourceSlice.linkedExampleCount}
                    />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-[var(--muted)]">
                  {caseCount === 0
                    ? "Esta sesión todavía no tiene dataset examples guardados."
                    : `${caseCount} slice(s) asociados a esta sesión.`}
                </p>
                <Link href={caseLibraryHref} className="button-secondary">
                  Abrir biblioteca
                </Link>
              </div>

              {recentCases.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-[var(--line)] px-4 py-6 text-sm text-[var(--muted)]">
                  Todavía no se han guardado dataset examples para esta sesión.
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
                  <Link href={`/dataset-examples/${caseItem.id}`} className="button-primary mt-5 inline-flex">
                    Abrir example
                  </Link>
                </article>
              ))}

              {caseCount > recentCases.length ? (
                <p className="text-sm text-[var(--muted)]">
                  Mostrando {recentCases.length} example(s) recientes. Usa la biblioteca para ver el resto.
                </p>
              ) : null}
            </div>
          )}
        </div>
      </SideDrawer>

      <CenteredSheet
        open={activePanel === "settings"}
        title="Configuración y test del chat"
        description="Ajusta el modelo, la URL, la API key, verifica la conexión y define el prompt de comportamiento sin sacar al transcript del foco principal."
        onClose={() => setActivePanel(null)}
      >
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-4">
            <InfoCard label="Proveedor" value={chatProviderLabel} />
            <InfoCard label="Modelo guardado" value={chatModel || "Sin definir"} />
            <InfoCard
              label="URL efectiva"
              value={chatResolvedBaseUrl || "https://api.openai.com/v1"}
              compact
            />
            <InfoCard
              label="API key"
              value={chatApiKey ? "Configurada en sesión" : "No configurada"}
              compact
            />
          </div>

          <div className="grid gap-4 rounded-[1.5rem] border border-[var(--line)] bg-white/50 p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="space-y-3">
              <label className="block space-y-2">
                <FormLabel>Usar configuración guardada</FormLabel>
                <select
                  className="field"
                  value={selectedLlmConfigurationId}
                  onChange={(event) => setSelectedLlmConfigurationId(event.target.value)}
                  disabled={isSavingModel || isTestingConnection || savedLlmConfigurations.length === 0}
                >
                  <option value="">Selecciona una configuración global</option>
                  {savedLlmConfigurations.map((configuration) => (
                    <option key={configuration.id} value={configuration.id}>
                      {configuration.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-sm text-[var(--muted)]">
                La selección carga modelo, URL y API key al borrador actual. Si la configuración trae prompt, también lo
                aplica.
              </p>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                className="button-secondary"
                onClick={handleLoadSavedConfiguration}
                disabled={!selectedLlmConfigurationId || isSavingModel || isTestingConnection}
              >
                Cargar al borrador
              </button>
            </div>
          </div>

          <div className="grid gap-4 rounded-[1.5rem] border border-[var(--line)] bg-white/50 p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="space-y-3">
              <label className="block space-y-2">
                <FormLabel>Guardar como nueva configuración</FormLabel>
                <input
                  className="field"
                  value={newLlmConfigurationName}
                  onChange={(event) => setNewLlmConfigurationName(event.target.value)}
                  placeholder="Ejemplo: OpenAI equipo clínico"
                  disabled={isSavingLlmConfiguration}
                />
              </label>
              <p className="text-sm text-[var(--muted)]">
                Esto guarda el modelo, la URL, la API key y el prompt del borrador actual para reutilizarlos en cualquier
                proyecto.
              </p>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                className="button-secondary"
                onClick={() => {
                  void handleSaveCurrentConfiguration();
                }}
                disabled={
                  isSavingLlmConfiguration ||
                  newLlmConfigurationName.trim().length === 0 ||
                  chatModelDraft.trim().length === 0
                }
              >
                {isSavingLlmConfiguration ? "Guardando..." : "Guardar como nueva"}
              </button>
            </div>
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

          <label className="block space-y-2">
            <FormLabel>Chat URL (optional)</FormLabel>
            <input
              className="field mono"
              value={chatBaseUrlDraft}
              onChange={(event) => setChatBaseUrlDraft(event.target.value)}
              placeholder="Ejemplo: http://localhost:1234/v1"
              disabled={isSavingModel || isTestingConnection}
            />
            <p className="text-sm text-[var(--muted)]">
              Si la dejas vacía, la sesión usa la URL por defecto del entorno.
            </p>
          </label>

          <label className="block space-y-2">
            <FormLabel>Chat API key (optional)</FormLabel>
            <input
              type="password"
              className="field mono"
              value={chatApiKeyDraft}
              onChange={(event) => setChatApiKeyDraft(event.target.value)}
              placeholder="Bearer token opcional para este backend"
              disabled={isSavingModel || isTestingConnection}
            />
            <p className="text-sm text-[var(--muted)]">
              Si la dejas vacía, no se envía API key de sesión y se usa solo la del entorno si existe.
            </p>
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
                disabled={isSavingModel || isTestingConnection || !chatSettingsAreDirty}
              >
                {isSavingModel ? "Guardando..." : "Guardar configuración"}
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
              ? "El chat está habilitado para esta configuración verificada."
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

      <EditConflictModal
        open={editConflictState !== null}
        isBusy={isSavingEdit}
        canSave={editingMessage !== null && normalizedEditDraft.length > 0}
        onCancel={() => setEditConflictState(null)}
        onDiscard={() => {
          const nextMessageId = editConflictState?.nextMessageId;

          if (!nextMessageId) {
            return;
          }

          startEditingMessage(nextMessageId);
        }}
        onSave={() => {
          const nextMessageId = editConflictState?.nextMessageId;

          if (!nextMessageId) {
            return;
          }

          void handleSaveEditedMessage(nextMessageId);
        }}
      />

      <HeaderActionMenu
        open={headerMenuOpen}
        position={headerMenuPosition}
        sessionActionsExpanded={sessionActionsExpanded}
        onClose={closeHeaderMenu}
        onOpenSettings={openSettingsPanel}
        onOpenNotes={openNotesPanel}
        onOpenTags={openTagsPanel}
        onOpenCaseLibrary={openCaseLibrary}
        onToggleSessionActions={() => setSessionActionsExpanded((currentValue) => !currentValue)}
        onOpenClearChatConfirmation={openClearChatConfirmation}
        onOpenDeleteSessionConfirmation={openDeleteSessionConfirmation}
        disableClearChat={isClearingChat || isDeletingSession || messages.length === 0}
        disableDeleteSession={isDeletingSession || isClearingChat}
      />
    </>
  );
}

function formatCompactDate(date: Date | string) {
  const value = typeof date === "string" ? new Date(date) : date;

  return new Intl.DateTimeFormat("es-MX", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function TopIconButton({
  label,
  title,
  onClick,
  active = false,
  children,
}: {
  label: string;
  title: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex size-11 items-center justify-center rounded-full border text-[var(--foreground)] shadow-[0_8px_24px_rgba(24,35,47,0.08)] transition hover:-translate-y-px",
        active
          ? "border-[rgba(15,95,92,0.24)] bg-[rgba(15,95,92,0.12)]"
          : "border-[var(--line)] bg-white/82 hover:bg-white",
      )}
      onClick={onClick}
      aria-label={label}
      title={title}
    >
      {children}
    </button>
  );
}

function MenuRowButton({
  icon,
  label,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-[1.2rem] px-3 py-3 text-left transition hover:bg-[rgba(15,95,92,0.07)]"
    >
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[rgba(24,35,47,0.05)] text-[var(--muted-strong)]">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-[var(--foreground)]">{label}</span>
        <span className="mt-1 block text-xs text-[var(--muted)]">{description}</span>
      </span>
    </button>
  );
}

function HeaderActionMenu({
  open,
  position,
  sessionActionsExpanded,
  onClose,
  onOpenSettings,
  onOpenNotes,
  onOpenTags,
  onOpenCaseLibrary,
  onToggleSessionActions,
  onOpenClearChatConfirmation,
  onOpenDeleteSessionConfirmation,
  disableClearChat,
  disableDeleteSession,
}: {
  open: boolean;
  position: FloatingMenuPosition | null;
  sessionActionsExpanded: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  onOpenNotes: () => void;
  onOpenTags: () => void;
  onOpenCaseLibrary: () => void;
  onToggleSessionActions: () => void;
  onOpenClearChatConfirmation: () => void;
  onOpenDeleteSessionConfirmation: () => void;
  disableClearChat: boolean;
  disableDeleteSession: boolean;
}) {
  if (!open || !position) {
    return null;
  }

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Cerrar acciones de chat"
        className="fixed inset-0 z-40 cursor-default"
        onClick={onClose}
      />
      <div
        className="theme-drawer fixed z-50 rounded-[1.55rem] border border-[var(--line)] bg-[rgba(255,252,246,0.97)] p-2 shadow-[0_22px_58px_rgba(24,35,47,0.16)] backdrop-blur-xl"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          width: `${position.width}px`,
        }}
      >
        <div className="space-y-1">
          <MenuRowButton
            icon={<SettingsIcon />}
            label="Configuración LLM"
            description="Modelo y conexión"
            onClick={onOpenSettings}
          />
          <MenuRowButton
            icon={<NotesIcon />}
            label="Contexto"
            description="Notas del chat"
            onClick={onOpenNotes}
          />
          <MenuRowButton
            icon={<TagIcon />}
            label="Taxonomía"
            description="Etiquetas"
            onClick={onOpenTags}
          />
        </div>

        <div className="my-2 h-px bg-[rgba(24,35,47,0.08)]" />

        <div className="flex items-center justify-between gap-4 rounded-[1.2rem] px-3 py-3">
          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">Tema</p>
            <p className="text-xs text-[var(--muted)]">Ajusta el modo visual</p>
          </div>
          <ThemeToggle />
        </div>

        <button
          type="button"
          className="flex w-full items-center justify-between gap-4 rounded-[1.2rem] px-3 py-3 text-left transition hover:bg-[rgba(15,95,92,0.07)]"
          onClick={onOpenCaseLibrary}
        >
          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">Dataset examples</p>
            <p className="text-xs text-[var(--muted)]">Abrir biblioteca</p>
          </div>
          <span className="text-sm font-medium text-[var(--muted-strong)]">Abrir</span>
        </button>

        <div className="my-2 h-px bg-[rgba(24,35,47,0.08)]" />

        <button
          type="button"
          className="flex w-full items-center justify-between gap-4 rounded-[1.2rem] px-3 py-3 text-left transition hover:bg-[rgba(15,95,92,0.07)]"
          onClick={onToggleSessionActions}
        >
          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">Acciones de la sesión</p>
            <p className="text-xs text-[var(--muted)]">Expandir opciones destructivas</p>
          </div>
          <DisclosureCaretIcon expanded={sessionActionsExpanded} />
        </button>

        {sessionActionsExpanded ? (
          <div className="mt-2 space-y-2 rounded-[1.2rem] border border-[rgba(24,35,47,0.08)] bg-[rgba(248,245,238,0.9)] p-2">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 rounded-[1rem] px-3 py-3 text-left transition hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onOpenClearChatConfirmation}
              disabled={disableClearChat}
            >
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">Limpiar chat</p>
                <p className="text-xs text-[var(--muted)]">Mantiene la sesión</p>
              </div>
            </button>

            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 rounded-[1rem] bg-rose-600 px-3 py-3 text-left text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onOpenDeleteSessionConfirmation}
              disabled={disableDeleteSession}
            >
              <div>
                <p className="text-sm font-medium">Eliminar chat</p>
                <p className="text-xs text-rose-100">Permanente</p>
              </div>
            </button>
          </div>
        ) : null}
      </div>
    </>,
    document.body,
  );
}

function DisclosureCaretIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={cn("size-4 fill-none stroke-current stroke-[1.7] text-[var(--muted-strong)] transition", expanded ? "rotate-180" : "")}
    >
      <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SidebarSection({
  title,
  soft = false,
  className,
  children,
}: {
  title: string;
  soft?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-[1.7rem] border p-5 shadow-[0_16px_36px_rgba(24,35,47,0.05)]",
        soft
          ? "border-[rgba(24,35,47,0.05)] bg-[rgba(234,228,217,0.62)]"
          : "border-[rgba(24,35,47,0.07)] bg-[rgba(255,252,246,0.76)]",
        className,
      )}
    >
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
        {title}
      </p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SidebarStat({
  value,
  label,
}: {
  value: string | number;
  label: string;
}) {
  return (
    <div className="rounded-[1.15rem] bg-white/82 px-4 py-4">
      <p className="editorial-heading text-[2rem] leading-none text-[var(--foreground)]">{value}</p>
      <p className="mt-2 text-[0.68rem] uppercase tracking-[0.22em] text-[var(--muted)]">{label}</p>
    </div>
  );
}

function BackArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-[1.8]">
      <path d="M19 12H5" strokeLinecap="round" />
      <path d="m11 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-[1.7]">
      <path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1L6.5 8.5l4.1-1.4L12 3Z" />
      <path d="m18.6 14.1.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />
      <path d="m5.1 13.8.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7.7-1.9Z" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6 fill-none stroke-current stroke-[1.8]">
      <path d="M5 7.25h14" strokeLinecap="round" />
      <path d="M7 7.25V17a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V7.25" strokeLinecap="round" />
      <path d="M9.75 4.5h4.5" strokeLinecap="round" />
      <path d="M12 10v4.5" strokeLinecap="round" />
      <path d="M10.25 12.25H13.75" strokeLinecap="round" />
    </svg>
  );
}

function NotesIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-[1.8]">
      <path d="M12 17.5v-5" strokeLinecap="round" />
      <path d="M12 8.75h.01" strokeLinecap="round" />
      <circle cx="12" cy="12" r="8.25" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-[1.8]">
      <path d="M11 4.5H6.75A2.25 2.25 0 0 0 4.5 6.75V11l7.75 8 8-7.75-8-6.75Z" strokeLinejoin="round" />
      <circle cx="8.1" cy="8.1" r="1.1" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-[1.8]">
      <path d="M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z" />
      <path d="M19 12a7.84 7.84 0 0 0-.12-1.4l1.82-1.41-1.75-3.02-2.2.9a8.34 8.34 0 0 0-2.42-1.4L14 3.25h-4l-.33 2.42a8.34 8.34 0 0 0-2.42 1.4l-2.2-.9L3.3 9.19l1.82 1.41A8.58 8.58 0 0 0 5 12c0 .47.04.94.12 1.4L3.3 14.81l1.75 3.02 2.2-.9c.74.59 1.56 1.06 2.42 1.4L10 20.75h4l.33-2.42c.86-.34 1.68-.81 2.42-1.4l2.2.9 1.75-3.02-1.82-1.41c.08-.46.12-.93.12-1.4Z" strokeLinejoin="round" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-3.5 fill-none stroke-current stroke-[1.6]">
      <path
        d="M13.75 3.75a1.768 1.768 0 0 1 2.5 2.5l-8.5 8.5-3 .5.5-3 8.5-8.5Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RetryIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-3.5 fill-none stroke-current stroke-[1.6]">
      <path d="M16.25 10a6.25 6.25 0 1 1-1.831-4.419" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.75 3.75h3.5v3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5 fill-current">
      <path d="M5.25 4.5 15 10l-9.75 5.5V4.5Z" />
    </svg>
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

function ChatHistoryDrawer({
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
    <div className="theme-overlay fixed inset-0 z-50 flex items-stretch justify-start backdrop-blur-[1px]">
      <div className="theme-drawer relative flex h-full w-full max-w-full flex-col border-r border-[var(--line)] sm:max-w-[28rem]">
        <div className="border-b border-[var(--line)] px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                Sidebar izquierdo
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
      <button type="button" aria-label="Cerrar historial" className="flex-1" onClick={onClose} />
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

function EditConflictModal({
  open,
  isBusy,
  canSave,
  onCancel,
  onDiscard,
  onSave,
}: {
  open: boolean;
  isBusy: boolean;
  canSave: boolean;
  onCancel: () => void;
  onDiscard: () => void;
  onSave: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="theme-overlay fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-[1px] sm:p-6">
      <button
        type="button"
        aria-label="Cerrar confirmación de edición"
        className="absolute inset-0"
        onClick={onCancel}
      />
      <div className="theme-drawer relative w-full max-w-lg rounded-[2rem] border border-[var(--line)] p-6 shadow-[0_20px_56px_rgba(15,23,42,0.24)] sm:p-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
          Edición en curso
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          Guardar cambios o descartarlos
        </h2>
        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
          Hay cambios sin guardar en este turno. Puedes guardarlos antes de editar otro mensaje o descartarlos y continuar.
        </p>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" className="button-secondary" onClick={onCancel} disabled={isBusy}>
            Cancelar
          </button>
          <button type="button" className="button-secondary" onClick={onDiscard} disabled={isBusy}>
            Descartar cambios
          </button>
          <button type="button" className="button-primary" onClick={onSave} disabled={isBusy || !canSave}>
            {isBusy ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}
