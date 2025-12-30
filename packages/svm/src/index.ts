import type { ClientSigner, SIWxPayload } from "@aimo.network/client";
import { createSIWxMessage, prepareSIWxForSigning } from "@aimo.network/client";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import {
  ExactSvmScheme,
  type ClientSvmSigner,
  type ClientSvmConfig,
} from "@x402/svm";
import type {
  Address,
  SignableMessage,
  SignatureDictionary,
  SignatureBytes,
} from "@solana/kit";
import bs58 from "bs58";

/**
 * SVM message signer interface for signing arbitrary messages.
 * This interface is compatible with @solana/kit's MessagePartialSigner.
 *
 * This minimal interface allows for various wallet implementations:
 * - @solana/kit KeyPairSigner
 * - Wallet adapters (Phantom, Solflare, etc.)
 * - Custom wallet implementations
 */
export interface SvmMessageSigner {
  /**
   * The Solana address of the signer
   */
  readonly address: Address;

  /**
   * Signs an array of messages.
   *
   * @param messages - Array of SignableMessage objects to sign
   * @returns Promise resolving to an array of signature dictionaries
   */
  signMessages(
    messages: readonly SignableMessage[]
  ): Promise<readonly SignatureDictionary[]>;
}

/**
 * Combined SVM signer interface that supports both message signing (for SIWx)
 * and transaction signing (for x402 payments).
 *
 * Most Solana wallet implementations implement both MessagePartialSigner
 * and TransactionSigner interfaces.
 */
export type SvmSigner = SvmMessageSigner & ClientSvmSigner;

/**
 * CAIP-2 chain ID for Solana mainnet
 */
export const SOLANA_MAINNET_CHAIN_ID =
  "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

/**
 * CAIP-2 chain ID for Solana devnet
 */
export const SOLANA_DEVNET_CHAIN_ID = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";

/**
 * CAIP-2 chain ID for Solana testnet
 */
export const SOLANA_TESTNET_CHAIN_ID =
  "solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z";

/**
 * SVM client signer that implements the ClientSigner interface.
 * Combines x402 payment signing with SIWx authentication.
 *
 * @example
 * ```typescript
 * import { SvmClientSigner } from "@aimo.network/svm";
 * import { createKeyPairSignerFromBytes } from "@solana/kit";
 *
 * // Create a keypair signer (implements both signMessages and TransactionSigner)
 * const keypairSigner = await createKeyPairSignerFromBytes(privateKeyBytes);
 *
 * // Create the client signer
 * const clientSigner = new SvmClientSigner(keypairSigner);
 *
 * // Use for SIWx authentication
 * const signature = await clientSigner.signPayload(siwxPayload);
 *
 * // Use for x402 payments (via SchemeNetworkClient interface)
 * const paymentPayload = await clientSigner.createPaymentPayload(2, requirements);
 * ```
 */
export class SvmClientSigner implements ClientSigner {
  private readonly signer: SvmSigner;
  private readonly exactScheme: ExactSvmScheme;
  private readonly chainId: `${string}:${string}`;

  /**
   * The SVM network chain ID for x402 v2. Equals to chainId here.
   */
  readonly network: `${string}:${string}`;

  /**
   * The payment scheme identifier
   */
  readonly scheme = "exact";

  /**
   * Creates a new SvmClientSigner instance.
   *
   * @param signer - The SVM signer that implements both message and transaction signing
   * @param chainId - The CAIP-2 chain ID (e.g., "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" for mainnet)
   * @param config - Optional configuration for the client
   */
  constructor(
    signer: SvmSigner,
    chainId: `${string}:${string}` = SOLANA_MAINNET_CHAIN_ID,
    config?: ClientSvmConfig
  ) {
    this.signer = signer;
    this.chainId = chainId;
    this.network = chainId;
    // ExactSvmScheme only needs ClientSvmSigner (TransactionSigner)
    this.exactScheme = new ExactSvmScheme(signer, config);
  }

  /**
   * Gets the signer's address
   */
  get address(): Address {
    return this.signer.address;
  }

  /**
   * Creates a payment payload for the Exact scheme.
   * Delegates to the underlying ExactSvmScheme.
   *
   * @param x402Version - The x402 protocol version
   * @param paymentRequirements - The payment requirements
   * @returns Promise resolving to a payment payload
   */
  async createPaymentPayload(
    x402Version: number,
    paymentRequirements: PaymentRequirements
  ): Promise<Pick<PaymentPayload, "x402Version" | "payload">> {
    return this.exactScheme.createPaymentPayload(
      x402Version,
      paymentRequirements
    );
  }

  /**
   * Signs a SIWx payload for authentication.
   *
   * @param payload - The SIWx payload to sign
   * @returns Promise resolving to the base64-encoded signed envelope
   */
  async signPayload(payload: SIWxPayload): Promise<string> {
    // Use default chainId if not provided in payload
    const payloadWithChain = {
      ...payload,
      chainId: payload.chainId || this.chainId,
    };

    // Use the shared CAIP-122 message format utilities
    const message = createSIWxMessage(payloadWithChain);

    // Convert message to bytes and create a SignableMessage
    const messageBytes = new TextEncoder().encode(message);
    const signableMessage: SignableMessage = {
      content: messageBytes,
      signatures: {} as SignatureDictionary,
    };

    // Sign the message using the SVM signer
    const [signatureDict] = await this.signer.signMessages([signableMessage]);

    // Get the signature from the dictionary (there should be exactly one)
    const signatureBytes = signatureDict[this.signer.address] as SignatureBytes;
    const signature = base58Encode(signatureBytes);

    // Create the envelope and base64 encode it
    const envelope = { message, signature };
    return btoa(JSON.stringify(envelope));
  }
}

/**
 * Creates a SvmClientSigner from an SVM signer.
 *
 * @param signer - The SVM signer
 * @param chainId - The CAIP-2 chain ID (defaults to Solana mainnet)
 * @param config - Optional configuration for the client
 * @returns A new SvmClientSigner instance
 */
export function createSvmClientSigner(
  signer: SvmSigner,
  chainId: `${string}:${string}` = SOLANA_MAINNET_CHAIN_ID,
  config?: ClientSvmConfig
): SvmClientSigner {
  return new SvmClientSigner(signer, chainId, config);
}

// Re-export useful types and utilities from x402/svm
export {
  ExactSvmScheme,
  type ClientSvmSigner,
  type ClientSvmConfig,
} from "@x402/svm";

// Re-export SIWx utilities for convenience
export { createSIWxMessage, prepareSIWxForSigning } from "@aimo.network/client";

/**
 * Base58 encode a Uint8Array
 */
function base58Encode(bytes: Uint8Array): string {
  return bs58.encode(bytes);
}
