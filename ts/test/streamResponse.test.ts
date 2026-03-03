/**
 * Stream Response Tests
 *
 * Tests streaming chat completions using the AimoClient with SVM (Solana) signer.
 * Demonstrates how to handle Server-Sent Events (SSE) streaming responses.
 */
import { describe, it, before } from "mocha";
import { assert } from "chai";
import { testConfig } from "./testEnv";
import { AimoClient, wrapFetchWithSigner } from "@aimo.network/client";
import { SvmClientSigner, SOLANA_MAINNET_CHAIN_ID } from "@aimo.network/svm";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import bs58 from "bs58";
import { chatCompletionsMessages } from "./utils";

/**
 * Debug wrapper for fetch to trace request/response timing
 */
function createDebugFetch(baseFetch: typeof globalThis.fetch): typeof globalThis.fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method || "GET";

    console.log(`\n    🔵 [${new Date().toISOString()}] Starting ${method} request to: ${url}`);

    if (init?.headers) {
      const headers = new Headers(init.headers);
      console.log(`    📋 Request headers:`);
      headers.forEach((value, key) => {
        // Truncate long header values for readability
        const displayValue = value.length > 100 ? value.slice(0, 100) + "..." : value;
        console.log(`       - ${key}: ${displayValue}`);
      });
    }

    const startTime = Date.now();

    try {
      console.log(`    ⏳ [${new Date().toISOString()}] Awaiting fetch response...`);
      const response = await baseFetch(input, init);
      const elapsed = Date.now() - startTime;

      console.log(`    🟢 [${new Date().toISOString()}] Response received in ${elapsed}ms`);
      console.log(`       - Status: ${response.status} ${response.statusText}`);
      console.log(`       - Content-Type: ${response.headers.get("content-type")}`);

      // If we get a 402, log the payment required header
      if (response.status === 402) {
        const paymentRequired = response.headers.get("PAYMENT-REQUIRED");
        console.log(`    💰 402 Payment Required!`);
        if (paymentRequired) {
          console.log(
            `       - PAYMENT-REQUIRED header present (length: ${paymentRequired.length})`,
          );
        }
      }

      return response;
    } catch (error) {
      const elapsed = Date.now() - startTime;
      console.log(`    🔴 [${new Date().toISOString()}] Request failed after ${elapsed}ms`);
      console.log(`       - Error: ${error}`);
      throw error;
    }
  };
}

/**
 * Creates a debug-wrapped signer to track payment signing operations
 */
function wrapSignerWithDebug(signer: SvmClientSigner): SvmClientSigner {
  const originalCreatePaymentPayload = signer.createPaymentPayload.bind(signer);
  const originalSignPayload = signer.signPayload.bind(signer);

  // Override createPaymentPayload
  signer.createPaymentPayload = async (...args) => {
    console.log(`    💳 [${new Date().toISOString()}] Creating payment payload...`);
    const startTime = Date.now();
    try {
      const result = await originalCreatePaymentPayload(...args);
      console.log(
        `    ✅ [${new Date().toISOString()}] Payment payload created in ${Date.now() - startTime}ms`,
      );
      return result;
    } catch (error) {
      console.log(
        `    ❌ [${new Date().toISOString()}] Payment payload creation failed after ${Date.now() - startTime}ms`,
      );
      console.log(`       - Error: ${error}`);
      throw error;
    }
  };

  // Override signPayload
  signer.signPayload = async (...args) => {
    console.log(`    🔐 [${new Date().toISOString()}] Signing SIWx payload...`);
    const startTime = Date.now();
    try {
      const result = await originalSignPayload(...args);
      console.log(
        `    ✅ [${new Date().toISOString()}] SIWx payload signed in ${Date.now() - startTime}ms`,
      );
      return result;
    } catch (error) {
      console.log(
        `    ❌ [${new Date().toISOString()}] SIWx signing failed after ${Date.now() - startTime}ms`,
      );
      console.log(`       - Error: ${error}`);
      throw error;
    }
  };

  return signer;
}

describe("Stream Responses", function () {
  // Increase timeout for streaming API calls (server can be slow)
  this.timeout(300000);

  let client: AimoClient;
  let clientSigner: SvmClientSigner;

  before(async function () {
    if (!testConfig.solanaPrivateKey) {
      console.log("    ⚠️  Skipping stream tests - SOLANA_PRIVATE_KEY not set");
      this.skip();
      return;
    }

    console.log(`    🔧 Setting up test environment...`);

    // Create SVM signer from private key (base58 encoded)
    console.log(`    📝 Creating SVM signer...`);
    const privateKeyBytes = bs58.decode(testConfig.solanaPrivateKey);
    const svmSigner = await createKeyPairSignerFromBytes(privateKeyBytes);
    console.log(`    ✅ Using Solana wallet: ${svmSigner.address}`);

    // Create client signer for SIWx authentication and x402 payments
    console.log(`    📝 Creating client signer...`);
    clientSigner = new SvmClientSigner({
      signer: svmSigner,
      chainId: SOLANA_MAINNET_CHAIN_ID,
    });

    // Wrap signer with debugging
    clientSigner = wrapSignerWithDebug(clientSigner);
    console.log(`    ✅ Client signer created (with debug wrapper)`);

    // Create AimoClient with debug fetch wrapper
    console.log(`    📝 Creating AimoClient with debug fetch...`);
    client = new AimoClient({
      signer: clientSigner,
      baseUrl: testConfig.apiBase,
      siwxDomain: testConfig.apiDomain,
      fetchOverride: createDebugFetch(globalThis.fetch),
    });
    console.log(`    ✅ AimoClient created`);
    console.log(`    🔧 Setup complete\n`);
  });

  it("should handle streaming chat completion response", async function () {
    console.log(`\n    🚀 Starting streaming chat completion test`);
    console.log(
      `    📤 Request body: ${JSON.stringify({ model: "openai/gpt-4o-mini", stream: true, max_tokens: 100 })}`,
    );

    // Make a streaming chat completion request
    console.log(`    ⏳ Calling client.chatCompletions()...`);
    const requestStartTime = Date.now();

    const response = await client.chatCompletions({
      model: "deepseek/deepseek-v3.1",
      stream: true,
      max_tokens: 100,
      messages: chatCompletionsMessages,
    });

    console.log(`    ✅ chatCompletions() returned in ${Date.now() - requestStartTime}ms`);

    // Handle server errors gracefully (504, 500, etc.)
    if (response.status >= 500) {
      console.log(
        `    ⚠️  Server error ${response.status} - skipping test (server may be overloaded)`,
      );
      this.skip();
      return;
    }

    // Check response status
    if (!response.ok && response.status !== 402) {
      const errorBody = await response.text();
      console.log(`    ❌ Request failed with status ${response.status}`);
      console.log(`    Error body: ${errorBody}`);
    }

    assert.oneOf(response.status, [200, 402], "Expected 200 OK or 402 Payment Required");

    if (response.status !== 200) {
      console.log("    ⏭️  Skipping stream parsing - payment required");
      return;
    }

    // Verify the response has a body for streaming
    assert.isNotNull(response.body, "Expected response body for streaming");

    // Parse the SSE stream
    console.log(`    📡 Starting to read stream...`);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";
    let chunkCount = 0;
    let buffer = "";

    console.log("\n    📡 Receiving stream chunks:");

    while (true) {
      const readStartTime = Date.now();
      const { done, value } = await reader.read();
      const readTime = Date.now() - readStartTime;

      if (readTime > 1000) {
        console.log(`    ⚠️  Slow read: ${readTime}ms`);
      }

      if (done) {
        console.log("\n    ✅ Stream completed");
        break;
      }

      // Decode the chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE messages from buffer
      const lines = buffer.split("\n");
      // Keep the last potentially incomplete line in buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        // Skip empty lines and comments
        if (!line || line.startsWith(":")) continue;

        // Parse SSE data lines
        if (line.startsWith("data: ")) {
          const data = line.slice(6); // Remove "data: " prefix

          // Check for stream end signal
          if (data === "[DONE]") {
            console.log("    Received [DONE] signal");
            continue;
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;

            if (delta?.content) {
              fullContent += delta.content;
              chunkCount++;
              // Print each chunk inline (without newline for continuous output)
              process.stdout.write(delta.content);
            }
          } catch (e) {
            // Skip non-JSON lines
            console.log(`    ⚠️ Could not parse: ${data}`);
          }
        }
      }
    }

    console.log(`\n\n    📊 Stream statistics:`);
    console.log(`       - Total chunks received: ${chunkCount}`);
    console.log(`       - Full content length: ${fullContent.length} chars`);
    console.log(`       - Content preview: "${fullContent.slice(0, 100)}..."`);

    // Assertions
    assert.isAbove(chunkCount, 0, "Expected at least one content chunk");
    assert.isNotEmpty(fullContent, "Expected non-empty streamed content");
  });
});
