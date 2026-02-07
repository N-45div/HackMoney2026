'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { createPublicClient, http, formatUnits } from 'viem'
import { useWalletClient, useSwitchChain } from 'wagmi'
import { TrendingUp, TrendingDown, DollarSign, CreditCard, AlertTriangle, RefreshCw, ExternalLink, Bot, Zap } from 'lucide-react'
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
  const { data: walletClient } = useWalletClient()
  const { switchChainAsync } = useSwitchChain()
  const [creditInfo, setCreditInfo] = useState<CreditInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [agentTopUpLoading, setAgentTopUpLoading] = useState(false)

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

  // Demo function for Agent Top-Up (simulating agent action)
  const handleAgentTopUp = async () => {
    if (!walletClient || !address || !creditInfo) return
    setAgentTopUpLoading(true)
    
    try {
      // 1. Call LLM Agent API
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: address,
          creditInfo: {
            deposited: creditInfo.deposited.toString(),
            borrowed: creditInfo.borrowed.toString(),
            creditLimit: creditInfo.creditLimit.toString(),
            available: creditInfo.available.toString(),
          }
        })
      })
      
      const decision = await response.json()
      console.log('Agent Decision:', decision)

      if (decision.action === 'TOP_UP') {
        // 2. Execute on-chain action if Agent decides to top up
        await switchChainAsync({ chainId: arcTestnet.id })
        
        const amount = BigInt(decision.amount || '10') * 1000000n // Convert to USDC decimals
        
        // Execute top-up as "agent" (user acting as agent for demo)
        const hash = await walletClient.writeContract({
          address: CONTRACTS.CREDIT_TERMINAL,
          abi: ARC_CREDIT_TERMINAL_ABI,
          functionName: 'agentTopUp',
          args: [address as `0x${string}`, amount], 
          chain: arcTestnet,
          account: address as `0x${string}`,
        })
        
        await publicClient.waitForTransactionReceipt({ hash })
        fetchCreditInfo()
        alert(`Agent triggered top-up: ${decision.reason}`)
      } else {
        alert(`Agent decided to MONITOR only: ${decision.reason}`)
      }

    } catch (err) {
      console.error('Agent top-up failed:', err)
      alert('Agent failed to execute. Check console.')
    } finally {
      setAgentTopUpLoading(false)
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
      className="glass-card p-6 md:p-7"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/15 to-blue-500/15 border border-cyan-500/10 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Credit Dashboard</h2>
            <p className="text-xs text-slate-500">Arc Testnet</p>
          </div>
        </div>
        <button 
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-slate-500 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && !creditInfo ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading credit info...</p>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-sm text-slate-400">Health Factor</span>
              <span className={`text-sm font-semibold ${
                healthStatus === 'danger' ? 'text-red-400' :
                healthStatus === 'warning' ? 'text-amber-400' : 'text-emerald-400'
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
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Deposited</span>
              </div>
              <p className="text-2xl font-bold text-emerald-400 tracking-tight">
                ${creditInfo ? parseFloat(formatUnits(creditInfo.deposited, 6)).toFixed(2) : '0.00'}
              </p>
            </div>
            <div className="metric-card">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Borrowed</span>
              </div>
              <p className="text-2xl font-bold text-orange-400 tracking-tight">
                ${creditInfo ? parseFloat(formatUnits(creditInfo.borrowed, 6)).toFixed(2) : '0.00'}
              </p>
            </div>
            <div className="metric-card border-cyan-500/15">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Available</span>
              </div>
              <p className="text-2xl font-bold text-cyan-400 tracking-tight">
                ${creditInfo ? parseFloat(formatUnits(creditInfo.available, 6)).toFixed(2) : '0.00'}
              </p>
            </div>
            <div className="metric-card">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-3.5 h-3.5 text-slate-300" />
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Limit</span>
              </div>
              <p className="text-2xl font-bold text-slate-300 tracking-tight">
                ${creditInfo ? parseFloat(formatUnits(creditInfo.creditLimit, 6)).toFixed(2) : '0.00'}
              </p>
            </div>
          </div>

          {/* Agent Demo Panel */}
          <div className="mt-4 p-4 rounded-xl bg-violet-500/[0.04] border border-violet-500/10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-violet-400" />
                <span className="text-sm font-medium text-violet-400">Agentic Commerce Demo</span>
              </div>
              <span className="text-[10px] bg-violet-500/10 text-violet-300 px-2 py-0.5 rounded-full border border-violet-500/20">
                Prize Demo
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-3 leading-relaxed">
              Simulate an AI agent monitoring your health factor and automatically topping up your margin to prevent liquidation.
            </p>
            <motion.button
              onClick={handleAgentTopUp}
              disabled={agentTopUpLoading || !creditInfo}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full py-2.5 rounded-lg bg-violet-500/10 text-violet-300 border border-violet-500/20 hover:bg-violet-500/20 font-medium text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {agentTopUpLoading ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Agent processing...
                </>
              ) : (
                <>
                  <Zap className="w-3 h-3" />
                  Trigger Agent Top-Up (10 USDC)
                </>
              )}
            </motion.button>
          </div>

          <div className="mt-5 pt-4 border-t border-white/[0.06]">
            <a 
              href={DEPLOYMENT_TX.ARC_CREDIT_TERMINAL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-500 hover:text-white transition-colors flex items-center gap-1.5"
            >
              Contract: {CONTRACTS.CREDIT_TERMINAL.slice(0, 10)}...{CONTRACTS.CREDIT_TERMINAL.slice(-8)}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </>
      )}
    </motion.div>
  )
}
