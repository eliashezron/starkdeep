import { NextResponse } from "next/server";
import { getFeeMode, getNetwork, getSignerWallet, listTokens } from "../_shared";

export async function POST() {
  try {
    const wallet = await getSignerWallet();
    const chainId = wallet.getChainId?.();
    const address = wallet.address?.toString?.();
    const tokens = listTokens(chainId);

    return NextResponse.json({ address, tokens, network: getNetwork(), feeMode: getFeeMode() });
  } catch (err) {
    console.error("Signer connect failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Connect failed" },
      { status: 500 }
    );
  }
}
