"use client";

import { useEffect, useMemo, useState } from "react";
import { WalletShell } from "./components/WalletShell";
import { useZapWallet } from "./hooks/useZapWallet";

type Action = "send" | "receive";

export default function HomePage() {
  const [action, setAction] = useState<Action>("send");
  const [sendToken, setSendToken] = useState("STRK");
  const [sendAmount, setSendAmount] = useState("100");
  const [recipient, setRecipient] = useState("0x2f1...c2b");

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [activity, setActivity] = useState<string[]>(["Received 120 STRK", "Sent 45 USDC"]);

  const {
    tokens,
    refreshBalances,
    isFetchingBalances,
    send,
    network,
    feeMode,
    status: walletStatus,
    address,
    error,
    tokenDisplay,
    totalFiat,
    shortAddress,
    login,
    logout,
    authenticated,
    autoConnectRequested,
  } = useZapWallet();

  const feeModeDisplay = feeMode ?? "user";

  useEffect(() => {
    if (tokenDisplay.length && !tokenDisplay.find((t) => t.symbol === sendToken)) {
      setSendToken(tokenDisplay[0].symbol);
    }
  }, [tokenDisplay, sendToken]);

  useEffect(() => {
    if (address) {
      const base: string[] = [`Connected wallet ${address.slice(0, 6)}...${address.slice(-4)}`];
      base.push(action === "send" ? "Ready to send" : "Ready to receive");
      setActivity(base);
    } else {
      setActivity(["Connect your wallet to load activity"]);
    }
  }, [address, action]);

  const activeToken = useMemo(() => tokenDisplay.find((t) => t.symbol === sendToken), [tokenDisplay, sendToken]);

  const handleCopyAddress = async () => {
    if (!address) {
      setStatusMessage("Connect wallet to copy your address");
      return;
    }
    try {
      await navigator.clipboard.writeText(address);
      setStatusMessage("Address copied to clipboard");
    } catch (err) {
      setStatusMessage("Unable to copy address");
      console.error("Clipboard copy failed", err);
    }
  };

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

  const renderAction = () => {
    if (action === "send") {
      return (
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
              className="flex-1 rounded-xl bg-blue-500 px-4 py-3 text-base font-semibold text-slate-900 shadow-lg shadow-blue-500/25 transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {walletStatus === "ready" ? (isSending ? "Sending..." : "Send with StarkZap") : "Connect wallet first"}
            </button>
          </div>
        </div>
      );
    }

    if (action === "receive") {
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-300">Deposit address</p>
              <span className="rounded-full bg-slate-900/70 px-3 py-1 text-xs text-slate-200">{network}</span>
            </div>
            <p className="mt-3 text-lg font-semibold">{shortAddress}</p>
            <p className="mt-1 text-xs text-slate-400">Share this address to receive tokens.</p>
            <div className="mt-4 flex gap-2">
              <button
                className="flex-1 rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-50 transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                onClick={handleCopyAddress}
                disabled={!address}
              >
                Copy
              </button>
              <button className="flex-1 rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-50 transition hover:border-white/40" type="button">
                Share
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-slate-300">Quick deposit tokens</p>
              <button
                type="button"
                onClick={refreshBalances}
                disabled={!address || isFetchingBalances || walletStatus !== "ready"}
                className="rounded-full border border-white/15 px-3 py-1 text-xs text-slate-100 transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isFetchingBalances ? "Syncing..." : "Refresh"}
              </button>
            </div>
            <div className="mt-3 grid gap-2">
              {tokenDisplay.map((token) => (
                <div
                  key={token.symbol}
                  className="flex items-center justify-between rounded-lg bg-slate-900/70 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="text-xs text-slate-400">{token.name}</p>
                    <p className="text-sm text-slate-200">{token.symbol}</p>
                  </div>
                  <p className="text-xs text-slate-300">Balance {token.balance}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-slate-400">
              Balances are fetched live from StarkZap wallet.balanceOf(); connect your wallet then refresh if stale.
            </p>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <WalletShell
      current={action}
      onTabChange={setAction}
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
      {renderAction()}
    </WalletShell>
  );
}