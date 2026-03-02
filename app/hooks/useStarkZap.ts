"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Amount,
  ChainId,
  OnboardStrategy,
  StarkZap,
  accountPresets,
  fromAddress,
  getPresets,
  type NetworkName,
  type Token,
} from "starkzap";

// Client-side Privy onboarding per StarkZap docs.
export function useStarkZap(accessToken?: string) {
  const [sdk, setSdk] = useState<StarkZap | null>(null);
  const [wallet, setWallet] = useState<any>(null);
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

  const feeMode = (paymaster ? "sponsored" : "user") as const;

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
        deploy: "if_needed",
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
    const chain = wallet?.getChainId?.();
    const presets = chain
      ? getPresets(chain as ChainId)
      : getPresets(network === "mainnet" ? ChainId.MAINNET : ChainId.SEPOLIA);
    return Object.values(presets);
  }, [wallet, network]);

  const address = wallet?.address?.toString?.();

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
        { feeMode }
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
    connect,
    disconnect,
    send,
    network,
    feeMode,
  };
}
