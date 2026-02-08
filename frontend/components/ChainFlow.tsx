'use client'

import { motion } from 'framer-motion'
import { ArrowRight, Zap } from 'lucide-react'

export default function ChainFlow() {
  return (
    <div className="glass-card p-6 md:p-7 mb-8 overflow-hidden">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
          Cross-Chain Flow
        </h3>
        <div className="flex items-center gap-2">
          <span className="status-dot status-active" />
          <span className="text-xs text-emerald-400 font-medium">All Systems Operational</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 md:gap-4">
        <ChainNode
          name="Arc Testnet"
          role="Credit Hub"
          color="cyan"
          icon="🔵"
          delay={0}
        />
        <FlowArrow delay={0.2} label="CCTP" />
        <ChainNode
          name="Ethereum Sepolia"
          role="Uniswap v4"
          color="blue"
          icon="🔷"
          delay={0.3}
        />
        <FlowArrow delay={0.4} label="Yellow" highlight />
        <ChainNode
          name="Yellow Network"
          role="State Channels"
          color="amber"
          icon="⚡"
          delay={0.5}
        />
      </div>

      <div className="mt-5 pt-4 border-t border-white/[0.06]">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-500">Last sync: 2s ago</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-amber-400" />
              <span className="text-slate-500">Avg top-up: 87ms</span>
            </div>
          </div>
          <span className="text-slate-600 hidden sm:block">Block: #1,234,567</span>
        </div>
      </div>
    </div>
  )
}

function ChainNode({
  name,
  role,
  color,
  icon,
  delay,
}: {
  name: string
  role: string
  color: 'cyan' | 'blue' | 'amber' | 'violet' | 'emerald'
  icon: string
  delay: number
}) {
  const colorMap = {
    cyan: 'from-cyan-500/15 to-cyan-500/5 border-cyan-500/20',
    blue: 'from-blue-500/15 to-blue-500/5 border-blue-500/20',
    amber: 'from-amber-500/15 to-amber-500/5 border-amber-500/20',
    violet: 'from-violet-500/15 to-violet-500/5 border-violet-500/20',
    emerald: 'from-emerald-500/15 to-emerald-500/5 border-emerald-500/20',
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.3 }}
      className={`flex-1 max-w-[160px] p-3.5 rounded-xl bg-gradient-to-br ${colorMap[color]} border text-center`}
    >
      <div className="text-xl mb-1.5">{icon}</div>
      <h4 className="font-semibold text-xs text-white">{name}</h4>
      <p className="text-[10px] text-slate-500 mt-0.5">{role}</p>
    </motion.div>
  )
}

function FlowArrow({ delay, label, highlight }: { delay: number; label: string; highlight?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="flex flex-col items-center gap-1 shrink-0"
    >
      <div className={`flex items-center gap-0.5 ${highlight ? 'text-amber-400' : 'text-slate-600'}`}>
        <div className={`h-px w-4 md:w-8 ${highlight ? 'bg-amber-400/50' : 'bg-white/10'}`} />
        <ArrowRight className="w-3.5 h-3.5" />
        <div className={`h-px w-4 md:w-8 ${highlight ? 'bg-amber-400/50' : 'bg-white/10'}`} />
      </div>
      <span className={`text-[10px] ${highlight ? 'text-amber-400 font-medium' : 'text-slate-600'}`}>
        {label}
      </span>
    </motion.div>
  )
}
