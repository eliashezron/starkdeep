"use client";

import { useEffect, useMemo, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useStarkZap } from "./hooks/useStarkZap";

type Action = "send" | "receive" | "swap" | "portfolio";

type TokenView = {
  symbol: string;
  name: string;
  balance: string;
  fiat: string;
  change: string;
};

const fallbackTokens: TokenView[] = [
  { symbol: "STRK", name: "Starknet", balance: "1,240", fiat: "$2,480", change: "+3.2%" },
  { symbol: "USDC", name: "USD Coin", balance: "4,200", fiat: "$4,200", change: "+0.2%" },
  { symbol: "strkBTC", name: "Stark Bitcoin", balance: "0.10", fiat: "$6,500", change: "+1.4%" },
  { symbol: "wBTC", name: "Wrapped Bitcoin", balance: "0.05", fiat: "$3,250", change: "+0.8%" },
];

const stakingPositions = [
  {
    validator: "Equinox",
    staked: "350 STRK",
    rewards: "12.4 STRK",
    apr: "8.2% APY",
    cooldown: "3d left",
  },
  {
    validator: "Nebula",
    staked: "210 STRK",
    rewards: "4.8 STRK",
    apr: "7.4% APY",
    cooldown: "Unlocked",
  },
];

export default function Home() {
  const [action, setAction] = useState<Action>("send");
  const [sendToken, setSendToken] = useState(fallbackTokens[0].symbol);
  const [sendAmount, setSendAmount] = useState("100");
  const [recipient, setRecipient] = useState("0x2f1...c2b");
  const [swapFrom, setSwapFrom] = useState(fallbackTokens[0].symbol);
  const [swapTo, setSwapTo] = useState(fallbackTokens[1].symbol);
  const [swapAmount, setSwapAmount] = useState("50");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const { login, logout, authenticated, getAccessToken } = usePrivy();
  const [accessToken, setAccessToken] = useState("");
  const [autoConnectRequested, setAutoConnectRequested] = useState(false);

  const {
    connect,
    status: walletStatus,
    address,
    tokens: zapTokens,
    error,
    send,
    network,
    feeMode,
  } = useStarkZap(accessToken);

  useEffect(() => {
    const fetchToken = async () => {
      if (!authenticated) {
        setAccessToken("");
        return;
      }
      try {
        const token = await getAccessToken();
        setAccessToken(token ?? "");
      } catch (err) {
        console.error("Failed to get Privy access token", err);
        setAccessToken("");
      }
    };
    fetchToken();
  }, [authenticated, getAccessToken]);

  useEffect(() => {
    const maybeConnect = async () => {
      if (
        !authenticated ||
        !accessToken ||
        accessToken.length < 10 ||
        walletStatus === "ready" ||
        walletStatus === "connecting" ||
        walletStatus === "error"
      ) {
        return;
      }
      setAutoConnectRequested(true);
      try {
        await connect();
      } catch (err) {
        console.error("Auto-connect failed", err);
      } finally {
        setAutoConnectRequested(false);
      }
    };
    maybeConnect();
  }, [authenticated, accessToken, walletStatus, connect]);

  const shortAddress = useMemo(() => {
    if (!address) return "Not connected";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }, [address]);

  const tokenDisplay = useMemo<TokenView[]>(() => {
    const allowList = new Set(["strk", "usdc", "strkbtc", "wbtc"]);

    const source = zapTokens && Array.isArray(zapTokens)
      ? zapTokens.map((t) => ({
          symbol: t.symbol,
          name: t.name,
          balance: "—",
          fiat: "—",
          change: "",
        }))
      : fallbackTokens;

    const filtered = source.filter((t) => allowList.has(t.symbol.toLowerCase()));
    return filtered.length ? filtered : fallbackTokens;
  }, [zapTokens]);

  useEffect(() => {
    if (tokenDisplay.length && !tokenDisplay.find((t) => t.symbol === sendToken)) {
      setSendToken(tokenDisplay[0].symbol);
    }
    if (tokenDisplay.length && !tokenDisplay.find((t) => t.symbol === swapFrom)) {
      setSwapFrom(tokenDisplay[0].symbol);
    }
    if (tokenDisplay.length > 1 && !tokenDisplay.find((t) => t.symbol === swapTo)) {
      setSwapTo(tokenDisplay[1].symbol);
    }
  }, [tokenDisplay, sendToken, swapFrom, swapTo]);

  const totalFiat = useMemo(() => "$9,800.00", []);
  const activeToken = useMemo(
    () => tokenDisplay.find((t) => t.symbol === sendToken),
    [tokenDisplay, sendToken]
  );

  const handleSend = async () => {
    const token = zapTokens?.find((t) => t.symbol === sendToken);
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
      setStatusMessage(
        err instanceof Error ? `Send failed: ${err.message}` : "Send failed"
      );
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
            <button
              type="button"
              onClick={handleSend}
              disabled={walletStatus !== "ready" || isSending}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-400 via-cyan-400 to-emerald-400 px-4 py-3 text-base font-semibold text-slate-900 shadow-lg shadow-emerald-500/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {walletStatus === "ready" ? (isSending ? "Sending..." : "Send with StarkZap") : "Connect wallet first"}
            </button>
        </div>
      );
    }

    if (action === "receive") {
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-300">Deposit address</p>
              <span className="rounded-full bg-slate-900/70 px-3 py-1 text-xs text-slate-200">Sepolia</span>
            </div>
            <p className="mt-3 text-lg font-semibold">0x9a1c...93e2</p>
            <p className="mt-1 text-xs text-slate-400">Share this address to receive tokens.</p>
            <div className="mt-4 flex gap-2">
              <button className="flex-1 rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-50 transition hover:border-white/40" type="button">
                Copy
              </button>
              <button className="flex-1 rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-50 transition hover:border-white/40" type="button">
                Share
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-slate-300">Quick deposit tokens</p>
            <div className="mt-3 grid gap-2">
              {tokenDisplay.map((token) => (
                <div
                  key={token.symbol}
                  className="flex items-center justify-between rounded-lg bg-slate-900/70 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-semibold text-slate-50">{token.symbol}</p>
                    <p className="text-xs text-slate-400">{token.name}</p>
                  </div>
                  <p className="text-xs text-slate-300">Balance {token.balance}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-slate-400">
              Each deposit will be reflected automatically; hook this to `wallet.balanceOf()` when wiring StarkZap.
            </p>
          </div>
        </div>
      );
    }

    if (action === "swap") {
      return (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-sm text-slate-300">From</span>
                <select
                  className="rounded-lg bg-slate-900/70 p-3 text-sm text-slate-50 outline-none"
                  value={swapFrom}
                  onChange={(e) => setSwapFrom(e.target.value)}
                >
                  {tokenDisplay.map((token) => (
                    <option key={token.symbol} value={token.symbol}>
                      {token.symbol}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm text-slate-300">To</span>
                <select
                  className="rounded-lg bg-slate-900/70 p-3 text-sm text-slate-50 outline-none"
                  value={swapTo}
                  onChange={(e) => setSwapTo(e.target.value)}
                >
                  {tokenDisplay
                    .filter((token) => token.symbol !== swapFrom)
                    .map((token) => (
                      <option key={token.symbol} value={token.symbol}>
                        {token.symbol}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-sm text-slate-300">Amount</span>
                <input
                  className="rounded-lg bg-slate-900/70 p-3 text-lg font-semibold text-slate-50 outline-none"
                  value={swapAmount}
                  onChange={(e) => setSwapAmount(e.target.value)}
                  placeholder="0.00"
                />
              </label>
              <div className="rounded-lg bg-slate-900/70 p-3 text-sm text-slate-200">
                <p className="font-semibold text-white">Route preview</p>
                <p className="mt-2 text-slate-300">AVNU aggregator · Fee: sponsored</p>
                <p className="text-slate-400">Wire this to StarkZap swap call when backend is ready.</p>
              </div>
            </div>
            <button
              type="button"
              className="mt-4 w-full rounded-xl bg-gradient-to-r from-fuchsia-400 via-blue-400 to-cyan-300 px-4 py-3 text-base font-semibold text-slate-900 shadow-lg shadow-blue-500/25 transition hover:brightness-110"
            >
              Get quote & swap
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
              {stakingPositions.map((position) => (
            <div
              key={position.validator}
              className="rounded-xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-white/5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-300">Validator</p>
                  <p className="text-lg font-semibold text-white">{position.validator}</p>
                </div>
                <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-200">
                  {position.apr}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-slate-900/70 p-3">
                  <p className="text-slate-400">Staked</p>
                  <p className="text-base font-semibold text-white">{position.staked}</p>
                </div>
                <div className="rounded-lg bg-slate-900/70 p-3">
                  <p className="text-slate-400">Rewards</p>
                  <p className="text-base font-semibold text-white">{position.rewards}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                <span>Cooldown</span>
                <span>{position.cooldown}</span>
              </div>
              <div className="mt-4 flex gap-2">
                <button className="flex-1 rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-50 transition hover:border-white/40" type="button">
                  Claim rewards
                </button>
                <button className="flex-1 rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 transition hover:brightness-110" type="button">
                  Exit intent
                </button>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400">
          Use `sdk.getStakerPools()` and `wallet.getPoolPosition()` to hydrate this view with live data from StarkZap.
        </p>
      </div>
    );
  };

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
                  : accessToken
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
              <div className="rounded-full bg-emerald-400/15 px-4 py-2 text-xs font-semibold text-emerald-200">
                Live via StarkZap soon
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
              {["Received 120 STRK", "Sent 45 USDC", "Staked 50 STRK"].map((item) => (
                <div key={item} className="flex items-center justify-between rounded-xl bg-slate-800/70 px-3 py-2">
                  <span className="text-slate-200">{item}</span>
                  <span className="text-xs text-slate-400">5m ago</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-slate-400">Hook to tx history once StarkZap is integrated.</p>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-indigo-500/10">
          <div className="flex flex-wrap items-center gap-3">
            {([
              { key: "send", label: "Send" },
              { key: "receive", label: "Receive" },
              { key: "swap", label: "Swap" },
              { key: "portfolio", label: "Portfolio" },
            ] as { key: Action; label: string }[]).map(({ key, label }) => {
              const isActive = action === key;
              return (
                <button
                  key={key}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "bg-white text-slate-900 shadow-md shadow-white/30"
                      : "bg-slate-900/70 text-slate-200 hover:bg-slate-900"
                  }`}
                  type="button"
                  onClick={() => setAction(key)}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="mt-6">{renderAction()}</div>
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
