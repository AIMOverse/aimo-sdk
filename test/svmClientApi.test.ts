/**
 * SVM Client API Integration Tests
 *
 * Tests the AimoClient API using SVM (Solana) signer.
 */
import { describe, it, before } from "mocha";
import { assert } from "chai";
import { testConfig } from "./testEnv";
import { AimoClient } from "@aimo.network/client";
import { SvmClientSigner, SOLANA_MAINNET_CHAIN_ID } from "@aimo.network/svm";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import bs58 from "bs58";

describe("SVM Client API Tests", function () {
  // Increase timeout for API calls
  this.timeout(60000);

  let client: AimoClient;

  before(async function () {
    if (!testConfig.solanaPrivateKey) {
      console.log("    ⚠️  Skipping SVM tests - SOLANA_PRIVATE_KEY not set");
      this.skip();
      return;
    }

    // Create SVM signer from private key
    const privateKeyBytes = bs58.decode(testConfig.solanaPrivateKey);
    const svmSigner = await createKeyPairSignerFromBytes(privateKeyBytes);
    console.log(`    Using Solana wallet: ${svmSigner.address}`);

    // Create client signer
    const clientSigner = new SvmClientSigner({
      signer: svmSigner,
      chainId: SOLANA_MAINNET_CHAIN_ID,
    });

    // Create AimoClient (fetch is wrapped automatically)
    client = new AimoClient({
      signer: clientSigner,
      baseUrl: testConfig.apiBase,
    });
  });

  it("should query session balance", async function () {
    const balance = await client.sessionBalance();

    assert.property(
      balance,
      "caip_account_id",
      "Expected caip_account_id in response"
    );
    assert.property(
      balance,
      "balance_micro_usdc",
      "Expected balance_micro_usdc in response"
    );
    assert.property(balance, "balance_usd", "Expected balance_usd in response");
    assert.typeOf(
      balance.balance_micro_usdc,
      "number",
      "Expected balance_micro_usdc to be a number"
    );

    console.log(`    Session balance: ${balance.balance_usd} USD`);
    console.log(`    CAIP Account: ${balance.caip_account_id}`);

    // Verify CAIP account ID format is correct for Solana
    assert.include(
      balance.caip_account_id,
      "solana:",
      "Expected Solana CAIP account ID"
    );
  });

  it("should make chat completion request", async function () {
    const response = await client.chatCompletions({
      model: "openai/gpt-4o-mini",
      stream: false,
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: "Say 'Hello from AiMo SDK test!' and nothing else.",
        },
      ],
    });

    // Response might be 200 (success) or 402 (payment required)
    assert.oneOf(
      response.status,
      [200, 402],
      "Expected 200 OK or 402 Payment Required"
    );

    if (response.status === 200) {
      const body: any = await response.json();
      assert.property(body, "choices", "Expected choices in response");
      assert.isArray(body.choices, "Expected choices to be an array");
      console.log(`    Chat completion: ${body.choices[0]?.message?.content}`);
    } else {
      const body: any = await response.json();
      assert.equal(body.x402Version, 2, "Expected x402Version to be 2");
      console.log("    Payment required - insufficient balance");
    }
  });
});
