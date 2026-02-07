import './globals.css'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { cookieToInitialState } from 'wagmi'
import { config } from '@/lib/wagmi-config'
import { Providers } from '@/lib/providers'

export const metadata: Metadata = {
  title: 'NitroBridge Vault - Instant Cross-Chain Margin',
  description: 'Revolving credit line with instant cross-chain margin refills powered by Yellow Network, Circle CCTP, and Uniswap v4',
  keywords: ['DeFi', 'Cross-chain', 'Margin', 'Yellow Network', 'CCTP', 'Uniswap v4'],
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = await headers()
  const initialState = cookieToInitialState(config, headersList.get('cookie'))
  
  return (
    <html lang="en">
      <body>
        <Providers initialState={initialState}>
          {children}
        </Providers>
      </body>
    </html>
  )
}
