"""HTTP wrapper for AiMo Network SDK.

Wraps httpx.AsyncClient with SIWx authentication and x402 payment handling.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from typing import Any
from urllib.parse import urlparse

import httpx

from aimo_network.client.signer import ClientSigner
from aimo_network.client.siwx import (
    SIWxPayload,
    create_siwx_message,
    encode_siwx_header,
)


@dataclass
class SIWxSessionCache:
    """In-memory cache for SIWx sessions."""

    _cache: dict[str, SIWxPayload] = field(default_factory=dict)

    def get(self, address: str) -> SIWxPayload | None:
        return self._cache.get(address)

    def set(self, address: str, payload: SIWxPayload) -> None:
        self._cache[address] = payload


@dataclass
class WrapHttpxOptions:
    """Options for wrapping an httpx client with SIWx auth."""

    siwx_domain: str | None = None
    session_cache: SIWxSessionCache | None = None


def _generate_expiration_time() -> str:
    """Generate an expiration time ISO string (1 hour from now)."""
    return (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()


def _extract_domain(url: str) -> str:
    """Extract host from a URL string."""
    parsed = urlparse(url)
    return parsed.netloc or parsed.hostname or ""


async def _build_siwx_header(
    signer: ClientSigner,
    url: str,
    options: WrapHttpxOptions | None,
) -> str:
    """Build the SIWx authentication header."""
    # Check cache first
    if options and options.session_cache:
        cached = options.session_cache.get(signer.address)
        if cached and datetime.fromisoformat(cached.expiration_time) > datetime.now(timezone.utc):
            message = create_siwx_message(cached)
            return encode_siwx_header(message, cached.signature)

    # Build new payload
    domain = (options.siwx_domain if options else None) or _extract_domain(url)

    if options and options.siwx_domain:
        parsed = urlparse(url)
        uri = f"https://{options.siwx_domain}{parsed.path}{parsed.query and '?' + parsed.query or ''}"
    else:
        uri = url

    payload = SIWxPayload(
        domain=domain,
        address=str(signer.address),
        uri=uri,
        version="1",
        chain_id=signer.network,
        expiration_time=_generate_expiration_time(),
    )

    signature = await signer.sign_payload(payload)
    siwx_header = encode_siwx_header(create_siwx_message(payload), signature)

    # Cache the signed payload
    if options and options.session_cache:
        payload.signature = signature
        options.session_cache.set(signer.address, payload)

    return siwx_header


class _SIWxTransport(httpx.AsyncBaseTransport):
    """httpx transport that injects SIWx headers and optionally handles x402 payments."""

    def __init__(
        self,
        signer: ClientSigner,
        options: WrapHttpxOptions | None,
        base_transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._signer = signer
        self._options = options
        self._base_transport = base_transport or httpx.AsyncHTTPTransport()
        self._x402_client: Any = None
        self._x402_available = False
        self._x402_checked = False

    def _check_x402(self) -> None:
        if self._x402_checked:
            return
        self._x402_checked = True
        try:
            from x402.http.clients import x402HttpxClient

            from aimo_network.client.signer import to_x402_client

            self._x402_client = to_x402_client(self._signer)
            self._x402_transport_cls = x402HttpxClient
            self._x402_available = True
        except ImportError:
            self._x402_available = False

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        # Add SIWx header
        siwx_header = await _build_siwx_header(
            self._signer, str(request.url), self._options
        )
        request.headers["SIGN-IN-WITH-X"] = siwx_header

        # Get response from base transport
        response = await self._base_transport.handle_async_request(request)

        # Handle x402 payment if needed
        self._check_x402()
        if self._x402_available and response.status_code == 402:
            try:
                from x402.http.clients import handle_402_httpx

                return await handle_402_httpx(
                    self._x402_client, request, response, self._base_transport
                )
            except Exception:
                pass

        return response

    async def aclose(self) -> None:
        await self._base_transport.aclose()


def create_siwx_httpx_client(
    signer: ClientSigner,
    options: WrapHttpxOptions | None = None,
    **httpx_kwargs: Any,
) -> httpx.AsyncClient:
    """Create an httpx.AsyncClient wrapped with SIWx authentication.

    The returned client automatically:
    1. Injects SIGN-IN-WITH-X header on every request
    2. Handles x402 Payment Required responses (if x402 is installed)

    Args:
        signer: The client signer for authentication.
        options: Optional configuration for SIWx domain and caching.
        **httpx_kwargs: Additional kwargs passed to httpx.AsyncClient.

    Returns:
        An httpx.AsyncClient with SIWx auth.
    """
    base_transport = httpx_kwargs.pop("transport", None)
    transport = _SIWxTransport(signer, options, base_transport)
    return httpx.AsyncClient(transport=transport, **httpx_kwargs)
