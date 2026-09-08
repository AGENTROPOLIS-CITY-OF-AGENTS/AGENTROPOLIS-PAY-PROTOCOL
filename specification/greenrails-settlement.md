# GREENRAILS Settlement Specification (v1, mock)

Status: Draft. Protocol version identifier: `greenrails.settlement.v1`.

This document extends [protocol.md](./protocol.md) with the settlement flow used by
HOOD TERPS commerce. All normative rules in `protocol.md` and controls in
[THREAT-MODEL.md](../THREAT-MODEL.md) apply unchanged. Where a PAY mandate governs the
buyer's spend, the Pay objects (Mandate, Payment Intent, Approval, Receipt) wrap this
flow; the settlement receipt links to the Pay receipt via `pay_receipt`.

## Scope and mock boundary

- v1 is **mock-only**. Every quote, state record, and receipt MUST carry `"mock": true`
  and `"display_notice": "MOCK SETTLEMENT · NO FUNDS WILL MOVE"`. Any surface (UI, CLI,
  receipt) MUST render that string verbatim.
- Implementations MUST NOT execute swaps, transfers, payouts, or request wallet signatures
  under this version. Any live flag (`LIVE_FUNDS_ENABLED` or equivalent) MUST default to
  `false` and MUST be gated behind explicit human approval after security, legal/compliance,
  custody/liquidity, and rollback gates.
- Fee fields are disclosed amounts only. No field, doc, or copy may assert a fixed price,
  appreciation, yield, profit share, redemption right, or peg for $XENTS or any NFT.

## Assets and roles (canonical)

- Seller payout asset: **USDC on Base**. No ETH payout requirement. Sellers are never
  required to accept $XENTS.
- $XENTS is **mandatory for paid HOOD TERPS participation/settlement** and is never a
  mandatory seller payout asset.
- GREENRAILS converts supported fiat/crypto inputs into **exact-output $XENTS**; completed
  settlement releases the reserved USDC to the seller.
- The Legacy NFT stays on its native chain and is **never burned** or bridged.
- Free actions stay free (site/lore viewing, wallet connect, ownership proof, basic Legacy
  Passport, free Genesis Signal Pack, GTM points, previews). They never enter this flow.

Tier placement (finance hierarchy): PAY-PROTOCOL, PAYRAIL and GREENRAILS are **T2
Protocol/Execution**; XENTS-CAPITAL-GRID (T1) is the $XENTS monetary authority;
54-FISCAL-CMD (T3) is ledger/treasury; HOOD-TERPS (T4) is a commerce consumer; T0
(SOVEREIGNTY, AEGIS-ASSURANCE, 54T, SENTINEL-6) owns `MANUAL_REVIEW` escalation.

## Entities

| Entity | Schema | Notes |
|---|---|---|
| Buyer | `settlement-quote#/$defs/party` (`role: buyer`) | Wallet optional for card input. |
| Seller | `settlement-quote#/$defs/party` (`role: seller`) | `payout_wallet` is a Base address. |
| Quote | `schemas/settlement-quote.schema.json` | Exact-output; immutable once digested. |
| Reservation | `settlement-state#/$defs/reservation` | USDC held for the seller before any buyer funds are accepted. |
| InputAuthorization | `settlement-state#/$defs/input_authorization` | Buyer's fiat/crypto authorization (not capture). |
| XentsRoute | `settlement-state#/$defs/xents_route` | Conversion of input into exact `$XENTS` output. |
| NftTransfer | `settlement-state#/$defs/nft_transfer` | Transfer on the NFT's native chain. |
| UsdcPayout | `settlement-state#/$defs/usdc_payout` | Release of reserved USDC on Base. |
| Receipt | `schemas/settlement-receipt.schema.json` | Signed terminal record. |
| Refund | `settlement-state#/$defs/refund` | Compensating return of buyer input. |

## Fee model

`quote.fees[]` lists every fee as `{code, payer, asset, amount, description?}` with
`code ∈ {network, routing, processing, platform, escrow}`. The receipt repeats the fees
actually charged. Fees are informational disclosures of amounts; the protocol makes no
claim about the value of any asset.

## State machine

Success path (exact spelling):

```
QUOTED -> USDC_RESERVED -> INPUT_AUTHORIZED -> XENTS_ROUTED -> NFT_TRANSFER_PENDING
  -> NFT_TRANSFER_CONFIRMED -> USDC_RELEASED -> RECEIPT_FINALIZED
```

Failure/terminal states: `QUOTE_EXPIRED`, `INPUT_FAILED`, `INSUFFICIENT_LIQUIDITY`,
`NFT_OWNERSHIP_CHANGED`, `NFT_TRANSFER_FAILED`, `CHAIN_CONFIRMATION_TIMEOUT`,
`USDC_PAYOUT_FAILED`, `REFUND_PENDING`, `REFUNDED`, `MANUAL_REVIEW`.

Terminal (no outgoing transitions): `RECEIPT_FINALIZED`, `QUOTE_EXPIRED`, `INPUT_FAILED`,
`INSUFFICIENT_LIQUIDITY`, `REFUNDED`, `MANUAL_REVIEW`. Every terminal state MUST produce a
receipt.

### Allowed transitions

| From | To | Trigger / guard |
|---|---|---|
| (none) | QUOTED | Quote issued; `expires_at = created_at + quote_ttl_seconds`. |
| QUOTED | USDC_RESERVED | Liquidity source confirms hold of full `usdc_payout.amount`. |
| QUOTED | QUOTE_EXPIRED | `now > expires_at` before reservation. |
| QUOTED | INSUFFICIENT_LIQUIDITY | Hold cannot be placed for the full amount. |
| QUOTED | NFT_OWNERSHIP_CHANGED | `owner_at_quote` no longer owns the token. |
| USDC_RESERVED | INPUT_AUTHORIZED | Buyer input authorized (fiat auth or on-chain deposit with `input_chain_confirmations`). |
| USDC_RESERVED | QUOTE_EXPIRED | Quote expiry while awaiting input; reservation returned. |
| USDC_RESERVED | INPUT_FAILED | Authorization declined or `input_authorization_seconds` elapsed; reservation returned. |
| USDC_RESERVED | NFT_OWNERSHIP_CHANGED | Ownership re-check fails; reservation returned. |
| INPUT_AUTHORIZED | XENTS_ROUTED | Route delivers exactly `xents_output.amount`. |
| INPUT_AUTHORIZED | INSUFFICIENT_LIQUIDITY | Route cannot deliver exact output. |
| INPUT_AUTHORIZED | NFT_OWNERSHIP_CHANGED | Ownership re-check fails. |
| XENTS_ROUTED | NFT_TRANSFER_PENDING | Transfer submitted on native chain. |
| XENTS_ROUTED | NFT_OWNERSHIP_CHANGED | Pre-submit ownership check fails. |
| NFT_TRANSFER_PENDING | NFT_TRANSFER_CONFIRMED | `confirmations >= nft_chain_confirmations`. |
| NFT_TRANSFER_PENDING | NFT_TRANSFER_FAILED | Transaction reverted/rejected. |
| NFT_TRANSFER_PENDING | CHAIN_CONFIRMATION_TIMEOUT | `nft_transfer_seconds` elapsed without threshold. |
| NFT_TRANSFER_CONFIRMED | USDC_RELEASED | Payout confirmed with `base_confirmations`. |
| NFT_TRANSFER_CONFIRMED | USDC_PAYOUT_FAILED | Payout reverted or `usdc_payout_seconds` elapsed. |
| USDC_RELEASED | RECEIPT_FINALIZED | Both `nft_transfer_verified` and `usdc_payout_verified` are true; receipt signed. |
| NFT_OWNERSHIP_CHANGED | REFUND_PENDING | Buyer input was authorized/captured. |
| NFT_OWNERSHIP_CHANGED | REFUNDED | No buyer input captured (void only). |
| NFT_TRANSFER_FAILED | REFUND_PENDING | Always (input was captured). |
| CHAIN_CONFIRMATION_TIMEOUT | NFT_TRANSFER_CONFIRMED | Late confirmation observed before refund executes. |
| CHAIN_CONFIRMATION_TIMEOUT | REFUND_PENDING | Timeout with no confirmation. |
| CHAIN_CONFIRMATION_TIMEOUT | MANUAL_REVIEW | Ambiguous chain state (reorg/pending). |
| USDC_PAYOUT_FAILED | USDC_RELEASED | Bounded retry succeeds. |
| USDC_PAYOUT_FAILED | MANUAL_REVIEW | Retries exhausted. NFT already moved: never auto-refund the buyer. |
| REFUND_PENDING | REFUNDED | Compensating refund confirmed. |
| REFUND_PENDING | MANUAL_REVIEW | Refund fails or exceeds `input_authorization_seconds`. |

Any other transition is invalid and MUST be rejected. Transitions are monotonic and are
appended to `state.transitions[]` with `actor`, `reason_code`, and optional
`evidence_digest`.

### Failure routing summary

- Before buyer input is captured (`QUOTED`, `USDC_RESERVED`): fail directly to a terminal
  state, return the reservation. No refund needed.
- After input captured but before NFT moved: `REFUND_PENDING -> REFUNDED`.
- After NFT moved (`NFT_TRANSFER_CONFIRMED` onward): never refund the buyer automatically;
  retry payout, then `MANUAL_REVIEW` (T0 escalation) with `held_assets` recorded.

## Invariants (MUST)

1. **Reserve before accept.** No transition to `INPUT_AUTHORIZED` unless `reservation.status
   = held` for the full `usdc_payout.amount`.
2. **Dual-verify before complete.** `RECEIPT_FINALIZED` requires
   `verification.nft_transfer_verified = true` and `usdc_payout_verified = true`, each with
   a tx reference meeting its confirmation threshold.
3. **Exact output.** `xents_route.amount_out` MUST equal `quote.xents_output.amount`.
4. **Non-atomic by design.** Cross-chain steps are separate transitions with timeouts and
   confirmation thresholds; compensation is explicit (`REFUND_PENDING`, `MANUAL_REVIEW`).
5. **No burn.** `nft_transfer.chain` MUST equal `quote.listing.nft.chain`; `to` is a
   wallet, never a burn address.
6. **Quote immutability.** Amounts, assets, destinations, fees, timeouts and thresholds
   MUST NOT change after `quote_digest` is computed.

## Timeouts and confirmation thresholds

Required on every quote (`timeouts`, `confirmation_thresholds`):

| Field | Meaning |
|---|---|
| `quote_ttl_seconds` | QUOTED/USDC_RESERVED -> QUOTE_EXPIRED |
| `input_authorization_seconds` | USDC_RESERVED -> INPUT_FAILED; also bounds REFUND_PENDING |
| `nft_transfer_seconds` | NFT_TRANSFER_PENDING -> CHAIN_CONFIRMATION_TIMEOUT |
| `usdc_payout_seconds` | NFT_TRANSFER_CONFIRMED -> USDC_PAYOUT_FAILED |
| `nft_chain_confirmations` | Confirmations required on the NFT's native chain |
| `base_confirmations` | Confirmations required on Base for USDC release |
| `input_chain_confirmations` | Confirmations for on-chain buyer inputs (optional for fiat) |

## Idempotency

- `idempotency_key` (>= 8 chars) is chosen by the client and carried on quote, state, and
  receipt. Re-submitting the same key with the same `quote_digest` MUST return the existing
  object. Same key with a different digest MUST be rejected (`409`-class error).
- Each side effect (reserve, authorize, route, transfer, payout, refund) MUST use a derived
  sub-key `sha256(idempotency_key || ":" || step)` toward its provider.
- Provider callbacks MUST be correlated to the derived sub-key and de-duplicated.

## Receipt signature envelope

```json
"signature": {
  "alg": "ed25519 | es256 | es256k | mock-none",
  "kid": "<key id>",
  "signer": "<authority id>",
  "canonicalization": "rfc8785-jcs",
  "payload_digest": "sha256:<hex over JCS receipt without `signature`>",
  "value": "<base64url signature>",
  "signed_at": "<date-time>"
}
```

`mock-none` is permitted only while `mock: true`. Receipts MAY chain via
`previous_receipt_digest`. `evidence_digest` commits to the full transition log.

## Conformance

An implementation is conformant when its objects validate against the three settlement
schemas, it rejects transitions absent from the table above, enforces the invariants,
renders the display notice, and produces a signed receipt for every terminal state.
Run `node tests/validate-schemas.mjs` (see `.github/workflows/schema-validate.yml`).
