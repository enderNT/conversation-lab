import { serializeChatRequest } from "@/lib/session-chat";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      messages: {
        orderBy: {
          orderIndex: "asc",
        },
        select: {
          id: true,
          role: true,
          text: true,
          orderIndex: true,
          createdAt: true,
          metadataJson: true,
        },
      },
      chatRequests: {
        orderBy: {
          updatedAt: "desc",
        },
        take: 1,
        select: {
          id: true,
          sessionId: true,
          userMessageId: true,
          status: true,
          transport: true,
          integrationRequestId: true,
          errorMessage: true,
          responseMessageId: true,
          createdAt: true,
          updatedAt: true,
          completedAt: true,
        },
      },
    },
  });

  if (!session) {
    return Response.json({ error: "Session not found." }, { status: 404 });
  }

  return Response.json({
    messages: session.messages.map((message) => ({
      id: message.id,
      role: message.role,
      text: message.text,
      orderIndex: message.orderIndex,
      createdAt: message.createdAt.toISOString(),
      isEdited:
        !!message.metadataJson &&
        typeof message.metadataJson === "object" &&
        !Array.isArray(message.metadataJson) &&
        typeof message.metadataJson.editedAt === "string",
    })),
    chatRequest: serializeChatRequest(session.chatRequests[0]),
  });
}
