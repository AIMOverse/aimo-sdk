import type { ClientSigner, SIWxPayload } from "@aimo.network/client";
import { createSIWxMessage, prepareSIWxForSigning } from "@aimo.network/client";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import { ExactEvmScheme, type ClientEvmSigner } from "@x402/evm";

/**
 * EVM signer interface for signing messages.
 * This interface is compatible with viem's WalletClient signMessage.
 *
 * This minimal interface allows for various wallet implementations:
 * - viem LocalAccount
 * - Browser wallet adapters (MetaMask, WalletConnect, etc.)
 * - Custom wallet implementations
 */
export interface EvmMessageSigner {
  /**
   * The EVM address of the signer
   */
  readonly address: `0x${string}`;

  /**
   * Signs a message using personal_sign (EIP-191).
   * The message is prefixed with "\x19Ethereum Signed Message:\n" + len(message).
   *
   * @param message - The message to sign (string or raw bytes)
   * @returns The signature as a hex string
   */
  signMessage(args: {
    message: string | { raw: Uint8Array };
  }): Promise<`0x${string}`>;
}

/**
 * Combined EVM signer interface that supports both message signing (for SIWx)
 * and typed data signing (for x402 payments).
 *
 * Most EVM wallet implementations (viem, ethers, wallet adapters) implement both interfaces.
 */
export type EvmSigner = EvmMessageSigner & ClientEvmSigner;

/**
 * Default EVM CAIP-2 chain ID (Ethereum mainnet)
 * Format: eip155:<chain_id>
 */
export const EVM_MAINNET_CHAIN_ID = "eip155:1";

/**
 * Options for creating an EvmClientSigner instance
 */
export interface EvmClientSignerOptions {
  /**
   * The EVM signer that implements both message and typed data signing
   */
  signer: EvmSigner;
  /**
   * The CAIP-2 chain ID (e.g., "eip155:1" for Ethereum mainnet)
   * @default EVM_MAINNET_CHAIN_ID
   */
  chainId?: `${string}:${string}`;
}

/**
 * EVM client signer that implements the ClientSigner interface.
 * Combines x402 payment signing with SIWx authentication.
 *
 * @example
 * ```typescript
 * import { EvmClientSigner } from "@aimo.network/evm";
 * import { createWalletClient, http } from "viem";
 * import { privateKeyToAccount } from "viem/accounts";
 * import { mainnet } from "viem/chains";
 *
 * // Using viem account (implements both signMessage and signTypedData)
 * const account = privateKeyToAccount("0x...");
 *
 * // Create the client signer
 * const clientSigner = new EvmClientSigner({ signer: account });
 *
 * // With custom chain ID
 * const clientSigner = new EvmClientSigner({
 *   signer: account,
 *   chainId: "eip155:137", // Polygon
 * });
 *
 * // Use for SIWx authentication
 * const signature = await clientSigner.signPayload(siwxPayload);
 *
 * // Use for x402 payments (via SchemeNetworkClient interface)
 * const paymentPayload = await clientSigner.createPaymentPayload(2, requirements);
 * ```
 */
export class EvmClientSigner implements ClientSigner {
  private readonly signer: EvmSigner;
  private readonly exactScheme: ExactEvmScheme;
  readonly chainId: `${string}:${string}`;

  /**
   * The EVM network chain ID for x402 v2. Equals to chainId here.
   */
  readonly network: `${string}:${string}`;

  /**
   * The payment scheme identifier
   */
  readonly scheme = "exact";

  /**
   * Creates a new EvmClientSigner instance.
   *
   * @param options - Configuration options for the signer
   */
  constructor(options: EvmClientSignerOptions) {
    const { signer, chainId = EVM_MAINNET_CHAIN_ID } = options;
    this.signer = signer;
    this.chainId = chainId;
    this.network = chainId;
    // ExactEvmScheme only needs ClientEvmSigner (signTypedData)
    this.exactScheme = new ExactEvmScheme(signer);
  }

  /**
   * Gets the signer's address
   */
  get address(): `0x${string}` {
    return this.signer.address;
  }

  /**
   * Creates a payment payload for the Exact scheme.
   * Delegates to the underlying ExactEvmScheme.
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
   * @returns The SIWx signature
   */
  async signPayload(payload: Omit<SIWxPayload, "signature">): Promise<string> {
    // Use default chainId if not provided in payload
    const payloadWithChain = {
      ...payload,
      chainId: payload.chainId || this.chainId,
    };

    // Use the shared CAIP-122 message format utilities
    const { message, createHeader } = prepareSIWxForSigning(payloadWithChain);

    // Sign the message using EIP-191 personal_sign
    const signature = await this.signer.signMessage({ message });

    // Return the signature
    return signature;
  }
}

/**
 * Creates an EvmClientSigner from an EVM signer.
 *
 * @param options - Configuration options for the signer
 * @returns A new EvmClientSigner instance
 */
export function createEvmClientSigner(
  options: EvmClientSignerOptions
): EvmClientSigner {
  return new EvmClientSigner(options);
}
