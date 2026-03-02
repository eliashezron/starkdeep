import { NextResponse } from "next/server";
import {
  extractUserId,
  privyAppSecret,
  privyClient,
  privyDevSignerContext,
  privySignerContextUrl,
  verifyAccessTokenJwt,
  verifyClaims,
  walletCache,
} from "./shared";

// Verify the Privy access token server-side and return { walletId, publicKey, serverUrl }.
export async function POST(request: Request) {
  // Dev-only stub to unblock local work without a real signer-context relay.
  if (privyDevSignerContext) {
    console.log("[signer-context] DEV stub active");
    const origin = new URL(request.url).origin;
    return NextResponse.json({
      walletId: "dev-wallet-id",
      publicKey: "0x0123456789abcdef",
      serverUrl: `${origin}/api/privy/sign`,
    });
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
    console.error("Privy token verification failed", err);
    return NextResponse.json({ error: "Invalid access token" }, { status: 401 });
  }

  // If a direct signer context URL is provided, forward there.
  if (privySignerContextUrl && privyAppSecret) {
    try {
      const res = await fetch(privySignerContextUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${privyAppSecret}`,
        },
        body: JSON.stringify({ accessToken }),
        cache: "no-store",
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Privy signer-context fetch failed", res.status, text);
        return NextResponse.json({ error: "Failed to fetch signer context" }, { status: 502 });
      }

      const data = await res.json();
      const { walletId, publicKey, serverUrl } = data || {};
      if (!walletId || !publicKey || !serverUrl) {
        return NextResponse.json(
          { error: "Signer context response missing walletId/publicKey/serverUrl" },
          { status: 502 }
        );
      }

      return NextResponse.json({ walletId, publicKey, serverUrl });
    } catch (err) {
      console.error("Privy signer-context relay error", err);
      return NextResponse.json({ error: "Signer context relay failed" }, { status: 502 });
    }
  }

  // Fallback: build signer context using Privy server SDK, one wallet per user (cached in-memory).
  if (!privyClient) {
    return NextResponse.json({ error: "Privy client not configured" }, { status: 500 });
  }

  let claims: any = null;
  try {
    claims = await verifyClaims(accessToken);
  } catch (err) {
    console.error("Privy client token verify failed", err);
    return NextResponse.json({ error: "Invalid access token" }, { status: 401 });
  }

  const userId = extractUserId(claims);
  if (!userId) {
    console.error("Privy token missing user id", claims);
    return NextResponse.json({ error: "Missing user id in token" }, { status: 400 });
  }

  if (walletCache.has(userId)) {
    return NextResponse.json(walletCache.get(userId)!);
  }

  try {
    const wallet = await privyClient.wallets().create({ chain_type: "starknet" });
    const walletId = (wallet as any)?.id || (wallet as any)?.wallet_id;
    const publicKey = (wallet as any)?.public_key || (wallet as any)?.publicKey;
    const origin = new URL(request.url).origin;
    const serverUrl = `${origin}/api/privy/sign`;

    if (!walletId || !publicKey) {
      return NextResponse.json({ error: "Privy wallet create missing id/publicKey" }, { status: 502 });
    }
    const payload = { walletId, publicKey, serverUrl };
    walletCache.set(userId, payload);
    return NextResponse.json(payload);
  } catch (err) {
    console.error("Privy wallet create failed", err);
    return NextResponse.json({ error: "Failed to create signer wallet" }, { status: 502 });
  }
}
