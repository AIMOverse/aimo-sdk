/**
 * Test environment configuration
 *
 * Loads environment variables from .env or .env.local depending on how tests are run.
 * - `pnpm test` uses .env (production endpoints)
 * - `pnpm test:local` uses .env.local (local development)
 */
import dotenv from "dotenv";

// Check for TEST_ENV environment variable to determine which env file to load
const isLocal = process.env.TEST_ENV === "local";
const envFile = isLocal ? ".env.local" : ".env";
dotenv.config({ path: envFile });

// Default API base URLs
const DEFAULT_API_BASE_PRODUCTION = "https://beta.bitrouter.io";
const DEFAULT_API_BASE_LOCAL = "http://localhost:8000";

// Derive API base and domain
const apiBase =
  process.env.API_BASE || (isLocal ? DEFAULT_API_BASE_LOCAL : DEFAULT_API_BASE_PRODUCTION);
const apiDomain = process.env.API_DOMAIN || new URL(apiBase).hostname;

// Export environment configuration
export const testConfig = {
  apiBase,
  apiDomain,
  evmPrivateKey: process.env.EVM_PRIVATE_KEY as `0x${string}` | undefined,
  solanaPrivateKey: process.env.SOLANA_PRIVATE_KEY,
  isLocal: process.env.TEST_ENV === "local",
};

console.log(`\n📋 Test Configuration:`);
console.log(`   Environment: ${testConfig.isLocal ? "local" : "production"}`);
console.log(`   API Base: ${testConfig.apiBase}`);
console.log(`   API Domain: ${testConfig.apiDomain}`);
console.log(`   EVM Key: ${testConfig.evmPrivateKey ? "✓ configured" : "✗ not set"}`);
console.log(`   Solana Key: ${testConfig.solanaPrivateKey ? "✓ configured" : "✗ not set"}\n`);
