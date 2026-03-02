"""SVM SIWx (Sign-In-With-X) integration tests.

Tests Solana wallet-based authentication using the SDK.
Requires SOLANA_PRIVATE_KEY env var.
"""

from __future__ import annotations

import base64
import json
from datetime import datetime, timezone, timedelta

import httpx
import pytest

from aimo_network.client.siwx import (
    SIWxPayload,
    create_siwx_message,
    encode_siwx_header,
    prepare_siwx_for_signing,
)
from aimo_network.svm import SvmClientSigner, SOLANA_MAINNET_CHAIN_ID

from tests.conftest import TestConfig


@pytest.fixture(scope="module")
def svm_signer(test_config: TestConfig) -> SvmClientSigner:
    if not test_config.solana_private_key:
        pytest.skip("SOLANA_PRIVATE_KEY not set")
    import base58
    from solders.keypair import Keypair  # type: ignore[import-untyped]

    secret = base58.b58decode(test_config.solana_private_key)
    keypair = Keypair.from_bytes(secret)
    return SvmClientSigner(keypair=keypair, chain_id=SOLANA_MAINNET_CHAIN_ID)


@pytest.fixture(scope="module")
def svm_address(svm_signer: SvmClientSigner) -> str:
    return svm_signer.address


class TestSvmSIWxMessageBuilding:
    def test_valid_caip122_message(self, test_config: TestConfig, svm_address: str) -> None:
        expiration = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
        payload = SIWxPayload(
            domain=test_config.api_domain,
            address=svm_address,
            uri=f"https://{test_config.api_domain}",
            version="1",
            chain_id=SOLANA_MAINNET_CHAIN_ID,
            expiration_time=expiration,
        )
        message = create_siwx_message(payload)

        assert f"{test_config.api_domain} wants you to sign in with your Solana account:" in message
        assert svm_address in message
        assert f"URI: https://{test_config.api_domain}" in message
        assert "Version: 1" in message
        assert f"Chain ID: {SOLANA_MAINNET_CHAIN_ID}" in message
        assert f"Expiration Time: {expiration}" in message

    def test_optional_statement(self, test_config: TestConfig, svm_address: str) -> None:
        payload = SIWxPayload(
            domain=test_config.api_domain,
            address=svm_address,
            statement="Sign in to access the AiMo Network API.",
            uri=f"https://{test_config.api_domain}",
            version="1",
            chain_id=SOLANA_MAINNET_CHAIN_ID,
            expiration_time=(datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
        )
        message = create_siwx_message(payload)
        assert "Sign in to access the AiMo Network API." in message

    def test_resources_list(self, test_config: TestConfig, svm_address: str) -> None:
        payload = SIWxPayload(
            domain=test_config.api_domain,
            address=svm_address,
            uri=f"https://{test_config.api_domain}",
            version="1",
            chain_id=SOLANA_MAINNET_CHAIN_ID,
            expiration_time=(datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
            resources=["https://api.aimo.network/chat", "https://api.aimo.network/models"],
        )
        message = create_siwx_message(payload)
        assert "Resources:" in message
        assert "- https://api.aimo.network/chat" in message
        assert "- https://api.aimo.network/models" in message


class TestSvmSIWxHeaderCreation:
    async def test_valid_base64_header(
        self, test_config: TestConfig, svm_signer: SvmClientSigner, svm_address: str
    ) -> None:
        payload = SIWxPayload(
            domain=test_config.api_domain,
            address=svm_address,
            uri=f"https://{test_config.api_domain}",
            version="1",
            chain_id=SOLANA_MAINNET_CHAIN_ID,
            expiration_time=(datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
        )
        signature = await svm_signer.sign_payload(payload)
        header = encode_siwx_header(create_siwx_message(payload), signature)

        assert isinstance(header, str)
        decoded = json.loads(base64.b64decode(header))
        assert "message" in decoded
        assert "signature" in decoded
        assert isinstance(decoded["signature"], str)

    async def test_prepare_siwx_helper(
        self, test_config: TestConfig, svm_signer: SvmClientSigner, svm_address: str
    ) -> None:
        payload = SIWxPayload(
            domain=test_config.api_domain,
            address=svm_address,
            uri=f"https://{test_config.api_domain}",
            version="1",
            chain_id=SOLANA_MAINNET_CHAIN_ID,
            expiration_time=(datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
        )
        prepared = prepare_siwx_for_signing(payload)
        signature = await svm_signer.sign_payload(payload)
        header = prepared.create_header(signature)

        decoded = json.loads(base64.b64decode(header))
        assert decoded["message"] == prepared.message
        assert decoded["signature"] == signature


class TestSvmSIWxAuthFlow:
    async def test_valid_header_authenticates(
        self, test_config: TestConfig, svm_signer: SvmClientSigner, svm_address: str
    ) -> None:
        payload = SIWxPayload(
            domain=test_config.api_domain,
            address=svm_address,
            uri=f"https://{test_config.api_domain}",
            version="1",
            chain_id=SOLANA_MAINNET_CHAIN_ID,
            expiration_time=(datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
        )
        signature = await svm_signer.sign_payload(payload)
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
        expected_caip = f"{SOLANA_MAINNET_CHAIN_ID}:{svm_address}"
        assert body["caip_account_id"] == expected_caip

    async def test_invalid_header_rejected(self, test_config: TestConfig) -> None:
        invalid = base64.b64encode(
            json.dumps({"message": "invalid", "signature": "invalid"}).encode()
        ).decode()
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{test_config.api_base}/api/v1/session/balance",
                headers={"SIGN-IN-WITH-X": invalid},
            )
        assert resp.status_code == 401

    async def test_expired_message_rejected(
        self, test_config: TestConfig, svm_signer: SvmClientSigner, svm_address: str
    ) -> None:
        expired_time = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
        payload = SIWxPayload(
            domain=test_config.api_domain,
            address=svm_address,
            uri=f"https://{test_config.api_domain}",
            version="1",
            chain_id=SOLANA_MAINNET_CHAIN_ID,
            expiration_time=expired_time,
        )
        signature = await svm_signer.sign_payload(payload)
        header = encode_siwx_header(create_siwx_message(payload), signature)

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{test_config.api_base}/api/v1/session/balance",
                headers={"SIGN-IN-WITH-X": header},
            )
        assert resp.status_code == 401

    async def test_domain_mismatch_rejected(
        self, test_config: TestConfig, svm_signer: SvmClientSigner, svm_address: str
    ) -> None:
        payload = SIWxPayload(
            domain="wrong-domain.com",
            address=svm_address,
            uri="https://wrong-domain.com",
            version="1",
            chain_id=SOLANA_MAINNET_CHAIN_ID,
            expiration_time=(datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
        )
        signature = await svm_signer.sign_payload(payload)
        header = encode_siwx_header(create_siwx_message(payload), signature)

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{test_config.api_base}/api/v1/session/balance",
                headers={"SIGN-IN-WITH-X": header},
            )
        assert resp.status_code == 401
