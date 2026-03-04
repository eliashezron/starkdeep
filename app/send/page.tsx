"use client";

import { useEffect, useMemo, useState } from "react";
import { WalletShell } from "../components/WalletShell";
import { useZapWallet } from "../hooks/useZapWallet";

export default function SendPage() {
  const {
    tokens,
    balances,
    refreshBalances,
    send,
    status: walletStatus,
    address,
    network,
    feeMode,
    error,
    tokenDisplay,
    totalFiat,
    shortAddress,
    login,
    logout,
    authenticated,
    autoConnectRequested,
  } = useZapWallet();

  const [sendToken, setSendToken] = useState<string>(tokenDisplay[0]?.symbol ?? "STRK");
  const [sendAmount, setSendAmount] = useState("100");
  const [recipient, setRecipient] = useState("0x2f1...c2b");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [activity, setActivity] = useState<string[]>(["Received 120 STRK", "Sent 45 USDC", "Staked 50 STRK"]);

  const feeModeDisplay = feeMode ?? "user";

  useEffect(() => {
    if (tokenDisplay.length && !tokenDisplay.find((t) => t.symbol === sendToken)) {
      setSendToken(tokenDisplay[0].symbol);
    }
  }, [tokenDisplay, sendToken]);

  useEffect(() => {
    if (address) {
      setActivity([
        `Connected wallet ${address.slice(0, 6)}...${address.slice(-4)}`,
        "Ready to send",
      ]);
    } else {
      setActivity(["Connect your wallet to load activity"]);
    }
  }, [address]);

  const activeToken = useMemo(() => tokenDisplay.find((t) => t.symbol === sendToken), [tokenDisplay, sendToken]);

  const handleSend = async () => {
    const token = tokens?.find((t) => t.symbol === sendToken);
    if (!token) {
      setStatusMessage("Connect wallet to load tokens for sending");
      return;
    }

    if (recipient.length < 6) {
      setStatusMessage("Recipient address looks too short");
      return;
    }

    try {
      setIsSending(true);
      setStatusMessage("Submitting transfer via StarkZap...");
      const tx = await send(token, sendAmount, recipient);
      setStatusMessage(`Submitted. Track: ${tx.explorerUrl ?? "pending"}`);
    } catch (err) {
      setStatusMessage(err instanceof Error ? `Send failed: ${err.message}` : "Send failed");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <WalletShell
      current="send"
      network={network}
      feeMode={feeModeDisplay}
      shortAddress={shortAddress}
      walletStatus={walletStatus}
      autoConnectRequested={autoConnectRequested}
      authenticated={authenticated}
      login={login}
      logout={logout}
      tokenDisplay={tokenDisplay}
      totalFiat={totalFiat}
      activity={activity}
      statusMessage={statusMessage}
      error={error}
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-4">
            <span className="text-sm text-slate-300">From</span>
            <select
              className="rounded-lg bg-slate-900/70 p-3 text-sm text-slate-50 outline-none"
              value={sendToken}
              onChange={(e) => setSendToken(e.target.value)}
            >
              {tokenDisplay.map((token) => (
                <option key={token.symbol} value={token.symbol}>
                  {token.symbol} · {token.name}
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-400">Balance {activeToken?.balance ?? "0"}</span>
          </label>
          <label className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-4">
            <span className="text-sm text-slate-300">Amount</span>
            <input
              className="rounded-lg bg-slate-900/70 p-3 text-lg font-semibold text-slate-50 outline-none"
              value={sendAmount}
              onChange={(e) => setSendAmount(e.target.value)}
              placeholder="0.00"
            />
            <div className="flex gap-2 text-xs text-slate-400">
              {[
                { label: "25%", value: "0.25" },
                { label: "50%", value: "0.5" },
                { label: "Max", value: activeToken?.balance ?? "0" },
              ].map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  className="rounded-full border border-white/10 px-3 py-1 text-slate-200 transition hover:border-white/40 hover:text-white"
                  onClick={() => setSendAmount(chip.value)}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </label>
        </div>
        <label className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-4">
          <span className="text-sm text-slate-300">Recipient</span>
          <input
            className="rounded-lg bg-slate-900/70 p-3 text-base text-slate-50 outline-none"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x..."
          />
          <span className="text-xs text-slate-400">Paste a Starknet address or QR scan</span>
        </label>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={refreshBalances}
            disabled={!address || walletStatus !== "ready"}
            className="rounded-full border border-white/15 px-3 py-2 text-xs text-slate-100 transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Refresh balances
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={walletStatus !== "ready" || isSending}
            className="flex-1 rounded-xl bg-gradient-to-r from-indigo-400 via-cyan-400 to-emerald-400 px-4 py-3 text-base font-semibold text-slate-900 shadow-lg shadow-emerald-500/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {walletStatus === "ready" ? (isSending ? "Sending..." : "Send with StarkZap") : "Connect wallet first"}
          </button>
        </div>
      </div>
    </WalletShell>
  );
}
