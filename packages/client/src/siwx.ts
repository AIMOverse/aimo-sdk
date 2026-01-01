/**
 * Sign-In-With-X (SIWx) Client SDK
 *
 * Implements CAIP-122 standard wallet-based identity assertions.
 * This module allows clients to prove control of a wallet for authentication.
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Network identifier in CAIP-2 format
 */
export type Network = `${string}:${string}`;

/**
 * Supported signature schemes for SIWx
 */
export type SignatureScheme =
  | "eip191"
  | "eip712"
  | "eip1271"
  | "eip6492"
  | "siws"
  | "sep10";

/**
 * SIWx payload containing the message fields and signature
 */
export interface SIWxPayload {
  /** Domain that requested the signature */
  domain: string;
  /** Address of the signer */
  address: string;
  /** Optional statement */
  statement?: string;
  /** URI of the resource */
  uri: string;
  /** SIWx version */
  version: string;
  /** Chain ID in CAIP-2 format */
  chainId: string;
  /** Optional nonce */
  nonce?: string;
  /** Optional time when the message was issued */
  issuedAt?: string;
  /** Time when the message expires (required) */
  expirationTime: string;
  /** Time before which the message is not valid */
  notBefore?: string;
  /** Optional request identifier */
  requestId?: string;
  /** List of resources */
  resources?: string[];
  /** Signature over the message */
  signature: string;
}

/**
 * Signer interface for signing SIWx messages
 */
export interface SIWxSigner {
  /** Sign a SIWx payload and return the base64-encoded envelope */
  signPayload(payload: SIWxPayload): Promise<string>;
}

// ============================================================================
// Client-Side Functions
// ============================================================================

/**
 * Get the chain name from a CAIP-2 chain ID
 */
function getChainName(chainId: string): string {
  if (chainId.startsWith("eip155:")) {
    return "Ethereum";
  }
  if (chainId.startsWith("solana:")) {
    return "Solana";
  }
  // Extract namespace for unknown chains
  const namespace = chainId.split(":")[0];
  return namespace.charAt(0).toUpperCase() + namespace.slice(1);
}

/**
 * Create a CAIP-122 formatted SIWx message string from a payload
 *
 * @param payload - SIWx payload (signature field is ignored)
 * @returns CAIP-122 formatted message string
 *
 * @example
 * ```typescript
 * const message = createSIWxMessage({
 *   domain: "example.com",
 *   address: "0x1234...",
 *   uri: "https://example.com/resource",
 *   version: "1",
 *   chainId: "eip155:1",
 *   expirationTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
 *   signature: "", // ignored
 * });
 * ```
 */
export function createSIWxMessage(
  payload: Omit<SIWxPayload, "signature"> | SIWxPayload
): string {
  const chainName = getChainName(payload.chainId);

  const lines: string[] = [
    `${payload.domain} wants you to sign in with your ${chainName} account:`,
    payload.address,
    "",
  ];

  if (payload.statement) {
    lines.push(payload.statement);
    lines.push("");
  }

  lines.push(`URI: ${payload.uri}`);
  lines.push(`Version: ${payload.version}`);
  lines.push(`Chain ID: ${payload.chainId}`);

  if (payload.nonce) {
    lines.push(`Nonce: ${payload.nonce}`);
  }

  if (payload.issuedAt) {
    lines.push(`Issued At: ${payload.issuedAt}`);
  }

  lines.push(`Expiration Time: ${payload.expirationTime}`);

  if (payload.notBefore) {
    lines.push(`Not Before: ${payload.notBefore}`);
  }

  if (payload.requestId) {
    lines.push(`Request ID: ${payload.requestId}`);
  }

  if (payload.resources && payload.resources.length > 0) {
    lines.push("Resources:");
    for (const resource of payload.resources) {
      lines.push(`- ${resource}`);
    }
  }

  return lines.join("\n");
}

/**
 * Encode a signed SIWx envelope as a base64 header value
 *
 * @param message - The CAIP-122 formatted message string
 * @param signature - The signature over the message
 * @returns Base64-encoded header value
 *
 * @example
 * ```typescript
 * const header = encodeSIWxHeader(message, signature);
 * fetch(url, {
 *   headers: { "SIGN-IN-WITH-X": header }
 * });
 * ```
 */
export function encodeSIWxHeader(message: string, signature: string): string {
  const envelope = { message, signature };
  return btoa(JSON.stringify(envelope));
}

/**
 * Prepare a SIWx payload for signing
 *
 * This is a convenience function that creates the message and provides
 * a helper to encode the final header after signing.
 *
 * @param payload - SIWx payload (without signature)
 * @returns Object containing the message to sign and a function to create the header
 *
 * @example
 * ```typescript
 * const { message, createHeader } = prepareSIWxForSigning(payload);
 * const signature = await signer.signMessage(message);
 * const header = createHeader(signature);
 * ```
 */
export function prepareSIWxForSigning(
  payload: Omit<SIWxPayload, "signature">
): {
  message: string;
  createHeader: (signature: string) => string;
} {
  const message = createSIWxMessage(payload);

  return {
    message,
    createHeader: (signature: string) => encodeSIWxHeader(message, signature),
  };
}
