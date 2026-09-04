# AGENTROPOLIS Pay Protocol - Rust Reference SDK

Rust is the preferred reference implementation language for production-critical Pay Protocol components.

The Rust SDK should implement strongly typed protocol objects and deterministic validation for:

- `Mandate`
- `PaymentIntent`
- `Approval`
- `Receipt`
- `PrivacySettlementEnvelope`
- canonical serialization and hashing
- expiry/revocation checks
- amount/currency/merchant/rail constraints
- idempotency and replay-resistant identifiers
- provider evidence verification interfaces

This SDK MUST NOT contain production private keys, seed phrases, unrestricted wallet custody, proprietary fraud rules, or implicit spending authority.

The JSON schemas remain the language-neutral interoperability contract. Rust is the hardened reference implementation, not a requirement imposed on every external implementer.

Canonical corridor:

`Identity -> Mandate -> Payment Intent -> Policy -> Approval -> Provider Execution -> Receipt -> Audit`
