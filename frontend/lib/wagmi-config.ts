import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { cookieStorage, createStorage } from 'wagmi'
import { arcTestnet, baseSepolia, sepolia } from './contracts'

export const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID'

if (!projectId) {
  console.warn('WalletConnect Project ID is not set. Get one at https://cloud.walletconnect.com')
}

export const metadata = {
  name: 'NitroBridge Vault',
  description: 'Instant cross-chain margin refills with sub-second state channel settlements',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://nitrobridge.app',
  icons: ['https://avatars.githubusercontent.com/u/37784886']
}

export const networks = [arcTestnet, baseSepolia, sepolia]

export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: true,
  storage: createStorage({
    storage: cookieStorage,
  }),
})

export const config = wagmiAdapter.wagmiConfig
