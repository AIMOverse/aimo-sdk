/**
 * SVM SIWx (Sign-In-With-X) Integration Tests
 *
 * Tests Solana wallet-based authentication using the SDK.
 */
import { describe, it, before } from "mocha";
import { assert } from "chai";
import { testConfig } from "./testEnv";
import {
  createSIWxMessage,
  encodeSIWxHeader,
  prepareSIWxForSigning,
} from "@aimo.network/client";
import { SvmClientSigner, SOLANA_MAINNET_CHAIN_ID } from "@aimo.network/svm";
import { createKeyPairSignerFromBytes, signBytes } from "@solana/kit";
import bs58 from "bs58";

describe("SVM SIWx Authentication Tests", function () {
  this.timeout(30000);

  let signer: SvmClientSigner;
  let keypairSigner: Awaited<ReturnType<typeof createKeyPairSignerFromBytes>>;
  let address: string;

  before(async function () {
    if (!testConfig.solanaPrivateKey) {
      console.log(
        "    ⚠️  Skipping SVM SIWx tests - SOLANA_PRIVATE_KEY not set"
      );
      this.skip();
      return;
    }

    const privateKeyBytes = bs58.decode(testConfig.solanaPrivateKey);
    keypairSigner = await createKeyPairSignerFromBytes(privateKeyBytes);
    signer = new SvmClientSigner({
      signer: keypairSigner,
      chainId: SOLANA_MAINNET_CHAIN_ID,
    });
    address = keypairSigner.address;
    console.log(`    Using Solana wallet: ${address}`);
  });

  describe("SIWx Message Building", function () {
    it("should build a valid CAIP-122 SIWx message for Solana", function () {
      const expirationTime = new Date(
        Date.now() + 60 * 60 * 1000
      ).toISOString();
      const payload = {
        domain: testConfig.apiDomain,
        address,
        uri: `https://${testConfig.apiDomain}`,
        version: "1",
        chainId: SOLANA_MAINNET_CHAIN_ID,
        expirationTime,
      };

      const message = createSIWxMessage(payload);

      // Verify message format for Solana
      assert.include(
        message,
        `${testConfig.apiDomain} wants you to sign in with your Solana account:`,
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
        `Chain ID: ${SOLANA_MAINNET_CHAIN_ID}`,
        "Expected chain ID"
      );
      assert.include(
        message,
        `Expiration Time: ${payload.expirationTime}`,
        "Expected expiration time"
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
        chainId: SOLANA_MAINNET_CHAIN_ID,
        expirationTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      };

      const message = createSIWxMessage(payload);

      assert.include(
        message,
        "Sign in to access the AiMo Network API.",
        "Expected statement in message"
      );
    });

    it("should include resources list in message", function () {
      const payload = {
        domain: testConfig.apiDomain,
        address,
        uri: `https://${testConfig.apiDomain}`,
        version: "1",
        chainId: SOLANA_MAINNET_CHAIN_ID,
        expirationTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        resources: [
          "https://api.aimo.network/chat",
          "https://api.aimo.network/models",
        ],
      };

      const message = createSIWxMessage(payload);

      assert.include(message, "Resources:", "Expected resources section");
      assert.include(
        message,
        "- https://api.aimo.network/chat",
        "Expected first resource"
      );
      assert.include(
        message,
        "- https://api.aimo.network/models",
        "Expected second resource"
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
        chainId: SOLANA_MAINNET_CHAIN_ID,
        expirationTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
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
      // Solana signatures are base58 encoded
      assert.isString(decoded.signature, "Expected base58 signature");

      console.log(`    Header length: ${header.length} chars`);
      console.log(`    Signature: ${decoded.signature.slice(0, 20)}...`);
    });

    it("should use prepareSIWxForSigning helper correctly", async function () {
      const payload = {
        domain: testConfig.apiDomain,
        address,
        uri: `https://${testConfig.apiDomain}`,
        version: "1",
        chainId: SOLANA_MAINNET_CHAIN_ID,
        expirationTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      };

      const { message, createHeader } = prepareSIWxForSigning(payload);

      // Sign the message manually using @solana/kit
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = await signBytes(
        keypairSigner.keyPair.privateKey,
        messageBytes
      );
      const signature = bs58.encode(signatureBytes);

      // Create the header
      const header = createHeader(signature);

      // Verify structure
      const decoded = JSON.parse(atob(header));
      assert.equal(decoded.message, message, "Message should match");
      assert.equal(decoded.signature, signature, "Signature should match");
    });

    it("should use encodeSIWxHeader helper correctly", function () {
      const message = "test message";
      const signature = "5TyNmXvBUKgK9QrF4z...";

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
        chainId: SOLANA_MAINNET_CHAIN_ID,
        expirationTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
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
      const expectedCaipAccountId = `${SOLANA_MAINNET_CHAIN_ID}:${address}`;
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
        JSON.stringify({ message: "invalid", signature: "invalid" })
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
      // Create a message that's already expired
      const expiredTime = new Date(Date.now() - 60 * 1000).toISOString(); // 1 minute ago

      const { message, createHeader } = prepareSIWxForSigning({
        domain: testConfig.apiDomain,
        address,
        uri: `https://${testConfig.apiDomain}`,
        version: "1",
        chainId: SOLANA_MAINNET_CHAIN_ID,
        expirationTime: expiredTime, // Expired
      });

      // Sign using the keypair
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = await signBytes(
        keypairSigner.keyPair.privateKey,
        messageBytes
      );
      const signature = bs58.encode(signatureBytes);
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

    it("should reject domain mismatch", async function () {
      const wrongDomain = "wrong-domain.com";

      const { message, createHeader } = prepareSIWxForSigning({
        domain: wrongDomain, // Wrong domain
        address,
        uri: `https://${wrongDomain}`,
        version: "1",
        chainId: SOLANA_MAINNET_CHAIN_ID,
        expirationTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });

      // Sign using the keypair
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = await signBytes(
        keypairSigner.keyPair.privateKey,
        messageBytes
      );
      const signature = bs58.encode(signatureBytes);
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
