import { ClientSigner, toX402Client } from "./signer";
import { wrapFetchWithPayment } from "@x402/fetch";
import type { SIWxPayload } from "./siwx";

/**
 * Generate a cryptographically secure nonce
 */
function generateNonce(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  const array = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    // Last resort fallback (not cryptographically secure)
    for (let i = 0; i < 16; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
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
 * Wraps a fetch function to add both x402 payment handling and SIWx authentication.
 *
 * This wrapper:
 * 1. Adds a `SIGN-IN-WITH-X` header for wallet-based authentication
 * 2. Handles x402 Payment Required responses automatically
 *
 * @param fetch - The fetch function to wrap
 * @param signer - The client signer for authentication and payments
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
  signer: ClientSigner
): typeof globalThis.fetch {
  const client = toX402Client(signer);
  const fetchWithPayment = wrapFetchWithPayment(fetch, client);

  return async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const domain = extractDomain(input);
    const uri =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;

    // Create SIWx payload for authentication
    const payload: SIWxPayload = {
      domain,
      address: String(signer.address),
      uri,
      version: "1",
      chainId: signer.network,
      nonce: generateNonce(),
      issuedAt: new Date().toISOString(),
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
