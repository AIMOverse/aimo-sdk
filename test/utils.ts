export const chatCompletionsMessages = [
  {
    role: "system" as const,
    content: "You are a helpful assistant. Keep your replies very brief.",
  },
  {
    role: "user" as const,
    content: "What's the meaning of life",
  },
];

export const chatCompletionsRequestBody = {
  model: "openai/gpt-5",
  stream: false,
  max_tokens: 100,
  messages: chatCompletionsMessages,
};
