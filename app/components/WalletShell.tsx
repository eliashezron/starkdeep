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
  activity: string[];
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
  activity,
  statusMessage,
  error,
  children,
}: WalletShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="pointer-events-none absolute inset-0 opacity-50 mix-blend-screen">
        <div className="absolute -left-10 top-10 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute bottom-20 right-0 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
      </div>
      <main className="relative mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-indigo-500/10">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">StarkDeep Wallet</p>
            <h1 className="text-2xl font-semibold text-white">Built on StarkZap</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-slate-900/80 px-3 py-1 text-xs text-slate-200">Network · {network}</span>
            <span className="rounded-full bg-slate-900/80 px-3 py-1 text-xs text-emerald-200">Fee mode · {feeMode}</span>
            <span className="rounded-full bg-slate-900/80 px-3 py-1 text-xs text-slate-200">{shortAddress}</span>
            <button
              className="rounded-full bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:brightness-110"
              type="button"
              onClick={authenticated ? logout : login}
            >
              {authenticated ? "Sign out of Privy" : "Login with Privy"}
            </button>
            <span className="rounded-full bg-slate-900/80 px-3 py-1 text-xs text-slate-200">
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

        <section className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-emerald-500/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-300">Total portfolio value</p>
                <p className="text-3xl font-semibold text-white">{totalFiat}</p>
              </div>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {tokenDisplay.map((token) => (
                <div key={token.symbol} className="rounded-xl bg-slate-900/70 p-4">
                  <div className="flex items-center justify-between text-sm text-slate-300">
                    <p>{token.symbol}</p>
                    <span className={token.change.startsWith("-") ? "text-red-300" : "text-emerald-200"}>{token.change}</span>
                  </div>
                  <p className="mt-2 text-lg font-semibold text-white">{token.balance}</p>
                  <p className="text-xs text-slate-400">{token.fiat}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/70 via-slate-900/80 to-slate-900/60 p-6 shadow-lg shadow-cyan-500/10">
            <p className="text-sm text-slate-300">Recent activity</p>
            <div className="mt-4 space-y-3 text-sm">
              {activity.map((item, idx) => (
                <div key={item + idx} className="flex items-center justify-between rounded-xl bg-slate-800/70 px-3 py-2">
                  <span className="text-slate-200">{item}</span>
                  <span className="text-xs text-slate-400">live soon</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-indigo-500/10">
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
                      ? "bg-white text-slate-900 shadow-md shadow-white/30"
                      : "bg-slate-900/70 text-slate-200 hover:bg-slate-900"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="mt-6">{children}</div>
          {(statusMessage || error) && (
            <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-200">
              {statusMessage && <p>{statusMessage}</p>}
              {error && <p className="text-red-300">{error}</p>}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
