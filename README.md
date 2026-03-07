# BitRouter SDK

Official SDKs for interacting with [BitRouter](https://bitrouter.ai) - the zero-ops LLM gateway for autonomous agents.

## SDKs

| SDK | Language | Package | Directory |
|-----|----------|---------|-----------|
| Python | Python 3.10+ | `bitrouter` (PyPI) | [`python/`](./python/) |

## Quick Links

- [Python SDK Documentation](./python/README.md)

## Authentication

Both SDKs use [SIWx (Sign-In-With-X)](https://chainagnostic.org/CAIPs/caip-122) for wallet-based authentication. Each request is automatically signed with your wallet, proving ownership without exposing private keys.

## Payments

Both SDKs integrate with [x402](https://www.x402.org/) for seamless micropayments. When you make API requests that require payment, the SDK automatically handles the payment flow using your wallet.

## License

ISC
