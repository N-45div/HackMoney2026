'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Wallet, LogOut, Copy, ExternalLink, Check, ChevronDown, ArrowLeftRight } from 'lucide-react'
import { useAccount, useDisconnect } from 'wagmi'
import { useAppKit } from '@reown/appkit/react'

interface ConnectWalletProps {
  large?: boolean
}

export default function ConnectWallet({ large }: ConnectWalletProps) {
  const { address, isConnected, chain } = useAccount()
  const { disconnect } = useDisconnect()
  const { open } = useAppKit()
  const [copied, setCopied] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function copyAddress() {
    if (address) {
      navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function handleDisconnect() {
    disconnect()
    setShowMenu(false)
  }

  if (isConnected && address) {
    return (
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] hover:border-white/[0.15] transition-all duration-200"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-white" />
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-sm font-semibold text-white leading-tight">
              {address.slice(0, 6)}...{address.slice(-4)}
            </p>
            <p className="text-[10px] text-slate-500 font-medium">{chain?.name || 'Unknown'}</p>
          </div>
          <span className="status-dot status-active ml-0.5" />
          <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${showMenu ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {showMenu && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 w-60 glass-card p-1.5 rounded-xl z-50"
            >
              <div className="px-3 py-2.5 mb-1">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium mb-1">Connected Wallet</p>
                <p className="text-sm font-mono text-slate-300">{address.slice(0, 10)}...{address.slice(-8)}</p>
              </div>

              <button
                onClick={copyAddress}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.06] transition-colors text-left"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-500" />}
                <span className="text-sm text-slate-300">{copied ? 'Copied!' : 'Copy Address'}</span>
              </button>

              <a
                href={`https://testnet.arcscan.app/address/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.06] transition-colors"
              >
                <ExternalLink className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-300">View on Explorer</span>
              </a>

              <button
                onClick={() => { open({ view: 'Networks' }); setShowMenu(false) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.06] transition-colors text-left"
              >
                <ArrowLeftRight className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-300">Switch Network</span>
              </button>

              <div className="my-1 mx-2 border-t border-white/[0.06]" />

              <button
                onClick={handleDisconnect}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-red-500/10 transition-colors text-left"
              >
                <LogOut className="w-4 h-4 text-red-400" />
                <span className="text-sm text-red-400">Disconnect</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  if (large) {
    return (
      <motion.button
        onClick={() => open()}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="btn-primary px-8 py-4 text-base flex items-center gap-3"
      >
        <span className="relative z-10 flex items-center gap-2.5">
          <Wallet className="w-5 h-5" />
          Connect Wallet
        </span>
      </motion.button>
    )
  }

  return (
    <motion.button
      onClick={() => open()}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm"
    >
      <span className="relative z-10 flex items-center gap-2">
        <Wallet className="w-4 h-4" />
        Connect
      </span>
    </motion.button>
  )
}
