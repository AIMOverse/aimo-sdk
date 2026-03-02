# AiMo Network SDK

Official SDKs for interacting with [AiMo Network](https://aimo.network) - a decentralized AI inference marketplace.

## SDKs

| SDK | Language | Package | Directory |
|-----|----------|---------|-----------|
| TypeScript | TypeScript/JavaScript | `@aimo.network/*` (npm) | [`ts/`](./ts/) |
| Python | Python 3.10+ | `aimo-network` (PyPI) | [`python/`](./python/) |

## Quick Links

- [TypeScript SDK Documentation](./ts/README.md)
- [Python SDK Documentation](./python/README.md)

## Authentication

Both SDKs use [SIWx (Sign-In-With-X)](https://chainagnostic.org/CAIPs/caip-122) for wallet-based authentication. Each request is automatically signed with your wallet, proving ownership without exposing private keys.

## Payments

Both SDKs integrate with [x402](https://www.x402.org/) for seamless micropayments. When you make API requests that require payment, the SDK automatically handles the payment flow using your wallet.

## License

ISC
