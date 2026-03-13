"""Sign-In-With-X (SIWx) Client SDK.

Implements CAIP-122 standard wallet-based identity assertions.
This module allows clients to prove control of a wallet for authentication.
"""

from __future__ import annotations

import base64
import json
from dataclasses import dataclass, field
from typing import Callable


@dataclass
class SIWxPayload:
    """SIWx payload containing the message fields and signature."""

    domain: str
    address: str
    uri: str
    version: str
    chain_id: str
    expiration_time: str
    statement: str | None = None
    nonce: str | None = None
    issued_at: str | None = None
    not_before: str | None = None
    request_id: str | None = None
    resources: list[str] = field(default_factory=list)
    signature: str = ""


def _get_chain_name(chain_id: str) -> str:
    """Get the chain name from a CAIP-2 chain ID."""
    if chain_id.startswith("eip155:"):
        return "Ethereum"
    if chain_id.startswith("solana:"):
        return "Solana"
    namespace = chain_id.split(":")[0]
    return namespace[0].upper() + namespace[1:]


def create_siwx_message(payload: SIWxPayload) -> str:
    """Create a CAIP-122 formatted SIWx message string from a payload.

    Args:
        payload: SIWx payload (signature field is ignored).

    Returns:
        CAIP-122 formatted message string.
    """
    chain_name = _get_chain_name(payload.chain_id)

    lines: list[str] = [
        f"{payload.domain} wants you to sign in with your {chain_name} account:",
        payload.address,
        "",
    ]

    if payload.statement:
        lines.append(payload.statement)
        lines.append("")

    lines.append(f"URI: {payload.uri}")
    lines.append(f"Version: {payload.version}")
    lines.append(f"Chain ID: {payload.chain_id}")

    if payload.nonce:
        lines.append(f"Nonce: {payload.nonce}")

    if payload.issued_at:
        lines.append(f"Issued At: {payload.issued_at}")

    lines.append(f"Expiration Time: {payload.expiration_time}")

    if payload.not_before:
        lines.append(f"Not Before: {payload.not_before}")

    if payload.request_id:
        lines.append(f"Request ID: {payload.request_id}")

    if payload.resources:
        lines.append("Resources:")
        for resource in payload.resources:
            lines.append(f"- {resource}")

    return "\n".join(lines)


def encode_siwx_header(message: str, signature: str) -> str:
    """Encode a signed SIWx envelope as a base64 header value.

    Args:
        message: The CAIP-122 formatted message string.
        signature: The signature over the message.

    Returns:
        Base64-encoded header value.
    """
    envelope = {"message": message, "signature": signature}
    return base64.b64encode(json.dumps(envelope).encode()).decode()


@dataclass
class PreparedSIWx:
    """Result of preparing a SIWx payload for signing."""

    message: str
    create_header: Callable[[str], str]


def prepare_siwx_for_signing(payload: SIWxPayload) -> PreparedSIWx:
    """Prepare a SIWx payload for signing.

    This is a convenience function that creates the message and provides
    a helper to encode the final header after signing.

    Args:
        payload: SIWx payload (signature field is ignored).

    Returns:
        Object containing the message to sign and a function to create the header.
    """
    message = create_siwx_message(payload)
    return PreparedSIWx(
        message=message,
        create_header=lambda signature: encode_siwx_header(message, signature),
    )
