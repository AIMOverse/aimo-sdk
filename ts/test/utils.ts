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

export function debugFetch(fetch: typeof globalThis.fetch): typeof globalThis.fetch {
  return async (input, init) => {
    console.log("Fetch request:", { input, init });
    const response = await fetch(input, init);

    if (!response.ok) {
      const body = await response.text();
      console.log("Fetch response error:", {
        status: response.status,
        statusText: response.statusText,
        body,
      });
    } else {
      console.log("Fetch response:", {
        status: response.status,
        statusText: response.statusText,
      });
    }

    return response;
  };
}
