# AiMo Network Python SDK

Python SDK for interacting with [AiMo Network](https://aimo.network) - a decentralized AI inference marketplace.

## Installation

```bash
# Core client only
pip install aimo-network

# With Solana support
pip install aimo-network[solana]

# With Ethereum support
pip install aimo-network[evm]

# With OpenAI provider
pip install aimo-network[openai]

# Everything
pip install aimo-network[all]
```

## Usage

### Solana (SVM) Example

```python
import asyncio
from solders.keypair import Keypair
import base58

from aimo_network import AimoClient, AimoClientOptions
from aimo_network.svm import SvmClientSigner, SOLANA_MAINNET_CHAIN_ID


async def main():
    # Create a Solana keypair from your private key
    secret = base58.b58decode("your-base58-private-key")
    keypair = Keypair.from_bytes(secret)

    # Create the client signer
    signer = SvmClientSigner(keypair=keypair, chain_id=SOLANA_MAINNET_CHAIN_ID)

    # Create the AiMo client
    async with AimoClient(AimoClientOptions(
        signer=signer,
        base_url="https://beta.aimo.network",
    )) as client:
        # Query your session balance
        balance = await client.session_balance()
        print(f"Balance: {balance.balance_usd} USD")

        # Make a chat completion request (OpenAI-compatible)
        response = await client.chat_completions({
            "model": "openai/gpt-4o-mini",
            "messages": [{"role": "user", "content": "Hello, what is AiMo Network?"}],
        })

        if response.status_code == 200:
            data = response.json()
            print(data["choices"][0]["message"]["content"])

asyncio.run(main())
```

### Ethereum (EVM) Example

```python
import asyncio
from eth_account import Account

from aimo_network import AimoClient, AimoClientOptions
from aimo_network.evm import EvmClientSigner, EVM_MAINNET_CHAIN_ID


async def main():
    # Create an EVM account from your private key
    account = Account.from_key("0x...")

    # Create the client signer
    signer = EvmClientSigner(account=account, chain_id=EVM_MAINNET_CHAIN_ID)

    # Create the AiMo client
    async with AimoClient(AimoClientOptions(
        signer=signer,
        base_url="https://beta.aimo.network",
    )) as client:
        balance = await client.session_balance()
        print(f"Balance: {balance.balance_usd} USD")

asyncio.run(main())
```

### OpenAI Provider

Use AiMo Network as a drop-in OpenAI replacement:

```python
import asyncio
from solders.keypair import Keypair
import base58

from aimo_network.svm import SvmClientSigner, SOLANA_MAINNET_CHAIN_ID
from aimo_network.provider import create_openai_client


async def main():
    secret = base58.b58decode("your-base58-private-key")
    keypair = Keypair.from_bytes(secret)
    signer = SvmClientSigner(keypair=keypair, chain_id=SOLANA_MAINNET_CHAIN_ID)

    # Get a standard OpenAI client that authenticates via wallet
    openai_client = create_openai_client(signer)

    response = await openai_client.chat.completions.create(
        model="openai/gpt-4o-mini",
        messages=[{"role": "user", "content": "What is AiMo Network?"}],
    )
    print(response.choices[0].message.content)

asyncio.run(main())
```

### Streaming

```python
import asyncio
import json
from aimo_network import AimoClient, AimoClientOptions
from aimo_network.svm import SvmClientSigner, SOLANA_MAINNET_CHAIN_ID


async def main():
    # ... create signer as above ...

    async with AimoClient(AimoClientOptions(
        signer=signer,
        base_url="https://beta.aimo.network",
    )) as client:
        response = await client.chat_completions({
            "model": "openai/gpt-4o-mini",
            "messages": [{"role": "user", "content": "Tell me a story"}],
            "stream": True,
        })

        async for line in response.aiter_lines():
            if line.startswith("data: ") and line[6:] != "[DONE]":
                chunk = json.loads(line[6:])
                content = chunk["choices"][0]["delta"].get("content", "")
                print(content, end="", flush=True)

asyncio.run(main())
```

### Local Development

```python
client = AimoClient(AimoClientOptions(
    signer=signer,
    base_url="http://localhost:8000",
    siwx_domain="beta.aimo.network",  # Override SIWx signing domain
))
```

## Authentication

The SDK uses [SIWx (Sign-In-With-X)](https://chainagnostic.org/CAIPs/caip-122) for wallet-based authentication. Each request is automatically signed with your wallet.

## Payments

The SDK integrates with [x402](https://www.x402.org/) for seamless micropayments when making API requests that require payment.

## License

ISC
