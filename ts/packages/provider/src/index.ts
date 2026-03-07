import { createOpenAI } from "@ai-sdk/openai";
import { ApiBase, ClientSigner, wrapFetchWithSigner } from "@bitrouter/client";
import { LanguageModelV3 } from "@ai-sdk/provider";

/**
 * Options for configuring the BitRouter Network provider
 */
export interface BitRouterNetworkOptions {
  /**
   * The signer used for payments and authenticating requests
   */
  signer: ClientSigner;
  /**
   * Optional base URL for the BitRouter Network API.
   *
   * Defaults to https://beta.bitrouter.io
   */
  baseURL?: string;
  /**
   * Optional fetch implementation to use.
   *
   * If not provided, the global fetch will be used.
   */
  fetch?: typeof globalThis.fetch;
  /**
   * Optional API key for BitRouter Network.
   */
  apiKey?: string;
  /**
   * Optional domain for SIWX authentication.
   */
  siwxDomain?: string;
}

/**
 * Type representing a BitRouter Network chat model ID
 */
export type BitRouterChatModelId = string & {};

/**
 * Creates a BitRouter Network provider with the given options.
 * @param options - Configuration options for the provider
 * @returns - An object with methods to create chat models
 */
export function bitrouter(options: BitRouterNetworkOptions) {
  const apiBaseURL = options.baseURL || "https://beta.bitrouter.io";
  const baseURL = new URL(ApiBase, apiBaseURL).toString();
  const wrappedFetch = wrapFetchWithSigner(options.fetch || globalThis.fetch, options.signer, {
    siwxDomain: options.siwxDomain,
  });

  const openai = {
    chat: (modelId: BitRouterChatModelId): LanguageModelV3 => {
      const provider = createOpenAI({
        baseURL,
        apiKey: options.apiKey || "siwx", // Dummy key - actual auth is via SIGN-IN-WITH-X header
        fetch: wrappedFetch,
      });

      return provider.chat(modelId);
    },
  };

  return {
    /**
     * Creates an OpenAI-compatible chat model instance with the given model ID.
     * @param modelId - The ID of the chat model to create
     * @returns A LanguageModelV3 instance for the specified chat model
     */
    chat: (modelId: BitRouterChatModelId): LanguageModelV3 => openai.chat(modelId),
  };
}
