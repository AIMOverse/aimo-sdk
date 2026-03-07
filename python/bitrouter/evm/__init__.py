"""Ethereum (EVM) signer module for BitRouter SDK."""

from bitrouter.evm.constants import EVM_MAINNET_CHAIN_ID
from bitrouter.evm.signer import EvmClientSigner

__all__ = [
    "EVM_MAINNET_CHAIN_ID",
    "EvmClientSigner",
]
