import { createRemoteJWKSet, jwtVerify } from "jose";
import { PrivyClient } from "@privy-io/node";

export const jwksEndpoint = process.env.JWKS_ENDPOINT;
export const privyAppId = process.env.PRIVY_APP_ID;
export const privyAppSecret = process.env.PRIVY_APP_SECRET;
export const privySignerContextUrl = process.env.PRIVY_SIGNER_CONTEXT_URL;
export const privyDevSignerContext = process.env.PRIVY_DEV_SIGNER_CONTEXT === "1";

export const jwks = jwksEndpoint ? createRemoteJWKSet(new URL(jwksEndpoint)) : null;
export const privyClient = privyAppId && privyAppSecret ? new PrivyClient({ appId: privyAppId, appSecret: privyAppSecret }) : null;

export type SignerContext = {
  walletId: string;
  publicKey: string;
  serverUrl: string;
};

export const walletCache = new Map<string, SignerContext>();

export async function verifyAccessTokenJwt(accessToken: string) {
  if (!jwks || !privyAppId) {
    throw new Error("JWKS endpoint or PRIVY_APP_ID not configured");
  }
  await jwtVerify(accessToken, jwks, { audience: privyAppId, issuer: "privy.io" });
}

export async function verifyClaims(accessToken: string) {
  if (!privyClient) {
    throw new Error("Privy client not configured");
  }
  return privyClient.utils().auth().verifyAccessToken(accessToken);
}

export function extractUserId(claims: any) {
  return claims?.sub || claims?.userId || claims?.user_id;
}