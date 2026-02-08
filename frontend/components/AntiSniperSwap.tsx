'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { createPublicClient, http, keccak256, encodePacked, parseUnits } from 'viem'
import { sepolia } from 'viem/chains'
import { useWalletClient, useSwitchChain } from 'wagmi'
import {
  Shield,
  Lock,
  Unlock,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Eye,
  EyeOff,
} from 'lucide-react'
import {
  SEPOLIA_CONTRACTS,
  ANTI_SNIPER_HOOK_ABI,
  POOL_SWAP_TEST_ABI,
  ERC20_ABI,
} from '../lib/contracts'

interface AntiSniperSwapProps {
  address: string
}

const sepoliaClient = createPublicClient({
  chain: sepolia,
  transport: http(),
})

type SwapStep = 'idle' | 'committing' | 'committed' | 'revealing' | 'revealed' | 'swapping' | 'complete' | 'error'

export default function AntiSniperSwap({ address }: AntiSniperSwapProps) {
  const { data: walletClient } = useWalletClient()
  const { switchChainAsync } = useSwitchChain()
  const [amount, setAmount] = useState('')
  const [step, setStep] = useState<SwapStep>('idle')
  const [loading, setLoading] = useState(false)
  const [commitTxHash, setCommitTxHash] = useState<string | null>(null)
  const [revealTxHash, setRevealTxHash] = useState<string | null>(null)
  const [swapTxHash, setSwapTxHash] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [nonce, setNonce] = useState<bigint>(0n)
  const [commitHash, setCommitHash] = useState<string | null>(null)

  // Uniswap v3/v4 TickMath compatible bounds
  const MIN_SQRT_RATIO = 4295128739n
  const MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342n

  // Real PoolKey for the ETH/USDC pool initialized on Sepolia with AntiSniperHook
  const POOL_KEY = {
    currency0: '0x0000000000000000000000000000000000000000' as `0x${string}`, // Native ETH
    currency1: SEPOLIA_CONTRACTS.USDC, // Sepolia USDC
    fee: 3000,       // 0.30%
    tickSpacing: 60,
    hooks: SEPOLIA_CONTRACTS.ANTI_SNIPER_HOOK,
  }

  // On-chain PoolId from pool initialization tx:
  // https://sepolia.etherscan.io/tx/0x77e97d786e38e1665c5cce44a8c3b24daffe953069d4497042f36ce1e4c182a3
  const POOL_ID = SEPOLIA_CONTRACTS.POOL_ID as `0x${string}`

  const handleCommit = async () => {
    if (!amount || parseFloat(amount) <= 0 || !address || !walletClient) return

    setLoading(true)
    setStep('committing')
    setErrorMsg(null)
    setCommitTxHash(null)
    setRevealTxHash(null)

    try {
      await switchChainAsync({ chainId: sepolia.id })

      const swapAmount = parseUnits(amount, 6)
      const randomNonce = BigInt(Math.floor(Math.random() * 1000000000))
      setNonce(randomNonce)

      // Generate commitment hash: keccak256(abi.encodePacked(amount, nonce, trader))
      const hash = keccak256(
        encodePacked(
          ['uint256', 'uint256', 'address'],
          [swapAmount, randomNonce, address as `0x${string}`]
        )
      )
      setCommitHash(hash)

      // Call commit(bytes32 _hash, PoolId poolId) on AntiSniperHook
      const txHash = await walletClient.writeContract({
        address: SEPOLIA_CONTRACTS.ANTI_SNIPER_HOOK,
        abi: ANTI_SNIPER_HOOK_ABI,
        functionName: 'commit',
        args: [hash, POOL_ID],
        chain: sepolia,
        account: address as `0x${string}`,
      })
      setCommitTxHash(txHash)

      await sepoliaClient.waitForTransactionReceipt({ hash: txHash })

      setStep('committed')
    } catch (err) {
      console.error('Commit failed:', err)
      setErrorMsg(err instanceof Error ? err.message : 'Commit failed')
      setStep('error')
    } finally {
      setLoading(false)
    }
  }

  const handleReveal = async () => {
    if (!amount || !address || nonce === 0n || !walletClient) return

    setLoading(true)
    setStep('revealing')
    setErrorMsg(null)

    try {
      await switchChainAsync({ chainId: sepolia.id })

      const swapAmount = parseUnits(amount, 6)

      // PoolKey struct for the reveal call — matches the initialized pool
      const poolKey = POOL_KEY

      // Call reveal(uint256 amount, uint256 nonce, PoolKey calldata key)
      const txHash = await walletClient.writeContract({
        address: SEPOLIA_CONTRACTS.ANTI_SNIPER_HOOK,
        abi: ANTI_SNIPER_HOOK_ABI,
        functionName: 'reveal',
        args: [swapAmount, nonce, poolKey],
        chain: sepolia,
        account: address as `0x${string}`,
      })
      setRevealTxHash(txHash)

      await sepoliaClient.waitForTransactionReceipt({ hash: txHash })

      setStep('revealed')
    } catch (err) {
      console.error('Reveal failed:', err)
      setErrorMsg(err instanceof Error ? err.message : 'Reveal failed')
      setStep('error')
    } finally {
      setLoading(false)
    }
  }

  const handleSwap = async () => {
    if (!amount || !address || !walletClient) return

    setLoading(true)
    setStep('swapping')
    setErrorMsg(null)

    try {
      await switchChainAsync({ chainId: sepolia.id })

      const swapAmount = parseUnits(amount, 6)

      // Ensure PoolManager can pull USDC for settlement during unlockCallback.
      // (PoolSwapTest triggers PoolManager settlement logic under the hood.)
      const allowance = await sepoliaClient.readContract({
        address: SEPOLIA_CONTRACTS.USDC,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address as `0x${string}`, SEPOLIA_CONTRACTS.POOL_MANAGER],
      })

      if (allowance < swapAmount) {
        const approveHash = await walletClient.writeContract({
          address: SEPOLIA_CONTRACTS.USDC,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [SEPOLIA_CONTRACTS.POOL_MANAGER, swapAmount],
          chain: sepolia,
          account: address as `0x${string}`,
        })
        await sepoliaClient.waitForTransactionReceipt({ hash: approveHash })
      }

      // Prepare swap parameters
      const swapParams = {
        zeroForOne: false, // USDC -> ETH (currency1 -> currency0)
        // Exact input uses negative amountSpecified in v4
        amountSpecified: -BigInt(swapAmount),
        // Use a valid sqrtPriceLimitX96 bound
        sqrtPriceLimitX96: MAX_SQRT_RATIO - 1n,
      }

      // hookData with REQUIRE_COMMIT to enforce commit-reveal check
      const hookData = '0x5245515549524520434f4d4d4954' // "REQUIRE_COMMIT" in hex

      const testSettings = {
        takeClaims: false,
        settleUsingBurn: false,
      }

      // Execute swap through PoolSwapTest (handles PoolManager.unlock + unlockCallback)
      const txHash = await walletClient.writeContract({
        address: SEPOLIA_CONTRACTS.POOL_SWAP_TEST,
        abi: POOL_SWAP_TEST_ABI,
        functionName: 'swap',
        args: [POOL_KEY, swapParams, testSettings, hookData],
        chain: sepolia,
        account: address as `0x${string}`,
      })
      setSwapTxHash(txHash)

      await sepoliaClient.waitForTransactionReceipt({ hash: txHash })

      setStep('complete')
    } catch (err) {
      console.error('Swap failed:', err)
      const msg = err instanceof Error ? err.message : 'Swap execution failed'
      if (
        msg.toLowerCase().includes('user rejected') ||
        msg.toLowerCase().includes('user denied')
      ) {
        setErrorMsg('Transaction cancelled in wallet.')
      } else {
        setErrorMsg(msg)
      }
      setStep('error')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setStep('idle')
    setAmount('')
    setCommitTxHash(null)
    setRevealTxHash(null)
    setSwapTxHash(null)
    setErrorMsg(null)
    setNonce(0n)
    setCommitHash(null)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="glass-card p-6 md:p-7"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/15 to-violet-500/15 border border-indigo-500/10 flex items-center justify-center">
          <Shield className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h2 className="text-base font-bold text-white">MEV-Protected Swap</h2>
          <p className="text-xs text-slate-500">Commit-reveal via AntiSniperHook on Sepolia</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* How it works */}
        <div className="p-3.5 rounded-xl bg-indigo-500/[0.06] border border-indigo-500/10">
          <p className="text-xs text-slate-400 leading-relaxed">
            <strong className="text-indigo-400">Commit-Reveal Scheme:</strong> First, commit a hidden hash of your swap. After 1 block, reveal the actual amount. This prevents MEV bots from frontrunning your trade.
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
            step === 'idle' || step === 'committing' ? 'bg-white/[0.06] text-white' :
            step === 'committed' || step === 'revealing' || step === 'revealed' ? 'bg-emerald-500/15 text-emerald-400' :
            'bg-red-500/15 text-red-400'
          }`}>
            <EyeOff className="w-3 h-3" />
            1. Commit
          </div>
          <div className="w-4 h-px bg-white/10" />
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
            step === 'revealed' ? 'bg-emerald-500/15 text-emerald-400' :
            step === 'committed' || step === 'revealing' ? 'bg-white/[0.06] text-white' :
            'bg-white/[0.03] text-slate-600'
          }`}>
            <Eye className="w-3 h-3" />
            2. Reveal
          </div>
          <div className="w-4 h-px bg-white/10" />
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
            step === 'revealed' ? 'bg-emerald-500/15 text-emerald-400' :
            'bg-white/[0.03] text-slate-600'
          }`}>
            <Shield className="w-3 h-3" />
            3. Swap
          </div>
        </div>

        {/* Amount Input */}
        <div>
          <label className="block text-sm text-slate-400 mb-2">Swap Amount (USDC)</label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="input-field text-xl font-semibold pr-20"
              disabled={loading || step === 'committed'}
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <span className="text-sm text-slate-500 font-medium">USDC</span>
            </div>
          </div>
        </div>

        {/* Commit Hash Display */}
        {commitHash && (
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Commitment Hash</p>
            <p className="text-xs text-slate-300 font-mono break-all">{commitHash}</p>
            {nonce > 0n && (
              <p className="text-[10px] text-slate-500 mt-1">Nonce: {nonce.toString()} (kept secret until reveal)</p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        {step === 'idle' || step === 'error' ? (
          <motion.button
            onClick={handleCommit}
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
                <span>Committing...</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 relative z-10" />
                <span className="relative z-10">Commit Hidden Order</span>
              </>
            )}
          </motion.button>
        ) : step === 'committed' ? (
          <motion.button
            onClick={handleReveal}
            disabled={loading}
            whileHover={{ scale: loading ? 1 : 1.01 }}
            whileTap={{ scale: loading ? 1 : 0.99 }}
            className={`w-full py-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
              loading
                ? 'bg-white/[0.04] text-slate-600 cursor-not-allowed'
                : 'btn-primary'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Revealing...</span>
              </>
            ) : (
              <>
                <Unlock className="w-4 h-4 relative z-10" />
                <span className="relative z-10">Reveal & Execute Swap</span>
              </>
            )}
          </motion.button>
        ) : step === 'revealed' ? (
          <motion.button
            onClick={handleSwap}
            disabled={loading}
            whileHover={{ scale: loading ? 1 : 1.01 }}
            whileTap={{ scale: loading ? 1 : 0.99 }}
            className={`w-full py-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
              loading
                ? 'bg-white/[0.04] text-slate-600 cursor-not-allowed'
                : 'btn-primary'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Swapping...</span>
              </>
            ) : (
              <>
                <Shield className="w-4 h-4 relative z-10" />
                <span className="relative z-10">Execute Protected Swap</span>
              </>
            )}
          </motion.button>
        ) : step === 'complete' ? (
          <motion.button
            onClick={reset}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="w-full py-4 rounded-xl font-semibold text-sm bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all flex items-center justify-center gap-2"
          >
            New Swap
          </motion.button>
        ) : null}

        {/* Success States */}
        {commitTxHash && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/10"
          >
            <div className="flex items-center gap-2 text-emerald-400 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Commit tx confirmed</span>
            </div>
            <a
              href={`https://sepolia.etherscan.io/tx/${commitTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-emerald-400/70 hover:text-emerald-400 flex items-center gap-1 transition-colors"
            >
              View on Etherscan <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </motion.div>
        )}

        {revealTxHash && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/10"
          >
            <div className="flex items-center gap-2 text-emerald-400 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Reveal tx confirmed</span>
            </div>
            <a
              href={`https://sepolia.etherscan.io/tx/${revealTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-emerald-400/70 hover:text-emerald-400 flex items-center gap-1 transition-colors"
            >
              View on Etherscan <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </motion.div>
        )}

        {swapTxHash && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/10"
          >
            <div className="flex items-center gap-2 text-emerald-400 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Swap executed successfully!</span>
            </div>
            <a
              href={`https://sepolia.etherscan.io/tx/${swapTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-emerald-400/70 hover:text-emerald-400 flex items-center gap-1 transition-colors"
            >
              View on Etherscan <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </motion.div>
        )}

        {/* Error */}
        {step === 'error' && errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-xl bg-red-500/[0.08] border border-red-500/15"
          >
            <div className="flex items-center gap-2 text-red-400 mb-1">
              <XCircle className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Transaction Failed</span>
            </div>
            <p className="text-[10px] text-red-400/70 break-words">{errorMsg}</p>
          </motion.div>
        )}

        {/* Contract Info */}
        <div className="pt-3 border-t border-white/[0.06] space-y-1">
          <a
            href={`https://sepolia.etherscan.io/address/${SEPOLIA_CONTRACTS.ANTI_SNIPER_HOOK}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-slate-500 hover:text-white transition-colors flex items-center justify-between"
          >
            <span>Hook: {SEPOLIA_CONTRACTS.ANTI_SNIPER_HOOK.slice(0, 12)}...{SEPOLIA_CONTRACTS.ANTI_SNIPER_HOOK.slice(-6)}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          <p className="text-[10px] text-slate-500">
            Deployed on Ethereum Sepolia · Uniswap v4 PoolManager: {SEPOLIA_CONTRACTS.POOL_MANAGER.slice(0, 10)}...
          </p>
        </div>
      </div>
    </motion.div>
  )
}
