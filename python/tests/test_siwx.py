"""Unit tests for SIWx (Sign-In-With-X) CAIP-122 implementation.

These tests require no credentials or network access.
"""

from __future__ import annotations

import base64
import json

from bitrouter.client.siwx import (
    SIWxPayload,
    create_siwx_message,
    encode_siwx_header,
    prepare_siwx_for_signing,
)


class TestCreateSIWxMessage:
    def test_solana_message_format(self) -> None:
        payload = SIWxPayload(
            domain="app.bitrouter.ai",
            address="7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
            uri="https://app.bitrouter.ai",
            version="1",
            chain_id="solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
            expiration_time="2025-01-01T00:00:00.000Z",
        )
        message = create_siwx_message(payload)

        assert "app.bitrouter.ai wants you to sign in with your Solana account:" in message
        assert "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" in message
        assert "URI: https://app.bitrouter.ai" in message
        assert "Version: 1" in message
        assert "Chain ID: solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" in message
        assert "Expiration Time: 2025-01-01T00:00:00.000Z" in message

    def test_ethereum_message_format(self) -> None:
        payload = SIWxPayload(
            domain="app.bitrouter.ai",
            address="0x1234567890abcdef1234567890abcdef12345678",
            uri="https://app.bitrouter.ai",
            version="1",
            chain_id="eip155:1",
            expiration_time="2025-01-01T00:00:00.000Z",
        )
        message = create_siwx_message(payload)

        assert "app.bitrouter.ai wants you to sign in with your Ethereum account:" in message
        assert "0x1234567890abcdef1234567890abcdef12345678" in message
        assert "Chain ID: eip155:1" in message

    def test_optional_statement(self) -> None:
        payload = SIWxPayload(
            domain="app.bitrouter.ai",
            address="test-address",
            uri="https://app.bitrouter.ai",
            version="1",
            chain_id="solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
            expiration_time="2025-01-01T00:00:00.000Z",
            statement="Sign in to access the BitRouter API.",
        )
        message = create_siwx_message(payload)

        assert "Sign in to access the BitRouter API." in message

    def test_optional_nonce_and_issued_at(self) -> None:
        payload = SIWxPayload(
            domain="app.bitrouter.ai",
            address="test-address",
            uri="https://app.bitrouter.ai",
            version="1",
            chain_id="eip155:1",
            expiration_time="2025-01-01T00:00:00.000Z",
            nonce="test-nonce-123",
            issued_at="2024-12-31T23:00:00.000Z",
        )
        message = create_siwx_message(payload)

        assert "Nonce: test-nonce-123" in message
        assert "Issued At: 2024-12-31T23:00:00.000Z" in message

    def test_resources_list(self) -> None:
        payload = SIWxPayload(
            domain="app.bitrouter.ai",
            address="test-address",
            uri="https://app.bitrouter.ai",
            version="1",
            chain_id="solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
            expiration_time="2025-01-01T00:00:00.000Z",
            resources=[
                "https://api.bitrouter.ai/chat",
                "https://api.bitrouter.ai/models",
            ],
        )
        message = create_siwx_message(payload)

        assert "Resources:" in message
        assert "- https://api.bitrouter.ai/chat" in message
        assert "- https://api.bitrouter.ai/models" in message

    def test_unknown_chain_namespace(self) -> None:
        payload = SIWxPayload(
            domain="example.com",
            address="test-address",
            uri="https://example.com",
            version="1",
            chain_id="cosmos:cosmoshub-4",
            expiration_time="2025-01-01T00:00:00.000Z",
        )
        message = create_siwx_message(payload)

        assert "example.com wants you to sign in with your Cosmos account:" in message


class TestEncodeSIWxHeader:
    def test_produces_valid_base64_json(self) -> None:
        message = "test message"
        signature = "test-signature"

        header = encode_siwx_header(message, signature)

        decoded = json.loads(base64.b64decode(header))
        assert decoded["message"] == message
        assert decoded["signature"] == signature

    def test_roundtrip_with_real_message(self) -> None:
        payload = SIWxPayload(
            domain="app.bitrouter.ai",
            address="test-address",
            uri="https://app.bitrouter.ai",
            version="1",
            chain_id="solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
            expiration_time="2025-01-01T00:00:00.000Z",
        )
        message = create_siwx_message(payload)
        signature = "5TyNmXvBUKgK9QrF4z..."

        header = encode_siwx_header(message, signature)

        decoded = json.loads(base64.b64decode(header))
        assert decoded["message"] == message
        assert decoded["signature"] == signature


class TestPrepareSIWxForSigning:
    def test_returns_message_and_callable(self) -> None:
        payload = SIWxPayload(
            domain="app.bitrouter.ai",
            address="test-address",
            uri="https://app.bitrouter.ai",
            version="1",
            chain_id="eip155:1",
            expiration_time="2025-01-01T00:00:00.000Z",
        )

        prepared = prepare_siwx_for_signing(payload)

        assert isinstance(prepared.message, str)
        assert callable(prepared.create_header)

    def test_create_header_produces_valid_output(self) -> None:
        payload = SIWxPayload(
            domain="app.bitrouter.ai",
            address="test-address",
            uri="https://app.bitrouter.ai",
            version="1",
            chain_id="eip155:1",
            expiration_time="2025-01-01T00:00:00.000Z",
        )

        prepared = prepare_siwx_for_signing(payload)
        header = prepared.create_header("0xdeadbeef")

        decoded = json.loads(base64.b64decode(header))
        assert decoded["message"] == prepared.message
        assert decoded["signature"] == "0xdeadbeef"
