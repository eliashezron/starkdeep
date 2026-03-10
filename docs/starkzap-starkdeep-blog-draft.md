# How to Build Gasless Starknet Staking with StarkZap and Privy

If the goal is to show how easy it is to build on Starknet, `starkzap` makes a strong case.

With a small amount of TypeScript, you can implement:

- social login with Privy
- embedded Starknet wallets
- gas sponsorship with a paymaster
- validator discovery
- staking pool discovery
- staking, unstaking, and withdraw flows

without forcing users to think about seed phrases, wallet extensions, or gas.

That is the setup used here: Privy handles identity and server-side signing, while StarkZap handles wallet onboarding and staking flows.

## Why this feels simple

The flow is short:

1. Privy signs the user in
2. Privy creates a Starknet wallet on the backend
3. StarkZap onboards that wallet
4. The paymaster sponsors gas
5. StarkZap handles validators, pools, staking, unstaking, and withdraw

Most of the blockchain complexity stays inside `starkzap`.

## Install the packages

```bash
pnpm add starkzap @privy-io/react-auth @privy-io/node jose
```

## Environment variables

Use environment variables like this:

```bash
# Client
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id # Privy app ID from the Privy dashboard
NEXT_PUBLIC_STARKZAP_NETWORK=mainnet # Use mainnet or sepolia
NEXT_PUBLIC_STARKZAP_AVNU_KEY=your_avnu_paymaster_api_key # API key from AVNU paymaster portal
NEXT_PUBLIC_STARKZAP_AVNU_NODE=https://starknet.paymaster.avnu.fi # AVNU paymaster RPC URL
NEXT_PUBLIC_STARKZAP_FEE_MODE=sponsored # Use sponsored for gasless UX, or user for user-paid gas
NEXT_PUBLIC_STARKZAP_ACCOUNT_DEPLOYED=false # false if StarkZap should deploy when needed, true if already deployed

# Server
PRIVY_APP_ID=your_privy_app_id # Same Privy app ID used on the client
PRIVY_APP_SECRET=your_privy_app_secret # Privy app secret from the Privy dashboard
JWKS_ENDPOINT=https://auth.privy.io/api/v1/apps/your_privy_app_id/jwks.json # Replace with your Privy app JWKS endpoint
STARKZAP_NETWORK=mainnet # Use mainnet or sepolia
STARKZAP_AVNU_KEY=your_avnu_paymaster_api_key # API key from AVNU paymaster portal
STARKZAP_AVNU_NODE=https://starknet.paymaster.avnu.fi # AVNU paymaster RPC URL
STARKZAP_FEE_MODE=sponsored # Use sponsored for paymaster-backed transactions
```

---

## 1. Create embedded Starknet wallets with Privy

This part is straightforward.

When a user signs in with email OTP or Google, the backend can create a Starknet wallet for them with a single Privy API call:

```ts
import { PrivyClient } from "@privy-io/node";

const privy = new PrivyClient({
  appId: process.env.PRIVY_APP_ID!,
  appSecret: process.env.PRIVY_APP_SECRET!,
});

const wallet = await privy.wallets().create({
  chain_type: "starknet",
});

// wallet.id         -> used later for signing
// wallet.address    -> the Starknet address to store on the backend
// wallet.public_key -> required for StarkZap onboarding
```

The wallet is fully server-managed. The client never handles a private key, and the user never has to install or interact with a wallet extension.

When StarkZap needs a signature, the backend can ask Privy to sign the transaction hash:

```ts
const result = await privy.wallets().rawSign(wallet.id, {
  params: { hash },
});

return { signature: result.signature };
```

That is the full Privy role in this architecture:

- the user signs in
- the backend creates a Starknet wallet
- the backend signs transaction hashes
- StarkZap uses that wallet behind the scenes

This is exactly the kind of flow that makes a Starknet app feel familiar to web2 users.

---

## 2. Configure StarkZap with a paymaster

The paymaster is what makes the UX gasless. If an AVNU key is present, every StarkZap action can be sponsored.

```ts
import {
  StarkZap,
  type NetworkName,
} from "starkzap";

const network = (process.env.NEXT_PUBLIC_STARKZAP_NETWORK as NetworkName) || "mainnet";

const apiKey = process.env.NEXT_PUBLIC_STARKZAP_AVNU_KEY?.trim();
const nodeUrl = process.env.NEXT_PUBLIC_STARKZAP_AVNU_NODE?.trim();

const paymaster = apiKey
  ? { nodeUrl, headers: { "x-paymaster-api-key": apiKey } }
  : undefined;

const sdk = new StarkZap({ network, paymaster });
const feeMode = paymaster ? "sponsored" : undefined;
```

That setup is enough to remove the usual “fund the wallet first” step.

## 3. Onboard the Privy wallet into StarkZap

Once Privy has created the wallet, StarkZap can onboard it by resolving signer context from your backend.

```ts
import {
  OnboardStrategy,
  accountPresets,
} from "starkzap";

const { wallet } = await sdk.onboard({
  strategy: OnboardStrategy.Privy,
  privy: {
    resolve: async () => {
      const response = await fetch("/api/privy/signer-context", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const json = await response.json();
      return {
        ...json,
        headers: async () => ({ Authorization: `Bearer ${accessToken}` }),
      };
    },
  },
  accountPreset: accountPresets.argentXV050,
  feeMode,
  deploy: "if_needed",
});
```

The important pieces are:

- `strategy: OnboardStrategy.Privy` to tell StarkZap which wallet type to use
- `resolve()` to return `walletId`, `publicKey`, and the signing endpoint
- `feeMode` so the paymaster can sponsor transactions
- `deploy: "if_needed"` so the account can be deployed automatically on first use

At this point you have a usable, Privy-backed Starknet wallet.

---

## 4. Load validators

StarkZap ships validator presets for supported networks, so you do not need to manually curate validators yourself.

```ts
import { mainnetValidators, sepoliaValidators } from "starkzap";

const validators = Object.values(
  network === "mainnet" ? mainnetValidators : sepoliaValidators,
);

const validator = validators[0];
```

Each validator includes the `stakerAddress` you need for the next step.

## 5. Load staking pools

Once you have a validator, StarkZap can fetch its staking pools.

```ts
import { fromAddress } from "starkzap";

const pools = await sdk.getStakerPools(fromAddress(validator.stakerAddress));
const pool = pools[0];
```

Each pool gives you the contract and token metadata needed for staking.

---

## 6. Stake into a pool

Once you have a pool, staking is one call.

```ts
import { Amount } from "starkzap";

const amount = Amount.parse("1", pool.token);
const stakeTx = await wallet.stake(pool.poolContract, amount);
```

StarkZap builds and submits the transaction for you.

## 7. Unstake from a pool

Unstaking is also one call, but it starts the cooldown rather than withdrawing immediately.

```ts
const amount = Amount.parse("1", pool.token);
const unstakeTx = await wallet.exitPoolIntent(pool.poolContract, amount);
```

This is the “start withdrawal” step.

## 8. Withdraw after cooldown

After the cooldown period has passed, finalize the exit with:

```ts
const withdrawTx = await wallet.exitPool(pool.poolContract);
```

That completes the staking lifecycle.

## 9. Read the current staking position

To show the user what is currently staked, pending, or claimable, read the position directly from the wallet:

```ts
const position = await wallet.getPoolPosition(pool.poolContract);
```

That position can include values like `staked`, `rewards`, `unpooling`, `total`, and `unpoolTime`.

---

## 10. Why StarkZap makes this easy

What makes this setup compelling is not just that staking works.

It is that the entire developer flow stays high-level:

- Privy handles auth and server-side signing
- StarkZap handles onboarding and paymaster integration
- StarkZap exposes validators and pools
- StarkZap gives you `stake()`, `exitPoolIntent()`, `exitPool()`, and `getPoolPosition()`

So instead of wiring together multiple low-level primitives, you mostly work with a single SDK.

That is what makes this a good story for Medium: advanced Starknet functionality can look like normal product code.

## Conclusion

If you want to build a Starknet app that feels simple to users and simple to developers, this stack is hard to beat.

With `starkzap`, `@privy-io/react-auth`, `@privy-io/node`, and a paymaster, you can implement:

- social login
- embedded wallets
- gasless transactions
- validator discovery
- staking pool discovery
- staking, unstaking, and withdraw flows

And you can do it with a surprisingly small amount of readable TypeScript.

That is the real value of StarkZap: it turns advanced Starknet workflows into normal application development.
