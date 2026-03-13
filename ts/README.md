# BitRouter SDK

TypeScript SDK for interacting with [BitRouter](https://bitrouter.io) - a decentralized AI inference marketplace.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

## Table of content

- [BitRouter SDK](#bitrouter-sdk)
  - [Table of content](#table-of-content)
  - [Installation](#installation)
  - [Usage](#usage)
    - [Solana (SVM) Example](#solana-svm-example)
    - [Ethereum (EVM) Example](#ethereum-evm-example)
    - [AI SDK Integration](#ai-sdk-integration)
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
npm install @bitrouter/client

# For Solana (SVM) support
npm install @bitrouter/svm

# For Ethereum (EVM) support
npm install @bitrouter/evm
```

## Usage

### Solana (SVM) Example

```typescript
import { BitRouterClient } from "@bitrouter/client";
import { SvmClientSigner, SOLANA_MAINNET_CHAIN_ID } from "@bitrouter/svm";
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

// Create the BitRouter client
const client = new BitRouterClient({
  signer,
  baseUrl: "https://beta.bitrouter.io",
});

// Query your session balance
const balance = await client.sessionBalance();
console.log(`Balance: ${balance.balance_usd} USD`);

// Make a chat completion request (OpenAI-compatible)
const response = await client.chatCompletions({
  model: "openai/gpt-4o-mini",
  messages: [{ role: "user", content: "Hello, what is BitRouter?" }],
});

if (response.ok) {
  const data = await response.json();
  console.log(data.choices[0].message.content);
}
```

### Ethereum (EVM) Example

```typescript
import { BitRouterClient } from "@bitrouter/client";
import { EvmClientSigner, EVM_MAINNET_CHAIN_ID } from "@bitrouter/evm";
import { privateKeyToAccount } from "viem/accounts";

// Create an EVM account from your private key
const account = privateKeyToAccount("0x...");

// Create the client signer
const signer = new EvmClientSigner({
  signer: account,
  chainId: EVM_MAINNET_CHAIN_ID,
});

// Create the BitRouter client
const client = new BitRouterClient({
  signer,
  baseUrl: "https://beta.bitrouter.io",
});

// Query your session balance
const balance = await client.sessionBalance();
console.log(`Balance: ${balance.balance_usd} USD`);
console.log(`CAIP Account: ${balance.caip_account_id}`);
```

### AI SDK Integration

The `@bitrouter/provider` package provides seamless integration with Vercel's [AI SDK](https://sdk.vercel.ai/):

```bash
npm install @bitrouter/provider ai
```

```typescript
import { bitrouter } from "@bitrouter/provider";
import { SvmClientSigner, SOLANA_MAINNET_CHAIN_ID } from "@bitrouter/svm";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { generateText } from "ai";
import bs58 from "bs58";

// Create your signer (SVM or EVM)
const privateKeyBytes = bs58.decode("your-base58-private-key");
const keypairSigner = await createKeyPairSignerFromBytes(privateKeyBytes);
const signer = new SvmClientSigner({
  signer: keypairSigner,
  chainId: SOLANA_MAINNET_CHAIN_ID,
});

// Create the BitRouter provider
const br = bitrouter({
  signer,
  baseURL: "https://beta.bitrouter.io",
});

// Use with AI SDK's generateText
const result = await generateText({
  model: br.chat("openai/gpt-4o-mini"),
  prompt: "What is BitRouter?",
});

console.log(result.text);
```

### Local Development

When developing locally against a local server that validates against a production domain, use the `siwxDomain` option:

```typescript
const client = new BitRouterClient({
  signer,
  baseUrl: "http://localhost:8000",
  siwxDomain: "beta.bitrouter.io", // Override SIWx signing domain
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
| `@bitrouter/client`   | Core client for API interactions, SIWx authentication, and x402 payments |
| `@bitrouter/svm`      | Solana wallet signer support                                             |
| `@bitrouter/evm`      | Ethereum wallet signer support                                           |
| `@bitrouter/provider` | Vercel AI SDK provider integration                                       |
| `@bitrouter/react`    | React hooks and components (coming soon)                                 |

## Authentication

The SDK uses [SIWx (Sign-In-With-X)](https://chainagnostic.org/CAIPs/caip-122) for wallet-based authentication. Each request is automatically signed with your wallet, proving ownership without exposing private keys.

## Payments

The SDK integrates with [x402](https://www.x402.org/) for seamless micropayments. When you make API requests that require payment, the SDK automatically handles the payment flow using your wallet.

## License

ISC
