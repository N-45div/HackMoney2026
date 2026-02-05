'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { createPublicClient, http, formatUnits } from 'viem'
import { TrendingUp, TrendingDown, DollarSign, CreditCard, AlertTriangle, RefreshCw } from 'lucide-react'
import { arcTestnet, CONTRACTS, ARC_CREDIT_TERMINAL_ABI, DEPLOYMENT_TX } from '../lib/contracts'

interface CreditInfo {
  deposited: bigint
  borrowed: bigint
  creditLimit: bigint
  available: bigint
}

interface CreditDashboardProps {
  address: string
}

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(),
})

export default function CreditDashboard({ address }: CreditDashboardProps) {
  const [creditInfo, setCreditInfo] = useState<CreditInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  async function fetchCreditInfo() {
    if (!address) return
    
    try {
      const creditLine = await publicClient.readContract({
        address: CONTRACTS.CREDIT_TERMINAL,
        abi: ARC_CREDIT_TERMINAL_ABI,
        functionName: 'getCreditInfo',
        args: [address as `0x${string}`],
      }) as { deposited: bigint; borrowed: bigint; creditLimit: bigint; lastUpdate: bigint; ensHash: `0x${string}` }
      
      const available = await publicClient.readContract({
        address: CONTRACTS.CREDIT_TERMINAL,
        abi: ARC_CREDIT_TERMINAL_ABI,
        functionName: 'getAvailableCredit',
        args: [address as `0x${string}`],
      }) as bigint
      
      setCreditInfo({
        deposited: creditLine.deposited,
        borrowed: creditLine.borrowed,
        creditLimit: creditLine.creditLimit,
        available: available,
      })
      setError(null)
    } catch (err) {
      console.error('Error fetching credit info:', err)
      setError('Failed to fetch credit info')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    fetchCreditInfo()
    const interval = setInterval(fetchCreditInfo, 30000)
    return () => clearInterval(interval)
  }, [address])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchCreditInfo()
  }

  const utilizationRate = creditInfo && creditInfo.creditLimit > 0n
    ? Number((creditInfo.borrowed * 100n) / creditInfo.creditLimit)
    : 0

  const healthStatus = utilizationRate > 80 ? 'danger' : utilizationRate > 50 ? 'warning' : 'healthy'

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-cyan" />
          </div>
          <div>
            <h2 className="font-semibold">Credit Dashboard</h2>
            <p className="text-xs text-muted">Arc Testnet</p>
          </div>
        </div>
        <button 
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 rounded-lg hover:bg-white/5 transition"
        >
          <RefreshCw className={`w-4 h-4 text-muted ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && !creditInfo ? (
        <div className="text-center py-12">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted">Loading credit info...</p>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <AlertTriangle className="w-10 h-10 text-red mx-auto mb-4" />
          <p className="text-sm text-red">{error}</p>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-secondary">Health Factor</span>
              <span className={`text-sm font-semibold ${
                healthStatus === 'danger' ? 'text-red' :
                healthStatus === 'warning' ? 'text-yellow' : 'text-green'
              }`}>
                {utilizationRate}% Utilized
              </span>
            </div>
            <div className="progress-bar">
              <div 
                className={`progress-fill ${
                  healthStatus === 'danger' ? 'progress-danger' :
                  healthStatus === 'warning' ? 'progress-warning' : 'progress-healthy'
                }`}
                style={{ width: `${Math.min(utilizationRate, 100)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="metric-card">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green" />
                <span className="text-xs text-muted uppercase">Deposited</span>
              </div>
              <p className="metric-value text-green">
                ${creditInfo ? parseFloat(formatUnits(creditInfo.deposited, 6)).toFixed(2) : '0.00'}
              </p>
            </div>
            <div className="metric-card">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-4 h-4 text-orange" />
                <span className="text-xs text-muted uppercase">Borrowed</span>
              </div>
              <p className="metric-value text-orange">
                ${creditInfo ? parseFloat(formatUnits(creditInfo.borrowed, 6)).toFixed(2) : '0.00'}
              </p>
            </div>
            <div className="metric-card ring-1 ring-cyan/30">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-cyan" />
                <span className="text-xs text-muted uppercase">Available</span>
              </div>
              <p className="metric-value text-cyan">
                ${creditInfo ? parseFloat(formatUnits(creditInfo.available, 6)).toFixed(2) : '0.00'}
              </p>
            </div>
            <div className="metric-card">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-4 h-4 text-purple" />
                <span className="text-xs text-muted uppercase">Limit</span>
              </div>
              <p className="metric-value text-purple">
                ${creditInfo ? parseFloat(formatUnits(creditInfo.creditLimit, 6)).toFixed(2) : '0.00'}
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/5">
            <a 
              href={DEPLOYMENT_TX.ARC_CREDIT_TERMINAL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted hover:text-white transition"
            >
              Contract: {CONTRACTS.CREDIT_TERMINAL.slice(0, 10)}...{CONTRACTS.CREDIT_TERMINAL.slice(-8)} ↗
            </a>
          </div>
        </>
      )}
    </motion.div>
  )
}
