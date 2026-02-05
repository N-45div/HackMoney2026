'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Wallet, LogOut, Copy, ExternalLink, Check } from 'lucide-react'

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
      on: (event: string, callback: (...args: unknown[]) => void) => void
    }
  }
}

interface ConnectWalletProps {
  onConnect: (address: string) => void
  connected: boolean
  address: string
  large?: boolean
}

export default function ConnectWallet({ onConnect, connected, address, large }: ConnectWalletProps) {
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  async function handleConnect() {
    if (!window.ethereum) {
      alert('Please install MetaMask or another Web3 wallet!')
      return
    }

    setLoading(true)
    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      }) as string[]
      
      if (accounts[0]) {
        onConnect(accounts[0])
      }
    } catch (error) {
      console.error('Failed to connect:', error)
    } finally {
      setLoading(false)
    }
  }

  function copyAddress() {
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (connected) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-3 px-4 py-2 glass-card hover:bg-white/5 rounded-xl transition"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-white" />
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-sm font-medium">
              {address.slice(0, 6)}...{address.slice(-4)}
            </p>
            <p className="text-xs text-muted">Arc Testnet</p>
          </div>
          <span className="status-dot status-active ml-1" />
        </button>

        {showMenu && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="absolute right-0 top-full mt-2 w-56 glass-card p-2 rounded-xl z-50"
          >
            <button
              onClick={copyAddress}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition text-left"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green" />
              ) : (
                <Copy className="w-4 h-4 text-muted" />
              )}
              <span className="text-sm">{copied ? 'Copied!' : 'Copy Address'}</span>
            </button>
            <a
              href={`https://testnet.arcscan.app/address/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition"
            >
              <ExternalLink className="w-4 h-4 text-muted" />
              <span className="text-sm">View on Explorer</span>
            </a>
            <div className="my-1 border-t border-white/5" />
            <button
              onClick={() => window.location.reload()}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition text-left text-red"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">Disconnect</span>
            </button>
          </motion.div>
        )}
      </div>
    )
  }

  if (large) {
    return (
      <motion.button
        onClick={handleConnect}
        disabled={loading}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="btn-primary px-8 py-4 text-base flex items-center gap-3"
      >
        <span className="relative z-10 flex items-center gap-3">
          <Wallet className="w-5 h-5" />
          {loading ? 'Connecting...' : 'Connect Wallet'}
        </span>
      </motion.button>
    )
  }

  return (
    <motion.button
      onClick={handleConnect}
      disabled={loading}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="btn-primary flex items-center gap-2"
    >
      <span className="relative z-10 flex items-center gap-2">
        <Wallet className="w-4 h-4" />
        {loading ? 'Connecting...' : 'Connect'}
      </span>
    </motion.button>
  )
}
