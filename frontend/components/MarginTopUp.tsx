'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { parseUnits, createPublicClient, http, zeroHash } from 'viem'
import { useWalletClient, useSwitchChain } from 'wagmi'
import { Zap, ArrowUpRight, CheckCircle2, XCircle, Loader2, ExternalLink } from 'lucide-react'
import { arcTestnet, CONTRACTS, ARC_CREDIT_TERMINAL_ABI, ERC20_ABI, DEPLOYMENT_TX } from '../lib/contracts'

interface MarginTopUpProps {
  address: string
}

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(),
})

export default function MarginTopUp({ address }: MarginTopUpProps) {
  const { data: walletClient } = useWalletClient()
  const { switchChainAsync } = useSwitchChain()
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'approving' | 'depositing' | 'success' | 'error'>('idle')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) return
    if (!address || !walletClient) {
      setErrorMsg('Please connect a wallet')
      setStatus('error')
      return
    }
    
    setLoading(true)
    setStatus('approving')
    setErrorMsg(null)
    setTxHash(null)
    
    try {
      await switchChainAsync({ chainId: arcTestnet.id })
      
      const depositAmount = parseUnits(amount, 6)
      
      const approveHash = await walletClient.writeContract({
        address: CONTRACTS.USDC,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONTRACTS.CREDIT_TERMINAL, depositAmount],
        chain: arcTestnet,
        account: address as `0x${string}`,
      })
      
      await publicClient.waitForTransactionReceipt({ hash: approveHash })
      
      setStatus('depositing')
      const depositHash = await walletClient.writeContract({
        address: CONTRACTS.CREDIT_TERMINAL,
        abi: ARC_CREDIT_TERMINAL_ABI,
        functionName: 'depositToCreditLine',
        args: [depositAmount, zeroHash],
        chain: arcTestnet,
        account: address as `0x${string}`,
      })
      
      setTxHash(depositHash)
      await publicClient.waitForTransactionReceipt({ hash: depositHash })
      
      setStatus('success')
      setAmount('')
    } catch (err) {
      console.error('Deposit failed:', err)
      setErrorMsg(err instanceof Error ? err.message : 'Transaction failed')
      setStatus('error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="glass-card p-6 md:p-7"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/15 to-orange-500/15 border border-amber-500/10 flex items-center justify-center">
          <Zap className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h2 className="text-base font-bold text-white">Deposit USDC</h2>
          <p className="text-xs text-slate-500">Instant margin via Yellow channels</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Yellow Network Badge */}
        <div className="p-3.5 rounded-xl bg-amber-500/[0.06] border border-amber-500/10">
          <div className="flex items-center gap-2 mb-0.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-sm font-medium text-amber-400">Yellow State Channel Active</span>
          </div>
          <p className="text-xs text-slate-500">
            Sub-second transfers, zero gas for top-ups
          </p>
        </div>

        {/* Amount Input */}
        <div>
          <label className="block text-sm text-slate-400 mb-2">Amount (USDC)</label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="input-field text-xl font-semibold pr-20"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <span className="text-sm text-slate-500 font-medium">USDC</span>
            </div>
          </div>
        </div>

        {/* Quick Amount Buttons */}
        <div className="grid grid-cols-4 gap-2">
          {['100', '500', '1000', '5000'].map((val) => (
            <button
              key={val}
              onClick={() => setAmount(val)}
              className={`py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                amount === val 
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                  : 'bg-white/[0.03] text-slate-400 hover:bg-white/[0.06] border border-transparent hover:border-white/[0.08]'
              }`}
            >
              ${val}
            </button>
          ))}
        </div>

        {/* Deposit Button */}
        <motion.button
          onClick={handleDeposit}
          disabled={loading || !amount}
          whileHover={{ scale: loading ? 1 : 1.01 }}
          whileTap={{ scale: loading ? 1 : 0.99 }}
          className={`w-full py-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
            loading || !amount
              ? 'bg-white/[0.04] text-slate-600 cursor-not-allowed'
              : 'btn-primary'
          }`}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{status === 'approving' ? 'Approving USDC...' : 'Depositing...'}</span>
            </>
          ) : (
            <>
              <span className="relative z-10">Deposit to Credit Line</span>
              <ArrowUpRight className="w-4 h-4 relative z-10" />
            </>
          )}
        </motion.button>

        {/* Success State */}
        {status === 'success' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/15"
          >
            <div className="flex items-center gap-2 text-emerald-400 mb-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm font-medium">Deposit Successful!</span>
            </div>
            {txHash && (
              <a 
                href={`https://testnet.arcscan.app/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-emerald-400/70 hover:text-emerald-400 flex items-center gap-1 transition-colors"
              >
                View on Explorer <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </motion.div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-red-500/[0.08] border border-red-500/15"
          >
            <div className="flex items-center gap-2 text-red-400 mb-1">
              <XCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Transaction Failed</span>
            </div>
            {errorMsg && (
              <p className="text-xs text-red-400/70 truncate">{errorMsg}</p>
            )}
          </motion.div>
        )}

        {/* Contract Info */}
        <div className="pt-4 border-t border-white/[0.06]">
          <a 
            href={DEPLOYMENT_TX.ARC_CREDIT_TERMINAL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-slate-500 hover:text-white transition-colors flex items-center justify-between"
          >
            <span>Contract: {CONTRACTS.CREDIT_TERMINAL.slice(0, 10)}...{CONTRACTS.CREDIT_TERMINAL.slice(-6)}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </motion.div>
  )
}
