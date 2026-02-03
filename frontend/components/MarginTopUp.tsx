'use client'

import { useState } from 'react'

interface MarginTopUpProps {
  address: string
}

export default function MarginTopUp({ address }: MarginTopUpProps) {
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle')

  const handleTopUp = async () => {
    if (!amount || parseFloat(amount) <= 0) return
    
    setLoading(true)
    setStatus('processing')
    
    // Simulate Yellow state channel top-up
    try {
      await new Promise(resolve => setTimeout(resolve, 2000))
      setStatus('success')
      setAmount('')
    } catch {
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
          onClick={handleTopUp}
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
              Processing via Yellow...
            </span>
          ) : (
            'Request Instant Top-up'
          )}
        </button>

        {status === 'success' && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-green-400 text-center">
            ✅ Top-up successful! Funds added instantly via state channel.
          </div>
        )}

        {status === 'error' && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-center">
            ❌ Top-up failed. Please try again.
          </div>
        )}

        <div className="text-center text-gray-500 text-sm">
          <p>Powered by Yellow Nitrolite SDK</p>
          <p className="mt-1">Endpoint: wss://clearnet-sandbox.yellow.com/ws</p>
        </div>
      </div>
    </div>
  )
}
