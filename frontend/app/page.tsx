'use client'

import { useState } from 'react'
import CreditDashboard from '@/components/CreditDashboard'
import MarginTopUp from '@/components/MarginTopUp'
import ConnectWallet from '@/components/ConnectWallet'

export default function Home() {
  const [connected, setConnected] = useState(false)
  const [address, setAddress] = useState('')

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              NitroBridge Vault
            </h1>
            <p className="text-gray-400 mt-2">
              Instant cross-chain margin refills via state channels
            </p>
          </div>
          <ConnectWallet 
            onConnect={(addr) => { setConnected(true); setAddress(addr) }}
            connected={connected}
            address={address}
          />
        </header>

        {connected ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <CreditDashboard address={address} />
            <MarginTopUp address={address} />
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="text-6xl mb-6">🔐</div>
            <h2 className="text-2xl font-semibold mb-4">Connect Your Wallet</h2>
            <p className="text-gray-400 max-w-md mx-auto">
              Connect your wallet to access your credit line, view available margin, 
              and enable instant top-ups via Yellow state channels.
            </p>
          </div>
        )}

        <footer className="mt-16 pt-8 border-t border-gray-800 text-center text-gray-500">
          <p>Built for HackMoney 2026</p>
          <div className="flex justify-center gap-6 mt-4 text-sm">
            <span>Arc Testnet</span>
            <span>•</span>
            <span>Yellow Nitrolite</span>
            <span>•</span>
            <span>Circle CCTP</span>
            <span>•</span>
            <span>Uniswap v4</span>
          </div>
        </footer>
      </div>
    </main>
  )
}
