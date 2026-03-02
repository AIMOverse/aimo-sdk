// Re-export all SIWx types and functions
export * from "./siwx";
export type { SIWxPayload, SIWxSigner } from "./siwx";

// Re-export ClientSigner type and utilities
export type { ClientSigner } from "./signer";
export { toX402Client, toSchemeRegistrations } from "./signer";

// Re-export fetch wrapper
export { wrapFetchWithSigner } from "./fetch";

// Re-export API client
export { AimoClient, AimoEndpoints, ApiBase } from "./api";
export type { SessionBalanceResponse, AimoClientOptions } from "./api";
