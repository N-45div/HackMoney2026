# NitroBridge Vault - Frontend

Modern Next.js 16 frontend for NitroBridge Vault with proper Web3 wallet integration using wagmi v2+ and Web3Modal.

## Features

- ✅ **Proper Wallet Connect Integration** - WalletConnect v2, MetaMask, Coinbase Wallet, and injected wallets
- ✅ **Multi-Chain Support** - Arc Testnet, Base Sepolia, Ethereum Sepolia
- ✅ **Modern UI/UX** - Glass morphism design, smooth animations with Framer Motion
- ✅ **Real-time Data** - Live credit dashboard with auto-refresh
- ✅ **Type-Safe** - Full TypeScript support with proper typing
- ✅ **SSR Compatible** - Server-side rendering with Next.js 16 App Router

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Styling**: Custom CSS with glass morphism effects
- **Web3**: wagmi v3, viem v2, Web3Modal v5
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **State Management**: TanStack React Query

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your WalletConnect Project ID:

```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

**Get your WalletConnect Project ID:**
1. Go to https://cloud.walletconnect.com
2. Create a new project
3. Copy the Project ID

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Project Structure

```
frontend/
├── app/
│   ├── layout.tsx          # Root layout with wagmi providers
│   ├── page.tsx            # Main landing page
│   └── globals.css         # Global styles
├── components/
│   ├── ConnectWallet.tsx   # Wallet connection component
│   ├── CreditDashboard.tsx # Credit line dashboard
│   ├── MarginTopUp.tsx     # Deposit/top-up interface
│   ├── ChainFlow.tsx       # Cross-chain flow visualization
│   └── NetworkStatus.tsx   # Network status indicator
├── lib/
│   ├── wagmi-config.ts     # Wagmi configuration
│   ├── providers.tsx       # Web3 providers wrapper
│   ├── contracts.ts        # Contract addresses and ABIs
│   └── *.abi.json         # Contract ABIs
└── package.json
```

## Key Components

### ConnectWallet

Fully functional wallet connection with:
- Multiple wallet support (MetaMask, WalletConnect, Coinbase, etc.)
- Network switching
- Address display and copy
- Disconnect functionality

### CreditDashboard

Real-time credit line information:
- Deposited amount
- Borrowed amount
- Available credit
- Credit utilization health factor
- Auto-refresh every 30 seconds

### MarginTopUp

Deposit USDC to credit line:
- Amount input with quick presets
- Two-step approval + deposit flow
- Transaction status tracking
- Success/error handling

## Wallet Integration

The app uses **wagmi v3** with **Web3Modal v5** for wallet connectivity:

```typescript
// lib/wagmi-config.ts
export const config = defaultWagmiConfig({
  chains: [arcTestnet, baseSepolia, sepolia],
  projectId,
  metadata: { name, description, url, icons },
  ssr: true,
  enableWalletConnect: true,
  enableInjected: true,
  enableCoinbase: true,
})
```

### Supported Wallets

- MetaMask (browser extension)
- WalletConnect (mobile wallets via QR)
- Coinbase Wallet
- Any injected wallet (Brave, Trust, etc.)

## Contract Integration

Contracts are configured in `lib/contracts.ts`:

```typescript
export const ARC_CONTRACTS = {
  CREDIT_TERMINAL: '0xd1835d13A9694F0E9329FfDE9b18936CE872aae5',
  USDC: '0x3600000000000000000000000000000000000000',
  TOKEN_MESSENGER: '0xb43db544E2c27092c107639Ad201b3dEfAbcF192',
  MESSAGE_TRANSMITTER: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
}
```

## Development

### Build for Production

```bash
npm run build
```

### Start Production Server

```bash
npm start
```

### Lint

```bash
npm run lint
```

## Network Configuration

### Arc Testnet
- Chain ID: 5042002
- RPC: https://rpc.testnet.arc.network
- Explorer: https://testnet.arcscan.app

### Base Sepolia
- Chain ID: 84532
- RPC: https://sepolia.base.org
- Explorer: https://sepolia.basescan.org

### Ethereum Sepolia
- Chain ID: 11155111
- RPC: https://rpc.sepolia.org
- Explorer: https://sepolia.etherscan.io

## Troubleshooting

### "Project ID is not defined"
Make sure you've set `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` in `.env.local`

### Wallet not connecting
1. Check that you're on a supported network
2. Try refreshing the page
3. Clear browser cache and reconnect

### Transaction failing
1. Ensure you have sufficient USDC balance
2. Check you're on Arc Testnet (chain ID 5042002)
3. Verify contract addresses in `lib/contracts.ts`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details
