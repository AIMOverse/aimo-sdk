"""BitRouter API Client.

Provides a typed client for interacting with BitRouter API endpoints.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

import httpx

from bitrouter.client.http import WrapHttpxOptions, create_siwx_httpx_client
from bitrouter.client.signer import ClientSigner

BITROUTER_ENDPOINTS = {
    "chat_completions": "/chat/completions",
    "session_balance": "/session/balance",
}

API_BASE = "/api/v1"


@dataclass
class SessionBalanceResponse:
    """Session balance response from the API."""

    caip_account_id: str
    balance_micro_usdc: int
    balance_usd: str


@dataclass
class BitRouterClientOptions:
    """Options for creating a BitRouterClient instance."""

    signer: ClientSigner
    base_url: str
    api_base: str = API_BASE
    siwx_domain: str | None = None
    endpoints_override: dict[str, str] = field(default_factory=dict)
    httpx_client: httpx.AsyncClient | None = None


class BitRouterClient:
    """BitRouter API Client.

    Provides methods to interact with BitRouter API endpoints including
    chat completions and session balance queries.

    Can be used as an async context manager::

        async with BitRouterClient(options) as client:
            balance = await client.session_balance()
    """

    def __init__(self, options: BitRouterClientOptions) -> None:
        self._base_url = options.base_url.rstrip("/")
        self._api_base = options.api_base.strip("/")
        self._endpoints = {**BITROUTER_ENDPOINTS, **options.endpoints_override}
        self._owns_client = options.httpx_client is None

        if options.httpx_client is not None:
            self._client = options.httpx_client
        else:
            wrap_options = WrapHttpxOptions(siwx_domain=options.siwx_domain)
            self._client = create_siwx_httpx_client(options.signer, wrap_options)

    def _build_url(self, endpoint: str) -> str:
        """Build the full URL for an endpoint."""
        return f"{self._base_url}/{self._api_base}/{endpoint.lstrip('/')}"

    async def chat_completions(
        self,
        body: dict[str, Any],
        **kwargs: Any,
    ) -> httpx.Response:
        """Send a chat completion request.

        This endpoint is OpenAI-compatible and supports streaming responses.

        Args:
            body: The chat completion request body (OpenAI-compatible format).
            **kwargs: Additional kwargs passed to httpx request.

        Returns:
            The raw httpx.Response object (for streaming support).
        """
        url = self._build_url(self._endpoints["chat_completions"])
        headers = kwargs.pop("headers", {})
        headers["Content-Type"] = "application/json"
        return await self._client.post(
            url,
            content=json.dumps(body),
            headers=headers,
            **kwargs,
        )

    async def session_balance(self, **kwargs: Any) -> SessionBalanceResponse:
        """Query the session balance for the authenticated wallet.

        Returns:
            Session balance information.

        Raises:
            httpx.HTTPStatusError: If the request fails.
        """
        url = self._build_url(self._endpoints["session_balance"])
        response = await self._client.get(url, **kwargs)

        if response.status_code >= 400:
            error_body: Any
            try:
                error_body = response.json()
            except Exception:
                raise httpx.HTTPStatusError(
                    f"API request failed: {response.status_code} {response.reason_phrase}",
                    request=response.request,
                    response=response,
                )
            raise httpx.HTTPStatusError(
                f"API request failed: {response.status_code} {response.reason_phrase} - "
                f"{error_body.get('error', json.dumps(error_body))}",
                request=response.request,
                response=response,
            )

        data = response.json()
        return SessionBalanceResponse(
            caip_account_id=data["caip_account_id"],
            balance_micro_usdc=data["balance_micro_usdc"],
            balance_usd=data["balance_usd"],
        )

    async def aclose(self) -> None:
        """Close the underlying httpx client."""
        if self._owns_client:
            await self._client.aclose()

    async def __aenter__(self) -> BitRouterClient:
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self.aclose()
