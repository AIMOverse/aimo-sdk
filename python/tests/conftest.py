"""Test configuration and shared fixtures."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

import pytest

# Load .env from repo root
try:
    from dotenv import load_dotenv

    repo_root = Path(__file__).parent.parent.parent
    for env_file in [".env.local", ".env"]:
        env_path = repo_root / env_file
        if env_path.exists():
            load_dotenv(env_path)
            break
except ImportError:
    pass

DEFAULT_API_BASE = "https://beta.aimo.network"


@dataclass
class TestConfig:
    api_base: str
    api_domain: str
    evm_private_key: str | None
    solana_private_key: str | None


@pytest.fixture(scope="session")
def test_config() -> TestConfig:
    api_base = os.environ.get("API_BASE", DEFAULT_API_BASE)
    api_domain = os.environ.get("API_DOMAIN", "")
    if not api_domain:
        from urllib.parse import urlparse

        api_domain = urlparse(api_base).hostname or ""

    return TestConfig(
        api_base=api_base,
        api_domain=api_domain,
        evm_private_key=os.environ.get("EVM_PRIVATE_KEY"),
        solana_private_key=os.environ.get("SOLANA_PRIVATE_KEY"),
    )


CHAT_COMPLETIONS_MESSAGES = [
    {"role": "system", "content": "You are a helpful assistant. Keep your replies very brief."},
    {"role": "user", "content": "What's the meaning of life"},
]

CHAT_COMPLETIONS_REQUEST_BODY = {
    "model": "openai/gpt-5",
    "stream": False,
    "max_tokens": 100,
    "messages": CHAT_COMPLETIONS_MESSAGES,
}
