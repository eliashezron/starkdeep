import {
  Amount,
  ChainId,
  OnboardStrategy,
  StarkSigner,
  StarkZap,
  accountPresets,
  fromAddress,
  getPresets,
  type NetworkName,
  type Token,
} from "starkzap";

const network = (process.env.STARKZAP_NETWORK as NetworkName) || "mainnet";
const signerKey = process.env.STARKZAP_SIGNER_KEY?.trim();

const paymaster = (() => {
  const forceUser = process.env.STARKZAP_FEE_MODE === "user";
  if (forceUser) return undefined;
  const apiKey = process.env.STARKZAP_AVNU_KEY?.trim();
  const nodeUrl = process.env.STARKZAP_AVNU_NODE?.trim();
  if (!apiKey) return undefined;
  return nodeUrl ? { nodeUrl, apiKey } : { apiKey };
})();

const feeMode: "sponsored" | "user" = paymaster ? "sponsored" : "user";

const sdk = new StarkZap({ network, paymaster });

let walletPromise: Promise<any> | null = null;

export async function getSignerWallet() {
  if (!signerKey) throw new Error("STARKZAP_SIGNER_KEY missing");
  if (!walletPromise) {
    walletPromise = sdk
      .onboard({
        strategy: OnboardStrategy.Signer,
        account: { signer: new StarkSigner(signerKey) },
        accountPreset: accountPresets.argentXV050,
        deploy: "if_needed",
        feeMode,
      })
      .then((res) => res.wallet);
  }
  return walletPromise;
}

export function listTokens(chainId?: ChainId): Token[] {
  const presets = chainId
    ? getPresets(chainId)
    : getPresets(network === "mainnet" ? ChainId.MAINNET : ChainId.SEPOLIA);
  return Object.values(presets);
}

export function findToken(symbol: string, chainId?: ChainId): Token | undefined {
  return listTokens(chainId).find((t) => t.symbol === symbol);
}

export async function transferWithSigner(symbol: string, amount: string, to: string) {
  const wallet = await getSignerWallet();
  const chainId = wallet.getChainId?.();
  const token = findToken(symbol, chainId);
  if (!token) throw new Error(`Token ${symbol} not found for signer network`);

  return wallet.transfer(
    token,
    [
      {
        to: fromAddress(to),
        amount: Amount.parse(amount, token),
      },
    ],
    { feeMode }
  );
}

export function getNetwork(): NetworkName {
  return network;
}

export function getFeeMode() {
  return feeMode;
}
