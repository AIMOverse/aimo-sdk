import { SchemeNetworkClient } from "@x402/core/types";

// Re-export all SIWx types and functions
export * from "./siwx";
export type { SIWxPayload, SIWxSigner } from "./siwx";

export type ClientSigner = SchemeNetworkClient & {
  signPayload(payload: import("./siwx").SIWxPayload): Promise<string>;
};
