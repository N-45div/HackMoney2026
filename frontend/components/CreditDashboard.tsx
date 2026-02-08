'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { createPublicClient, http, formatUnits } from 'viem'
import { useWalletClient, useSwitchChain } from 'wagmi'
import { TrendingUp, TrendingDown, DollarSign, CreditCard, AlertTriangle, RefreshCw, ExternalLink, Bot, Zap } from 'lucide-react'
import { arcTestnet, CONTRACTS, ARC_CREDIT_TERMINAL_ABI, DEPLOYMENT_TX } from '../lib/contracts'
import * as Nitrolite from '@erc7824/nitrolite'

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
  const [agentStatus, setAgentStatus] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null)

  const recordYellowMeterReceipt = async (decision: any) => {
    if (typeof window === 'undefined' || !address) return

    const pkKey = `nitrobridge:yellow:session_pk:${address.toLowerCase()}`
    const sessionPk = window.localStorage.getItem(pkKey)
    if (!sessionPk || !/^0x[0-9a-fA-F]{64}$/.test(sessionPk)) {
      setAgentStatus({
        type: 'info',
        message: 'Yellow session key not found. Open the Yellow tab once and connect to generate a session key, then retry.'
      })
      return
    }

    const signer = Nitrolite.createECDSAMessageSigner(sessionPk as `0x${string}`)
    const ts = Date.now()

    const payload = {
      type: 'nitrobridge_meter_event',
      product: 'risk_agent',
      action: 'risk_agent_analysis',
      asset: 'ytest.usd',
      amount: '0.01',
      wallet: address,
      decision,
      nonce: ts,
      timestamp: ts,
    }

    const signature = await signer(payload as any)
    const storageKey = `nitrobridge:meter_events:${address.toLowerCase()}`
    const existingRaw = window.localStorage.getItem(storageKey)
    const existing = existingRaw ? (JSON.parse(existingRaw) as any[]) : []
    const next = [{ ts, action: payload.action, amount: 0.01, payload, signature }, ...existing].slice(0, 50)
    window.localStorage.setItem(storageKey, JSON.stringify(next))
    window.dispatchEvent(new Event('nitrobridge:meter_events_updated'))
  }

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

  const handleAgentTopUp = async () => {
    if (!walletClient || !address || !creditInfo) return
    setAgentTopUpLoading(true)
    setAgentStatus(null)
    
    try {
      // 1. Call LLM Agent API
      setAgentStatus({ type: 'info', message: 'Analyzing credit utilization...' })
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

      // Always record a signed receipt (judge-friendly) for the agent run
      try {
        await recordYellowMeterReceipt(decision)
      } catch (e) {
        console.error('Failed to record Yellow meter receipt:', e)
      }

      if (decision.action === 'TOP_UP') {
        setAgentStatus({ type: 'info', message: `Agent recommends top-up: ${decision.reason}. Executing...` })
        
        // 2. Execute on-chain action
        await switchChainAsync({ chainId: arcTestnet.id })
        
        const amount = BigInt(decision.amount || '10') * 1000000n // Convert to USDC decimals
        
        const hash = await walletClient.writeContract({
          address: CONTRACTS.CREDIT_TERMINAL,
          abi: ARC_CREDIT_TERMINAL_ABI,
          functionName: 'agentTopUp',
          args: [address as `0x${string}`, amount], 
          chain: arcTestnet,
          account: address as `0x${string}`,
        })
        
        setAgentStatus({ type: 'info', message: 'Waiting for confirmation...' })
        await publicClient.waitForTransactionReceipt({ hash })
        fetchCreditInfo()
        setAgentStatus({ type: 'success', message: `Top-up complete — ${decision.reason}` })
      } else {
        setAgentStatus({ type: 'info', message: `Monitoring — ${decision.reason}` })
      }

    } catch (err: unknown) {
      console.error('Agent top-up failed:', err)
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setAgentStatus({ type: 'error', message: `Failed: ${msg.slice(0, 120)}` })
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

          {/* AI Risk Agent */}
          <div className="mt-4 p-4 rounded-xl bg-violet-500/[0.04] border border-violet-500/10">
            <div className="flex items-center gap-2 mb-3">
              <Bot className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-medium text-violet-400">AI Risk Agent</span>
            </div>
            <p className="text-xs text-slate-500 mb-3 leading-relaxed">
              LLM-powered agent monitors your credit utilization and automatically tops up margin to prevent liquidation.
            </p>

            {agentStatus && (
              <div className={`mb-3 p-2.5 rounded-lg text-xs leading-relaxed ${
                agentStatus.type === 'success' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' :
                agentStatus.type === 'error' ? 'bg-red-500/10 text-red-300 border border-red-500/20' :
                'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
              }`}>
                {agentStatus.message}
              </div>
            )}

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
                  Agent analyzing...
                </>
              ) : (
                <>
                  <Zap className="w-3 h-3" />
                  Run Agent Analysis
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
