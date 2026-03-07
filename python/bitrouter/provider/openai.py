"""OpenAI provider integration for BitRouter SDK.

Creates an OpenAI-compatible client that authenticates via SIWx wallet signing.
"""

from __future__ import annotations

from typing import Any

from bitrouter.client.api import API_BASE
from bitrouter.client.http import WrapHttpxOptions, create_siwx_httpx_client
from bitrouter.client.signer import ClientSigner

try:
    from openai import AsyncOpenAI  # type: ignore[import-untyped]
except ImportError as _err:
    raise ImportError(
        "openai package is required for the OpenAI provider. "
        "Install it with: pip install bitrouter[openai]"
    ) from _err


def create_openai_client(
    signer: ClientSigner,
    base_url: str = "https://app.bitrouter.ai",
    api_key: str = "siwx",
    siwx_domain: str | None = None,
    **openai_kwargs: Any,
) -> AsyncOpenAI:
    """Create an AsyncOpenAI client that authenticates via SIWx.

    The returned client is a standard OpenAI client that sends
    SIGN-IN-WITH-X headers for wallet-based authentication.

    Args:
        signer: The client signer for authentication.
        base_url: Base URL of the BitRouter API.
        api_key: API key (default: "siwx" — actual auth is via wallet).
        siwx_domain: Optional domain override for SIWx signing.
        **openai_kwargs: Additional kwargs passed to AsyncOpenAI.

    Returns:
        An AsyncOpenAI client configured for BitRouter.
    """
    full_base_url = f"{base_url.rstrip('/')}/{API_BASE.strip('/')}"
    wrap_options = WrapHttpxOptions(siwx_domain=siwx_domain)
    http_client = create_siwx_httpx_client(signer, wrap_options)

    return AsyncOpenAI(
        base_url=full_base_url,
        api_key=api_key,
        http_client=http_client,
        **openai_kwargs,
    )
