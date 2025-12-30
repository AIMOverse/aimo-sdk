export const chatCompletionsRequestBody = {
  model: "openai/gpt-5",
  stream: false,
  max_tokens: 100,
  messages: [
    {
      role: "system",
      content: "You are a helpful assistant. Keep your replies very brief.",
    },
    {
      role: "user",
      content: "What's the meaning of life",
    },
  ],
};
