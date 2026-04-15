import OpenAI from "openai";

export const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";

type ConversationMessage = {
  role: "user" | "assistant";
  text: string;
};

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not configured. Add it to your environment to enable session chat.",
    );
  }

  return new OpenAI({
    apiKey,
  });
}

export function getConfiguredOpenAIModel() {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
}

export async function generateAssistantReply(messages: ConversationMessage[]) {
  const response = await getOpenAIClient().chat.completions.create({
    model: getConfiguredOpenAIModel(),
    messages: messages.map((message) => ({
      role: message.role,
      content: message.text,
    })),
  });

  const content = response.choices[0]?.message?.content;
  const text = typeof content === "string" ? content.trim() : "";

  if (!text) {
    throw new Error("The configured model returned an empty response.");
  }

  return {
    text,
    model: response.model,
    responseId: response.id,
  };
}