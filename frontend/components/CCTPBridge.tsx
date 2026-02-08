'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  parseUnits,
  formatUnits,
  createPublicClient,
  http,
  pad,
} from 'viem'
import { sepolia } from 'viem/chains'
import { useWalletClient, useSwitchChain } from 'wagmi'
import {
  ArrowRight,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Clock,
  ArrowDownUp,
} from 'lucide-react'
import {
  arcTestnet,
  SEPOLIA_CONTRACTS,
  ARC_CONTRACTS,
  CCTP_DOMAINS,
  ERC20_ABI,
} from '../lib/contracts'

interface CCTPBridgeProps {
  address: string
}

// CCTP V2 TokenMessengerV2 ABI
const TOKEN_MESSENGER_ABI = [
  {
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'destinationDomain', type: 'uint32' },
      { name: 'mintRecipient', type: 'bytes32' },
      { name: 'burnToken', type: 'address' },
      { name: 'destinationCaller', type: 'bytes32' },
      { name: 'maxFee', type: 'uint256' },
      { name: 'minFinalityThreshold', type: 'uint32' },
    ],
    name: 'depositForBurn',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

const MESSAGE_TRANSMITTER_ABI = [
  {
    inputs: [
      { name: 'message', type: 'bytes' },
      { name: 'attestation', type: 'bytes' },
    ],
    name: 'receiveMessage',
    outputs: [{ name: 'success', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

// CCTP V2 attestation API
const ATTESTATION_API = 'https://iris-api-sandbox.circle.com/v2'

const sepoliaClient = createPublicClient({
  chain: sepolia,
  transport: http(),
})

const arcClient = createPublicClient({
  chain: arcTestnet,
  transport: http(),
})

type BridgeStatus =
  | 'idle'
  | 'approving'
  | 'burning'
  | 'waiting_attestation'
  | 'minting'
  | 'success'
  | 'error'

export default function CCTPBridge({ address }: CCTPBridgeProps) {
  const { data: walletClient } = useWalletClient()
  const { switchChainAsync } = useSwitchChain()
  const [amount, setAmount] = useState('')
  const [status, setStatus] = useState<BridgeStatus>('idle')
  const [loading, setLoading] = useState(false)
  const [burnTxHash, setBurnTxHash] = useState<string | null>(null)
  const [mintTxHash, setMintTxHash] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [sepoliaBalance, setSepoliaBalance] = useState<string | null>(null)
  const [arcBalance, setArcBalance] = useState<string | null>(null)
  const [attestationProgress, setAttestationProgress] = useState(0)

  // Fetch balances
  useEffect(() => {
    if (!address) return
    const fetchBalances = async () => {
      try {
        const sepBal = await sepoliaClient.readContract({
          address: SEPOLIA_CONTRACTS.USDC,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [address as `0x${string}`],
        })
        setSepoliaBalance(formatUnits(sepBal, 6))
      } catch {
        setSepoliaBalance('0.00')
      }
      try {
        const arcBal = await arcClient.readContract({
          address: ARC_CONTRACTS.USDC,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [address as `0x${string}`],
        })
        setArcBalance(formatUnits(arcBal, 6))
      } catch {
        setArcBalance('0.00')
      }
    }
    fetchBalances()
    const interval = setInterval(fetchBalances, 15000)
    return () => clearInterval(interval)
  }, [address])

  const handleBridge = async () => {
    if (!amount || parseFloat(amount) <= 0 || !address || !walletClient) return

    setLoading(true)
    setStatus('approving')
    setErrorMsg(null)
    setBurnTxHash(null)
    setMintTxHash(null)
    setAttestationProgress(0)

    try {
      await switchChainAsync({ chainId: sepolia.id })

      const bridgeAmount = parseUnits(amount, 6)

      // Step 1: Approve TokenMessenger to spend USDC on Sepolia
      const approveHash = await walletClient.writeContract({
        address: SEPOLIA_CONTRACTS.USDC,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [SEPOLIA_CONTRACTS.TOKEN_MESSENGER, bridgeAmount],
        chain: sepolia,
        account: address as `0x${string}`,
      })
      await sepoliaClient.waitForTransactionReceipt({ hash: approveHash })

      // Step 2: Burn USDC on Sepolia via depositForBurn
      setStatus('burning')
      const mintRecipient = pad(address as `0x${string}`, { size: 32 })

      // CCTP V2: depositForBurn with 7 params
      const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`
      const maxFee = 500n // 0.0005 USDC max fee
      const minFinalityThreshold = 1000 // 1000 or less = Fast Transfer

      const burnHash = await walletClient.writeContract({
        address: SEPOLIA_CONTRACTS.TOKEN_MESSENGER,
        abi: TOKEN_MESSENGER_ABI,
        functionName: 'depositForBurn',
        args: [
          bridgeAmount,
          CCTP_DOMAINS.ARC,
          mintRecipient,
          SEPOLIA_CONTRACTS.USDC,
          ZERO_BYTES32,        // destinationCaller (0x0 = any caller)
          maxFee,              // max fee in USDC subunits
          minFinalityThreshold, // fast transfer threshold
        ],
        chain: sepolia,
        account: address as `0x${string}`,
      })
      setBurnTxHash(burnHash)

      const burnReceipt = await sepoliaClient.waitForTransactionReceipt({
        hash: burnHash,
      })

      // Step 3 & 4: Poll Circle V2 attestation API using transaction hash
      // V2 endpoint: GET /v2/messages/{sourceDomain}?transactionHash={txHash}
      setStatus('waiting_attestation')
      const sourceDomain = CCTP_DOMAINS.ETHEREUM // Sepolia = domain 0

      let attestation: string | null = null
      let messageBytes: `0x${string}` | null = null
      const maxAttempts = 90 // 15 minutes at 5s intervals
      const apiUrl = `${ATTESTATION_API}/messages/${sourceDomain}?transactionHash=${burnHash}`
      console.log('[CCTP] Polling V2 attestation API:', apiUrl)
      
      for (let i = 0; i < maxAttempts; i++) {
        setAttestationProgress(Math.min(((i + 1) / 30) * 100, 95))
        try {
          const resp = await fetch(apiUrl)
          console.log(`[CCTP] Poll ${i + 1}: status=${resp.status}`)
          
          if (!resp.ok) {
            if (resp.status !== 404) {
              const text = await resp.text().catch(() => '')
              console.log(`[CCTP] Non-OK response: ${resp.status} ${text.slice(0, 200)}`)
            }
            await new Promise((r) => setTimeout(r, 5000))
            continue
          }

          const data = await resp.json()
          console.log('[CCTP] Response:', JSON.stringify(data).slice(0, 500))
          
          if (data.messages && data.messages.length > 0) {
            const msg = data.messages[0]
            if (msg.status === 'complete' && msg.attestation) {
              attestation = msg.attestation
              messageBytes = msg.message as `0x${string}`
              console.log('[CCTP] Attestation received!')
              break
            }
          }
        } catch (err) {
          console.log('[CCTP] Poll error:', err)
        }
        await new Promise((r) => setTimeout(r, 5000))
      }

      if (!attestation || !messageBytes) {
        throw new Error(
          'Attestation timeout — Circle may take a few minutes. Try again later.'
        )
      }

      setAttestationProgress(100)

      // Step 5: Mint on Arc Testnet
      setStatus('minting')

      // Switch wallet to Arc Testnet for the mint tx
      await switchChainAsync({ chainId: arcTestnet.id })

      const mintHash = await walletClient.writeContract({
        address: ARC_CONTRACTS.MESSAGE_TRANSMITTER,
        abi: MESSAGE_TRANSMITTER_ABI,
        functionName: 'receiveMessage',
        args: [messageBytes, attestation as `0x${string}`],
        chain: arcTestnet,
        account: address as `0x${string}`,
      })
      setMintTxHash(mintHash)

      await arcClient.waitForTransactionReceipt({ hash: mintHash })

      setStatus('success')
      setAmount('')
    } catch (err) {
      console.error('Bridge failed:', err)
      setErrorMsg(err instanceof Error ? err.message : 'Bridge failed')
      setStatus('error')
    } finally {
      setLoading(false)
    }
  }

  const statusLabels: Record<BridgeStatus, string> = {
    idle: '',
    approving: 'Approving USDC on Sepolia...',
    burning: 'Burning USDC on Sepolia...',
    waiting_attestation: 'Waiting for Circle attestation...',
    minting: 'Minting USDC on Arc Testnet...',
    success: 'Bridge complete!',
    error: 'Bridge failed',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="glass-card p-6 md:p-7"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/15 to-blue-500/15 border border-cyan-500/10 flex items-center justify-center">
          <ArrowDownUp className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <h2 className="text-base font-bold text-white">CCTP Bridge</h2>
          <p className="text-xs text-slate-500">
            Sepolia → Arc Testnet via Circle
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Balance Display */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
              Sepolia USDC
            </p>
            <p className="text-lg font-bold text-white">
              {sepoliaBalance !== null
                ? `$${parseFloat(sepoliaBalance).toFixed(2)}`
                : '...'}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
              Arc USDC
            </p>
            <p className="text-lg font-bold text-white">
              {arcBalance !== null
                ? `$${parseFloat(arcBalance).toFixed(2)}`
                : '...'}
            </p>
          </div>
        </div>

        {/* Flow Indicator */}
        <div className="flex items-center justify-center gap-3 py-2">
          <span className="text-xs font-medium text-slate-400">
            Ethereum Sepolia
          </span>
          <ArrowRight className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-medium text-slate-400">
            Arc Testnet
          </span>
        </div>

        {/* Amount Input */}
        <div>
          <label className="block text-sm text-slate-400 mb-2">
            Amount (USDC)
          </label>
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
          {['10', '50', '100', '500'].map((val) => (
            <button
              key={val}
              onClick={() => setAmount(val)}
              disabled={loading}
              className={`py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                amount === val
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                  : 'bg-white/[0.03] text-slate-400 hover:bg-white/[0.06] border border-transparent hover:border-white/[0.08]'
              }`}
            >
              ${val}
            </button>
          ))}
        </div>

        {/* Bridge Button */}
        <motion.button
          onClick={handleBridge}
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
              <span>{statusLabels[status]}</span>
            </>
          ) : (
            <>
              <span className="relative z-10">Bridge to Arc Testnet</span>
              <ArrowRight className="w-4 h-4 relative z-10" />
            </>
          )}
        </motion.button>

        {/* Attestation Progress */}
        {status === 'waiting_attestation' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-amber-500/[0.06] border border-amber-500/10"
          >
            <div className="flex items-center gap-2 text-amber-400 mb-2">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">
                Waiting for Circle attestation...
              </span>
            </div>
            <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full transition-all duration-1000"
                style={{ width: `${attestationProgress}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              This typically takes 30-60 seconds on testnet
            </p>
          </motion.div>
        )}

        {/* Success */}
        {status === 'success' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/15"
          >
            <div className="flex items-center gap-2 text-emerald-400 mb-2">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm font-medium">Bridge Successful!</span>
            </div>
            <div className="space-y-1">
              {burnTxHash && (
                <a
                  href={`https://sepolia.etherscan.io/tx/${burnTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-400/70 hover:text-emerald-400 flex items-center gap-1 transition-colors"
                >
                  Burn tx on Sepolia <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {mintTxHash && (
                <a
                  href={`https://testnet.arcscan.app/tx/${mintTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-400/70 hover:text-emerald-400 flex items-center gap-1 transition-colors"
                >
                  Mint tx on Arc <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
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
              <span className="text-sm font-medium">Bridge Failed</span>
            </div>
            {errorMsg && (
              <p className="text-xs text-red-400/70 break-words">
                {errorMsg}
              </p>
            )}
          </motion.div>
        )}

        {/* Info */}
        <div className="pt-3 border-t border-white/[0.06] space-y-1.5">
          <p className="text-[10px] text-slate-500">
            Get Sepolia USDC:{' '}
            <a
              href="https://faucet.circle.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              faucet.circle.com
            </a>
          </p>
          <p className="text-[10px] text-slate-500">
            Bridge uses Circle CCTP — burn on source, attest, mint on
            destination.
          </p>
        </div>
      </div>
    </motion.div>
  )
}
