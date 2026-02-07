# NitroBridge Vault - Technical Architecture

> Deep technical documentation for the NitroBridge Vault system

## Deployed Infrastructure

| Component | Address | Network | Block |
|-----------|---------|---------|-------|
| **ArcCreditTerminal** | `0xd1835d13A9694F0E9329FfDE9b18936CE872aae5` | Arc Testnet | 25322657 |
| USDC Token | `0x3600000000000000000000000000000000000000` | Arc Testnet | Native |
| TokenMessenger | `0xb43db544E2c27092c107639Ad201b3dEfAbcF192` | Arc Testnet | Circle |
| MessageTransmitter | `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA` | Arc Testnet | Circle |

## System Architecture

```mermaid
graph TB
    subgraph "User Layer"
        UI[Web App - Next.js]
        CD[Credit Dashboard]
        MT[Margin Top-up UI]
        BM[Bridge Monitor]
    end

    subgraph "AI Agent Layer"
        API[Next.js API Route<br/>/api/agent]
        LLM[OpenRouter LLM<br/>Llama 3 8B]
    end

    subgraph "Smart Contracts - Arc Testnet"
        ACT[ArcCreditTerminal.sol<br/>0xd1835d13...aae5]
        ASH[AntiSniperHook.sol<br/>Uniswap v4 on Sepolia]
    end

    subgraph "Integration Layer"
        YN[Yellow Nitrolite SDK]
        CC[Circle CCTP]
    end

    subgraph "Cross-Chain Layer"
        ES[Ethereum Sepolia<br/>Chain ID: 11155111]
        AT[Arc Testnet<br/>Chain ID: 5042002]
    end

    UI --> CD
    UI --> MT
    UI --> BM
    CD --> API
    API --> LLM
    LLM --> API
    API --> ACT
    CD --> ACT
    MT --> YN
    BM --> CC
    YN --> ACT
    CC --> ES
    CC --> AT
    ACT --> ASH
```

## End-to-End Flow (Actual Implementation)

```mermaid
sequenceDiagram
    participant User
    participant UI as Web App
    participant Agent as LLM Agent (OpenRouter)
    participant ACT as ArcCreditTerminal
    participant YN as Yellow ClearNode
    participant CCTP as Circle CCTP
    participant Hook as AntiSniperHook

    User->>UI: 1. Deposit USDC
    UI->>ACT: depositToCreditLine(amount)
    ACT-->>User: Credit line opened ✓
    
    User->>UI: 2. Trigger AI Agent
    UI->>Agent: POST /api/agent (creditInfo)
    Agent->>Agent: Analyze utilization vs thresholds
    Agent-->>UI: { action: TOP_UP, amount: 10 }
    UI->>ACT: agentTopUp(user, 10 USDC)
    ACT-->>User: Margin restored ✓
    
    User->>UI: 3. Connect to Yellow Network
    UI->>YN: WebSocket + Auth (EIP-712)
    YN-->>User: Authenticated ✓
    
    User->>UI: 4. Create Payment Session
    UI->>YN: createAppSessionMessage
    YN-->>User: Session ID + allocations ✓
    
    User->>UI: 5. Send Instant Transfer
    UI->>YN: createTransferMessage
    YN-->>User: Transfer confirmed (<100ms, $0 gas) ✓
    
    User->>UI: 6. Bridge USDC from Sepolia
    UI->>CCTP: depositForBurn on Sepolia
    CCTP->>CCTP: Attestation (30-60s)
    UI->>ACT: receiveMessage on Arc
    ACT-->>User: USDC minted on Arc ✓
    
    User->>UI: 7. MEV-Protected Swap
    UI->>Hook: commit(hash)
    Hook-->>User: Commitment stored ✓
    Note over Hook: Wait 1 block minimum
    UI->>Hook: reveal(amount, nonce)
    Hook-->>User: Reveal verified ✓
    UI->>Hook: PoolManager.swap(key, params, REQUIRE_COMMIT)
    Hook-->>User: Swap executed (MEV-protected) ✓
```

## Component Architecture

```mermaid
graph LR
    subgraph "Arc Credit Terminal"
        A[deposit]
        B[borrow]
        C[agentTopUp]
        D[settleCredit]
        E[receiveCCTP]
    end

    subgraph "Yellow Integration"
        F[createSession]
        G[offChainTransfer]
        H[settleOnChain]
    end

    subgraph "Uniswap v4 Hook"
        I[commit]
        J[reveal]
        K[beforeSwap]
        L[afterSwap]
    end

    subgraph "Circle CCTP"
        M[depositForBurn]
        N[fetchAttestation]
        O[receiveMessage]
    end

    A --> F
    C --> G
    G --> H
    H --> E
    E --> I
    I --> J
    J --> K
    K --> L
    D --> M
    M --> N
    N --> O
    O --> E
```

## Data Flow

```mermaid
flowchart TD
    A[Trader deposits USDC] --> B[Arc Credit Terminal]
    B --> C{LLM Agent Analyzes}
    C -->|Healthy| D[Continue Trading]
    C -->|Low Margin| E[Agent Decision: TOP_UP]
    E --> F[agentTopUp on-chain]
    F --> G[Credit Line Updated]
    B --> H[Yellow State Channel]
    H --> I[Instant Off-chain Transfer]
    B --> J[Circle CCTP Bridge]
    J --> K[Cross-chain USDC]
    B --> L[Uniswap v4 Hook]
    L --> M[Commit → Reveal → Swap]
    M --> N[MEV-Protected Execution]
```

## Technology Stack

```mermaid
mindmap
  root((NitroBridge<br/>Vault))
    Frontend
      Next.js 14
      Wagmi v2
      Viem
      TailwindCSS
    AI Agent
      OpenRouter API
      Llama 3 8B
      Next.js API Routes
      JSON Structured Output
    Smart Contracts
      Arc Testnet
      Uniswap v4 Hooks
      Foundry
      OpenZeppelin
    Integrations
      Yellow Nitrolite
      Circle CCTP
      WebSocket API
    Networks
      Arc 5042002
      Sepolia 11155111
      Yellow Sandbox
```

## Deployment Architecture

```mermaid
graph TB
    subgraph "Testnet Infrastructure"
        subgraph "Arc Testnet (5042002)"
            A1[ArcCreditTerminal.sol<br/>0xd1835d13...aae5]
            A2[AntiSniperHook.sol]
            A3[PoolManager v4]
            A4[USDC 0x3600...]
        end

        subgraph "Ethereum Sepolia (11155111)"
            S1[CCTP TokenMessenger<br/>0x9f3B...dB96]
            S2[CCTP MessageTransmitter<br/>0x7865...3388]
            S3[USDC 0x1c7D...7238]
        end

        subgraph "Yellow Sandbox"
            Y1[ClearNode WebSocket]
            Y2[State Channel Manager]
        end
    end

    subgraph "AI Agent (Server-side)"
        B1[Next.js API Route<br/>/api/agent]
        B3[OpenRouter LLM<br/>Llama 3 8B]
    end

    A1 <-->|CCTP| S1
    A2 --> A3
    B1 --> B3
    B3 --> B1
    B1 --> A1
```

## Smart Contract Details

### ArcCreditTerminal.sol

```mermaid
classDiagram
    class ArcCreditTerminal {
        +IERC20 usdc
        +mapping~address,CreditLine~ creditLines
        +mapping~address,bool~ authorizedAgents
        +deposit(uint256 amount) external
        +borrow(uint256 amount) external
        +agentTopUp(address user, uint256 amount) external
        +settleCredit(uint256 amount) external
        +receiveCCTP(uint256 amount, bytes32 messageHash) external
        +authorizeAgent(address agent) external
        +revokeAgent(address agent) external
    }

    class CreditLine {
        +uint256 limit
        +uint256 borrowed
        +uint256 lastActivity
    }

    ArcCreditTerminal "1" --> "*" CreditLine : manages
```

### AntiSniperHook.sol

```mermaid
classDiagram
    class AntiSniperHook {
        +IPoolManager poolManager
        +mapping~bytes32,Commitment~ commitments
        +uint256 COMMIT_DEADLINE
        +commit(bytes32 hash) external
        +reveal(uint256 amount, bytes32 salt) external
        +beforeSwap(PoolKey, SwapParams) returns(bytes4)
        +afterSwap(PoolKey, SwapParams, BalanceDelta) returns(bytes4)
        +getHookPermissions() returns(Hooks.Permissions)
    }

    class Commitment {
        +bytes32 hash
        +uint256 timestamp
        +address trader
        +bool revealed
    }

    AntiSniperHook "1" --> "*" Commitment : tracks
```

## Yellow Nitrolite Integration

```mermaid
sequenceDiagram
    participant Trader
    participant SDK as @erc7824/nitrolite
    participant ClearNode as Yellow ClearNode
    participant Contract as ArcCreditTerminal

    Note over Trader,SDK: Initialize SDK
    Trader->>SDK: createAppSessionMessage(params)
    SDK->>ClearNode: WebSocket: app_session
    ClearNode-->>SDK: Session created
    SDK-->>Trader: sessionId

    Note over Trader,ClearNode: Off-chain transfers
    Trader->>SDK: createTransferMessage(amount)
    SDK->>ClearNode: WebSocket: transfer
    ClearNode-->>SDK: State updated
    SDK-->>Trader: newBalance

    Note over Trader,Contract: Settlement
    Trader->>SDK: createSettlementMessage()
    SDK->>ClearNode: WebSocket: settle
    ClearNode->>Contract: settleOnChain(finalState)
    Contract-->>Trader: Balances finalized
```

## Circle CCTP Integration

```mermaid
sequenceDiagram
    participant User
    participant Sepolia as TokenMessenger (Sepolia)
    participant Circle as Circle Attestation API
    participant Arc as MessageTransmitter (Arc)

    User->>Sepolia: approve(messenger, amount)
    User->>Sepolia: depositForBurn(amount, 10, recipient, usdc)
    Sepolia-->>User: MessageSent(message, hash)

    Note over User,Circle: Wait for attestation (~30-60s)

    loop Poll attestation
        User->>Circle: GET /attestations/{hash}
        Circle-->>User: {status: "pending"}
    end
    
    Circle-->>User: {status: "complete", attestation: "0x..."}

    User->>Arc: receiveMessage(message, attestation)
    Arc-->>User: USDC minted on Arc
```

## Security Model

```mermaid
flowchart TB
    subgraph "Access Control"
        A[Owner] --> B[authorizeAgent]
        A --> C[revokeAgent]
        D[Authorized Agent] --> E[agentTopUp]
    end

    subgraph "Safety Mechanisms"
        F[ReentrancyGuard] --> G[All external calls]
        H[CCTP Attestation] --> I[Cross-chain messages]
        J[Commit-Reveal] --> K[Order privacy]
    end

    subgraph "State Protection"
        L[Credit limits] --> M[Prevent over-borrowing]
        N[Nonce tracking] --> O[Prevent replay]
    end
```

## API Reference

### LLM Agent API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agent` | POST | Analyzes credit utilization and returns action decision |

**Request Body:**
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

**LLM Provider:** [OpenRouter](https://openrouter.ai) → `meta-llama/llama-3-8b-instruct:free`

**Fallback:** If no `OPENROUTER_API_KEY` is set, the agent uses a rule-based fallback (>50% utilization = TOP_UP).

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | No* | OpenRouter API key for LLM agent |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Yes | WalletConnect project ID |

*Agent works with rule-based fallback if no key is provided.

### Contract ABIs

All ABIs are embedded in `frontend/lib/contracts.ts` for zero-config deployment.

