"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Amount, ChainId, OnboardStrategy, StarkZap, accountPresets, fromAddress, getPresets, type Address, type FeeMode, type NetworkName, type Token } from "starkzap";

// Client-side Privy onboarding per StarkZap docs.
export function useStarkZap(accessToken?: string) {
  const [sdk, setSdk] = useState<StarkZap | null>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [address, setAddress] = useState<string | undefined>(undefined);
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [isFetchingBalances, setIsFetchingBalances] = useState(false);
  const [status, setStatus] = useState<"idle" | "connecting" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const network = (process.env.NEXT_PUBLIC_STARKZAP_NETWORK as NetworkName) || "mainnet";
  const paymaster = useMemo(() => {
    const forceUser = process.env.NEXT_PUBLIC_STARKZAP_FEE_MODE === "user";
    if (forceUser) return undefined;
    const apiKey = (process.env.NEXT_PUBLIC_STARKZAP_AVNU_KEY || "").trim();
    const nodeUrl = (process.env.NEXT_PUBLIC_STARKZAP_AVNU_NODE || "").trim();
    if (!apiKey) return undefined; // fall back to user-paid if no key
    // Starknet Paymaster RPC expects the API key in the x-paymaster-api-key header.
    const headers = { "x-paymaster-api-key": apiKey };
    return nodeUrl ? { nodeUrl, headers } : { headers };
  }, []);

  const feeMode: FeeMode | undefined = paymaster ? "sponsored" : undefined;

  const deployPolicy = useMemo(() => {
    const deployedFlag = (process.env.NEXT_PUBLIC_STARKZAP_ACCOUNT_DEPLOYED || "").trim().toLowerCase();
    return deployedFlag === "1" || deployedFlag === "true" ? "never" : "if_needed";
  }, []);

  const safeEnsureReady = useCallback(async () => {
    if (!wallet?.ensureReady) return;
    try {
      await wallet.ensureReady({ feeMode });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err ?? "");
      // Ignore noisy paymaster replays instead of hard-failing balance refreshes.
      if (msg.includes("PRE_CONFIRMED") || msg.includes("REVERTED") || msg.includes("Tx already sent")) {
        console.warn("StarkZap: ensureReady ignored (pre-confirmed/reverted)", msg);
        return;
      }
      throw err;
    }
  }, [wallet, feeMode]);

  const chainId = useMemo(() => {
    const chain = wallet?.getChainId?.();
    if (chain) return chain as ChainId;
    return network === "mainnet" ? ChainId.MAINNET : ChainId.SEPOLIA;
  }, [wallet, network]);

  const ensureSdk = useCallback(() => {
    if (sdk) return sdk;
    const instance = new StarkZap({ network, paymaster });
    setSdk(instance);
    return instance;
  }, [sdk, network, paymaster]);

  const connect = useCallback(async () => {
    setStatus("connecting");
    setError(null);
    try {
      const instance = ensureSdk();
      const token = (accessToken ?? "").trim();
      const devBypass = process.env.NEXT_PUBLIC_PRIVY_DEV_SIGNER_CONTEXT === "1";
      if (!token && !devBypass) throw new Error("Missing Privy access token. Complete Privy login first.");

      // Pure dev path: skip Privy onboarding entirely and return a mock wallet so the UI can function.
      if (devBypass) {
        const mockWallet = {
          address: "0xDEV-MOCK-PRIVY",
          getChainId: () => ChainId.MAINNET,
          transfer: async () => ({ explorerUrl: null }),
        };
        setWallet(mockWallet as any);
        setStatus("ready");
        return mockWallet;
      }

      const resolveSignerContext = async () => {
        const res = await fetch("/api/privy/signer-context", {
          method: "POST",
          cache: "no-store",
          headers: token
            ? {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              }
            : { "Content-Type": "application/json" },
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Failed to resolve signer context (${res.status}): ${text || res.statusText}`);
        }

        const json = await res.json();
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const serverUrl = json.serverUrl || (origin ? `${origin}/api/privy/sign` : undefined);

        return {
          ...json,
          ...(serverUrl ? { serverUrl } : {}),
          headers: async () => ({ Authorization: `Bearer ${token}` }),
        };
      };

      const { wallet } = await instance.onboard({
        strategy: OnboardStrategy.Privy,
        privy: { resolve: resolveSignerContext },
        accountPreset: accountPresets.argentXV050,
        feeMode,
        deploy: deployPolicy,
      });

      setWallet(wallet);
      setStatus("ready");
      return wallet;
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Connect failed");
      setStatus("error");
      throw err;
    }
  }, [ensureSdk, accessToken, feeMode]);

  const disconnect = useCallback(() => {
    setWallet(null);
    setStatus("idle");
  }, []);

  const tokens = useMemo(() => {
    const presets = getPresets(chainId);
    const overrides: Record<string, Partial<Token>> = {
      usdc: {
        address: fromAddress("0x033068F6539f8e6e6b131e6B2B814e6c34A5224bC66947c47DaB9dFeE93b35fb") as Address,
      },
      strk: {
        address: fromAddress("0x04718f5a0Fc34cC1AF16A1cdee98fFB20C31f5cD61D6Ab07201858f4287c938D") as Address,
      },
      wbtc: {
        address: fromAddress("0x03Fe2b97C1Fd336E750087D68B9b867997Fd64a2661fF3ca5A7C771641e8e7AC") as Address,
      },
    };

    return Object.values(presets)
      .map((token) => {
        const override = overrides[token.symbol.toLowerCase()];
        return override ? { ...token, ...override } : token;
      })
      .filter((token) => ["strk", "usdc", "wbtc", "strkbtc"].includes(token.symbol.toLowerCase()));
  }, [wallet, network, chainId]);

  const resolveAddress = useCallback(async () => {
    if (!wallet) return undefined;

    const direct = wallet.address;
    if (typeof direct === "string" || typeof direct === "number" || typeof direct === "bigint") {
      return direct.toString();
    }

    const acct = wallet.account;
    if (acct?.address) return acct.address.toString();

    if (typeof wallet.getAddress === "function") {
      const maybe = wallet.getAddress();
      const resolved = typeof maybe?.then === "function" ? await maybe : maybe;
      if (resolved) return resolved.toString();
    }

    return undefined;
  }, [wallet]);

  useEffect(() => {
    resolveAddress()
      .then((addr) => {
        setAddress(addr);
        // Backfill missing address onto wallet shape so downstream balanceOf calls have it.
        if (addr && wallet && !wallet.address) {
          setWallet((prev: any) => (prev ? { ...prev, address: addr } : prev));
        }
      })
      .catch((err) => {
        console.warn("StarkZap: failed to resolve address", err);
        setAddress(undefined);
      });
  }, [resolveAddress, wallet]);

  const refreshBalances = useCallback(async () => {
    if (!wallet || !tokens.length) return;

    // Dev mock wallet cannot fetch real onchain balances; surface placeholders.
    if (wallet.address === "0xDEV-MOCK-PRIVY") {
      setBalances(Object.fromEntries(tokens.map((t) => [t.symbol, "—"] as const)));
      return;
    }

    setIsFetchingBalances(true);
    try {
      await safeEnsureReady();

      const ownerAddress = address || (await resolveAddress());
      if (!ownerAddress) {
        console.warn("StarkZap: wallet address unavailable for balanceOf", address);
        setBalances(Object.fromEntries(tokens.map((t) => [t.symbol, "—"] as const)));
        return;
      }

      if (!wallet.address) {
        // Ensure address is present for wallet.balanceOf/erc20 paths.
        setWallet((prev: any) => (prev ? { ...prev, address: ownerAddress } : prev));
      }

      const entries = await Promise.all(
        tokens.map(async (token) => {
          try {
            const raw = wallet.balanceOf
              ? await wallet.balanceOf(token)
              : await wallet.erc20(token).balanceOf({ ...wallet, address: ownerAddress });

            // StarkZap balanceOf may already return Amount; normalize either way.
            const amount = raw instanceof Amount ? raw.toUnit() : Amount.fromRaw(raw as any, token).toUnit();
            return [token.symbol, amount] as const;
          } catch (err) {
            console.error(`Failed to load balance for ${token.symbol}`, err);
            return [token.symbol, "—"] as const;
          }
        })
      );
      setBalances(Object.fromEntries(entries));
    } catch (err) {
      console.error("Failed to load balances", err);
    } finally {
      setIsFetchingBalances(false);
    }
  }, [wallet, tokens, safeEnsureReady, address, resolveAddress]);

  useEffect(() => {
    refreshBalances();
  }, [refreshBalances]);

  const send = useCallback(
    async (token: Token, amount: string, to: string) => {
      if (!wallet) throw new Error("Connect wallet first");
      if (wallet.address === "0xDEV-MOCK-PRIVY") {
        throw new Error("Dev mock wallet cannot send; disable dev mode for real tx.");
      }
      const tx = await wallet.transfer(
        token,
        [
          {
            to: fromAddress(to),
            amount: Amount.parse(amount, token),
          },
        ],
        feeMode ? { feeMode } : undefined
      );
      return tx;
    },
    [wallet, feeMode]
  );

  return {
    sdk,
    wallet,
    address,
    status,
    error,
    tokens,
    balances,
    refreshBalances,
    isFetchingBalances,
    connect,
    disconnect,
    send,
    network,
    feeMode,
  };
}
