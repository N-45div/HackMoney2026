# NitroBridge Vault

NitroBridge Vault is a HackMoney 2026 build that fuses Arc/Circle infrastructure, Yellow Nitrolite sessions, Uniswap v4 hooks, and ENS-driven credit policies to deliver instant margin refills for cross-chain treasuries.

This repository is structured as a workspace that will eventually host:
- smart contracts for Arc (credit line) and Uniswap v4 (stealth top-up hook)
- a backend orchestrator that talks to Yellow SDK, monitors borrower health, and drives Circle Bridge Kit flows
- a frontend console for operators and borrowers (coming later)

## Problem Statement
Treasury teams that extend revolving credit across multiple EVM chains are stuck with:

1. **Slow approvals** – human-in-the-loop bridging every top-up exposes traders to liquidation risk.
2. **MEV leakage** – sourcing liquidity on-chain reveals order size and timing.
3. **Compliance debt** – risk/compliance teams can’t audit why or how credit was extended.

NitroBridge Vault solves this by:

- capturing credit policies in ENS TXT records (human-readable + cryptographic anchor),
- securing borrower approvals inside Yellow Nitrolite sessions so commitments are instant but private,
- executing stealth top-ups via a Uniswap v4 hook (commit–reveal TWAP), and
- settling funds on Arc testnet via Circle Bridge Kit directly into an Arc credit contract that emits ENS-tagged attestations.

## Architecture Overview

```
Borrower ENS Profile ─┐
                      │ ENS text records (risk params, policy hash)
Yellow Session Client ┼─> Session approvals / allowances (Nitrolite Canary)
                      │
Backend Agent         ├─> Watches ENS + Arc credit state, triggers rebalances
    ↳ Uniswap v4 Hook ─ execute stealth swaps on Base/Sepolia pools
    ↳ Circle Bridge Kit ─ bridge USDC → Arc testnet + call credit contract
Arc Credit Contract ──┘ emits events with ENS policy hash + new debt snapshot
```

## Repo Layout

```
arc-credit-terminal/
├── contracts/
│   ├── arc-credit/         # Foundry project for Arc credit manager
│   └── uniswap-hook/       # Foundry project for StealthTopUpHook
├── backend/                # Node/TS orchestrator (Yellow + Circle + ENS)
└── README.md
```

## Current Status
- ✅ Git + remote established: https://github.com/N-45div/NitroBridge-Vault
- ✅ Arc credit contract skeleton (`ArcCredit.sol`) with ENS-hash tagging and Bridge Kit events
- ✅ Backend workspace + dependency install (Yellow SDK 1.0.7, ENSJS, ethers, viem)
- 🚧 Uniswap v4 hook + backend orchestration + frontend console

## Roadmap
1. **Backend agent**: implement ENS policy fetch, Yellow session bootstrap, Circle Bridge Kit handler, health monitor loop.
2. **Uniswap hook**: Foundry project with commit–reveal TWAP + tests targeting Base Sepolia.
3. **Frontend**: Next.js console for borrowers/operators (ENS settings, session approvals, debt dashboard).
4. **Docs & Demo**: architecture diagram, testnet instructions, video script.

## Testnet Targets
- **Yellow**: Canary testnet for Nitrolite sessions.
- **Uniswap v4**: Base / Sepolia testnet pools using the v4 template.
- **Arc / Circle**: Arc public testnet + Bridge Kit sample (CCTP path from Base Sepolia).
- **ENS**: Sepolia ENS deployment for TXT/content-hash writes.

## Contribution
This repo is currently single-maintainer (hacking solo). Please open issues for questions or potential collabs aligned with HackMoney sponsor tracks.
