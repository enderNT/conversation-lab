import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getWebhookCallbackSecret } from "@/lib/session-chat";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const chatWebhookCallbackSchema = z
  .object({
    sessionId: z.string().trim().min(1),
    userMessageId: z.string().trim().min(1),
    chatRequestId: z.string().trim().min(1),
    status: z.enum(["completed", "failed"]),
    assistantText: z.string().optional(),
    error: z.string().optional(),
    integrationRequestId: z.string().optional(),
    rawResponse: z.unknown().optional(),
  })
  .superRefine((value, context) => {
    if (value.status === "completed" && !value.assistantText?.trim()) {
      context.addIssue({
        code: "custom",
        message: "assistantText es obligatorio cuando status=completed.",
        path: ["assistantText"],
      });
    }

    if (value.status === "failed" && !value.error?.trim()) {
      context.addIssue({
        code: "custom",
        message: "error es obligatorio cuando status=failed.",
        path: ["error"],
      });
    }
  });

function isAuthorized(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return false;
  }

  const token = authorization.slice("Bearer ".length).trim();

  return token === getWebhookCallbackSecret();
}

export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody = (await request.json()) as unknown;
    const parsed = chatWebhookCallbackSchema.safeParse(rawBody);

    if (!parsed.success) {
      return Response.json(
        {
          error: parsed.error.issues[0]?.message ?? "Invalid callback payload.",
        },
        { status: 400 },
      );
    }

    const payload = parsed.data;
    const rawResponsePayload =
      payload.rawResponse === undefined ? (payload as unknown as Prisma.JsonValue) : payload.rawResponse;

    const result = await prisma.$transaction(async (tx) => {
      const chatRequest = await tx.chatRequest.findUnique({
        where: { id: payload.chatRequestId },
        select: {
          id: true,
          sessionId: true,
          userMessageId: true,
          status: true,
          transport: true,
          integrationRequestId: true,
          responseMessageId: true,
          userMessage: {
            select: {
              orderIndex: true,
            },
          },
          session: {
            select: {
              projectId: true,
              chatModel: true,
            },
          },
        },
      });

      if (!chatRequest) {
        return {
          status: 404 as const,
          body: { error: "Chat request not found." },
        };
      }

      if (
        chatRequest.sessionId !== payload.sessionId ||
        chatRequest.userMessageId !== payload.userMessageId
      ) {
        return {
          status: 409 as const,
          body: { error: "Callback correlation does not match the stored chat request." },
        };
      }

      if (chatRequest.responseMessageId) {
        return {
          status: 200 as const,
          body: {
            ok: true,
            idempotent: true,
            responseMessageId: chatRequest.responseMessageId,
            projectId: chatRequest.session.projectId,
          },
        };
      }

      const completedAt = new Date();

      if (payload.status === "failed") {
        await tx.chatRequest.update({
          where: { id: payload.chatRequestId },
          data: {
            status: "failed",
            integrationRequestId:
              payload.integrationRequestId?.trim() || chatRequest.integrationRequestId || null,
            errorMessage: payload.error?.trim() || "La integración devolvió un error.",
            responsePayloadJson:
              rawResponsePayload === null || rawResponsePayload === undefined
                ? Prisma.JsonNull
                : (rawResponsePayload as Prisma.InputJsonValue),
            completedAt,
          },
        });

        return {
          status: 200 as const,
          body: {
            ok: true,
            status: "failed",
            projectId: chatRequest.session.projectId,
          },
        };
      }

      const responseMessage = await tx.message.create({
        data: {
          sessionId: payload.sessionId,
          role: "assistant",
          text: payload.assistantText!.trim(),
          orderIndex: chatRequest.userMessage.orderIndex + 1,
          metadataJson: {
            source: "webhook_async",
            chat_request_id: payload.chatRequestId,
            integration_request_id:
              payload.integrationRequestId?.trim() || chatRequest.integrationRequestId || null,
            integration_label: chatRequest.session.chatModel || "",
          },
        },
      });

      await tx.chatRequest.update({
        where: { id: payload.chatRequestId },
        data: {
          status: "completed",
          integrationRequestId:
            payload.integrationRequestId?.trim() || chatRequest.integrationRequestId || null,
          errorMessage: null,
          responseMessageId: responseMessage.id,
          responsePayloadJson:
            rawResponsePayload === null || rawResponsePayload === undefined
              ? Prisma.JsonNull
              : (rawResponsePayload as Prisma.InputJsonValue),
          completedAt,
        },
      });

      return {
        status: 200 as const,
        body: {
          ok: true,
          status: "completed",
          responseMessageId: responseMessage.id,
          projectId: chatRequest.session.projectId,
        },
      };
    });

    if ("projectId" in result.body && typeof result.body.projectId === "string") {
      revalidatePath(`/projects/${result.body.projectId}/sessions/${payload.sessionId}`);
      revalidatePath(`/projects/${result.body.projectId}`);
    }

    return Response.json(result.body, { status: result.status });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No fue posible procesar el callback del chat.",
      },
      { status: 500 },
    );
  }
}
