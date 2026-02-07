'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { parseUnits, createPublicClient, http } from 'viem'
import { useWalletClient, useSwitchChain } from 'wagmi'
import {
  ArrowUpRight,
  ArrowDownLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from 'lucide-react'
import {
  arcTestnet,
  CONTRACTS,
  ARC_CREDIT_TERMINAL_ABI,
  ERC20_ABI,
} from '../lib/contracts'

interface BorrowRepayProps {
  address: string
}

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(),
})

export default function BorrowRepay({ address }: BorrowRepayProps) {
  const { data: walletClient } = useWalletClient()
  const { switchChainAsync } = useSwitchChain()
  const [mode, setMode] = useState<'borrow' | 'repay'>('borrow')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'approving' | 'pending' | 'success' | 'error'>('idle')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleAction = async () => {
    if (!amount || parseFloat(amount) <= 0 || !address || !walletClient) return

    setLoading(true)
    setStatus('pending')
    setErrorMsg(null)
    setTxHash(null)

    try {
      await switchChainAsync({ chainId: arcTestnet.id })

      const actionAmount = parseUnits(amount, 6)

      if (mode === 'borrow') {
        // Call requestMarginTopUp(amount) on ArcCreditTerminal
        const hash = await walletClient.writeContract({
          address: CONTRACTS.CREDIT_TERMINAL,
          abi: ARC_CREDIT_TERMINAL_ABI,
          functionName: 'requestMarginTopUp',
          args: [actionAmount],
          chain: arcTestnet,
          account: address as `0x${string}`,
        })
        setTxHash(hash)
        await publicClient.waitForTransactionReceipt({ hash })
      } else {
        // Repay: first approve USDC, then call settleCredit(amount)
        setStatus('approving')
        const approveHash = await walletClient.writeContract({
          address: CONTRACTS.USDC,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [CONTRACTS.CREDIT_TERMINAL, actionAmount],
          chain: arcTestnet,
          account: address as `0x${string}`,
        })
        await publicClient.waitForTransactionReceipt({ hash: approveHash })

        setStatus('pending')
        const hash = await walletClient.writeContract({
          address: CONTRACTS.CREDIT_TERMINAL,
          abi: ARC_CREDIT_TERMINAL_ABI,
          functionName: 'settleCredit',
          args: [actionAmount],
          chain: arcTestnet,
          account: address as `0x${string}`,
        })
        setTxHash(hash)
        await publicClient.waitForTransactionReceipt({ hash })
      }

      setStatus('success')
      setAmount('')
    } catch (err) {
      console.error(`${mode} failed:`, err)
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
      transition={{ delay: 0.15 }}
      className="glass-card p-6 md:p-7"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center border ${
          mode === 'borrow'
            ? 'from-orange-500/15 to-red-500/15 border-orange-500/10'
            : 'from-emerald-500/15 to-green-500/15 border-emerald-500/10'
        }`}>
          {mode === 'borrow' ? (
            <ArrowUpRight className="w-5 h-5 text-orange-400" />
          ) : (
            <ArrowDownLeft className="w-5 h-5 text-emerald-400" />
          )}
        </div>
        <div>
          <h2 className="text-base font-bold text-white">
            {mode === 'borrow' ? 'Borrow USDC' : 'Repay Debt'}
          </h2>
          <p className="text-xs text-slate-500">
            {mode === 'borrow'
              ? 'Draw from your credit line'
              : 'Settle outstanding debt'}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Mode Toggle */}
        <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <button
            onClick={() => { setMode('borrow'); setStatus('idle'); setAmount('') }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
              mode === 'borrow'
                ? 'bg-orange-500/15 text-orange-400 border border-orange-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Borrow
          </button>
          <button
            onClick={() => { setMode('repay'); setStatus('idle'); setAmount('') }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
              mode === 'repay'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Repay
          </button>
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
              disabled={loading}
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <span className="text-sm text-slate-500 font-medium">USDC</span>
            </div>
          </div>
        </div>

        {/* Quick Amounts */}
        <div className="grid grid-cols-4 gap-2">
          {['50', '100', '500', '1000'].map((val) => (
            <button
              key={val}
              onClick={() => setAmount(val)}
              disabled={loading}
              className={`py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                amount === val
                  ? mode === 'borrow'
                    ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                    : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-white/[0.03] text-slate-400 hover:bg-white/[0.06] border border-transparent hover:border-white/[0.08]'
              }`}
            >
              ${val}
            </button>
          ))}
        </div>

        {/* Action Button */}
        <motion.button
          onClick={handleAction}
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
              <span>
                {status === 'approving'
                  ? 'Approving USDC...'
                  : mode === 'borrow'
                  ? 'Borrowing...'
                  : 'Repaying...'}
              </span>
            </>
          ) : (
            <>
              <span className="relative z-10">
                {mode === 'borrow' ? 'Borrow from Credit Line' : 'Repay Debt'}
              </span>
              {mode === 'borrow' ? (
                <ArrowUpRight className="w-4 h-4 relative z-10" />
              ) : (
                <ArrowDownLeft className="w-4 h-4 relative z-10" />
              )}
            </>
          )}
        </motion.button>

        {/* Success */}
        {status === 'success' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/15"
          >
            <div className="flex items-center gap-2 text-emerald-400 mb-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm font-medium">
                {mode === 'borrow' ? 'Borrow' : 'Repayment'} Successful!
              </span>
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

        {/* Error */}
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
              <p className="text-xs text-red-400/70 break-words">{errorMsg}</p>
            )}
          </motion.div>
        )}

        {/* Info */}
        <div className="pt-3 border-t border-white/[0.06]">
          <p className="text-[10px] text-slate-500">
            {mode === 'borrow'
              ? 'Borrow calls requestMarginTopUp() on ArcCreditTerminal. Must be within your credit limit (150% of deposit).'
              : 'Repay calls settleCredit() — approves USDC then reduces your outstanding debt.'}
          </p>
        </div>
      </div>
    </motion.div>
  )
}
