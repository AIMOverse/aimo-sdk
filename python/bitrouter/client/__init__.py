"""Core client module for BitRouter SDK."""

from bitrouter.client.siwx import (
    SIWxPayload,
    create_siwx_message,
    encode_siwx_header,
    prepare_siwx_for_signing,
)
from bitrouter.client.signer import ClientSigner, to_scheme_registration, to_x402_client
from bitrouter.client.http import create_siwx_httpx_client, WrapHttpxOptions
from bitrouter.client.api import BitRouterClient, BitRouterClientOptions, SessionBalanceResponse

__all__ = [
    "SIWxPayload",
    "create_siwx_message",
    "encode_siwx_header",
    "prepare_siwx_for_signing",
    "ClientSigner",
    "to_scheme_registration",
    "to_x402_client",
    "create_siwx_httpx_client",
    "WrapHttpxOptions",
    "BitRouterClient",
    "BitRouterClientOptions",
    "SessionBalanceResponse",
]
