# Stellar Recovery Rail Integration

## Repository role

**Protocol authority.** Defines portable intent, evaluation, recovery-boundary, guardian decision, and receipt fields. It never holds keys or executes clawbacks.

## Canonical owner

The Rust policy engine is owned by `AGENTROPOLIS-PAYRAIL/packages/stellar-recovery-rail`. This repository consumes versioned policy decisions and receipts. It must not fork or bypass the evaluator.

## Required fiscal corridor

`Identity -> Mandate -> Intent -> Simulation -> Policy -> Guardian quorum -> Escrow -> Settlement -> Receipt -> Audit`

## Non-negotiable controls

- Native XLM is treated as irreversible after settlement and used only for fees/reserves unless explicitly approved.
- Recoverable settlement uses audited Soroban escrow or a clawback-enabled issuer asset configured before trustlines are established.
- Every transfer enforces transaction, daily, reserve-outflow, destination, anomaly, cooling-window, and guardian-quorum policy.
- A zero guardian quorum is invalid for irreversible or high-value transfers.
- No browser, agent, model, prompt, or UI receives raw signing keys.
- Private provenance may record authorized jurisdiction, service origin, session, device attestation, anchor, bridge, wallet, and transaction lineage.
- Public ledgers receive only minimum necessary data or cryptographic commitments; geo metadata is not treated as proof of physical location.
- Every receipt states whether funds are recoverable before execution, after execution, or not recoverable.
- Once native BTC or another irreversible asset leaves controlled escrow, tracing does not imply seizure or guaranteed retrieval.
- LIQUID-4000 regression: any action attempting extreme reserve depletion is denied even when signatures and integration credentials are valid.

## Rust-first rule

Financial policy, amount arithmetic, limit evaluation, recovery-state transitions, and receipt validation run in Rust. TypeScript, Python, dashboards, models, and agents may request or display decisions but may not reproduce or override the financial rules.

## Activation gate

Remain dry-run/testnet until the Rust crate compiles cleanly, tests pass in CI, Soroban and issuer contracts are independently audited, key custody is externalized, incident procedures are exercised, and a human governance owner approves production activation.
