# AiMo Network SDK

TypeScript SDK for interacting with [AiMo Network](https://aimo.network) - a decentralized AI inference marketplace.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

## Table of content

- [AiMo Network SDK](#aimo-network-sdk)
  - [Table of content](#table-of-content)
  - [Installation](#installation)
  - [Usage](#usage)
    - [Solana (SVM) Example](#solana-svm-example)
    - [Ethereum (EVM) Example](#ethereum-evm-example)
    - [Local Development](#local-development)
    - [Custom RPC URL (Solana)](#custom-rpc-url-solana)
  - [Packages](#packages)
  - [Authentication](#authentication)
  - [Payments](#payments)
  - [License](#license)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Installation

```bash
# Install the client package
npm install @aimo.network/client

# For Solana (SVM) support
npm install @aimo.network/svm

# For Ethereum (EVM) support
npm install @aimo.network/evm
```

## Usage

### Solana (SVM) Example

```typescript
import { AimoClient } from "@aimo.network/client";
import { SvmClientSigner, SOLANA_MAINNET_CHAIN_ID } from "@aimo.network/svm";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import bs58 from "bs58";

// Create a Solana keypair signer from your private key
const privateKeyBytes = bs58.decode("your-base58-private-key");
const keypairSigner = await createKeyPairSignerFromBytes(privateKeyBytes);

// Create the client signer
const signer = new SvmClientSigner({
  signer: keypairSigner,
  chainId: SOLANA_MAINNET_CHAIN_ID,
});

// Create the AiMo client
const client = new AimoClient({
  signer,
  baseUrl: "https://beta.aimo.network",
});

// Query your session balance
const balance = await client.sessionBalance();
console.log(`Balance: ${balance.balance_usd} USD`);

// Make a chat completion request (OpenAI-compatible)
const response = await client.chatCompletions({
  model: "openai/gpt-4o-mini",
  messages: [{ role: "user", content: "Hello, what is AiMo Network?" }],
});

if (response.ok) {
  const data = await response.json();
  console.log(data.choices[0].message.content);
}
```

### Ethereum (EVM) Example

```typescript
import { AimoClient } from "@aimo.network/client";
import { EvmClientSigner, EVM_MAINNET_CHAIN_ID } from "@aimo.network/evm";
import { privateKeyToAccount } from "viem/accounts";

// Create an EVM account from your private key
const account = privateKeyToAccount("0x...");

// Create the client signer
const signer = new EvmClientSigner({
  signer: account,
  chainId: EVM_MAINNET_CHAIN_ID,
});

// Create the AiMo client
const client = new AimoClient({
  signer,
  baseUrl: "https://beta.aimo.network",
});

// Query your session balance
const balance = await client.sessionBalance();
console.log(`Balance: ${balance.balance_usd} USD`);
console.log(`CAIP Account: ${balance.caip_account_id}`);
```

### Local Development

When developing locally against a local server that validates against a production domain, use the `siwxDomain` option:

```typescript
const client = new AimoClient({
  signer,
  baseUrl: "http://localhost:8000",
  siwxDomain: "beta.aimo.network", // Override SIWx signing domain
});
```

### Custom RPC URL (Solana)

For Solana signers, you can specify a custom RPC URL:

```typescript
const signer = new SvmClientSigner({
  signer: keypairSigner,
  chainId: SOLANA_MAINNET_CHAIN_ID,
  config: {
    rpcUrl: "https://your-rpc-provider.com",
  },
});
```

## Packages

| Package                | Description                                                              |
| ---------------------- | ------------------------------------------------------------------------ |
| `@aimo.network/client` | Core client for API interactions, SIWx authentication, and x402 payments |
| `@aimo.network/svm`    | Solana wallet signer support                                             |
| `@aimo.network/evm`    | Ethereum wallet signer support                                           |
| `@aimo.network/react`  | React hooks and components (coming soon)                                 |

## Authentication

The SDK uses [SIWx (Sign-In-With-X)](https://chainagnostic.org/CAIPs/caip-122) for wallet-based authentication. Each request is automatically signed with your wallet, proving ownership without exposing private keys.

## Payments

The SDK integrates with [x402](https://www.x402.org/) for seamless micropayments. When you make API requests that require payment, the SDK automatically handles the payment flow using your wallet.

## License

ISC
