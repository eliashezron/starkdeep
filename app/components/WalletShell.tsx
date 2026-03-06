"use client";

import type { ReactNode } from "react";
import type { TokenView } from "../hooks/useZapWallet";

export type WalletShellProps = {
  current: "send" | "receive" | "stake";
  onTabChange?: (key: "send" | "receive" | "stake") => void;
  network: string;
  feeMode: string;
  shortAddress: string;
  walletStatus: "idle" | "connecting" | "ready" | "error";
  autoConnectRequested: boolean;
  authenticated: boolean;
  login: () => void;
  logout: () => void;
  tokenDisplay: TokenView[];
  totalFiat: string;
  statusMessage?: string | null;
  error?: string | null;
  children: ReactNode;
};

const tabs: { key: WalletShellProps["current"]; label: string }[] = [
  { key: "send", label: "Send" },
  { key: "receive", label: "Receive" },
  { key: "stake", label: "Stake" },
];

export function WalletShell({
  current,
  onTabChange,
  network,
  feeMode,
  shortAddress,
  walletStatus,
  autoConnectRequested,
  authenticated,
  login,
  logout,
  tokenDisplay,
  totalFiat,
  statusMessage,
  error,
  children,
}: WalletShellProps) {
  const renderStatusText = (text: string) => {
    const match = text.match(/https?:\/\/\S+/);
    if (!match) return text;

    const url = match[0];
    const [before, after = ""] = text.split(url);

    return (
      <span>
        {before}
        <a className="underline underline-offset-2" href={url} target="_blank" rel="noreferrer">
          View on explorer
        </a>
        {after}
      </span>
    );
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-black">
      <main className="relative mx-auto flex max-w-2xl flex-col gap-8 px-3 py-10">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-neutral-500/10">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gray-400">StarkDeep Wallet</p>
            <h1 className="text-2xl font-semibold text-gray-100">Built on StarkZap</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-gray-900/80 px-3 py-1 text-xs text-gray-200">Network · {network}</span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                feeMode === "sponsored" ? "bg-green-200 text-green-900" : "bg-gray-900/80 text-gray-200"
              }`}
            >
              Fee mode · {feeMode}
            </span>
            <span className="rounded-full bg-gray-900/80 px-3 py-1 text-xs text-gray-200">{shortAddress}</span>
            <button
              className="rounded-full bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-100 transition hover:brightness-110"
              type="button"
              onClick={authenticated ? logout : login}
            >
              {authenticated ? "Sign out of Privy" : "Login with Privy"}
            </button>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                walletStatus === "ready" ? "bg-green-200 text-green-900" : "bg-gray-900/80 text-gray-200"
              }`}
            >
              {walletStatus === "ready"
                ? "Wallet ready"
                : walletStatus === "connecting" || autoConnectRequested
                  ? "Preparing wallet..."
                  : authenticated
                    ? "Awaiting wallet"
                    : "Sign in first"}
            </span>
          </div>
        </header>

        <section className="grid gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-neutral-500/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-300">Total portfolio value</p>
                <p className="text-3xl font-semibold text-gray-100">{totalFiat}</p>
              </div>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {tokenDisplay.map((token) => (
                <div key={token.symbol} className="rounded-xl bg-gray-800/80 p-4">
                  <div className="flex items-center justify-between text-sm text-gray-300">
                    <p>{token.symbol}</p>
                    <span className={token.change.startsWith("-") ? "text-red-300" : "text-gray-200"}>{token.change}</span>
                  </div>
                  <p className="mt-2 text-lg font-semibold text-gray-100">{token.balance}</p>
                  <p className="text-xs text-gray-400">{token.fiat}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-neutral-500/10">
          <div className="flex flex-wrap items-center gap-3">
            {tabs.map(({ key, label, href }) => {
              const isActive = current === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onTabChange?.(key)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "bg-white text-gray-900 shadow-md shadow-white/30"
                      : "bg-gray-900/70 text-gray-200 hover:bg-gray-900"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="mt-6">{children}</div>
          {(statusMessage || error) && (
            <div className="mt-4 rounded-xl border border-white/10 bg-gray-900/60 p-4 text-sm text-gray-200">
              {statusMessage && <p>{renderStatusText(statusMessage)}</p>}
              {error && <p className="text-red-300">{renderStatusText(error)}</p>}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
