'use client'

import { motion } from 'framer-motion'
import { ArrowRight, Zap } from 'lucide-react'

export default function ChainFlow() {
  return (
    <div className="glass-card p-6 mb-8 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-secondary uppercase tracking-wide">
          Cross-Chain Flow
        </h3>
        <div className="flex items-center gap-2">
          <span className="status-dot status-active" />
          <span className="text-xs text-green">All Systems Operational</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        {/* Arc Chain */}
        <ChainNode
          name="Arc Testnet"
          role="Credit Hub"
          color="cyan"
          icon="🔵"
          delay={0}
        />

        {/* Flow Arrow 1 */}
        <FlowArrow delay={0.2} label="CCTP" />

        {/* Base Sepolia */}
        <ChainNode
          name="Base Sepolia"
          role="Uniswap v4"
          color="blue"
          icon="🔷"
          delay={0.3}
        />

        {/* Flow Arrow 2 */}
        <FlowArrow delay={0.4} label="Yellow" highlight />

        {/* Yellow Network */}
        <ChainNode
          name="Yellow Network"
          role="State Channels"
          color="yellow"
          icon="⚡"
          delay={0.5}
        />
      </div>

      {/* Live Activity Indicator */}
      <div className="mt-6 pt-4 border-t border-white/5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green animate-pulse" />
              <span className="text-muted">Last sync: 2s ago</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-3 h-3 text-yellow" />
              <span className="text-muted">Avg top-up: 87ms</span>
            </div>
          </div>
          <span className="text-muted">Block: #1,234,567</span>
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
  delay 
}: { 
  name: string
  role: string
  color: 'cyan' | 'blue' | 'yellow' | 'purple' | 'green'
  icon: string
  delay: number
}) {
  const colorClasses = {
    cyan: 'from-cyan-500/20 to-cyan-500/5 border-cyan-500/30',
    blue: 'from-blue-500/20 to-blue-500/5 border-blue-500/30',
    yellow: 'from-yellow-500/20 to-yellow-500/5 border-yellow-500/30',
    purple: 'from-purple-500/20 to-purple-500/5 border-purple-500/30',
    green: 'from-green-500/20 to-green-500/5 border-green-500/30',
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.3 }}
      className={`flex-1 max-w-[180px] p-4 rounded-xl bg-gradient-to-br ${colorClasses[color]} border text-center`}
    >
      <div className="text-2xl mb-2">{icon}</div>
      <h4 className="font-semibold text-sm">{name}</h4>
      <p className="text-xs text-muted mt-1">{role}</p>
    </motion.div>
  )
}

function FlowArrow({ delay, label, highlight }: { delay: number; label: string; highlight?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="flex flex-col items-center gap-1"
    >
      <div className={`flex items-center gap-1 ${highlight ? 'text-yellow' : 'text-muted'}`}>
        <div className={`h-px w-8 ${highlight ? 'bg-yellow' : 'bg-white/20'}`} />
        <ArrowRight className="w-4 h-4" />
        <div className={`h-px w-8 ${highlight ? 'bg-yellow' : 'bg-white/20'}`} />
      </div>
      <span className={`text-xs ${highlight ? 'text-yellow font-medium' : 'text-muted'}`}>
        {label}
      </span>
    </motion.div>
  )
}
