/**
 * EVM Client API Integration Tests
 *
 * Tests the AimoClient API using EVM (Ethereum) signer.
 */
import { describe, it, before } from "mocha";
import { assert } from "chai";
import { testConfig } from "./testEnv";
import { AimoClient } from "@aimo.network/client";
import { EvmClientSigner } from "@aimo.network/evm";
import { aimoNetwork } from "@aimo.network/provider";
import { privateKeyToAccount } from "viem/accounts";
import { generateText } from "ai";
import {
  chatCompletionsMessages,
  chatCompletionsRequestBody,
  debugFetch,
} from "./utils";

describe("EVM Client API Tests", function () {
  // Increase timeout for API calls
  this.timeout(60000);

  let client: AimoClient;
  let clientSigner: EvmClientSigner;

  before(function () {
    if (!testConfig.evmPrivateKey) {
      console.log("    ⚠️  Skipping EVM tests - EVM_PRIVATE_KEY not set");
      this.skip();
      return;
    }

    // Create EVM account from private key
    const account = privateKeyToAccount(testConfig.evmPrivateKey);
    console.log(`    Using EVM wallet: ${account.address}`);

    // Create client signer
    clientSigner = new EvmClientSigner({
      signer: account,
      chainId: "eip155:8453",
    });

    // Create AimoClient (fetch is wrapped automatically)
    client = new AimoClient({
      signer: clientSigner,
      baseUrl: testConfig.apiBase,
      siwxDomain: testConfig.apiDomain,
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

    // Verify CAIP account ID format is correct for EVM
    assert.include(
      balance.caip_account_id,
      "eip155:",
      "Expected EVM CAIP account ID"
    );
  });

  it("should make chat completion request", async function () {
    const response = await client.chatCompletions(chatCompletionsRequestBody);

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

  it("should be compatible with ai sdk", async function () {
    const aimo = aimoNetwork({
      signer: clientSigner,
      baseURL: testConfig.apiBase,
      siwxDomain: testConfig.apiDomain,
      fetch: debugFetch(globalThis.fetch),
    });
    const model = aimo.chat("openai/gpt-5");
    const result = await generateText({
      model,
      maxOutputTokens: 1000,
      messages: chatCompletionsMessages,
    });
    assert.isString(result.text, "Expected text in AI SDK response");

    console.log(`    AI SDK Chat completion: ${result.text}`);
  });
});
