# NitroBridge Vault — Technical Architecture

> Deep technical documentation. No separate backend — everything runs inside a single Next.js deployment.

## Design Principle

All blockchain interactions (reads, writes, WebSocket state channels) originate from React components via wagmi/viem in the browser. The only server-side code is a single Next.js API route (`/api/agent`) that proxies an LLM call. The `backend/` directory contains standalone reference scripts that are **not used** by the running application.

## System Architecture

```mermaid
graph TB
    subgraph Frontend["Next.js Frontend (Vercel)"]
        direction TB
        PAGE["page.tsx — Tab Router"]
        CD[CreditDashboard.tsx<br/>Credit info + AI Agent + Yellow metering]
        DEP[MarginTopUp.tsx<br/>Deposit USDC → credit line]
        BR[BorrowRepay.tsx<br/>Borrow / Repay on Arc]
        CCTP_UI[CCTPBridge.tsx<br/>Burn → Attest → Mint]
        YC[YellowChannel.tsx<br/>WebSocket auth + sessions + metering]
        MEV[AntiSniperSwap.tsx<br/>Commit → Reveal → Swap]
        API["/api/agent route<br/>(OpenRouter LLM)"]
    end

    subgraph Arc["Arc Testnet (5042002)"]
        ACT[ArcCreditTerminal.sol<br/>0xd1835d13...aae5]
        USDC_A[USDC<br/>0x3600...0000]
        TM_A[TokenMessengerV2]
        MT_A[MessageTransmitterV2]
    end

    subgraph Sepolia["Ethereum Sepolia (11155111)"]
        HOOK[AntiSniperHook.sol<br/>0x0A3b...540c0]
        PM[PoolManager v4<br/>0xE03A...1074]
        PST[PoolSwapTest<br/>0x9B6b...eEe]
        USDC_S[USDC<br/>0x1c7D...7238]
        TM_S[TokenMessengerV2]
    end

    subgraph Yellow["Yellow ClearNode (Sandbox)"]
        WS["wss://clearnet-sandbox.yellow.com/ws"]
        SC[ERC-7824 Nitrolite<br/>State Channels]
    end

    CD --> API
    CD --> ACT
    DEP --> ACT
    BR --> ACT
    CCTP_UI --> TM_S
    CCTP_UI --> MT_A
    YC --> WS
    MEV --> HOOK
    MEV --> PST
    HOOK --> PM
    TM_S -.->|Circle Attestation| TM_A
```

## Deployed Contracts

| Contract | Network | Address | Tx |
|----------|---------|---------|-----|
| **ArcCreditTerminal** | Arc Testnet | `0xd1835d13A9694F0E9329FfDE9b18936CE872aae5` | [Deploy](https://testnet.arcscan.app/tx/0xf30bfc37a23013a8f68d2b5375f5f5b19ddc5934b889923d91ba91462b61970f) |
| **AntiSniperHook** | Eth Sepolia | `0x0A3b821941789AC5Ff334AB6C374bb23C98540c0` | [Deploy](https://sepolia.etherscan.io/tx/0x3f495bb7d3b34ae58d1165bd1941083455afa28e89313463e13a10479247cebd) |
| ETH/USDC Pool (v4) | Eth Sepolia | `0x825ea1...63e5` | [Init](https://sepolia.etherscan.io/tx/0x77e97d786e38e1665c5cce44a8c3b24daffe953069d4497042f36ce1e4c182a3) |
| PoolManager v4 | Eth Sepolia | `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543` | Uniswap |
| PoolSwapTest | Eth Sepolia | `0x9B6b46e2c869aa39918Db7f52f5557FE577B6eEe` | Uniswap |
| USDC | Arc Testnet | `0x3600000000000000000000000000000000000000` | Native |
| TokenMessengerV2 | Eth Sepolia | `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA` | Circle |
| TokenMessengerV2 | Arc Testnet | `0xb43db544E2c27092c107639Ad201b3dEfAbcF192` | Circle |
| MessageTransmitterV2 | Arc Testnet | `0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275` | Circle |

## End-to-End Flow

```mermaid
sequenceDiagram
    participant User
    participant UI as Browser (wagmi + viem)
    participant Agent as /api/agent (OpenRouter)
    participant ACT as ArcCreditTerminal
    participant YN as Yellow ClearNode
    participant CCTP as Circle CCTP v2
    participant Hook as AntiSniperHook

    User->>UI: 1. Deposit USDC
    UI->>ACT: depositToCreditLine(amount, ensHash)
    ACT-->>User: Credit line opened

    User->>UI: 2. Run AI Risk Agent
    UI->>Agent: POST /api/agent (creditInfo)
    Agent->>Agent: Analyze utilization
    Agent-->>UI: { action: TOP_UP, amount: 10 }
    UI->>ACT: agentTopUp(user, 10 USDC)
    ACT-->>User: Margin restored

    User->>UI: 3. Connect Yellow Network
    UI->>YN: WebSocket + EIP-712 auth
    YN-->>User: Authenticated

    User->>UI: 4. Create Payment Session
    UI->>YN: createAppSessionMessage
    YN-->>User: Session ID + allocations

    User->>UI: 5. Instant Transfer
    UI->>YN: signed metering intent
    YN-->>User: Confirmed (<100ms, $0 gas)

    User->>UI: 6. Bridge USDC (Sepolia → Arc)
    UI->>CCTP: approve + depositForBurn on Sepolia
    CCTP->>CCTP: Circle attestation (~30-60s)
    UI->>ACT: receiveMessage on Arc
    ACT-->>User: USDC minted on Arc

    User->>UI: 7. MEV-Protected Swap
    UI->>Hook: commit(hash, poolId)
    Hook-->>User: Commitment stored
    Note over Hook: Wait 1+ block (MIN_COMMITMENT_AGE)
    UI->>Hook: reveal(amount, nonce, poolKey)
    Hook-->>User: Reveal verified
    UI->>Hook: PoolSwapTest.swap(key, params, hookData)
    Hook-->>User: Swap executed (MEV-protected)
```

## Smart Contract Details

### ArcCreditTerminal.sol

```mermaid
classDiagram
    class ArcCreditTerminal {
        +IERC20 usdc
        +uint256 COLLATERAL_RATIO
        +uint256 LIQUIDATION_THRESHOLD
        +mapping~address-CreditLine~ creditLines
        +mapping~address-bool~ authorizedAgents
        +depositToCreditLine(uint256 amount, bytes32 ensHash)
        +requestMarginTopUp(uint256 amount)
        +agentTopUp(address user, uint256 amount)
        +settleCredit(uint256 amount)
        +receiveCCTP(uint256 amount, bytes32 messageHash)
        +addAuthorizedAgent(address agent)
        +removeAuthorizedAgent(address agent)
        +getCreditInfo(address user) CreditLine
        +getAvailableCredit(address user) uint256
    }

    class CreditLine {
        +uint256 deposited
        +uint256 borrowed
        +uint256 creditLimit
        +uint256 lastUpdate
        +bytes32 ensHash
    }

    ArcCreditTerminal "1" --> "*" CreditLine : manages
```

**Inherits:** OpenZeppelin `ReentrancyGuard`, `Ownable`

### AntiSniperHook.sol

```mermaid
classDiagram
    class AntiSniperHook {
        +IPoolManager poolManager
        +uint256 REVEAL_DELAY = 2
        +uint256 MIN_COMMITMENT_AGE = 1
        +mapping~address-mapping-PoolId-Commitment~~ commitments
        +mapping~address-mapping-PoolId-uint256~~ revealedAmounts
        +commit(bytes32 hash, PoolId poolId)
        +reveal(uint256 amount, uint256 nonce, PoolKey key)
        +generateCommitmentHash(uint256, uint256, address) bytes32
        +getCommitment(address, PoolId) Commitment
        +_beforeSwap() enforces REQUIRE_COMMIT
        +_afterSwap() clears commitment
    }

    class Commitment {
        +bytes32 hash
        +uint256 blockNumber
        +bool revealed
    }

    AntiSniperHook "1" --> "*" Commitment : tracks
```

**Inherits:** Uniswap v4 `BaseHook`
**Hook permissions:** `beforeSwap: true`, `afterSwap: true` (all others false)

## Frontend Component Map

```mermaid
graph TD
    subgraph "App Shell"
        LAYOUT[layout.tsx<br/>Providers: AppKit + Wagmi + QueryClient]
        PAGE[page.tsx<br/>Tab router + landing]
    end

    subgraph "Components"
        CW[ConnectWallet.tsx<br/>Reown AppKit modal]
        NS[NetworkStatus.tsx<br/>Arc + Sepolia + Yellow status]
        CF[ChainFlow.tsx<br/>Visual cross-chain diagram]
        CD[CreditDashboard.tsx<br/>Credit info + AI agent + metering]
        MT[MarginTopUp.tsx<br/>USDC approve + deposit]
        BR[BorrowRepay.tsx<br/>Borrow / repay on Arc]
        CB[CCTPBridge.tsx<br/>Full CCTP v2 bridge]
        YC[YellowChannel.tsx<br/>WebSocket + Nitrolite SDK]
        AS[AntiSniperSwap.tsx<br/>Commit-reveal-swap]
    end

    subgraph "Lib"
        CONTRACTS[contracts.ts<br/>ABIs + addresses + chain defs]
        WAGMI[wagmi-config.ts<br/>WagmiAdapter + networks]
        PROV[providers.tsx<br/>AppKit + WagmiProvider]
    end

    LAYOUT --> PROV
    PAGE --> CW
    PAGE --> NS
    PAGE --> CF
    PAGE --> CD
    PAGE --> MT
    PAGE --> BR
    PAGE --> CB
    PAGE --> YC
    PAGE --> AS
    CD --> CONTRACTS
    MT --> CONTRACTS
    BR --> CONTRACTS
    CB --> CONTRACTS
    AS --> CONTRACTS
    PROV --> WAGMI
```

## Yellow Nitrolite Integration

```mermaid
sequenceDiagram
    participant Browser as YellowChannel.tsx
    participant SDK as @erc7824/nitrolite v0.5.3
    participant CN as Yellow ClearNode

    Browser->>CN: WebSocket connect
    Browser->>SDK: createAuthRequestMessage()
    SDK-->>Browser: auth_request payload
    Browser->>CN: Send auth_request
    CN-->>Browser: EIP-712 challenge
    Browser->>SDK: createEIP712AuthMessageSigner(walletClient)
    SDK-->>Browser: Signed challenge
    Browser->>CN: Send auth_verify
    CN-->>Browser: Authenticated

    Browser->>SDK: createAppSessionMessage(sessionKey, params)
    SDK->>CN: app_session
    CN-->>Browser: Session ID + allocations

    Note over Browser,CN: Off-chain metering
    Browser->>SDK: createECDSAMessageSigner(sessionPK)
    Browser->>Browser: Sign meter intent (localStorage)
    Browser->>Browser: Dispatch nitrobridge:meter_events_updated
```

## Circle CCTP v2 Bridge

```mermaid
sequenceDiagram
    participant Browser as CCTPBridge.tsx
    participant Sepolia as TokenMessengerV2 (Sepolia)
    participant Circle as Circle Attestation API
    participant Arc as MessageTransmitterV2 (Arc)

    Browser->>Sepolia: approve(TokenMessenger, amount)
    Browser->>Sepolia: depositForBurn(amount, arcDomain=26, recipient, usdc)
    Sepolia-->>Browser: MessageSent event (message, messageHash)

    loop Poll every 5s
        Browser->>Circle: GET /v2/attestations/{messageHash}
        Circle-->>Browser: status: pending
    end

    Circle-->>Browser: status: complete, attestation: 0x...

    Note over Browser: Switch wallet to Arc Testnet
    Browser->>Arc: receiveMessage(message, attestation)
    Arc-->>Browser: USDC minted on Arc
```

## AI Risk Agent

```mermaid
flowchart TD
    CD[CreditDashboard.tsx] -->|POST creditInfo| API["/api/agent route"]
    API --> LLM{OpenRouter API<br/>nvidia/nemotron-nano-9b-v2}
    LLM -->|JSON| API
    API -->|action + reason + amount| CD

    API --> FB{No API key?}
    FB -->|Yes| RULE[Rule-based fallback<br/>utilization > 50% = TOP_UP]
    RULE --> CD

    CD -->|TOP_UP decision| TX[agentTopUp on-chain]
    CD -->|MONITOR decision| NOOP[Display status only]
    CD -->|Always| METER[Sign Yellow meter receipt<br/>via session key in localStorage]
```

**Request:**
```json
{
  "userAddress": "0x...",
  "creditInfo": {
    "deposited": "10000000",
    "borrowed": "7000000",
    "creditLimit": "10000000",
    "available": "3000000"
  }
}
```

**Response:**
```json
{
  "action": "TOP_UP",
  "reason": "Utilization is 70%, exceeding safety threshold.",
  "amount": "100"
}
```

## Data Flow

```mermaid
flowchart TD
    A[Trader deposits USDC] --> B[ArcCreditTerminal]
    B --> C{AI Agent analyzes}
    C -->|Healthy| D[Continue monitoring]
    C -->|High utilization| E[agentTopUp on-chain]
    E --> F[Credit line updated]

    B --> G[Yellow State Channel]
    G --> H[Signed metering intents<br/>stored in localStorage]

    B --> I[Circle CCTP v2 Bridge]
    I --> J[Burn on Sepolia → Mint on Arc]

    B --> K[Uniswap v4 Hook]
    K --> L[commit hash]
    L --> M[Wait 1+ block]
    M --> N[reveal amount + nonce]
    N --> O[PoolSwapTest.swap with REQUIRE_COMMIT]
```

## Technology Stack

```mermaid
mindmap
  root((NitroBridge Vault))
    Frontend
      Next.js 16
      Wagmi v3
      Viem v2
      Tailwind CSS v4
      Framer Motion
      Reown AppKit
    AI Agent
      OpenRouter API
      nvidia nemotron-nano-9b-v2
      Next.js API Route
      Rule-based fallback
    Smart Contracts
      Solidity 0.8.26
      Foundry
      OpenZeppelin
      Uniswap v4 BaseHook
      HookMiner CREATE2
    Integrations
      erc7824 nitrolite v0.5.3
      Circle CCTP v2
      WebSocket API
    Networks
      Arc Testnet 5042002
      Ethereum Sepolia 11155111
      Yellow Sandbox
```

## Security Model

```mermaid
flowchart TB
    subgraph "Access Control"
        A[Contract Owner] --> B[addAuthorizedAgent]
        A --> C[removeAuthorizedAgent]
        D[Authorized Agent only] --> E[agentTopUp]
    end

    subgraph "On-chain Safety"
        F[ReentrancyGuard] --> G[All state-changing functions]
        H[COLLATERAL_RATIO check] --> I[Prevents over-borrowing]
        J[LIQUIDATION_THRESHOLD] --> K[Enforces minimum margin]
    end

    subgraph "MEV Protection"
        L[commit hash] --> M[Amount hidden on-chain]
        N[MIN_COMMITMENT_AGE = 1 block] --> O[Prevents same-block reveal]
        P[beforeSwap checks revealed flag] --> Q[Swap reverts without valid reveal]
    end

    subgraph "Cross-chain"
        R[Circle attestation] --> S[Every CCTP transfer validated]
        T[EIP-712 signatures] --> U[Yellow auth + state channels]
    end
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Yes | WalletConnect / Reown project ID |
| `OPENROUTER_API_KEY` | No* | OpenRouter API key for LLM agent |

*Agent falls back to rule-based logic (>50% utilization = TOP_UP) if no key is set.

## Contract ABIs

All ABIs are embedded in `frontend/lib/contracts.ts` for zero-config deployment — no external ABI files or build steps needed.
