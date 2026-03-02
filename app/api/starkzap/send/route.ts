import { NextResponse } from "next/server";
import { transferWithSigner } from "../_shared";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { symbol, amount, to } = (body as any) || {};

  if (!symbol || !amount || !to) {
    return NextResponse.json({ error: "symbol, amount, and to are required" }, { status: 400 });
  }

  try {
    const tx = await transferWithSigner(symbol, amount, to);
    return NextResponse.json({ hash: tx.transactionHash ?? null, explorerUrl: tx.explorerUrl ?? null });
  } catch (err) {
    console.error("Signer send failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Send failed" }, { status: 500 });
  }
}
