"use client";

import { useEffect, useMemo, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useStarkZap } from "./useStarkZap";
import type { Token } from "starkzap";

const fallbackTokens = [
  { symbol: "STRK", name: "Starknet", balance: "1,240", fiat: "$2,480", change: "+3.2%", numericFiat: 2480 },
  { symbol: "USDC", name: "USD Coin", balance: "4,200", fiat: "$4,200", change: "+0.2%", numericFiat: 4200 },
  { symbol: "strkBTC", name: "Stark Bitcoin", balance: "0.10", fiat: "$6,500", change: "+1.4%", numericFiat: 6500 },
  { symbol: "wBTC", name: "Wrapped Bitcoin", balance: "0.05", fiat: "$3,250", change: "+0.8%", numericFiat: 3250 },
] as const;

const usdPriceBook: Record<string, number> = {
  strk: 2.0,
  usdc: 1.0,
  strkbtc: 65000,
  wbtc: 65000,
};

export type TokenView = {
  symbol: string;
  name: string;
  balance: string;
  fiat: string;
  change: string;
  numericFiat?: number;
};

export function useZapWallet() {
  const { login, logout, authenticated, getAccessToken } = usePrivy();
  const [accessToken, setAccessToken] = useState("");
  const [autoConnectRequested, setAutoConnectRequested] = useState(false);

  const zap = useStarkZap(accessToken);
  const { connect, status, address, tokens, balances } = zap;

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
        status === "ready" ||
        status === "connecting" ||
        status === "error"
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
  }, [authenticated, accessToken, status, connect]);

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

    const source = tokens && Array.isArray(tokens)
      ? tokens.map((t: Token) => {
          const balanceStr = balances?.[t.symbol] ?? "—";
          const balanceNum = balanceStr && balanceStr !== "—" ? Number(balanceStr) : 0;
          const price = usdPriceBook[t.symbol.toLowerCase()] ?? 0;
          const numericFiat = Number.isFinite(balanceNum) && price ? balanceNum * price : 0;
          const item: TokenView = {
            symbol: t.symbol,
            name: t.name,
            balance: balanceStr,
            fiat: price ? `$${numericFiat.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—",
            change: "",
            numericFiat,
          };
          return item;
        })
      : [...fallbackTokens];

    const filtered = source.filter((t) => allowList.has(t.symbol.toLowerCase()));
    return filtered.length
      ? filtered.map((t) => ({ ...t, numericFiat: t.numericFiat ?? parseFiat(t.fiat) }))
      : [...fallbackTokens];
  }, [tokens, balances]);

  const totalFiat = useMemo(() => {
    const total = tokenDisplay.reduce((sum, t) => sum + (t.numericFiat ?? 0), 0);
    return total ? `$${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "$0.00";
  }, [tokenDisplay]);

  return {
    ...zap,
    login,
    logout,
    authenticated,
    accessToken,
    autoConnectRequested,
    shortAddress,
    tokenDisplay,
    totalFiat,
  };
}
