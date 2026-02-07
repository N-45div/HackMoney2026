'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const interval = setInterval(() => {
      setNetworks(prev => prev.map(n => ({
        ...n,
        latency: n.latency ? Math.max(10, n.latency + Math.floor(Math.random() * 20) - 10) : undefined
      })))
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const allConnected = networks.every(n => n.status === 'connected')

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] hover:border-white/[0.15] transition-all duration-200"
      >
        {allConnected ? (
          <Wifi className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <WifiOff className="w-3.5 h-3.5 text-red-400" />
        )}
        <span className="text-xs text-slate-400 hidden sm:inline font-medium">
          {allConnected ? 'Connected' : 'Issues'}
        </span>
        <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-60 glass-card p-3 rounded-xl z-50"
          >
            <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
              Network Status
            </h4>
            <div className="space-y-1.5">
              {networks.map((network) => (
                <div
                  key={network.name}
                  className="flex items-center justify-between p-2 rounded-lg bg-white/[0.03]"
                >
                  <div className="flex items-center gap-2">
                    <span className={`status-dot ${
                      network.status === 'connected' ? 'status-active' :
                      network.status === 'pending' ? 'status-pending' : 'status-error'
                    }`} />
                    <span className="text-sm text-slate-300">{network.name}</span>
                  </div>
                  {network.latency && (
                    <span className={`text-xs font-medium ${
                      network.latency < 50 ? 'text-emerald-400' :
                      network.latency < 100 ? 'text-amber-400' : 'text-red-400'
                    }`}>
                      {network.latency}ms
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-white/[0.06]">
              <p className="text-[10px] text-slate-600 text-center">
                All systems operational
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
