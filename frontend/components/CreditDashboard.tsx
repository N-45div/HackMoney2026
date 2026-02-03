'use client'

import { useState, useEffect } from 'react'
import { formatUnits } from 'viem'

interface CreditDashboardProps {
  address: string
}

interface CreditInfo {
  deposited: bigint
  borrowed: bigint
  creditLimit: bigint
  available: bigint
}

export default function CreditDashboard({ address }: CreditDashboardProps) {
  const [creditInfo, setCreditInfo] = useState<CreditInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Mock data for demo - replace with actual contract calls
    const mockData: CreditInfo = {
      deposited: BigInt(10000000000), // 10,000 USDC
      borrowed: BigInt(2500000000),   // 2,500 USDC
      creditLimit: BigInt(15000000000), // 15,000 USDC
      available: BigInt(12500000000),  // 12,500 USDC
    }
    
    setTimeout(() => {
      setCreditInfo(mockData)
      setLoading(false)
    }, 1000)
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

  const utilizationRate = creditInfo 
    ? Number(creditInfo.borrowed) / Number(creditInfo.creditLimit) * 100 
    : 0

  return (
    <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
      <h2 className="text-xl font-semibold mb-6">Credit Dashboard</h2>
      
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
