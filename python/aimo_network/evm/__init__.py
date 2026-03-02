"""Ethereum (EVM) signer module for AiMo Network SDK."""

from aimo_network.evm.constants import EVM_MAINNET_CHAIN_ID
from aimo_network.evm.signer import EvmClientSigner

__all__ = [
    "EVM_MAINNET_CHAIN_ID",
    "EvmClientSigner",
]
