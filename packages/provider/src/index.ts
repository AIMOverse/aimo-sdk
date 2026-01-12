import { createOpenAI } from "@ai-sdk/openai";
import {
  ApiBase,
  ClientSigner,
  wrapFetchWithSigner,
} from "@aimo.network/client";
import { LanguageModelV3 } from "@ai-sdk/provider";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";

/**
 * Options for configuring the Aimo Network provider
 */
export interface AimoNetworkOptions {
  /**
   * The signer used for payments and authenticating requests
   */
  signer: ClientSigner;
  /**
   * Optional base URL for the Aimo Network API.
   *
   * Defaults to https://beta.aimo.network
   */
  baseURL?: string;
  /**
   * Optional fetch implementation to use.
   *
   * If not provided, the global fetch will be used.
   */
  fetch?: typeof globalThis.fetch;
  /**
   * Optional API key for Aimo Network.
   */
  apiKey?: string;
  /**
   * Optional domain for SIWX authentication.
   */
  siwxDomain?: string;
}

/**
 * Type representing an Aimo Network chat model ID
 */
export type AimoChatModelId = string & {};

/**
 * Creates an Aimo Network provider with the given options.
 * @param options - Configuration options for the provider
 * @returns - An object with methods to create chat models
 */
export function aimoNetwork(options: AimoNetworkOptions) {
  const apiBaseURL = options.baseURL || "https://beta.aimo.network";
  const baseURL = new URL(ApiBase, apiBaseURL).toString();
  const wrappedFetch = wrapFetchWithSigner(
    options.fetch || globalThis.fetch,
    options.signer,
    {
      siwxDomain: options.siwxDomain,
    }
  );

  const openai = {
    chat: (modelId: AimoChatModelId): LanguageModelV3 => {
      const provider = createOpenAI({
        baseURL,
        apiKey: options.apiKey || "siwx", // Dummy key - actual auth is via SIGN-IN-WITH-X header
        fetch: wrappedFetch,
      });

      return provider.chat(modelId);
    },
  };

  const google = {
    chat: (modelId: AimoChatModelId): LanguageModelV3 => {
      const provider = createGoogleGenerativeAI({
        baseURL,
        apiKey: options.apiKey || "siwx", // Dummy key - actual auth is via SIGN-IN-WITH-X header
        fetch: wrappedFetch,
      });

      return provider.chat(modelId);
    },
  };

  const anthropic = {
    chat: (modelId: AimoChatModelId): LanguageModelV3 => {
      const provider = createAnthropic({
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
    chat: (modelId: AimoChatModelId): LanguageModelV3 => openai.chat(modelId),

    openai,
    google,
    anthropic,
  };
}
