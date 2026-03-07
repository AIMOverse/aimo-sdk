"""Ethereum (EVM) client signer implementation."""

from __future__ import annotations

from typing import Any

from bitrouter.client.siwx import SIWxPayload, create_siwx_message
from bitrouter.evm.constants import EVM_MAINNET_CHAIN_ID

try:
    from eth_account import Account  # type: ignore[import-untyped]
    from eth_account.messages import encode_defunct  # type: ignore[import-untyped]
except ImportError as _err:
    raise ImportError(
        "Ethereum dependencies are required for EvmClientSigner. "
        "Install them with: pip install bitrouter[evm]"
    ) from _err


class EvmClientSigner:
    """EVM client signer that implements the ClientSigner protocol.

    Combines x402 payment signing with SIWx authentication for Ethereum wallets.

    Args:
        account: An eth_account Account (from Account.from_key()).
        chain_id: CAIP-2 chain ID (default: Ethereum mainnet "eip155:1").
    """

    def __init__(
        self,
        account: Account,
        chain_id: str = EVM_MAINNET_CHAIN_ID,
    ) -> None:
        self._account = account
        self._chain_id = chain_id
        self._exact_scheme: Any = None

    @property
    def address(self) -> str:
        """The signer's Ethereum address (0x-prefixed hex)."""
        return self._account.address  # type: ignore[no-any-return]

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

        Uses EIP-191 personal_sign.

        Args:
            payload: The SIWx payload to sign.

        Returns:
            Hex signature string (0x-prefixed).
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
        signable = encode_defunct(text=message)
        signed = self._account.sign_message(signable)
        return signed.signature.hex()  # type: ignore[no-any-return]

    async def create_payment_payload(
        self, x402_version: int, payment_requirements: Any
    ) -> dict[str, Any]:
        """Create a payment payload for the x402 protocol.

        Delegates to x402's ExactEvmScheme.

        Raises:
            ImportError: If x402[evm] is not installed.
        """
        if self._exact_scheme is None:
            try:
                from x402.schemes.exact.evm import ExactEvmScheme  # type: ignore[import-untyped]
            except ImportError as e:
                raise ImportError(
                    "x402[evm] is required for payment handling. "
                    "Install it with: pip install bitrouter[evm]"
                ) from e
            self._exact_scheme = ExactEvmScheme(self._account)

        return await self._exact_scheme.create_payment_payload(  # type: ignore[no-any-return]
            x402_version, payment_requirements
        )
