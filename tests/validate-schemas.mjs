#!/usr/bin/env node
// Validates every JSON example under examples/greenrails against the settlement schemas.
// Usage: (cd tests && npm install) && node tests/validate-schemas.mjs
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Ajv2020 = require("ajv/dist/2020");
const addFormats = require("ajv-formats");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const schemasDir = join(root, "schemas");
const examplesDir = join(root, "examples", "greenrails");
const NOTICE = "MOCK SETTLEMENT \u00b7 NO FUNDS WILL MOVE";

const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true, allowUnionTypes: true });
addFormats(ajv);

for (const file of readdirSync(schemasDir).filter((f) => f.endsWith(".schema.json"))) {
  const schema = JSON.parse(readFileSync(join(schemasDir, file), "utf8"));
  ajv.addSchema(schema, schema.$id);
}

const byPrefix = {
  quote: "https://agentropolis.example/schemas/settlement-quote.schema.json",
  state: "https://agentropolis.example/schemas/settlement-state.schema.json",
  receipt: "https://agentropolis.example/schemas/settlement-receipt.schema.json",
};

const SUCCESS = [
  "QUOTED", "USDC_RESERVED", "INPUT_AUTHORIZED", "XENTS_ROUTED", "NFT_TRANSFER_PENDING",
  "NFT_TRANSFER_CONFIRMED", "USDC_RELEASED", "RECEIPT_FINALIZED",
];
const ALLOWED = new Set([
  ...SUCCESS.slice(1).map((s, i) => `${SUCCESS[i]}>${s}`),
  "QUOTED>QUOTE_EXPIRED", "QUOTED>INSUFFICIENT_LIQUIDITY", "QUOTED>NFT_OWNERSHIP_CHANGED",
  "USDC_RESERVED>QUOTE_EXPIRED", "USDC_RESERVED>INPUT_FAILED", "USDC_RESERVED>NFT_OWNERSHIP_CHANGED",
  "INPUT_AUTHORIZED>INSUFFICIENT_LIQUIDITY", "INPUT_AUTHORIZED>NFT_OWNERSHIP_CHANGED",
  "XENTS_ROUTED>NFT_OWNERSHIP_CHANGED",
  "NFT_TRANSFER_PENDING>NFT_TRANSFER_FAILED", "NFT_TRANSFER_PENDING>CHAIN_CONFIRMATION_TIMEOUT",
  "NFT_TRANSFER_CONFIRMED>USDC_PAYOUT_FAILED",
  "NFT_OWNERSHIP_CHANGED>REFUND_PENDING", "NFT_OWNERSHIP_CHANGED>REFUNDED",
  "NFT_TRANSFER_FAILED>REFUND_PENDING",
  "CHAIN_CONFIRMATION_TIMEOUT>NFT_TRANSFER_CONFIRMED", "CHAIN_CONFIRMATION_TIMEOUT>REFUND_PENDING",
  "CHAIN_CONFIRMATION_TIMEOUT>MANUAL_REVIEW",
  "USDC_PAYOUT_FAILED>USDC_RELEASED", "USDC_PAYOUT_FAILED>MANUAL_REVIEW",
  "REFUND_PENDING>REFUNDED", "REFUND_PENDING>MANUAL_REVIEW",
]);

// Semantic checks the schema alone cannot express.
function semantic(kind, doc) {
  const errs = [];
  if (doc.mock !== true) errs.push("mock must be true");
  if (doc.display_notice !== NOTICE) errs.push("display_notice mismatch");
  if (kind === "state") {
    const t = doc.transitions;
    if (t[0].from !== null || t[0].to !== "QUOTED") errs.push("log must start (null)->QUOTED");
    for (let i = 1; i < t.length; i++) {
      if (t[i].from !== t[i - 1].to) errs.push(`transition ${i} not contiguous`);
      if (!ALLOWED.has(`${t[i].from}>${t[i].to}`)) errs.push(`illegal transition ${t[i].from}->${t[i].to}`);
    }
    if (t[t.length - 1].to !== doc.state) errs.push("state != last transition");
    const reached = new Set(t.map((x) => x.to));
    if (reached.has("INPUT_AUTHORIZED") && doc.reservation?.amount === undefined) errs.push("reserve-before-accept: no reservation");
    if (reached.has("RECEIPT_FINALIZED") &&
        !(doc.nft_transfer?.status === "confirmed" && doc.usdc_payout?.status === "released"))
      errs.push("dual-verify-before-complete violated");
  }
  if (kind === "receipt" && doc.final_state === "RECEIPT_FINALIZED" &&
      !(doc.verification.nft_transfer_verified && doc.verification.usdc_payout_verified))
    errs.push("finalized receipt without dual verification");
  return errs;
}

let failures = 0, total = 0;
for (const file of readdirSync(examplesDir).filter((f) => f.endsWith(".json")).sort()) {
  const kind = basename(file).split("-")[0];
  const schemaId = byPrefix[kind];
  if (!schemaId) { console.log(`SKIP  ${file} (unknown prefix)`); continue; }
  total++;
  const doc = JSON.parse(readFileSync(join(examplesDir, file), "utf8"));
  const validate = ajv.getSchema(schemaId);
  const ok = validate(doc);
  const errs = [...(ok ? [] : validate.errors.map((e) => `${e.instancePath || "/"} ${e.message}`)), ...semantic(kind, doc)];
  if (errs.length) { failures++; console.log(`FAIL  ${file}`); for (const e of errs) console.log(`      - ${e}`); }
  else console.log(`PASS  ${file}`);
}
console.log(`\n${total - failures}/${total} examples valid`);
process.exit(failures ? 1 : 0);
