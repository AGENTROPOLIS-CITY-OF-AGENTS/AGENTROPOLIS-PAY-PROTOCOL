# Wallet Provider Contract

Wallet providers are execution backends only.

They SHALL NOT create authority.

Authority originates from:

Identity -> Mandate -> Policy -> Approval.

## Required Capabilities

- capabilities()
- health()
- prepare()
- execute()
- status()
- revoke()
- rotate()

## Required Metadata

- custody model
- supported chains
- supported assets
- supported settlement rails
- signing model
- provider version
- receipt format

## Supported Providers

- Cloudflare Wallets
- Base Smart Wallet
- Safe
- Xaman
- Joey
- MetaMask
- Phantom
- Future adapters

All providers must emit equivalent receipt objects and conform to the same governance corridor.