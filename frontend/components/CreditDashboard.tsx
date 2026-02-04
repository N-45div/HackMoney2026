'use client'

import { useState, useEffect } from 'react'
import { formatUnits, createPublicClient, http } from 'viem'
import { arcTestnet, CONTRACTS, ARC_CREDIT_TERMINAL_ABI, DEPLOYMENT_TX } from '../lib/contracts'

interface CreditDashboardProps {
  address: string
}

interface CreditInfo {
  deposited: bigint
  borrowed: bigint
  creditLimit: bigint
  available: bigint
  lastUpdate: bigint
}

// Create public client for Arc Testnet
const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(),
})

export default function CreditDashboard({ address }: CreditDashboardProps) {
  const [creditInfo, setCreditInfo] = useState<CreditInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchCreditInfo() {
      if (!address) return
      
      setLoading(true)
      setError(null)
      
      try {
        // Fetch credit line using getCreditInfo (returns full struct)
        const creditLine = await publicClient.readContract({
          address: CONTRACTS.ARC_CREDIT_TERMINAL,
          abi: ARC_CREDIT_TERMINAL_ABI,
          functionName: 'getCreditInfo',
          args: [address as `0x${string}`],
        }) as { deposited: bigint; borrowed: bigint; creditLimit: bigint; lastUpdate: bigint; ensHash: `0x${string}` }
        
        // Also fetch available credit
        const available = await publicClient.readContract({
          address: CONTRACTS.ARC_CREDIT_TERMINAL,
          abi: ARC_CREDIT_TERMINAL_ABI,
          functionName: 'getAvailableCredit',
          args: [address as `0x${string}`],
        }) as bigint
        
        setCreditInfo({
          deposited: creditLine.deposited,
          borrowed: creditLine.borrowed,
          creditLimit: creditLine.creditLimit,
          available: available,
          lastUpdate: creditLine.lastUpdate,
        })
      } catch (err) {
        console.error('Failed to fetch credit info:', err)
        setError('Failed to load credit information')
        setCreditInfo({
          deposited: BigInt(0),
          borrowed: BigInt(0),
          creditLimit: BigInt(0),
          available: BigInt(0),
          lastUpdate: BigInt(0),
        })
      } finally {
        setLoading(false)
      }
    }
    
    fetchCreditInfo()
  }, [address])

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
        <h2 className="text-xl font-semibold mb-4">Credit Dashboard</h2>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-800 rounded w-3/4"></div>
          <div className="h-4 bg-gray-800 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  const utilizationRate = creditInfo && creditInfo.creditLimit > BigInt(0)
    ? Number(creditInfo.borrowed) / Number(creditInfo.creditLimit) * 100 
    : 0

  return (
    <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
      <h2 className="text-xl font-semibold mb-6">Credit Dashboard</h2>
      
      {error && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 mb-4 text-yellow-400 text-sm">
          {error} - Showing default values
        </div>
      )}
      
      <div className="bg-gray-800/50 rounded-lg p-2 mb-4 text-xs text-gray-500">
        <a 
          href={DEPLOYMENT_TX.ARC_CREDIT_TERMINAL}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-blue-400 transition"
        >
          Contract: {CONTRACTS.ARC_CREDIT_TERMINAL.slice(0, 10)}...{CONTRACTS.ARC_CREDIT_TERMINAL.slice(-8)} ↗
        </a>
      </div>
      
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-800 rounded-xl p-4">
            <p className="text-gray-400 text-sm">Deposited</p>
            <p className="text-2xl font-bold text-green-400">
              ${creditInfo ? formatUnits(creditInfo.deposited, 6) : '0'}
            </p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4">
            <p className="text-gray-400 text-sm">Borrowed</p>
            <p className="text-2xl font-bold text-orange-400">
              ${creditInfo ? formatUnits(creditInfo.borrowed, 6) : '0'}
            </p>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-4">
          <div className="flex justify-between mb-2">
            <p className="text-gray-400 text-sm">Available Credit</p>
            <p className="text-sm text-gray-400">{utilizationRate.toFixed(1)}% used</p>
          </div>
          <p className="text-3xl font-bold text-blue-400 mb-3">
            ${creditInfo ? formatUnits(creditInfo.available, 6) : '0'}
          </p>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all"
              style={{ width: `${utilizationRate}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-sm mb-1">Credit Limit</p>
          <p className="text-xl font-semibold">
            ${creditInfo ? formatUnits(creditInfo.creditLimit, 6) : '0'}
          </p>
        </div>
      </div>
    </div>
  )
}
