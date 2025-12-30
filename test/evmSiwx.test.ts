/**
 * EVM SIWx (Sign-In-With-X) Integration Tests
 *
 * Tests EVM wallet-based authentication using the SDK.
 */
import { describe, it, before } from "mocha";
import { assert } from "chai";
import { testConfig } from "./testEnv";
import {
  createSIWxMessage,
  encodeSIWxHeader,
  prepareSIWxForSigning,
} from "@aimo.network/client";
import { EvmClientSigner, EVM_MAINNET_CHAIN_ID } from "@aimo.network/evm";
import { privateKeyToAccount } from "viem/accounts";
import crypto from "crypto";

describe("EVM SIWx Authentication Tests", function () {
  this.timeout(30000);

  let signer: EvmClientSigner;
  let address: string;

  before(function () {
    if (!testConfig.evmPrivateKey) {
      console.log("    ⚠️  Skipping EVM SIWx tests - EVM_PRIVATE_KEY not set");
      this.skip();
      return;
    }

    const account = privateKeyToAccount(testConfig.evmPrivateKey);
    signer = new EvmClientSigner(account, EVM_MAINNET_CHAIN_ID);
    address = account.address;
    console.log(`    Using EVM wallet: ${address}`);
  });

  describe("SIWx Message Building", function () {
    it("should build a valid CAIP-122 SIWx message", function () {
      const payload = {
        domain: testConfig.apiDomain,
        address,
        uri: `https://${testConfig.apiDomain}`,
        version: "1",
        chainId: EVM_MAINNET_CHAIN_ID,
        nonce: crypto.randomUUID(),
        issuedAt: new Date().toISOString(),
      };

      const message = createSIWxMessage(payload);

      // Verify message format
      assert.include(
        message,
        `${testConfig.apiDomain} wants you to sign in with your Ethereum account:`,
        "Expected domain and chain name header"
      );
      assert.include(message, address, "Expected address in message");
      assert.include(
        message,
        `URI: https://${testConfig.apiDomain}`,
        "Expected URI"
      );
      assert.include(message, "Version: 1", "Expected version");
      assert.include(
        message,
        `Chain ID: ${EVM_MAINNET_CHAIN_ID}`,
        "Expected chain ID"
      );
      assert.include(message, `Nonce: ${payload.nonce}`, "Expected nonce");
      assert.include(
        message,
        `Issued At: ${payload.issuedAt}`,
        "Expected issued at"
      );

      console.log("    Generated SIWx message:\n");
      console.log(
        message
          .split("\n")
          .map((l) => "      " + l)
          .join("\n")
      );
    });

    it("should include optional statement in message", function () {
      const payload = {
        domain: testConfig.apiDomain,
        address,
        statement: "Sign in to access the AiMo Network API.",
        uri: `https://${testConfig.apiDomain}`,
        version: "1",
        chainId: EVM_MAINNET_CHAIN_ID,
        nonce: crypto.randomUUID(),
        issuedAt: new Date().toISOString(),
      };

      const message = createSIWxMessage(payload);

      assert.include(
        message,
        "Sign in to access the AiMo Network API.",
        "Expected statement in message"
      );
    });

    it("should include optional expiration time", function () {
      const expirationTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const payload = {
        domain: testConfig.apiDomain,
        address,
        uri: `https://${testConfig.apiDomain}`,
        version: "1",
        chainId: EVM_MAINNET_CHAIN_ID,
        nonce: crypto.randomUUID(),
        issuedAt: new Date().toISOString(),
        expirationTime,
      };

      const message = createSIWxMessage(payload);

      assert.include(
        message,
        `Expiration Time: ${expirationTime}`,
        "Expected expiration time in message"
      );
    });
  });

  describe("SIWx Header Creation", function () {
    it("should create a valid base64-encoded SIWx header", async function () {
      const payload = {
        domain: testConfig.apiDomain,
        address,
        uri: `https://${testConfig.apiDomain}`,
        version: "1",
        chainId: EVM_MAINNET_CHAIN_ID,
        nonce: crypto.randomUUID(),
        issuedAt: new Date().toISOString(),
        signature: "",
      };

      const header = await signer.signPayload(payload);

      // Header should be base64 encoded
      assert.isString(header, "Expected header to be a string");

      // Decode and verify structure
      const decoded = JSON.parse(atob(header));
      assert.property(decoded, "message", "Expected message in decoded header");
      assert.property(
        decoded,
        "signature",
        "Expected signature in decoded header"
      );
      assert.isString(decoded.message, "Expected message to be a string");
      assert.match(
        decoded.signature,
        /^0x[0-9a-fA-F]+$/,
        "Expected hex signature"
      );

      console.log(`    Header length: ${header.length} chars`);
      console.log(`    Signature: ${decoded.signature.slice(0, 20)}...`);
    });

    it("should use prepareSIWxForSigning helper correctly", async function () {
      const account = privateKeyToAccount(testConfig.evmPrivateKey!);

      const payload = {
        domain: testConfig.apiDomain,
        address: account.address,
        uri: `https://${testConfig.apiDomain}`,
        version: "1",
        chainId: EVM_MAINNET_CHAIN_ID,
        nonce: crypto.randomUUID(),
        issuedAt: new Date().toISOString(),
      };

      const { message, createHeader } = prepareSIWxForSigning(payload);

      // Sign the message using viem account
      const signature = await account.signMessage({ message });

      // Create the header
      const header = createHeader(signature);

      // Verify structure
      const decoded = JSON.parse(atob(header));
      assert.equal(decoded.message, message, "Message should match");
      assert.equal(decoded.signature, signature, "Signature should match");
    });

    it("should use encodeSIWxHeader helper correctly", function () {
      const message = "test message";
      const signature = "0x1234567890abcdef";

      const header = encodeSIWxHeader(message, signature);

      const decoded = JSON.parse(atob(header));
      assert.equal(decoded.message, message);
      assert.equal(decoded.signature, signature);
    });
  });

  describe("SIWx Authentication Flow", function () {
    it("should authenticate successfully with valid SIWx header", async function () {
      const payload = {
        domain: testConfig.apiDomain,
        address,
        uri: `https://${testConfig.apiDomain}`,
        version: "1",
        chainId: EVM_MAINNET_CHAIN_ID,
        nonce: crypto.randomUUID(),
        issuedAt: new Date().toISOString(),
        signature: "",
      };

      const siwxHeader = await signer.signPayload(payload);

      const response = await fetch(
        `${testConfig.apiBase}/api/v1/session/balance`,
        {
          method: "GET",
          headers: {
            "SIGN-IN-WITH-X": siwxHeader,
          },
        }
      );

      assert.equal(
        response.status,
        200,
        "Expected 200 OK for valid SIWx header"
      );

      const body: any = await response.json();
      assert.property(body, "caip_account_id");
      assert.property(body, "balance_micro_usdc");
      assert.property(body, "balance_usd");

      // Verify the CAIP account ID matches our address
      const expectedCaipAccountId = `${EVM_MAINNET_CHAIN_ID}:${address}`;
      assert.equal(
        body.caip_account_id,
        expectedCaipAccountId,
        "CAIP account ID should match signer"
      );

      console.log(`    Authenticated as: ${body.caip_account_id}`);
      console.log(`    Balance: ${body.balance_usd}`);
    });

    it("should reject invalid SIWx header", async function () {
      const invalidHeader = btoa(
        JSON.stringify({ message: "invalid", signature: "0xinvalid" })
      );

      const response = await fetch(
        `${testConfig.apiBase}/api/v1/session/balance`,
        {
          method: "GET",
          headers: {
            "SIGN-IN-WITH-X": invalidHeader,
          },
        }
      );

      assert.equal(
        response.status,
        401,
        "Expected 401 Unauthorized for invalid SIWx header"
      );
    });

    it("should reject expired SIWx message", async function () {
      const account = privateKeyToAccount(testConfig.evmPrivateKey!);

      // Create a message issued 15 minutes ago
      const pastTime = new Date(Date.now() - 15 * 60 * 1000).toISOString();

      const { message, createHeader } = prepareSIWxForSigning({
        domain: testConfig.apiDomain,
        address: account.address,
        uri: `https://${testConfig.apiDomain}`,
        version: "1",
        chainId: EVM_MAINNET_CHAIN_ID,
        nonce: crypto.randomUUID(),
        issuedAt: pastTime, // Stale issued-at time
      });

      const signature = await account.signMessage({ message });
      const expiredHeader = createHeader(signature);

      const response = await fetch(
        `${testConfig.apiBase}/api/v1/session/balance`,
        {
          method: "GET",
          headers: {
            "SIGN-IN-WITH-X": expiredHeader,
          },
        }
      );

      assert.equal(
        response.status,
        401,
        "Expected 401 Unauthorized for expired SIWx message"
      );
    });

    it("should reject reused nonce", async function () {
      const fixedNonce = `test-nonce-${Date.now()}`;

      // First request with the nonce should succeed
      const payload1 = {
        domain: testConfig.apiDomain,
        address,
        uri: `https://${testConfig.apiDomain}`,
        version: "1",
        chainId: EVM_MAINNET_CHAIN_ID,
        nonce: fixedNonce,
        issuedAt: new Date().toISOString(),
        signature: "",
      };

      const header1 = await signer.signPayload(payload1);
      const response1 = await fetch(
        `${testConfig.apiBase}/api/v1/session/balance`,
        {
          method: "GET",
          headers: { "SIGN-IN-WITH-X": header1 },
        }
      );
      assert.equal(response1.status, 200, "Expected first request to succeed");

      // Second request with same nonce should fail
      const payload2 = {
        ...payload1,
        issuedAt: new Date().toISOString(), // Different timestamp
      };
      const header2 = await signer.signPayload(payload2);
      const response2 = await fetch(
        `${testConfig.apiBase}/api/v1/session/balance`,
        {
          method: "GET",
          headers: { "SIGN-IN-WITH-X": header2 },
        }
      );

      assert.equal(
        response2.status,
        401,
        "Expected second request with same nonce to fail"
      );
    });

    it("should reject domain mismatch", async function () {
      const account = privateKeyToAccount(testConfig.evmPrivateKey!);
      const wrongDomain = "wrong-domain.com";

      const { message, createHeader } = prepareSIWxForSigning({
        domain: wrongDomain, // Wrong domain
        address: account.address,
        uri: `https://${wrongDomain}`,
        version: "1",
        chainId: EVM_MAINNET_CHAIN_ID,
        nonce: crypto.randomUUID(),
        issuedAt: new Date().toISOString(),
      });

      const signature = await account.signMessage({ message });
      const mismatchedHeader = createHeader(signature);

      const response = await fetch(
        `${testConfig.apiBase}/api/v1/session/balance`,
        {
          method: "GET",
          headers: {
            "SIGN-IN-WITH-X": mismatchedHeader,
          },
        }
      );

      assert.equal(
        response.status,
        401,
        "Expected 401 Unauthorized for domain mismatch"
      );
    });
  });
});
