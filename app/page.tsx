"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Amount, fromAddress, mainnetValidators, sepoliaValidators, type Token } from "starkzap";
import { WalletShell } from "./components/WalletShell";
import { useZapWallet } from "./hooks/useZapWallet";

type Action = "send" | "receive" | "stake";
type ValidatorPreset = { name: string; stakerAddress: string; website?: string };
type StakerPool = { poolContract: string; token: Token; amount: any };
type PoolPosition = { staked?: any; rewards?: any; total?: any; unpooling?: any; unpoolTime?: Date | string };

export default function HomePage() {
  const [action, setAction] = useState<Action>("send");
  const [sendToken, setSendToken] = useState("STRK");
  const [sendAmount, setSendAmount] = useState("");
  const [recipient, setRecipient] = useState("");

  // Staking state
  const [stakeAction, setStakeAction] = useState<"stake" | "unstake" | "withdraw">("stake");
  const [selectedValidatorKey, setSelectedValidatorKey] = useState<string>("");
  const [pools, setPools] = useState<StakerPool[]>([]);
  const [selectedPool, setSelectedPool] = useState<string>("");
  const [stakeAmount, setStakeAmount] = useState("");
  const [stakeStatus, setStakeStatus] = useState<string | null>(null);
  const [isLoadingPools, setIsLoadingPools] = useState(false);
  const [isLoadingPosition, setIsLoadingPosition] = useState(false);
  const [isSubmittingStake, setIsSubmittingStake] = useState(false);
  const [stakePosition, setStakePosition] = useState<PoolPosition | null>(null);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const {
    sdk,
    wallet,
    balances,
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

  const validators = useMemo<ValidatorPreset[]>(() => {
    const set = network === "mainnet" ? mainnetValidators : sepoliaValidators;
    return Object.values(set ?? {}) as ValidatorPreset[];
  }, [network]);

  useEffect(() => {
    if (validators.length && !selectedValidatorKey) {
      setSelectedValidatorKey(validators[0].stakerAddress);
    }
  }, [validators, selectedValidatorKey]);

  const selectedValidator = useMemo(() => {
    return validators.find((v) => v.stakerAddress === selectedValidatorKey) ?? validators[0];
  }, [validators, selectedValidatorKey]);

  const selectedPoolObj = useMemo(() => pools.find((pool) => pool.poolContract === selectedPool), [pools, selectedPool]);
  const selectedStakeToken = selectedPoolObj?.token;
  const selectedStakeBalance = selectedStakeToken ? balances?.[selectedStakeToken.symbol] ?? "0" : "0";

  useEffect(() => {
    if (tokenDisplay.length && !tokenDisplay.find((t) => t.symbol === sendToken)) {
      setSendToken(tokenDisplay[0].symbol);
    }
  }, [tokenDisplay, sendToken]);

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

  const loadPools = useCallback(async () => {
    if (!sdk || !selectedValidator?.stakerAddress) return;
    setIsLoadingPools(true);
    try {
      const validatorAddr = fromAddress(selectedValidator.stakerAddress);
      const result = await sdk.getStakerPools(validatorAddr);
      setPools(result);
      const resolvedPool = result.find((p) => p.poolContract === selectedPool) ?? result[0];
      setSelectedPool(resolvedPool?.poolContract ?? "");
    } catch (err) {
      console.error("Failed to load pools", err);
      setStakeStatus(err instanceof Error ? err.message : "Unable to load pools");
    } finally {
      setIsLoadingPools(false);
    }
  }, [sdk, selectedValidator, selectedPool]);

  const loadStakePosition = useCallback(
    async (poolAddress?: string) => {
      const target = poolAddress ?? selectedPool;
      if (!wallet || !target) return;
      setIsLoadingPosition(true);
      try {
        const pos = await wallet.getPoolPosition(target);
        setStakePosition(pos ?? null);
      } catch (err) {
        console.error("Failed to load position", err);
        setStakePosition(null);
      } finally {
        setIsLoadingPosition(false);
      }
    },
    [wallet, selectedPool]
  );

  useEffect(() => {
    if (action === "stake") {
      loadPools();
    }
  }, [action, loadPools]);

  useEffect(() => {
    if (action === "stake" && selectedPool) {
      loadStakePosition(selectedPool);
    }
  }, [action, selectedPool, loadStakePosition]);

  useEffect(() => {
    if (walletStatus === "ready") {
      refreshBalances();
      if (action === "stake" && selectedPool) {
        loadStakePosition(selectedPool);
      }
    }
  }, [walletStatus, action, selectedPool, refreshBalances, loadStakePosition]);

  const handleStake = async () => {
    if (!wallet || walletStatus !== "ready") {
      setStakeStatus("Connect your wallet to stake");
      return;
    }
    if (!selectedStakeToken || !selectedPool) {
      setStakeStatus("Select a pool to stake into");
      return;
    }

    try {
      setIsSubmittingStake(true);
      setStakeStatus("Submitting stake via StarkZap...");
      const tx = await wallet.stake(selectedPool, Amount.parse(stakeAmount || "0", selectedStakeToken));
      setStakeStatus(tx.explorerUrl ?? "pending");
      await refreshBalances();
      await loadStakePosition(selectedPool);
    } catch (err) {
      setStakeStatus(err instanceof Error ? `Stake failed: ${err.message}` : "Stake failed");
    } finally {
      setIsSubmittingStake(false);
    }
  };

  const handleUnstake = async () => {
    if (!wallet || walletStatus !== "ready") {
      setStakeStatus("Connect your wallet to unstake");
      return;
    }
    if (!selectedStakeToken || !selectedPool) {
      setStakeStatus("Select a pool to unstake from");
      return;
    }

    try {
      setIsSubmittingStake(true);
      setStakeStatus("Requesting exit (cooldown starts)...");
      const tx = await wallet.exitPoolIntent(selectedPool, Amount.parse(stakeAmount || "0", selectedStakeToken));
      setStakeStatus(tx.explorerUrl ?? "pending");
      await loadStakePosition(selectedPool);
    } catch (err) {
      setStakeStatus(err instanceof Error ? `Unstake failed: ${err.message}` : "Unstake failed");
    } finally {
      setIsSubmittingStake(false);
    }
  };

  const handleWithdraw = async () => {
    if (!wallet || walletStatus !== "ready") {
      setStakeStatus("Connect your wallet to withdraw");
      return;
    }
    if (!selectedPool) {
      setStakeStatus("Select a pool to withdraw from");
      return;
    }

    const hasUnpooling = stakePosition?.unpooling && !stakePosition.unpooling.isZero?.();
    const readyTime = stakePosition?.unpoolTime ? new Date(stakePosition.unpoolTime) : undefined;
    if (!hasUnpooling) {
      setStakeStatus("No pending withdrawals for this pool");
      return;
    }
    if (readyTime && readyTime.getTime() > Date.now()) {
      setStakeStatus(`Exit window opens at ${readyTime.toLocaleString()}`);
      return;
    }

    try {
      setIsSubmittingStake(true);
      setStakeStatus("Finalizing withdrawal...");
      const tx = await wallet.exitPool(selectedPool);
      setStakeStatus(tx.explorerUrl ?? "pending");
      await refreshBalances();
      await loadStakePosition(selectedPool);
    } catch (err) {
      setStakeStatus(err instanceof Error ? `Withdraw failed: ${err.message}` : "Withdraw failed");
    } finally {
      setIsSubmittingStake(false);
    }
  };

  const stakePrimary = stakeAction === "stake"
    ? { label: "Stake", onClick: handleStake }
    : stakeAction === "unstake"
      ? { label: "Unstake", onClick: handleUnstake }
      : { label: "Withdraw", onClick: handleWithdraw };

  const stakeInProgressLabel = stakeAction === "stake" ? "Staking..." : stakeAction === "unstake" ? "Unstaking..." : "Withdrawing...";

  const positionDisplay = (value?: any) => {
    if (!value) return "0";
    if (typeof value === "string") return value;
    if (typeof value.toFormatted === "function") return value.toFormatted();
    if (typeof value.toUnit === "function") return value.toUnit();
    return String(value);
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
      setStatusMessage(tx.explorerUrl ?? "pending");
      await refreshBalances();
      if (action === "stake" && selectedPool) {
        await loadStakePosition(selectedPool);
      }
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
              <span className="text-sm text-gray-300">From</span>
              <select
                className="rounded-lg bg-gray-800 p-3 text-sm text-gray-50 outline-none"
                value={sendToken}
                onChange={(e) => setSendToken(e.target.value)}
              >
                {tokenDisplay.map((token) => (
                  <option key={token.symbol} value={token.symbol}>
                    {token.symbol} · {token.name}
                  </option>
                ))}
              </select>
              <span className="text-xs text-gray-400">Balance {activeToken?.balance ?? "0"}</span>
            </label>
            <label className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-4">
              <span className="text-sm text-gray-300">Amount</span>
              <input
                className="rounded-lg bg-gray-800 p-3 text-lg font-semibold text-gray-50 outline-none"
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value)}
                placeholder="0.00"
              />
              <div className="flex gap-2 text-xs text-gray-400">
                {[
                  { label: "25%", value: "0.25" },
                  { label: "50%", value: "0.5" },
                  { label: "Max", value: activeToken?.balance ?? "0" },
                ].map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    className="rounded-full border border-white/10 px-3 py-1 text-gray-200 transition hover:border-white/40 hover:text-gray-100"
                    onClick={() => setSendAmount(chip.value)}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </label>
          </div>
          <label className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-4">
            <span className="text-sm text-gray-300">Recipient</span>
            <input
              className="rounded-lg bg-gray-800 p-3 text-base text-gray-50 outline-none"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0x..."
            />
            <span className="text-xs text-gray-400">Paste a Starknet address or QR scan</span>
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={refreshBalances}
              disabled={!address || walletStatus !== "ready"}
              className="rounded-full border border-white/15 px-3 py-2 text-xs text-gray-100 transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Refresh balances
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={walletStatus !== "ready" || isSending}
              className="flex-1 rounded-xl bg-blue-500 px-4 py-3 text-base font-semibold text-gray-900 shadow-lg shadow-blue-500/25 transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
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
              <p className="text-sm text-gray-300">Deposit address</p>
              <span className="rounded-full bg-gray-900/70 px-3 py-1 text-xs text-gray-200">{network}</span>
            </div>
            <p className="mt-3 text-lg font-semibold">{shortAddress}</p>
            <p className="mt-1 text-xs text-gray-400">Share this address to receive tokens.</p>
            <div className="mt-4 flex gap-2">
              <button
                className="flex-1 rounded-lg border border-white/15 px-3 py-2 text-sm text-gray-50 transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                onClick={handleCopyAddress}
                disabled={!address}
              >
                Copy
              </button>
              <button className="flex-1 rounded-lg border border-white/15 px-3 py-2 text-sm text-gray-50 transition hover:border-white/40" type="button">
                Share
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-gray-300">Quick deposit tokens</p>
              <button
                type="button"
                onClick={refreshBalances}
                disabled={!address || isFetchingBalances || walletStatus !== "ready"}
                className="rounded-full border border-white/15 px-3 py-1 text-xs text-gray-100 transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isFetchingBalances ? "Syncing..." : "Refresh"}
              </button>
            </div>
            <div className="mt-3 grid gap-2">
              {tokenDisplay.map((token) => (
                <div
                  key={token.symbol}
                  className="flex items-center justify-between rounded-lg bg-gray-800 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="text-xs text-gray-400">{token.name}</p>
                    <p className="text-sm text-gray-200">{token.symbol}</p>
                  </div>
                  <p className="text-xs text-gray-300">Balance {token.balance}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (action === "stake") {
      const stakeBalanceLabel = stakeAction === "stake" ? selectedStakeBalance : positionDisplay(stakePosition?.staked);
      const stakeMaxValue = stakeAction === "stake" ? selectedStakeBalance || "0" : positionDisplay(stakePosition?.staked) || "0";

      return (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-4">
              <span className="text-sm text-gray-300">Validator</span>
              <select
                className="rounded-lg bg-gray-800 p-3 text-sm text-gray-50 outline-none"
                value={selectedValidator?.stakerAddress ?? ""}
                onChange={(e) => setSelectedValidatorKey(e.target.value)}
                disabled={!validators.length || isLoadingPools}
              >
                {validators.map((validator) => (
                  <option key={validator.stakerAddress} value={validator.stakerAddress}>
                    {validator.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-4">
              <span className="text-sm text-gray-300">Pool / Token</span>
              <select
                className="rounded-lg bg-gray-800 p-3 text-sm text-gray-50 outline-none"
                value={selectedPool}
                onChange={(e) => setSelectedPool(e.target.value)}
                disabled={!pools.length || isLoadingPools}
              >
                {pools.map((pool) => (
                  <option key={pool.poolContract} value={pool.poolContract}>
                    {pool.token.symbol} · {pool.poolContract.slice(0, 8)}...{pool.poolContract.slice(-4)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
            {(["stake", "unstake", "withdraw"] as const).map((key) => {
              const isActive = key === stakeAction;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStakeAction(key)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    isActive ? "bg-white text-gray-900 shadow-md shadow-white/30" : "bg-gray-900/70 text-gray-200 hover:bg-gray-900"
                  }`}
                >
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-5">
              {stakeAction !== "withdraw" && (
                <label className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-sm text-gray-300">
                    <span>Amount</span>
                    <span>Balance: {stakeBalanceLabel}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      className="flex-1 rounded-lg bg-gray-800 p-3 text-lg font-semibold text-gray-50 outline-none"
                      value={stakeAmount}
                      onChange={(e) => setStakeAmount(e.target.value)}
                      placeholder="0.00"
                    />
                    <button
                      type="button"
                      className="rounded-full border border-white/15 px-3 py-2 text-xs text-gray-100 transition hover:border-white/40"
                      onClick={() => setStakeAmount(stakeMaxValue)}
                      disabled={!selectedStakeToken && stakeAction === "stake"}
                    >
                      Max
                    </button>
                  </div>
                </label>
              )}

              {stakeAction === "withdraw" && (
                <div className="rounded-lg border border-white/10 bg-gray-900/60 p-4 text-sm text-gray-200">
                  <p>Pending withdrawal: {positionDisplay(stakePosition?.unpooling)}</p>
                  <p className="text-xs text-gray-400">
                    {stakePosition?.unpoolTime ? `Ready after: ${new Date(stakePosition.unpoolTime).toLocaleString()}` : "No exit intent active."}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={refreshBalances}
                  disabled={!address || walletStatus !== "ready"}
                  className="rounded-full border border-white/15 px-3 py-2 text-xs text-gray-100 transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Refresh balances
                </button>
                <button
                  type="button"
                  onClick={stakePrimary.onClick}
                  disabled={walletStatus !== "ready" || isSubmittingStake || isLoadingPools}
                  className="flex-1 rounded-xl bg-blue-500 px-4 py-3 text-base font-semibold text-gray-900 shadow-lg shadow-blue-500/25 transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {walletStatus === "ready" ? (isSubmittingStake ? stakeInProgressLabel : stakePrimary.label) : "Connect wallet first"}
                </button>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-300">Position</p>
                <span className="rounded-full bg-gray-900/70 px-3 py-1 text-xs text-gray-200">
                  {isLoadingPosition ? "Syncing" : walletStatus === "ready" ? "Live" : "Connect"}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-gray-900/70 p-3">
                  <p className="text-xs text-gray-400">Staked</p>
                  <p className="text-lg font-semibold text-gray-100">{positionDisplay(stakePosition?.staked)}</p>
                </div>
                <div className="rounded-lg bg-gray-900/70 p-3">
                  <p className="text-xs text-gray-400">Rewards</p>
                  <p className="text-lg font-semibold text-gray-100">{positionDisplay(stakePosition?.rewards)}</p>
                </div>
                <div className="rounded-lg bg-gray-900/70 p-3">
                  <p className="text-xs text-gray-400">Unpooling</p>
                  <p className="text-lg font-semibold text-gray-100">{positionDisplay(stakePosition?.unpooling)}</p>
                </div>
                <div className="rounded-lg bg-gray-900/70 p-3">
                  <p className="text-xs text-gray-400">Total</p>
                  <p className="text-lg font-semibold text-gray-100">{positionDisplay(stakePosition?.total)}</p>
                </div>
              </div>
              <p className="text-xs text-gray-400">
              </p>
            </div>
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
      statusMessage={action === "stake" ? stakeStatus : statusMessage}
      error={error}
    >
      {renderAction()}
    </WalletShell>
  );
}