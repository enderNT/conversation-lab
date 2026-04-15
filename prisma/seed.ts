import "dotenv/config";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { CaseStatus, MessageRole, PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured.");
}

const prisma = new PrismaClient({
  adapter: new PrismaLibSql({
    url: databaseUrl,
  }),
});

async function main() {
  const existingProjects = await prisma.project.count();

  if (existingProjects > 0) {
    return;
  }

  const project = await prisma.project.create({
    data: {
      name: "Demo Conversation Lab",
      description:
        "Proyecto semilla para probar sesiones simuladas y la creación manual de casos.",
    },
  });

  const session = await prisma.session.create({
    data: {
      projectId: project.id,
      title: "Consulta inicial sobre manchas del rostro",
    },
  });

  const messages = await Promise.all([
    prisma.message.create({
      data: {
        sessionId: session.id,
        role: MessageRole.user,
        text: "Busco algo para quitar manchas del rostro.",
        orderIndex: 0,
      },
    }),
    prisma.message.create({
      data: {
        sessionId: session.id,
        role: MessageRole.assistant,
        text: "Claro, puedo ayudarte con algunas opciones para uso diario.",
        orderIndex: 1,
      },
    }),
    prisma.message.create({
      data: {
        sessionId: session.id,
        role: MessageRole.user,
        text: "Prefiero algo que no sea muy agresivo porque tengo piel sensible.",
        orderIndex: 2,
      },
    }),
    prisma.message.create({
      data: {
        sessionId: session.id,
        role: MessageRole.assistant,
        text: "Entonces conviene orientar la búsqueda a despigmentantes suaves y protector solar diario.",
        orderIndex: 3,
      },
    }),
  ]);

  await prisma.case.create({
    data: {
      projectId: project.id,
      sessionId: session.id,
      title: "Caso de recomendación de producto sin diagnóstico",
      conversationSliceJson: messages.slice(0, 2).map((message) => ({
        id: message.id,
        role: message.role,
        text: message.text,
        orderIndex: message.orderIndex,
        createdAt: message.createdAt.toISOString(),
        metadataJson: message.metadataJson,
      })),
      lastUserMessage: messages[0].text,
      labelsJson: {
        expected_route: "rag_subgraph",
      },
      artifactsJson: {
        ideal_search_query:
          "productos para manchas del rostro despigmentantes uso diario piel sensible",
        ideal_answer:
          "Puedo ayudarte con opciones suaves para manchas del rostro, priorizando fórmulas despigmentantes de uso diario y acompañadas de protector solar.",
        expected_tool: "search_products",
      },
      notes: "Caso orientado a recomendación de producto, no diagnóstico médico.",
      status: CaseStatus.approved,
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });