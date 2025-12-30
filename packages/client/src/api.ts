/**
 * AiMo API Client
 *
 * Provides a typed client for interacting with AiMo API endpoints.
 * @module
 */

/**
 * API endpoint paths (without base URL or API version prefix)
 */
export const AimoEndpoints = {
  /** OpenAI-compatible chat completions endpoint */
  chatCompletions: "/chat/completions",
  /** Session balance query endpoint (requires SIWx auth) */
  sessionBalance: "/session/balance",
};

/**
 * Default API base path
 *
 * Example: "/api/v1" => "https://example.com/api/v1/chat/completions"
 */
export const ApiBase = "/api/v1";

/**
 * Session balance response from the API
 */
export interface SessionBalanceResponse {
  /** CAIP-10 account identifier (e.g., "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:address") */
  caip_account_id: string;
  /** Balance in micro USDC (1 USDC = 1,000,000 micro USDC) */
  balance_micro_usdc: number;
  /** Human-readable balance in USD */
  balance_usd: string;
}

/**
 * Options for creating an AimoClient instance
 */
export interface AimoClientOptions {
  /**
   * The fetch function to use for requests.
   * Use `wrapFetchWithSigner` to add SIWx authentication and x402 payment handling.
   */
  fetch: typeof globalThis.fetch;
  /**
   * Base URL of the API server (e.g., "https://api.aimo.network")
   */
  baseUrl: string;
  /**
   * API base path prefix (default: "/api/v1")
   */
  apiBase?: string;
  /**
   * Override default endpoint paths
   */
  endpointsOverride?: Partial<typeof AimoEndpoints>;
}

/**
 * AiMo API Client
 *
 * Provides methods to interact with AiMo API endpoints including
 * chat completions and session balance queries.
 *
 * @example
 * ```typescript
 * import { AimoClient, wrapFetchWithSigner } from "@aimo.network/client";
 * import { EvmClientSigner } from "@aimo.network/evm";
 *
 * // Create a signer
 * const signer = new EvmClientSigner(wallet, "eip155:1");
 *
 * // Wrap fetch with SIWx auth and x402 payment handling
 * const authFetch = wrapFetchWithSigner(fetch, signer);
 *
 * // Create the client
 * const client = new AimoClient({
 *   fetch: authFetch,
 *   baseUrl: "https://api.aimo.network",
 * });
 *
 * // Query session balance
 * const balance = await client.sessionBalance();
 * console.log(`Balance: ${balance.balance_usd}`);
 *
 * // Make a chat completion request
 * const response = await client.chatCompletions({
 *   model: "openai/gpt-4",
 *   messages: [{ role: "user", content: "Hello!" }],
 * });
 * ```
 */
export class AimoClient {
  private readonly fetch: typeof globalThis.fetch;
  private readonly baseUrl: string;
  private readonly apiBase: string;
  private readonly endpoints: typeof AimoEndpoints;

  /**
   * Creates a new AimoClient instance.
   *
   * @param options - Client configuration options
   */
  constructor(options: AimoClientOptions) {
    this.fetch = options.fetch;
    this.baseUrl = options.baseUrl;
    this.apiBase = options.apiBase ?? ApiBase;
    this.endpoints = {
      ...AimoEndpoints,
      ...options.endpointsOverride,
    };
  }

  /**
   * Handles error responses from the API.
   * Attempts to parse JSON error body for detailed error messages.
   *
   * @param response - The failed response
   * @throws Error with status and error details
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    let errorBody: any;
    try {
      errorBody = await response.json();
    } catch (e) {
      // If response is not JSON/text, rethrow generic error
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`
      );
    }

    throw new Error(
      `API request failed: ${response.status} ${response.statusText} - ${errorBody.error || JSON.stringify(errorBody)}`
    );
  }

  /**
   * Builds the full URL for an endpoint.
   * Handles slash normalization to avoid double slashes.
   */
  private buildUrl(
    endpoint: (typeof AimoEndpoints)[keyof typeof AimoEndpoints]
  ): string {
    // Ensure no double slashes
    return `${this.baseUrl.replace(/\/+$/, "")}/${this.apiBase.replace(
      /^\/+|\/+$/g,
      ""
    )}/${endpoint.replace(/^\/+/, "")}`;
  }

  /**
   * Sends a chat completion request.
   *
   * This endpoint is OpenAI-compatible and supports streaming responses.
   * If using with x402 payment-required resources, ensure fetch is wrapped
   * with `wrapFetchWithSigner`.
   *
   * @param body - The chat completion request body (OpenAI-compatible format)
   * @param init - Additional fetch options (headers will be merged)
   * @returns The raw Response object (for streaming support)
   *
   * @example
   * ```typescript
   * const response = await client.chatCompletions({
   *   model: "openai/gpt-4",
   *   messages: [
   *     { role: "system", content: "You are a helpful assistant." },
   *     { role: "user", content: "Hello!" },
   *   ],
   *   stream: false,
   * });
   *
   * if (response.ok) {
   *   const data = await response.json();
   *   console.log(data.choices[0].message.content);
   * }
   * ```
   */
  async chatCompletions(body: unknown, init?: RequestInit): Promise<Response> {
    const url = this.buildUrl(this.endpoints.chatCompletions);
    const headers = new Headers(init?.headers);
    headers.set("Content-Type", "application/json");

    return this.fetch(url, {
      ...init,
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  }

  /**
   * Queries the session balance for the authenticated wallet.
   *
   * Requires SIWx authentication header. Use `wrapFetchWithSigner` to
   * automatically add the authentication header.
   *
   * @param init - Additional fetch options
   * @returns Session balance information including CAIP account ID and balance
   * @throws Error if the request fails or authentication is invalid
   *
   * @example
   * ```typescript
   * const balance = await client.sessionBalance();
   * console.log(`Account: ${balance.caip_account_id}`);
   * console.log(`Balance: ${balance.balance_usd}`);
   * console.log(`Micro USDC: ${balance.balance_micro_usdc}`);
   * ```
   */
  async sessionBalance(init?: RequestInit): Promise<SessionBalanceResponse> {
    const url = this.buildUrl(this.endpoints.sessionBalance);

    const response = await this.fetch(url, {
      ...init,
      method: "GET",
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    return response.json();
  }
}
