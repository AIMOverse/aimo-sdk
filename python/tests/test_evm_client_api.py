"""EVM Client API integration tests.

Tests the AimoClient API using EVM (Ethereum) signer.
Requires EVM_PRIVATE_KEY env var.
"""

from __future__ import annotations

import pytest

from aimo_network.client.api import AimoClient, AimoClientOptions
from aimo_network.evm import EvmClientSigner, EVM_MAINNET_CHAIN_ID

from tests.conftest import CHAT_COMPLETIONS_REQUEST_BODY, TestConfig


@pytest.fixture(scope="module")
def evm_signer(test_config: TestConfig) -> EvmClientSigner:
    if not test_config.evm_private_key:
        pytest.skip("EVM_PRIVATE_KEY not set")
    from eth_account import Account

    account = Account.from_key(test_config.evm_private_key)
    return EvmClientSigner(account=account, chain_id="eip155:8453")


@pytest.fixture()
async def evm_client(
    test_config: TestConfig, evm_signer: EvmClientSigner
) -> AimoClient:
    client = AimoClient(
        AimoClientOptions(
            signer=evm_signer,
            base_url=test_config.api_base,
            siwx_domain=test_config.api_domain,
        )
    )
    yield client  # type: ignore[misc]
    await client.aclose()


class TestEvmClientApi:
    async def test_session_balance(self, evm_client: AimoClient) -> None:
        balance = await evm_client.session_balance()
        assert balance.caip_account_id
        assert isinstance(balance.balance_micro_usdc, int)
        assert balance.balance_usd
        assert "eip155:" in balance.caip_account_id

    async def test_chat_completions(self, evm_client: AimoClient) -> None:
        response = await evm_client.chat_completions(CHAT_COMPLETIONS_REQUEST_BODY)
        assert response.status_code in (200, 402)

        if response.status_code == 200:
            body = response.json()
            assert "choices" in body
            assert isinstance(body["choices"], list)
        else:
            body = response.json()
            assert body["x402Version"] == 2
