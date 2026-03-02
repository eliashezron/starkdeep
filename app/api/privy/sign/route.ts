import { NextResponse } from "next/server";
import {
  extractUserId,
  privyClient,
  privyDevSignerContext,
  verifyAccessTokenJwt,
  verifyClaims,
  walletCache,
} from "../signer-context/shared";

export async function POST(request: Request) {
  if (privyDevSignerContext) {
    return NextResponse.json({ signature: `0x${"0".repeat(128)}` });
  }

  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing Bearer authorization" }, { status: 401 });
  }

  const accessToken = auth.replace(/^Bearer\s+/i, "").trim();
  if (!accessToken) {
    return NextResponse.json({ error: "Empty access token" }, { status: 401 });
  }

  try {
    await verifyAccessTokenJwt(accessToken);
  } catch (err) {
    console.error("Privy token verification failed (sign)", err);
    return NextResponse.json({ error: "Invalid access token" }, { status: 401 });
  }

  if (!privyClient) {
    return NextResponse.json({ error: "Privy client not configured" }, { status: 500 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const walletId = body?.walletId || body?.wallet_id;
  const hash = body?.hash;
  if (!walletId || !hash) {
    return NextResponse.json({ error: "walletId and hash are required" }, { status: 400 });
  }

  let claims: any = null;
  try {
    claims = await verifyClaims(accessToken);
  } catch (err) {
    console.error("Privy client token verify failed (sign)", err);
    return NextResponse.json({ error: "Invalid access token" }, { status: 401 });
  }

  const userId = extractUserId(claims);
  if (!userId) {
    return NextResponse.json({ error: "Missing user id in token" }, { status: 400 });
  }

  const cached = walletCache.get(userId);
  if (!cached || cached.walletId !== walletId) {
    return NextResponse.json({ error: "Wallet not authorized for this user" }, { status: 403 });
  }

  try {
    const response = await privyClient.wallets().rawSign(walletId, { params: { hash } });
    const signature = (response as any)?.signature || (response as any)?.data?.signature;
    if (typeof signature !== "string") {
      return NextResponse.json({ error: "Privy signing failed" }, { status: 502 });
    }
    return NextResponse.json({ signature });
  } catch (err) {
    console.error("Privy rawSign failed", err);
    return NextResponse.json({ error: "Signing failed" }, { status: 502 });
  }
}