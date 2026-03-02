"""Streaming response tests.

Tests streaming chat completions using the AimoClient.
Requires SOLANA_PRIVATE_KEY env var.
"""

from __future__ import annotations

import json

import pytest

from aimo_network.client.api import AimoClient, AimoClientOptions
from aimo_network.svm import SvmClientSigner, SOLANA_MAINNET_CHAIN_ID

from tests.conftest import CHAT_COMPLETIONS_MESSAGES, TestConfig


@pytest.fixture(scope="module")
def svm_signer(test_config: TestConfig) -> SvmClientSigner:
    if not test_config.solana_private_key:
        pytest.skip("SOLANA_PRIVATE_KEY not set")
    import base58
    from solders.keypair import Keypair  # type: ignore[import-untyped]

    secret = base58.b58decode(test_config.solana_private_key)
    keypair = Keypair.from_bytes(secret)
    return SvmClientSigner(keypair=keypair, chain_id=SOLANA_MAINNET_CHAIN_ID)


@pytest.fixture()
async def stream_client(
    test_config: TestConfig, svm_signer: SvmClientSigner
) -> AimoClient:
    client = AimoClient(
        AimoClientOptions(
            signer=svm_signer,
            base_url=test_config.api_base,
            siwx_domain=test_config.api_domain,
        )
    )
    yield client  # type: ignore[misc]
    await client.aclose()


@pytest.mark.timeout(300)
class TestStreamResponse:
    async def test_streaming_chat_completion(self, stream_client: AimoClient) -> None:
        response = await stream_client.chat_completions({
            "model": "deepseek/deepseek-v3.1",
            "stream": True,
            "max_tokens": 100,
            "messages": CHAT_COMPLETIONS_MESSAGES,
        })

        if response.status_code >= 500:
            pytest.skip(f"Server error {response.status_code}")

        assert response.status_code in (200, 402)

        if response.status_code != 200:
            return

        full_content = ""
        chunk_count = 0

        async for line in response.aiter_lines():
            if not line or line.startswith(":"):
                continue
            if line.startswith("data: "):
                data = line[6:]
                if data == "[DONE]":
                    break
                try:
                    parsed = json.loads(data)
                    delta = parsed.get("choices", [{}])[0].get("delta", {})
                    content = delta.get("content", "")
                    if content:
                        full_content += content
                        chunk_count += 1
                except json.JSONDecodeError:
                    pass

        assert chunk_count > 0, "Expected at least one content chunk"
        assert full_content, "Expected non-empty streamed content"
