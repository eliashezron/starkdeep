"use client";

import { useEffect, useMemo, useState } from "react";
import { WalletShell } from "../components/WalletShell";
import { useZapWallet } from "../hooks/useZapWallet";

export default function StakePage() {
  const {
    network,
    feeMode,
    shortAddress,
    status: walletStatus,
    autoConnectRequested,
    authenticated,
    login,
    logout,
    tokenDisplay,
    totalFiat,
    error,
    // staking
    stakingInfo,
    refreshStakingInfo,
    isFetchingStaking,
    refreshBalances,
    isFetchingBalances,
    stake,
    addStake,
    exitStake,
    completeExit,
    stakingPool,
    stakingPoolOverride,
    stakeableTokens,
    loadStakeableTokens,
    isFetchingStakeable,
    validatorPools,
    loadValidatorPools,
    isFetchingPools,
    poolsError,
    address,
    tokens,
  } = useZapWallet();

  const [stakeAmount, setStakeAmount] = useState("50");
  const [stakeTab, setStakeTab] = useState<"stake" | "unstake" | "withdraw">("stake");
  const [unstakeAmount, setUnstakeAmount] = useState("10");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isStaking, setIsStaking] = useState(false);
  const [selectedStakeToken, setSelectedStakeToken] = useState<string | null>(null);
  const [validatorInput, setValidatorInput] = useState(
    (process.env.NEXT_PUBLIC_STARKZAP_VALIDATORS || "").trim()
  );
  const [activity, setActivity] = useState<string[]>(["Received 120 STRK", "Sent 45 USDC", "Staked 50 STRK"]);

  const feeModeDisplay = feeMode ?? "user";

  useEffect(() => {
    if (address) {
      setActivity([
        `Connected wallet ${address.slice(0, 6)}...${address.slice(-4)}`,
        stakingInfo.isMember ? `Staked: ${stakingInfo.staked} STRK` : "No stake yet",
        stakingInfo.rewards !== "—" ? `Rewards: ${stakingInfo.rewards} STRK` : "Rewards pending",
      ]);
    } else {
      setActivity(["Connect your wallet to load activity"]);
    }
  }, [address, stakingInfo]);

  useEffect(() => {
    if (stakeableTokens.length && !selectedStakeToken) {
      setSelectedStakeToken(stakeableTokens[0].symbol);
    }
  }, [stakeableTokens, selectedStakeToken]);

  const strkToken = useMemo(() => tokenDisplay.find((t) => t.symbol.toLowerCase() === "strk"), [tokenDisplay]);
  const selectedSymbol = selectedStakeToken ?? stakeableTokens[0]?.symbol ?? null;
  const poolRows = Object.entries(validatorPools).flatMap(([validator, pools]) =>
    pools
      .filter((p) => !selectedSymbol || p.token.symbol.toLowerCase() === selectedSymbol.toLowerCase())
      .map((p) => ({ validator, pool: p }))
  );

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

  const handleStake = async () => {
    const strk = tokens?.find((t) => t.symbol.toLowerCase() === "strk");
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
      refreshBalances();
    } catch (err) {
      setStatusMessage(err instanceof Error ? `Stake failed: ${err.message}` : "Stake failed");
    } finally {
      setIsStaking(false);
    }
  };

  const handleAddStake = async () => {
    const strk = tokens?.find((t) => t.symbol.toLowerCase() === "strk");
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
      refreshBalances();
      refreshStakingInfo();
    } catch (err) {
      setStatusMessage(err instanceof Error ? `Add stake failed: ${err.message}` : "Add stake failed");
    } finally {
      setIsStaking(false);
    }
  };

  const handleUnstake = async () => {
    const strk = tokens?.find((t) => t.symbol.toLowerCase() === "strk");
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
      refreshBalances();
      refreshStakingInfo();
    } catch (err) {
      setStatusMessage(err instanceof Error ? `Exit failed: ${err.message}` : "Exit failed");
    } finally {
      setIsStaking(false);
    }
  };

  return (
    <WalletShell
      current="stake"
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
                  <span>Balance {strkToken?.balance ?? "—"}</span>
                  <button
                    type="button"
                    className="rounded-full border border-white/10 px-3 py-1 text-slate-200 transition hover:border-white/40"
                    onClick={() => setStakeAmount(strkToken?.balance ?? "0")}
                  >
                    Max
                  </button>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleStake}
                    disabled={walletStatus !== "ready" || isStaking}
                    className="flex-1 rounded-xl bg-blue-500 px-4 py-3 text-base font-semibold text-slate-900 shadow-lg shadow-blue-500/25 transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {walletStatus === "ready" ? (isStaking ? "Staking..." : "Stake / Join") : "Connect wallet"}
                  </button>
                  <button
                    type="button"
                    onClick={handleAddStake}
                    disabled={walletStatus !== "ready" || isStaking || !stakingInfo.isMember}
                    className="flex-1 rounded-xl bg-blue-500 px-4 py-3 text-base font-semibold text-slate-900 shadow-lg shadow-blue-500/25 transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
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
                  className="w-full rounded-xl bg-blue-500 px-4 py-3 text-base font-semibold text-slate-900 shadow-lg shadow-blue-500/25 transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
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
    </WalletShell>
  );
}
