import { ClientSigner, toX402Client } from "./signer";
import { wrapFetchWithPayment } from "@x402/fetch";
import type { SIWxPayload } from "./siwx";

/**
 * Generate an expiration time ISO string (default: 1 hour from now)
 */
function generateExpirationTime(): string {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString();
}

/**
 * Extract domain from a URL or Request
 */
function extractDomain(input: RequestInfo | URL): string {
  let url: URL;
  if (typeof input === "string") {
    url = new URL(input);
  } else if (input instanceof URL) {
    url = input;
  } else {
    url = new URL(input.url);
  }
  return url.host;
}

/**
 * Options for wrapping fetch with signer
 */
export interface WrapFetchOptions {
  /**
   * Override the domain used for SIWx signing.
   * If not provided, the domain is extracted from the request URL.
   */
  siwxDomain?: string;
}

/**
 * Wraps a fetch function to add both x402 payment handling and SIWx authentication.
 *
 * This wrapper:
 * 1. Adds a `SIGN-IN-WITH-X` header for wallet-based authentication
 * 2. Handles x402 Payment Required responses automatically
 *
 * @param fetch - The fetch function to wrap
 * @param signer - The client signer for authentication and payments
 * @param options - Optional configuration
 * @returns A wrapped fetch function
 *
 * @example
 * ```typescript
 * import { wrapFetchWithSigner } from "@aimo.network/client";
 * import { EvmClientSigner } from "@aimo.network/evm";
 *
 * const signer = new EvmClientSigner(walletClient, "eip155:1");
 * const fetchWithAuth = wrapFetchWithSigner(fetch, signer);
 *
 * // All requests will include SIWx auth and handle payments
 * const response = await fetchWithAuth("https://api.example.com/resource");
 * ```
 */
export function wrapFetchWithSigner(
  fetch: typeof globalThis.fetch,
  signer: ClientSigner,
  options?: WrapFetchOptions
): typeof globalThis.fetch {
  const client = toX402Client(signer);
  const fetchWithPayment = wrapFetchWithPayment(fetch, client);

  return async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    // Use provided siwxDomain or extract from URL
    const domain = options?.siwxDomain ?? extractDomain(input);

    // Build URI - if siwxDomain is provided, rewrite the URL to use that domain
    let uri: string;
    if (options?.siwxDomain) {
      const originalUrl = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url
      );
      // Rewrite URI with the siwxDomain (preserve path and query)
      uri = `https://${options.siwxDomain}${originalUrl.pathname}${originalUrl.search}`;
    } else {
      uri =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
    }

    // Create SIWx payload for authentication
    const payload: SIWxPayload = {
      domain,
      address: String(signer.address),
      uri,
      version: "1",
      chainId: signer.network,
      expirationTime: generateExpirationTime(),
      signature: "", // Will be filled by signPayload
    };

    // Sign the payload to get the base64-encoded header
    const siwxHeader = await signer.signPayload(payload);

    // Merge headers
    const headers = new Headers(init?.headers);
    headers.set("SIGN-IN-WITH-X", siwxHeader);

    // Call fetch with payment handling and SIWx auth
    // Convert URL to string for compatibility
    const requestInput = input instanceof URL ? input.href : input;
    return fetchWithPayment(requestInput, {
      ...init,
      headers,
    });
  };
}
