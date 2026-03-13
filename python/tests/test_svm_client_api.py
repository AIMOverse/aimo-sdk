"""SVM Client API integration tests.

Tests the BitRouterClient API using SVM (Solana) signer.
Requires SOLANA_PRIVATE_KEY env var.
"""

from __future__ import annotations

import pytest

from bitrouter.client.api import BitRouterClient, BitRouterClientOptions
from bitrouter.svm import SvmClientSigner, SOLANA_MAINNET_CHAIN_ID

from tests.conftest import CHAT_COMPLETIONS_REQUEST_BODY, TestConfig


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
async def svm_client(
    test_config: TestConfig, svm_signer: SvmClientSigner
) -> BitRouterClient:
    client = BitRouterClient(
        BitRouterClientOptions(
            signer=svm_signer,
            base_url=test_config.api_base,
            siwx_domain=test_config.api_domain,
        )
    )
    yield client  # type: ignore[misc]
    await client.aclose()


class TestSvmClientApi:
    async def test_session_balance(self, svm_client: BitRouterClient) -> None:
        balance = await svm_client.session_balance()
        assert balance.caip_account_id
        assert isinstance(balance.balance_micro_usdc, int)
        assert balance.balance_usd
        assert "solana:" in balance.caip_account_id

    async def test_chat_completions(self, svm_client: BitRouterClient) -> None:
        response = await svm_client.chat_completions(CHAT_COMPLETIONS_REQUEST_BODY)
        assert response.status_code in (200, 402)

        if response.status_code == 200:
            body = response.json()
            assert "choices" in body
            assert isinstance(body["choices"], list)
        else:
            body = response.json()
            assert body["x402Version"] == 2
