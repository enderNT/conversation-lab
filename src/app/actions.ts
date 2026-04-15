"use server";

import { CaseStatus, MessageRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { deriveLastUserMessage, toConversationSlice } from "@/lib/cases";
import { generateAssistantReply } from "@/lib/openai";
import { prisma } from "@/lib/prisma";
import { asOptionalString } from "@/lib/utils";

const projectSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio"),
  description: z.string().trim().default(""),
});

const sessionSchema = z.object({
  title: z.string().trim().optional().default(""),
});

const chatTurnSchema = z.object({
  text: z.string().trim().min(1, "El mensaje no puede estar vacío"),
});

const caseSchema = z.object({
  title: z.string().trim().optional().default(""),
  lastUserMessage: z.string().trim().default(""),
  expectedRoute: z.string().trim().default(""),
  idealSearchQuery: z.string().trim().default(""),
  idealAnswer: z.string().trim().default(""),
  expectedTool: z.string().trim().default(""),
  notes: z.string().trim().default(""),
  status: z.nativeEnum(CaseStatus),
});

export async function createProject(formData: FormData) {
  const parsed = projectSchema.parse({
    name: asOptionalString(formData.get("name")),
    description: asOptionalString(formData.get("description")),
  });

  const project = await prisma.project.create({
    data: parsed,
  });

  revalidatePath("/");
  redirect(`/projects/${project.id}`);
}

export async function createSession(projectId: string, formData: FormData) {
  const parsed = sessionSchema.parse({
    title: asOptionalString(formData.get("title")),
  });

  const session = await prisma.session.create({
    data: {
      projectId,
      title: parsed.title || null,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}/sessions/${session.id}`);
}

export async function sendSessionMessage(
  projectId: string,
  sessionId: string,
  input: { text: string },
) {
  const parsed = chatTurnSchema.parse({
    text: input.text,
  });

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      projectId: true,
      messages: {
        orderBy: { orderIndex: "asc" },
        select: {
          role: true,
          text: true,
        },
      },
    },
  });

  if (!session || session.projectId !== projectId) {
    return {
      ok: false as const,
      error: "La sesión no existe o no pertenece al proyecto indicado.",
    };
  }

  try {
    const assistantReply = await generateAssistantReply([
      ...session.messages.map((message) => ({
        role: message.role,
        text: message.text,
      })),
      {
        role: MessageRole.user,
        text: parsed.text,
      },
    ]);

    await prisma.$transaction(async (tx) => {
      const lastMessage = await tx.message.findFirst({
        where: { sessionId },
        orderBy: { orderIndex: "desc" },
        select: { orderIndex: true },
      });

      const nextOrderIndex = (lastMessage?.orderIndex ?? -1) + 1;

      await tx.message.create({
        data: {
          sessionId,
          role: MessageRole.user,
          text: parsed.text,
          orderIndex: nextOrderIndex,
          metadataJson: {
            source: "session_chat",
          },
        },
      });

      await tx.message.create({
        data: {
          sessionId,
          role: MessageRole.assistant,
          text: assistantReply.text,
          orderIndex: nextOrderIndex + 1,
          metadataJson: {
            source: "openai",
            model: assistantReply.model,
            response_id: assistantReply.responseId,
          },
        },
      });
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No fue posible obtener una respuesta del modelo.";

    return {
      ok: false as const,
      error: message,
    };
  }

  revalidatePath(`/projects/${projectId}/sessions/${sessionId}`);

  return {
    ok: true as const,
  };
}

export async function createCase(
  projectId: string,
  sessionId: string,
  formData: FormData,
) {
  const startOrderIndex = Number.parseInt(String(formData.get("startOrderIndex") ?? ""), 10);
  const endOrderIndex = Number.parseInt(String(formData.get("endOrderIndex") ?? ""), 10);

  if (
    !Number.isInteger(startOrderIndex) ||
    !Number.isInteger(endOrderIndex) ||
    startOrderIndex > endOrderIndex
  ) {
    throw new Error("La selección de mensajes no es válida.");
  }

  const messages = await prisma.message.findMany({
    where: {
      sessionId,
      orderIndex: {
        gte: startOrderIndex,
        lte: endOrderIndex,
      },
    },
    orderBy: { orderIndex: "asc" },
  });

  if (messages.length !== endOrderIndex - startOrderIndex + 1) {
    throw new Error("La selección debe ser consecutiva.");
  }

  const conversationSlice = toConversationSlice(messages);
  const parsed = caseSchema.parse({
    title: asOptionalString(formData.get("title")),
    lastUserMessage:
      asOptionalString(formData.get("lastUserMessage")) ||
      deriveLastUserMessage(conversationSlice),
    expectedRoute: asOptionalString(formData.get("expectedRoute")),
    idealSearchQuery: asOptionalString(formData.get("idealSearchQuery")),
    idealAnswer: asOptionalString(formData.get("idealAnswer")),
    expectedTool: asOptionalString(formData.get("expectedTool")),
    notes: asOptionalString(formData.get("notes")),
    status: formData.get("status"),
  });

  const createdCase = await prisma.case.create({
    data: {
      projectId,
      sessionId,
      title: parsed.title || null,
      conversationSliceJson: conversationSlice,
      lastUserMessage: parsed.lastUserMessage,
      labelsJson: {
        expected_route: parsed.expectedRoute,
      },
      artifactsJson: {
        ideal_search_query: parsed.idealSearchQuery,
        ideal_answer: parsed.idealAnswer,
        expected_tool: parsed.expectedTool,
      },
      notes: parsed.notes,
      status: parsed.status,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/sessions/${sessionId}`);
  revalidatePath("/cases");
  redirect(`/cases/${createdCase.id}`);
}

export async function updateCase(caseId: string, formData: FormData) {
  const existingCase = await prisma.case.findUnique({
    where: { id: caseId },
    select: {
      projectId: true,
      sessionId: true,
    },
  });

  if (!existingCase) {
    throw new Error("El caso no existe.");
  }

  const parsed = caseSchema.parse({
    title: asOptionalString(formData.get("title")),
    lastUserMessage: asOptionalString(formData.get("lastUserMessage")),
    expectedRoute: asOptionalString(formData.get("expectedRoute")),
    idealSearchQuery: asOptionalString(formData.get("idealSearchQuery")),
    idealAnswer: asOptionalString(formData.get("idealAnswer")),
    expectedTool: asOptionalString(formData.get("expectedTool")),
    notes: asOptionalString(formData.get("notes")),
    status: formData.get("status"),
  });

  await prisma.case.update({
    where: { id: caseId },
    data: {
      title: parsed.title || null,
      lastUserMessage: parsed.lastUserMessage,
      labelsJson: {
        expected_route: parsed.expectedRoute,
      },
      artifactsJson: {
        ideal_search_query: parsed.idealSearchQuery,
        ideal_answer: parsed.idealAnswer,
        expected_tool: parsed.expectedTool,
      },
      notes: parsed.notes,
      status: parsed.status,
    },
  });

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/cases");
  revalidatePath(`/projects/${existingCase.projectId}`);
  revalidatePath(
    `/projects/${existingCase.projectId}/sessions/${existingCase.sessionId}`,
  );
  redirect(`/cases/${caseId}`);
}

export async function updateCaseStatus(caseId: string, formData: FormData) {
  const parsed = z
    .object({
      status: z.nativeEnum(CaseStatus),
    })
    .parse({
      status: formData.get("status"),
    });

  await prisma.case.update({
    where: { id: caseId },
    data: {
      status: parsed.status,
    },
  });

  revalidatePath("/cases");
  revalidatePath(`/cases/${caseId}`);
}