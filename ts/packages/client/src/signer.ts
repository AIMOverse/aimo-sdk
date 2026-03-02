import { SchemeRegistration, x402Client } from "@x402/core/client";
import { SchemeNetworkClient } from "@x402/core/types";
import { SIWxPayload } from "./siwx";

export type ClientSigner = SchemeNetworkClient & {
  /** The signer's address */
  address: string;
  /** Network identifier in CAIP-2 format */
  network: `${string}:${string}`;
  /** Sign a SIWx payload and return the signature */
  signPayload(payload: Omit<SIWxPayload, "signature">): Promise<string>;
};

export function toSchemeRegistrations(signer: ClientSigner): SchemeRegistration {
  return {
    network: signer.network,
    client: signer,
    x402Version: 2,
  };
}

export function toX402Client(signer: ClientSigner | ClientSigner[]): x402Client {
  if (Array.isArray(signer)) {
    const registrations = signer.map(toSchemeRegistrations);
    const client = x402Client.fromConfig({ schemes: registrations });
    return client;
  }

  const client = x402Client.fromConfig({
    schemes: [toSchemeRegistrations(signer)],
  });
  return client;
}
