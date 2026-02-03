'use client'

import { useState } from 'react'

interface ConnectWalletProps {
  onConnect: (address: string) => void
  connected: boolean
  address: string
}

export default function ConnectWallet({ onConnect, connected, address }: ConnectWalletProps) {
  const [connecting, setConnecting] = useState(false)

  const handleConnect = async () => {
    setConnecting(true)
    
    try {
      // Check for MetaMask
      if (typeof window !== 'undefined' && window.ethereum) {
        const accounts = await window.ethereum.request({ 
          method: 'eth_requestAccounts' 
        })
        if (accounts[0]) {
          onConnect(accounts[0])
        }
      } else {
        // Mock connection for demo
        await new Promise(resolve => setTimeout(resolve, 1000))
        onConnect('0x742d35Cc6634C0532925a3b844Bc454e4438f44e')
      }
    } catch (error) {
      console.error('Failed to connect:', error)
    } finally {
      setConnecting(false)
    }
  }

  if (connected) {
    return (
      <div className="flex items-center gap-3 bg-gray-800 rounded-xl px-4 py-2">
        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
        <span className="text-sm">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
      </div>
    )
  }

  return (
    <button
      onClick={handleConnect}
      disabled={connecting}
      className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 px-6 py-2 rounded-xl font-medium transition disabled:opacity-50"
    >
      {connecting ? 'Connecting...' : 'Connect Wallet'}
    </button>
  )
}

// Add ethereum type for TypeScript
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<string[]>
    }
  }
}
