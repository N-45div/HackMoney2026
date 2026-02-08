import './globals.css'
import type { Metadata } from 'next'
import { Providers } from '@/lib/providers'

export const metadata: Metadata = {
  title: 'NitroBridge Vault - Instant Cross-Chain Margin',
  description: 'Revolving credit line with instant cross-chain margin refills powered by Yellow Network, Circle CCTP, and Uniswap v4',
  keywords: ['DeFi', 'Cross-chain', 'Margin', 'Yellow Network', 'CCTP', 'Uniswap v4'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
