'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { parseUnits, createPublicClient, createWalletClient, http, custom, zeroHash } from 'viem'
import { Zap, ArrowUpRight, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { arcTestnet, CONTRACTS, ARC_CREDIT_TERMINAL_ABI, ERC20_ABI, DEPLOYMENT_TX } from '../lib/contracts'

interface MarginTopUpProps {
  address: string
}

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(),
})

export default function MarginTopUp({ address }: MarginTopUpProps) {
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'approving' | 'depositing' | 'success' | 'error'>('idle')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) return
    if (typeof window === 'undefined' || !window.ethereum) {
      setErrorMsg('Please connect a wallet')
      setStatus('error')
      return
    }
    
    setLoading(true)
    setStatus('approving')
    setErrorMsg(null)
    setTxHash(null)
    
    try {
      const walletClient = createWalletClient({
        chain: arcTestnet,
        transport: custom(window.ethereum),
      })
      
      const [account] = await walletClient.getAddresses()
      const depositAmount = parseUnits(amount, 6)
      
      const approveHash = await walletClient.writeContract({
        address: CONTRACTS.USDC,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONTRACTS.CREDIT_TERMINAL, depositAmount],
        account,
      })
      
      await publicClient.waitForTransactionReceipt({ hash: approveHash })
      
      setStatus('depositing')
      const depositHash = await walletClient.writeContract({
        address: CONTRACTS.CREDIT_TERMINAL,
        abi: ARC_CREDIT_TERMINAL_ABI,
        functionName: 'depositToCreditLine',
        args: [depositAmount, zeroHash],
        account,
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
      className="glass-card p-6"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center">
          <Zap className="w-5 h-5 text-yellow" />
        </div>
        <div>
          <h2 className="font-semibold">Deposit USDC</h2>
          <p className="text-xs text-muted">Instant margin via Yellow channels</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Yellow Network Badge */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-yellow-500/10 to-orange-500/5 border border-yellow-500/20">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-yellow" />
            <span className="text-sm font-medium text-yellow">Yellow State Channel Active</span>
          </div>
          <p className="text-xs text-muted">
            Sub-second transfers, zero gas for top-ups
          </p>
        </div>

        {/* Amount Input */}
        <div>
          <label className="block text-sm text-secondary mb-2">Amount (USDC)</label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="input-field text-xl font-semibold pr-20"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <span className="text-sm text-muted">USDC</span>
            </div>
          </div>
        </div>

        {/* Quick Amount Buttons */}
        <div className="grid grid-cols-4 gap-2">
          {['100', '500', '1000', '5000'].map((val) => (
            <button
              key={val}
              onClick={() => setAmount(val)}
              className={`py-2 rounded-lg text-sm font-medium transition ${
                amount === val 
                  ? 'bg-blue-500/20 text-blue border border-blue-500/30' 
                  : 'bg-white/5 text-secondary hover:bg-white/10 border border-transparent'
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
          className={`w-full py-4 rounded-xl font-semibold transition flex items-center justify-center gap-2 ${
            loading || !amount
              ? 'bg-white/5 text-muted cursor-not-allowed'
              : 'btn-primary'
          }`}
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
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
            className="p-4 rounded-xl bg-green/10 border border-green/20"
          >
            <div className="flex items-center gap-2 text-green mb-2">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">Deposit Successful!</span>
            </div>
            {txHash && (
              <a 
                href={`https://testnet.arcscan.app/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-green/80 hover:text-green flex items-center gap-1"
              >
                View on Explorer <ArrowUpRight className="w-3 h-3" />
              </a>
            )}
          </motion.div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-red/10 border border-red/20"
          >
            <div className="flex items-center gap-2 text-red mb-1">
              <XCircle className="w-5 h-5" />
              <span className="font-medium">Transaction Failed</span>
            </div>
            {errorMsg && (
              <p className="text-xs text-red/80 truncate">{errorMsg}</p>
            )}
          </motion.div>
        )}

        {/* Contract Info */}
        <div className="pt-4 border-t border-white/5">
          <a 
            href={DEPLOYMENT_TX.ARC_CREDIT_TERMINAL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted hover:text-white transition flex items-center justify-between"
          >
            <span>Contract: {CONTRACTS.CREDIT_TERMINAL.slice(0, 10)}...{CONTRACTS.CREDIT_TERMINAL.slice(-6)}</span>
            <ArrowUpRight className="w-3 h-3" />
          </a>
        </div>
      </div>
    </motion.div>
  )
}
