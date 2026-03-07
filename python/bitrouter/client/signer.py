"""Client signer protocol for BitRouter SDK.

Defines the protocol that all chain-specific signers must implement.
"""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable

from bitrouter.client.siwx import SIWxPayload


@runtime_checkable
class ClientSigner(Protocol):
    """Protocol for signing SIWx messages and creating payment payloads."""

    @property
    def address(self) -> str:
        """The signer's address."""
        ...

    @property
    def network(self) -> str:
        """Network identifier in CAIP-2 format."""
        ...

    @property
    def scheme(self) -> str:
        """The payment scheme identifier."""
        ...

    async def sign_payload(self, payload: SIWxPayload) -> str:
        """Sign a SIWx payload and return the signature."""
        ...

    async def create_payment_payload(
        self, x402_version: int, payment_requirements: Any
    ) -> dict[str, Any]:
        """Create a payment payload for the x402 protocol."""
        ...


def to_scheme_registration(signer: ClientSigner) -> dict[str, Any]:
    """Convert a signer to an x402 scheme registration dict."""
    return {
        "network": signer.network,
        "client": signer,
        "x402Version": 2,
    }


def to_x402_client(signer: ClientSigner | list[ClientSigner]) -> Any:
    """Create an x402 client from one or more signers.

    Requires the x402 package to be installed.

    Args:
        signer: A single signer or list of signers.

    Returns:
        An x402Client instance.

    Raises:
        ImportError: If the x402 package is not installed.
    """
    try:
        from x402.client import x402Client
    except ImportError as e:
        raise ImportError(
            "x402 package is required for payment handling. "
            "Install it with: pip install bitrouter[x402]"
        ) from e

    signers = signer if isinstance(signer, list) else [signer]
    registrations = [to_scheme_registration(s) for s in signers]
    return x402Client.from_config({"schemes": registrations})
