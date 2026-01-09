import { ClientSigner, toX402Client } from "./signer";
import { wrapFetchWithPayment } from "@x402/fetch";
import { createSIWxMessage, encodeSIWxHeader, type SIWxPayload } from "./siwx";

/**
 * Cache interface for storing SIWx sessions
 */
export interface SIWxSessionCache {
  get: (signer: string) => Promise<SIWxPayload | undefined>;
  set: (signer: string, value: SIWxPayload) => Promise<boolean>;
}

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

  /**
   * Optional SIWx session cache to reuse signed messages
   */
  sessionCache?: SIWxSessionCache;
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
    let siwxHeader: string;

    // Get SIWx header from cache if available, then validate expiration
    const cachedPayload = await options?.sessionCache?.get(signer.address);
    if (cachedPayload && new Date(cachedPayload.expirationTime) > new Date()) {
      const message = createSIWxMessage(cachedPayload);
      const signature = cachedPayload.signature;
      siwxHeader = encodeSIWxHeader(message, signature);
    } else {
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
      const payload: Omit<SIWxPayload, "signature"> = {
        domain,
        address: String(signer.address),
        uri,
        version: "1",
        chainId: signer.network,
        expirationTime: generateExpirationTime(),
      };
      // Sign the payload to get the base64-encoded header
      const signature = await signer.signPayload(payload);
      siwxHeader = encodeSIWxHeader(createSIWxMessage(payload), signature);

      // Store in cache if available
      if (options?.sessionCache) {
        const fullPayload: SIWxPayload = {
          ...payload,
          signature,
        };
        await options.sessionCache.set(signer.address, fullPayload);
      }
    }

    // Merge headers - convert to plain object for compatibility with x402 fetch wrapper
    // (spreading a Headers object doesn't copy its entries)
    const existingHeaders = new Headers(init?.headers);
    const headersObject: Record<string, string> = {};
    existingHeaders.forEach((value, key) => {
      headersObject[key] = value;
    });
    headersObject["SIGN-IN-WITH-X"] = siwxHeader;

    // Call fetch with payment handling and SIWx auth
    // Convert URL to string for compatibility
    const requestInput = input instanceof URL ? input.href : input;
    return fetchWithPayment(requestInput, {
      ...init,
      headers: headersObject,
    });
  };
}
