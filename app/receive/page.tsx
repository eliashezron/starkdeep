"use client";

import { useEffect, useState } from "react";
import { WalletShell } from "../components/WalletShell";
import { useZapWallet } from "../hooks/useZapWallet";

export default function ReceivePage() {
  const {
    address,
    network,
    feeMode,
    refreshBalances,
    isFetchingBalances,
    status: walletStatus,
    tokenDisplay,
    totalFiat,
    shortAddress,
    login,
    logout,
    authenticated,
    autoConnectRequested,
    error,
  } = useZapWallet();

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activity, setActivity] = useState<string[]>(["Received 120 STRK", "Sent 45 USDC", "Staked 50 STRK"]);

  useEffect(() => {
    if (address) {
      setActivity([`Connected wallet ${address.slice(0, 6)}...${address.slice(-4)}`, "Ready to receive"]);
    } else {
      setActivity(["Connect your wallet to load activity"]);
    }
  }, [address]);

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

  return (
    <WalletShell
      current="receive"
      network={network}
      feeMode={feeMode}
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
    </WalletShell>
  );
}
