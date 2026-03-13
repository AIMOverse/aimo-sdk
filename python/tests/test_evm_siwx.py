"""EVM SIWx (Sign-In-With-X) integration tests.

Tests EVM wallet-based authentication using the SDK.
Requires EVM_PRIVATE_KEY env var.
"""

from __future__ import annotations

import base64
import json
import re
from datetime import datetime, timezone, timedelta

import httpx
import pytest

from bitrouter.client.siwx import (
    SIWxPayload,
    create_siwx_message,
    encode_siwx_header,
    prepare_siwx_for_signing,
)
from bitrouter.evm import EvmClientSigner, EVM_MAINNET_CHAIN_ID

from tests.conftest import TestConfig


@pytest.fixture(scope="module")
def evm_signer(test_config: TestConfig) -> EvmClientSigner:
    if not test_config.evm_private_key:
        pytest.skip("EVM_PRIVATE_KEY not set")
    from eth_account import Account

    account = Account.from_key(test_config.evm_private_key)
    return EvmClientSigner(account=account, chain_id=EVM_MAINNET_CHAIN_ID)


@pytest.fixture(scope="module")
def evm_address(evm_signer: EvmClientSigner) -> str:
    return evm_signer.address


class TestEvmSIWxMessageBuilding:
    def test_valid_caip122_message(self, test_config: TestConfig, evm_address: str) -> None:
        expiration = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
        payload = SIWxPayload(
            domain=test_config.api_domain,
            address=evm_address,
            uri=f"https://{test_config.api_domain}",
            version="1",
            chain_id=EVM_MAINNET_CHAIN_ID,
            expiration_time=expiration,
        )
        message = create_siwx_message(payload)

        assert (
            f"{test_config.api_domain} wants you to sign in with your Ethereum account:" in message
        )
        assert evm_address in message
        assert f"URI: https://{test_config.api_domain}" in message
        assert "Version: 1" in message
        assert f"Chain ID: {EVM_MAINNET_CHAIN_ID}" in message

    def test_optional_statement(self, test_config: TestConfig, evm_address: str) -> None:
        payload = SIWxPayload(
            domain=test_config.api_domain,
            address=evm_address,
            statement="Sign in to access the BitRouter API.",
            uri=f"https://{test_config.api_domain}",
            version="1",
            chain_id=EVM_MAINNET_CHAIN_ID,
            expiration_time=(datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
        )
        message = create_siwx_message(payload)
        assert "Sign in to access the BitRouter API." in message

    def test_optional_nonce_and_issued_at(
        self, test_config: TestConfig, evm_address: str
    ) -> None:
        nonce = "test-nonce-123"
        issued_at = datetime.now(timezone.utc).isoformat()
        payload = SIWxPayload(
            domain=test_config.api_domain,
            address=evm_address,
            uri=f"https://{test_config.api_domain}",
            version="1",
            chain_id=EVM_MAINNET_CHAIN_ID,
            nonce=nonce,
            issued_at=issued_at,
            expiration_time=(datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
        )
        message = create_siwx_message(payload)
        assert f"Nonce: {nonce}" in message
        assert f"Issued At: {issued_at}" in message


class TestEvmSIWxHeaderCreation:
    async def test_valid_base64_header(
        self, test_config: TestConfig, evm_signer: EvmClientSigner, evm_address: str
    ) -> None:
        payload = SIWxPayload(
            domain=test_config.api_domain,
            address=evm_address,
            uri=f"https://{test_config.api_domain}",
            version="1",
            chain_id=EVM_MAINNET_CHAIN_ID,
            expiration_time=(datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
        )
        signature = await evm_signer.sign_payload(payload)
        header = encode_siwx_header(create_siwx_message(payload), signature)

        assert isinstance(header, str)
        decoded = json.loads(base64.b64decode(header))
        assert "message" in decoded
        assert "signature" in decoded
        assert re.match(r"^0x[0-9a-fA-F]+$", decoded["signature"])

    async def test_prepare_siwx_helper(
        self, test_config: TestConfig, evm_signer: EvmClientSigner, evm_address: str
    ) -> None:
        payload = SIWxPayload(
            domain=test_config.api_domain,
            address=evm_address,
            uri=f"https://{test_config.api_domain}",
            version="1",
            chain_id=EVM_MAINNET_CHAIN_ID,
            expiration_time=(datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
        )
        prepared = prepare_siwx_for_signing(payload)
        signature = await evm_signer.sign_payload(payload)
        header = prepared.create_header(signature)

        decoded = json.loads(base64.b64decode(header))
        assert decoded["message"] == prepared.message
        assert decoded["signature"] == signature


class TestEvmSIWxAuthFlow:
    async def test_valid_header_authenticates(
        self, test_config: TestConfig, evm_signer: EvmClientSigner, evm_address: str
    ) -> None:
        payload = SIWxPayload(
            domain=test_config.api_domain,
            address=evm_address,
            uri=f"https://{test_config.api_domain}",
            version="1",
            chain_id=EVM_MAINNET_CHAIN_ID,
            expiration_time=(datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
        )
        signature = await evm_signer.sign_payload(payload)
        siwx_header = encode_siwx_header(create_siwx_message(payload), signature)

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{test_config.api_base}/api/v1/session/balance",
                headers={"SIGN-IN-WITH-X": siwx_header},
            )
        assert resp.status_code == 200
        body = resp.json()
        assert "caip_account_id" in body
        assert "balance_micro_usdc" in body
        assert "balance_usd" in body
        expected_caip = f"{EVM_MAINNET_CHAIN_ID}:{evm_address}"
        assert body["caip_account_id"] == expected_caip

    async def test_invalid_header_rejected(self, test_config: TestConfig) -> None:
        invalid = base64.b64encode(
            json.dumps({"message": "invalid", "signature": "0xinvalid"}).encode()
        ).decode()
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{test_config.api_base}/api/v1/session/balance",
                headers={"SIGN-IN-WITH-X": invalid},
            )
        assert resp.status_code == 401

    async def test_expired_message_rejected(
        self, test_config: TestConfig, evm_signer: EvmClientSigner, evm_address: str
    ) -> None:
        expired_time = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
        payload = SIWxPayload(
            domain=test_config.api_domain,
            address=evm_address,
            uri=f"https://{test_config.api_domain}",
            version="1",
            chain_id=EVM_MAINNET_CHAIN_ID,
            expiration_time=expired_time,
        )
        signature = await evm_signer.sign_payload(payload)
        header = encode_siwx_header(create_siwx_message(payload), signature)

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{test_config.api_base}/api/v1/session/balance",
                headers={"SIGN-IN-WITH-X": header},
            )
        assert resp.status_code == 401

    async def test_domain_mismatch_rejected(
        self, test_config: TestConfig, evm_signer: EvmClientSigner, evm_address: str
    ) -> None:
        payload = SIWxPayload(
            domain="wrong-domain.com",
            address=evm_address,
            uri="https://wrong-domain.com",
            version="1",
            chain_id=EVM_MAINNET_CHAIN_ID,
            expiration_time=(datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
        )
        signature = await evm_signer.sign_payload(payload)
        header = encode_siwx_header(create_siwx_message(payload), signature)

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{test_config.api_base}/api/v1/session/balance",
                headers={"SIGN-IN-WITH-X": header},
            )
        assert resp.status_code == 401
