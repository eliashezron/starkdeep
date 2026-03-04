"use client";

import { useEffect, useMemo, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useStarkZap } from "./hooks/useStarkZap";

type Action = "send" | "receive" | "stake";

type TokenView = {
  symbol: string;
  name: string;
  balance: string;
  fiat: string;
  change: string;
  numericFiat?: number;
};

const fallbackTokens: TokenView[] = [
  { symbol: "STRK", name: "Starknet", balance: "1,240", fiat: "$2,480", change: "+3.2%", numericFiat: 2480 },
  { symbol: "USDC", name: "USD Coin", balance: "4,200", fiat: "$4,200", change: "+0.2%", numericFiat: 4200 },
  { symbol: "strkBTC", name: "Stark Bitcoin", balance: "0.10", fiat: "$6,500", change: "+1.4%", numericFiat: 6500 },
  { symbol: "wBTC", name: "Wrapped Bitcoin", balance: "0.05", fiat: "$3,250", change: "+0.8%", numericFiat: 3250 },
];

const usdPriceBook: Record<string, number> = {
  strk: 2.0,
  usdc: 1.0,
  strkbtc: 65000,
  wbtc: 65000,
};

export default function Home() {
  const [action, setAction] = useState<Action>("send");
  const [sendToken, setSendToken] = useState(fallbackTokens[0].symbol);
  const [sendAmount, setSendAmount] = useState("100");
  const [recipient, setRecipient] = useState("0x2f1...c2b");
  const [stakeAmount, setStakeAmount] = useState("50");
  const [stakeTab, setStakeTab] = useState<"stake" | "unstake" | "withdraw">("stake");
  const [unstakeAmount, setUnstakeAmount] = useState("10");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isStaking, setIsStaking] = useState(false);
  const [selectedStakeToken, setSelectedStakeToken] = useState<string | null>(null);
  const [validatorInput, setValidatorInput] = useState(
    (process.env.NEXT_PUBLIC_STARKZAP_VALIDATORS || "").trim()
  );
  const [activity, setActivity] = useState<string[]>(["Received 120 STRK", "Sent 45 USDC", "Staked 50 STRK"]);
  const { login, logout, authenticated, getAccessToken } = usePrivy();
  const [accessToken, setAccessToken] = useState("");
  const [autoConnectRequested, setAutoConnectRequested] = useState(false);

  const {
    connect,
    status: walletStatus,
    address,
    tokens: zapTokens,
    balances,
    refreshBalances,
    refreshStakingInfo,
    isFetchingBalances,
    isFetchingStaking,
    error,
    send,
    stake,
    addStake,
    exitStake,
    completeExit,
    stakingInfo,
    stakeableTokens,
    loadStakeableTokens,
    isFetchingStakeable,
    validatorPools,
    loadValidatorPools,
    isFetchingPools,
    poolsError,
    network,
    feeMode,
    stakingPool,
    stakingPoolOverride,
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

    const parseFiat = (fiat: string) => {
      const n = Number(fiat.replace(/[$,]/g, ""));
      return Number.isFinite(n) ? n : 0;
    };

    const source = zapTokens && Array.isArray(zapTokens)
      ? zapTokens.map((t) => {
          const balanceStr = balances?.[t.symbol] ?? "—";
          const balanceNum = balanceStr && balanceStr !== "—" ? Number(balanceStr) : 0;
          const price = usdPriceBook[t.symbol.toLowerCase()] ?? 0;
          const numericFiat = Number.isFinite(balanceNum) && price ? balanceNum * price : 0;
          return {
            symbol: t.symbol,
            name: t.name,
            balance: balanceStr,
            fiat: price ? `$${numericFiat.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—",
            change: "",
            numericFiat,
          } satisfies TokenView;
        })
      : fallbackTokens;

    const filtered = source.filter((t) => allowList.has(t.symbol.toLowerCase()));
    return filtered.length
      ? filtered.map((t) => ({ ...t, numericFiat: t.numericFiat ?? parseFiat(t.fiat) }))
      : fallbackTokens;
  }, [zapTokens, balances]);

  useEffect(() => {
    if (tokenDisplay.length && !tokenDisplay.find((t) => t.symbol === sendToken)) {
      setSendToken(tokenDisplay[0].symbol);
    }
  }, [tokenDisplay, sendToken]);

  useEffect(() => {
    if (stakeableTokens.length && !selectedStakeToken) {
      setSelectedStakeToken(stakeableTokens[0].symbol);
    }
  }, [stakeableTokens, selectedStakeToken]);

  const totalFiat = useMemo(() => {
    const total = tokenDisplay.reduce((sum, t) => sum + (t.numericFiat ?? 0), 0);
    return total ? `$${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "$0.00";
  }, [tokenDisplay]);

  useEffect(() => {
    if (address) {
      // Placeholder: Replace with real tx history once StarkZap exposes it.
      setActivity([
        `Connected wallet ${address.slice(0, 6)}...${address.slice(-4)}`,
        stakingInfo.isMember ? `Staked: ${stakingInfo.staked} STRK` : "No stake yet",
        stakingInfo.rewards !== "—" ? `Rewards: ${stakingInfo.rewards} STRK` : "Rewards pending",
      ]);
    } else {
      setActivity(["Connect your wallet to load activity"]);
    }
  }, [address, stakingInfo]);
  const activeToken = useMemo(
    () => tokenDisplay.find((t) => t.symbol === sendToken),
    [tokenDisplay, sendToken]
  );

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

  const handleLoadStakeable = async () => {
    try {
      setStatusMessage("Loading stakeable assets...");
      await loadStakeableTokens();
      setStatusMessage("Stakeable assets loaded");
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Failed to load stakeable assets");
    }
  };

  const handleFetchPools = async () => {
    const validators = validatorInput
      .split(/[\s,]+/)
      .map((v) => v.trim())
      .filter(Boolean);
    if (!validators.length) {
      setStatusMessage("Enter at least one validator staker address");
      return;
    }
    try {
      setStatusMessage("Loading validator pools...");
      await loadValidatorPools(validators);
      setStatusMessage("Validator pools updated");
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Failed to load validator pools");
    }
  };

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

  const handleStake = async () => {
    const strk = zapTokens?.find((t) => t.symbol.toLowerCase() === "strk");
    if (!strk) {
      setStatusMessage("STRK token not loaded yet. Connect wallet and refresh.");
      return;
    }
    if (!stakingPool) {
      setStatusMessage("Staking pool not configured for this network.");
      return;
    }

    try {
      setIsStaking(true);
      setStatusMessage("Staking via StarkZap...");
      const tx = await stake(strk, stakeAmount);
      setStatusMessage(`Staking submitted. Track: ${tx.explorerUrl ?? "pending"}`);
      setActivity((prev) => [
        `Staked ${stakeAmount} ${strk.symbol}`,
        ...prev.slice(0, 4),
      ]);
      refreshBalances();
    } catch (err) {
      setStatusMessage(err instanceof Error ? `Stake failed: ${err.message}` : "Stake failed");
    } finally {
      setIsStaking(false);
    }
  };

  const handleAddStake = async () => {
    const strk = zapTokens?.find((t) => t.symbol.toLowerCase() === "strk");
    if (!strk) {
      setStatusMessage("STRK token not loaded yet. Connect wallet and refresh.");
      return;
    }
    if (!stakingPool) {
      setStatusMessage("Staking pool not configured for this network.");
      return;
    }

    try {
      setIsStaking(true);
      setStatusMessage("Adding to stake via StarkZap...");
      const tx = await addStake(strk, stakeAmount);
      setStatusMessage(`Add stake submitted. Track: ${tx.explorerUrl ?? "pending"}`);
      setActivity((prev) => [`Added ${stakeAmount} ${strk.symbol}`, ...prev.slice(0, 4)]);
      refreshBalances();
      refreshStakingInfo();
    } catch (err) {
      setStatusMessage(err instanceof Error ? `Add stake failed: ${err.message}` : "Add stake failed");
    } finally {
      setIsStaking(false);
    }
  };

  const handleUnstake = async () => {
    const strk = zapTokens?.find((t) => t.symbol.toLowerCase() === "strk");
    if (!strk) {
      setStatusMessage("STRK token not loaded yet. Connect wallet and refresh.");
      return;
    }
    if (!stakingPool) {
      setStatusMessage("Staking pool not configured for this network.");
      return;
    }

    try {
      setIsStaking(true);
      setStatusMessage("Submitting exit intent (unstake)...");
      const tx = await exitStake(unstakeAmount, strk);
      setStatusMessage(`Exit intent submitted. Track: ${tx.explorerUrl ?? "pending"}. Complete exit after unpool time.`);
      setActivity((prev) => [`Exit intent ${unstakeAmount} ${strk.symbol}`, ...prev.slice(0, 4)]);
      refreshStakingInfo();
    } catch (err) {
      setStatusMessage(err instanceof Error ? `Unstake failed: ${err.message}` : "Unstake failed");
    } finally {
      setIsStaking(false);
    }
  };

  const handleCompleteExit = async () => {
    try {
      setIsStaking(true);
      setStatusMessage("Completing exit...");
      const tx = await completeExit();
      setStatusMessage(`Exit completed. Track: ${tx.explorerUrl ?? "pending"}`);
      setActivity((prev) => ["Exit completed", ...prev.slice(0, 4)]);
      refreshBalances();
      refreshStakingInfo();
    } catch (err) {
      setStatusMessage(err instanceof Error ? `Exit failed: ${err.message}` : "Exit failed");
    } finally {
      setIsStaking(false);
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

    if (action === "stake") {
      const strk = tokenDisplay.find((t) => t.symbol.toLowerCase() === "strk");
      const selectedSymbol = selectedStakeToken ?? stakeableTokens[0]?.symbol ?? null;
      const poolRows = Object.entries(validatorPools).flatMap(([validator, pools]) =>
        pools
          .filter((p) => !selectedSymbol || p.token.symbol.toLowerCase() === selectedSymbol.toLowerCase())
          .map((p) => ({ validator, pool: p }))
      );
      return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-emerald-500/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-300">Stake STRK</p>
                <p className="text-xs text-slate-400">
                  Pool: {stakingPool ? `${stakingPool.slice(0, 6)}...${stakingPool.slice(-4)}` : "unconfigured"}
                  {stakingPoolOverride ? " (env override)" : " (preset)"}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={refreshBalances}
                  disabled={!address || isFetchingBalances || walletStatus !== "ready"}
                  className="rounded-full border border-white/15 px-3 py-1 text-xs text-slate-100 transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isFetchingBalances ? "Syncing..." : "Refresh"}
                </button>
                <button
                  type="button"
                  onClick={refreshStakingInfo}
                  disabled={!address || isFetchingStaking}
                  className="rounded-full border border-white/15 px-3 py-1 text-xs text-slate-100 transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isFetchingStaking ? "Loading staking info..." : "Staking info"}
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 rounded-xl bg-slate-900/60 p-2 text-sm font-semibold text-slate-200">
              {(["stake", "unstake", "withdraw"] as const).map((key) => {
                const isActive = stakeTab === key;
                const label = key === "stake" ? "Stake" : key === "unstake" ? "Unstake" : "Withdraw";
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStakeTab(key)}
                    className={`flex-1 rounded-lg px-3 py-2 transition ${
                      isActive ? "bg-white text-slate-900 shadow" : "text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {stakeTab === "stake" && (
              <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-3 rounded-xl bg-slate-900/70 p-4">
                  <p className="text-sm text-slate-300">Amount (STRK)</p>
                  <input
                    className="w-full rounded-lg bg-slate-950/70 p-3 text-lg font-semibold text-slate-50 outline-none"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    placeholder="0.00"
                  />
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Balance {strk?.balance ?? "—"}</span>
                    <button
                      type="button"
                      className="rounded-full border border-white/10 px-3 py-1 text-slate-200 transition hover:border-white/40"
                      onClick={() => setStakeAmount(strk?.balance ?? "0")}
                    >
                      Max
                    </button>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={handleStake}
                      disabled={walletStatus !== "ready" || isStaking}
                      className="flex-1 rounded-xl bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 px-4 py-3 text-base font-semibold text-slate-900 shadow-lg shadow-emerald-500/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {walletStatus === "ready" ? (isStaking ? "Staking..." : "Stake / Join") : "Connect wallet"}
                    </button>
                    <button
                      type="button"
                      onClick={handleAddStake}
                      disabled={walletStatus !== "ready" || isStaking || !stakingInfo.isMember}
                      className="flex-1 rounded-xl bg-gradient-to-r from-indigo-400 via-cyan-400 to-emerald-400 px-4 py-3 text-base font-semibold text-slate-900 shadow-lg shadow-indigo-500/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {walletStatus === "ready" ? (isStaking ? "Adding..." : "Add to position") : "Connect wallet"}
                    </button>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-900/70 p-4 text-sm text-slate-200">
                  <p className="font-semibold text-white">Rewards eligible</p>
                  <p className="mt-2 text-slate-300">Commission: {stakingInfo.commission ?? "—"}%</p>
                  <p className="text-slate-300">Staked: {stakingInfo.staked} STRK</p>
                  <p className="text-slate-300">Rewards: {stakingInfo.rewards} STRK</p>
                  {stakingInfo.unpoolTime && (
                    <p className="text-slate-400">Unpool after: {stakingInfo.unpoolTime.toLocaleString()}</p>
                  )}
                  <p className="mt-3 rounded-lg bg-slate-950/70 p-3 text-xs text-slate-300">
                    Estimated gas shown once tx prepared. Rewards accrue per validator schedule.
                  </p>
                </div>
              </div>
            )}

            {stakeTab === "unstake" && (
              <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-3 rounded-xl bg-slate-900/70 p-4">
                  <p className="text-sm text-slate-300">Unstake amount (exit intent)</p>
                  <input
                    className="w-full rounded-lg bg-slate-950/70 p-3 text-lg font-semibold text-slate-50 outline-none"
                    value={unstakeAmount}
                    onChange={(e) => setUnstakeAmount(e.target.value)}
                    placeholder="0.00"
                  />
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Staked {stakingInfo.staked} STRK</span>
                    <span>Rewards {stakingInfo.rewards} STRK</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleUnstake}
                    disabled={walletStatus !== "ready" || isStaking || !stakingInfo.isMember}
                    className="w-full rounded-xl border border-white/20 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isStaking ? "Submitting..." : "Submit exit intent"}
                  </button>
                  <p className="text-xs text-slate-400">Exit intent starts the unpool window; complete withdrawal in Withdraw tab after the window.</p>
                </div>
                <div className="rounded-xl bg-slate-900/70 p-4 text-sm text-slate-200">
                  <p className="font-semibold text-white">Unstake details</p>
                  <p className="mt-2 text-slate-300">Commission: {stakingInfo.commission ?? "—"}%</p>
                  {stakingInfo.unpoolTime ? (
                    <p className="text-slate-300">Unpool after: {stakingInfo.unpoolTime.toLocaleString()}</p>
                  ) : (
                    <p className="text-slate-400">Unpool window starts after exit intent.</p>
                  )}
                  <p className="mt-3 rounded-lg bg-slate-950/70 p-3 text-xs text-slate-300">
                    Tokens stop earning rewards once exit intent is submitted and remain locked until the window ends.
                  </p>
                </div>
              </div>
            )}

            {stakeTab === "withdraw" && (
              <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-4 rounded-xl bg-slate-900/70 p-4">
                  <p className="text-sm text-slate-300">Complete exit</p>
                  <div className="rounded-lg bg-slate-950/70 p-3 text-sm text-slate-200">
                    <p className="text-slate-300">Unpool time: {stakingInfo.unpoolTime ? stakingInfo.unpoolTime.toLocaleString() : "Not set"}</p>
                    <p className="text-slate-300">Staked: {stakingInfo.staked} STRK</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCompleteExit}
                    disabled={walletStatus !== "ready" || isStaking}
                    className="w-full rounded-xl bg-gradient-to-r from-cyan-300 via-blue-400 to-indigo-500 px-4 py-3 text-base font-semibold text-slate-900 shadow-lg shadow-indigo-500/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isStaking ? "Completing..." : "Withdraw (complete exit)"}
                  </button>
                  <p className="text-xs text-slate-400">Complete exit after the unpool window. If not yet eligible, wait for the timestamp above.</p>
                </div>
                <div className="rounded-xl bg-slate-900/70 p-4 text-sm text-slate-200">
                  <p className="font-semibold text-white">Rewards</p>
                  <p className="mt-2 text-slate-300">Rewards: {stakingInfo.rewards} STRK</p>
                  <p className="text-slate-400">Claim occurs automatically when exiting via pool contract.</p>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-emerald-500/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">Stakeable assets & validators</p>
                <p className="text-xs text-slate-400">Load tokens via sdk.stakingTokens() and view pools from sdk.getStakerPools().</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleLoadStakeable}
                  disabled={isFetchingStakeable}
                  className="rounded-full border border-white/15 px-3 py-1 text-xs text-slate-100 transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isFetchingStakeable ? "Loading..." : "Load stakeable"}
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[0.45fr_0.55fr]">
              <div className="space-y-3 rounded-xl bg-slate-900/70 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Stakeable tokens</p>
                {stakeableTokens.length === 0 ? (
                  <p className="text-sm text-slate-300">Click load to fetch available staking assets.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {stakeableTokens.map((token) => {
                      const isActive = selectedSymbol === token.symbol;
                      return (
                        <button
                          key={token.symbol}
                          type="button"
                          onClick={() => setSelectedStakeToken(token.symbol)}
                          className={`rounded-full px-3 py-2 text-sm transition ${
                            isActive ? "bg-white text-slate-900 shadow" : "bg-white/10 text-slate-100 hover:bg-white/20"
                          }`}
                        >
                          {token.symbol}
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-slate-500">Tokens come from StarkZap stakingTokens().</p>
              </div>

              <div className="space-y-3 rounded-xl bg-slate-900/70 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Validator pools</p>
                  <button
                    type="button"
                    onClick={handleFetchPools}
                    disabled={isFetchingPools}
                    className="rounded-full border border-white/15 px-3 py-1 text-xs text-slate-100 transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isFetchingPools ? "Loading pools..." : "Fetch pools"}
                  </button>
                </div>
                <input
                  className="w-full rounded-lg bg-slate-950/70 p-3 text-sm text-slate-100 outline-none"
                  value={validatorInput}
                  onChange={(e) => setValidatorInput(e.target.value)}
                  placeholder="Comma or space-separated validator staker addresses"
                />
                {poolsError && <p className="text-xs text-rose-300">{poolsError}</p>}
                {poolRows.length === 0 ? (
                  <p className="text-sm text-slate-300">Enter validator staker addresses to see pools for {selectedSymbol ?? "a token"}.</p>
                ) : (
                  <div className="space-y-2">
                    {poolRows.map(({ validator, pool }) => {
                      const formatted = pool.amount?.toFormatted ? pool.amount.toFormatted() : String(pool.amount ?? "—");
                      return (
                        <div key={`${validator}-${pool.poolContract}-${pool.token.symbol}`} className="rounded-lg border border-white/10 bg-slate-950/60 p-3 text-sm text-slate-200">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-100">{pool.token.symbol}</span>
                            <span className="text-xs text-slate-400">Validator: {validator.slice(0, 6)}...{validator.slice(-4)}</span>
                          </div>
                          <p className="text-slate-300">Delegated: {formatted}</p>
                          <p className="text-xs text-slate-500">Pool contract: {pool.poolContract}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return null;
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
              {activity.map((item, idx) => (
                <div key={item + idx} className="flex items-center justify-between rounded-xl bg-slate-800/70 px-3 py-2">
                  <span className="text-slate-200">{item}</span>
                  <span className="text-xs text-slate-400">live soon</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-slate-400">Hook to tx history once StarkZap exposes a tx feed; currently showing placeholder items.</p>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-indigo-500/10">
          <div className="flex flex-wrap items-center gap-3">
            {([
              { key: "send", label: "Send" },
              { key: "receive", label: "Receive" },
              { key: "stake", label: "Stake" },
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
