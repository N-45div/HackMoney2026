'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Wifi, WifiOff, ChevronDown } from 'lucide-react'

interface NetworkInfo {
  name: string
  chainId: number
  status: 'connected' | 'disconnected' | 'pending'
  latency?: number
}

const NETWORKS: NetworkInfo[] = [
  { name: 'Arc Testnet', chainId: 5042002, status: 'connected', latency: 45 },
  { name: 'Base Sepolia', chainId: 84532, status: 'connected', latency: 32 },
  { name: 'Yellow Network', chainId: 0, status: 'connected', latency: 12 },
]

export default function NetworkStatus() {
  const [isOpen, setIsOpen] = useState(false)
  const [networks, setNetworks] = useState(NETWORKS)

  // Simulate latency updates
  useEffect(() => {
    const interval = setInterval(() => {
      setNetworks(prev => prev.map(n => ({
        ...n,
        latency: n.latency ? Math.max(10, n.latency + Math.floor(Math.random() * 20) - 10) : undefined
      })))
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const allConnected = networks.every(n => n.status === 'connected')

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg glass-card hover:bg-white/5 transition"
      >
        {allConnected ? (
          <Wifi className="w-4 h-4 text-green" />
        ) : (
          <WifiOff className="w-4 h-4 text-red" />
        )}
        <span className="text-sm text-secondary hidden sm:inline">
          {allConnected ? 'Connected' : 'Issues'}
        </span>
        <ChevronDown className={`w-4 h-4 text-muted transition ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          className="absolute right-0 top-full mt-2 w-64 glass-card p-3 rounded-xl z-50"
        >
          <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">
            Network Status
          </h4>
          <div className="space-y-2">
            {networks.map((network) => (
              <div
                key={network.name}
                className="flex items-center justify-between p-2 rounded-lg bg-white/5"
              >
                <div className="flex items-center gap-2">
                  <span className={`status-dot ${
                    network.status === 'connected' ? 'status-active' :
                    network.status === 'pending' ? 'status-pending' : 'status-error'
                  }`} />
                  <span className="text-sm">{network.name}</span>
                </div>
                {network.latency && (
                  <span className={`text-xs ${
                    network.latency < 50 ? 'text-green' :
                    network.latency < 100 ? 'text-yellow' : 'text-red'
                  }`}>
                    {network.latency}ms
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-white/5">
            <p className="text-xs text-muted text-center">
              All systems operational
            </p>
          </div>
        </motion.div>
      )}
    </div>
  )
}
