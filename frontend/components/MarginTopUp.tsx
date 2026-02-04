'use client'

import { useState } from 'react'
import { parseUnits, createPublicClient, createWalletClient, http, custom } from 'viem'
import { arcTestnet, CONTRACTS, ARC_CREDIT_TERMINAL_ABI, ERC20_ABI } from '../lib/contracts'

interface MarginTopUpProps {
  address: string
}

// Create public client for Arc Testnet
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
      const depositAmount = parseUnits(amount, 6) // USDC has 6 decimals
      
      // Step 1: Approve USDC spend
      const approveHash = await walletClient.writeContract({
        address: CONTRACTS.USDC,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONTRACTS.ARC_CREDIT_TERMINAL, depositAmount],
        account,
      })
      
      // Wait for approval
      await publicClient.waitForTransactionReceipt({ hash: approveHash })
      
      // Step 2: Deposit to credit terminal
      setStatus('depositing')
      const depositHash = await walletClient.writeContract({
        address: CONTRACTS.ARC_CREDIT_TERMINAL,
        abi: ARC_CREDIT_TERMINAL_ABI,
        functionName: 'deposit',
        args: [depositAmount],
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
    <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
      <h2 className="text-xl font-semibold mb-6">Instant Margin Top-up</h2>
      
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-xl p-4 border border-yellow-500/20">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-yellow-400">⚡</span>
            <p className="text-yellow-400 font-medium">Yellow State Channel</p>
          </div>
          <p className="text-gray-400 text-sm">
            Instant off-chain transfers, zero gas fees, pre-authorized by your credit policy
          </p>
        </div>

        <div>
          <label className="block text-gray-400 text-sm mb-2">Amount (USDC)</label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-lg focus:outline-none focus:border-blue-500 transition"
            />
            <button 
              onClick={() => setAmount('1000')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-blue-400 hover:text-blue-300"
            >
              MAX
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {['100', '500', '1000'].map((val) => (
            <button
              key={val}
              onClick={() => setAmount(val)}
              className="bg-gray-800 hover:bg-gray-700 rounded-lg py-2 text-sm transition"
            >
              ${val}
            </button>
          ))}
        </div>

        <button
          onClick={handleDeposit}
          disabled={loading || !amount}
          className={`w-full py-4 rounded-xl font-semibold transition ${
            loading || !amount
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600'
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">⏳</span>
              {status === 'approving' ? 'Approving USDC...' : 'Depositing...'}
            </span>
          ) : (
            'Deposit to Credit Line'
          )}
        </button>

        {status === 'success' && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-green-400">
            <p className="text-center mb-2">✅ Deposit successful!</p>
            {txHash && (
              <a 
                href={`https://explorer.testnet.arc.network/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-green-300 hover:underline block text-center"
              >
                View on Explorer →
              </a>
            )}
          </div>
        )}

        {status === 'error' && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-center">
            <p>❌ Transaction failed</p>
            {errorMsg && <p className="text-xs mt-1 text-red-300">{errorMsg}</p>}
          </div>
        )}

        <div className="text-center text-gray-500 text-sm">
          <p>Contract: {CONTRACTS.ARC_CREDIT_TERMINAL.slice(0, 10)}...{CONTRACTS.ARC_CREDIT_TERMINAL.slice(-8)}</p>
          <p className="mt-1">Network: Arc Testnet (5042002)</p>
        </div>
      </div>
    </div>
  )
}
