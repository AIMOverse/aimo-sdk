"""Solana (SVM) client signer implementation."""

from __future__ import annotations

from typing import Any

from bitrouter.client.siwx import SIWxPayload, create_siwx_message
from bitrouter.svm.constants import SOLANA_MAINNET_CHAIN_ID

try:
    from solders.keypair import Keypair  # type: ignore[import-untyped]
    import base58  # type: ignore[import-untyped]
except ImportError as _err:
    raise ImportError(
        "Solana dependencies are required for SvmClientSigner. "
        "Install them with: pip install bitrouter[solana]"
    ) from _err


class SvmClientSigner:
    """SVM client signer that implements the ClientSigner protocol.

    Combines x402 payment signing with SIWx authentication for Solana wallets.

    Args:
        keypair: A solders Keypair for signing.
        chain_id: CAIP-2 chain ID (default: Solana mainnet).
        rpc_url: Optional RPC URL for x402 payment transactions.
    """

    def __init__(
        self,
        keypair: Keypair,
        chain_id: str = SOLANA_MAINNET_CHAIN_ID,
        rpc_url: str | None = None,
    ) -> None:
        self._keypair = keypair
        self._chain_id = chain_id
        self._rpc_url = rpc_url
        self._exact_scheme: Any = None

    @property
    def address(self) -> str:
        """The signer's Solana address (base58 public key)."""
        return str(self._keypair.pubkey())

    @property
    def network(self) -> str:
        """Network identifier in CAIP-2 format."""
        return self._chain_id

    @property
    def scheme(self) -> str:
        """The payment scheme identifier."""
        return "exact"

    async def sign_payload(self, payload: SIWxPayload) -> str:
        """Sign a SIWx payload for authentication.

        Args:
            payload: The SIWx payload to sign.

        Returns:
            Base58-encoded signature string.
        """
        effective_payload = SIWxPayload(
            domain=payload.domain,
            address=payload.address,
            uri=payload.uri,
            version=payload.version,
            chain_id=payload.chain_id or self._chain_id,
            expiration_time=payload.expiration_time,
            statement=payload.statement,
            nonce=payload.nonce,
            issued_at=payload.issued_at,
            not_before=payload.not_before,
            request_id=payload.request_id,
            resources=payload.resources,
        )
        message = create_siwx_message(effective_payload)
        message_bytes = message.encode("utf-8")
        sig = self._keypair.sign_message(message_bytes)
        return base58.b58encode(bytes(sig)).decode()

    async def create_payment_payload(
        self, x402_version: int, payment_requirements: Any
    ) -> dict[str, Any]:
        """Create a payment payload for the x402 protocol.

        Delegates to x402's ExactSvmScheme.

        Raises:
            ImportError: If x402[svm] is not installed.
        """
        if self._exact_scheme is None:
            try:
                from x402.schemes.exact.svm import ExactSvmScheme  # type: ignore[import-untyped]
            except ImportError as e:
                raise ImportError(
                    "x402[svm] is required for payment handling. "
                    "Install it with: pip install bitrouter[solana]"
                ) from e
            config = {"rpc_url": self._rpc_url} if self._rpc_url else {}
            self._exact_scheme = ExactSvmScheme(self._keypair, config)

        return await self._exact_scheme.create_payment_payload(  # type: ignore[no-any-return]
            x402_version, payment_requirements
        )
