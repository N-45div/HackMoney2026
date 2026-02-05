'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Wallet, 
  Zap, 
  Shield, 
  ArrowRight, 
  Activity,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Layers,
  RefreshCw
} from 'lucide-react'
import CreditDashboard from '@/components/CreditDashboard'
import MarginTopUp from '@/components/MarginTopUp'
import ConnectWallet from '@/components/ConnectWallet'
import ChainFlow from '@/components/ChainFlow'
import NetworkStatus from '@/components/NetworkStatus'

export default function Home() {
  const [connected, setConnected] = useState(false)
  const [address, setAddress] = useState('')
  const [activeTab, setActiveTab] = useState<'dashboard' | 'deposit' | 'bridge'>('dashboard')

  return (
    <>
      <div className="gradient-bg" />
      
      <main className="min-h-screen relative">
        {/* Header */}
        <header className="container py-6">
          <nav className="flex items-center justify-between">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold gradient-text">NitroBridge</h1>
                <p className="text-xs text-muted">Instant Cross-Chain Margin</p>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-4"
            >
              <NetworkStatus />
              <ConnectWallet 
                onConnect={(addr) => { setConnected(true); setAddress(addr) }}
                connected={connected}
                address={address}
              />
            </motion.div>
          </nav>
        </header>

        <div className="container py-8">
          <AnimatePresence mode="wait">
            {connected ? (
              <motion.div
                key="connected"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                {/* Chain Flow Visualization */}
                <ChainFlow />

                {/* Tab Navigation */}
                <div className="flex items-center gap-2 mb-8 p-1 glass-card w-fit">
                  {[
                    { id: 'dashboard', label: 'Dashboard', icon: Activity },
                    { id: 'deposit', label: 'Deposit', icon: TrendingUp },
                    { id: 'bridge', label: 'Bridge', icon: RefreshCw },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as typeof activeTab)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                        activeTab === tab.id
                          ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white'
                          : 'text-secondary hover:text-white'
                      }`}
                    >
                      <tab.icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Main Content */}
                <div className="grid lg:grid-cols-2 gap-6">
                  <CreditDashboard address={address} />
                  <MarginTopUp address={address} />
                </div>

                {/* Features Section */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="grid md:grid-cols-3 gap-4 mt-8"
                >
                  <FeatureCard
                    icon={<Zap className="w-5 h-5 text-yellow" />}
                    title="Instant Top-ups"
                    description="Sub-second margin refills via Yellow state channels"
                    color="yellow"
                  />
                  <FeatureCard
                    icon={<Shield className="w-5 h-5 text-blue" />}
                    title="MEV Protected"
                    description="Commit-reveal swaps on Uniswap v4 hooks"
                    color="blue"
                  />
                  <FeatureCard
                    icon={<Layers className="w-5 h-5 text-cyan" />}
                    title="Cross-Chain"
                    description="Seamless USDC bridging via Circle CCTP"
                    color="cyan"
                  />
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                key="disconnected"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="py-12"
              >
                {/* Hero Section */}
                <div className="text-center max-w-3xl mx-auto mb-16">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card mb-6"
                  >
                    <span className="status-dot status-active" />
                    <span className="text-sm text-secondary">Live on Arc Testnet</span>
                  </motion.div>

                  <motion.h2
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-5xl font-bold mb-6"
                  >
                    <span className="gradient-text">Instant Margin</span>
                    <br />
                    <span className="text-primary">Across Chains</span>
                  </motion.h2>

                  <motion.p
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-lg text-secondary mb-8 max-w-xl mx-auto"
                  >
                    Never get liquidated due to slow bridges. NitroBridge uses Yellow state channels 
                    for instant margin top-ups with MEV-protected swaps on Uniswap v4.
                  </motion.p>

                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="flex items-center justify-center gap-4"
                  >
                    <ConnectWallet 
                      onConnect={(addr) => { setConnected(true); setAddress(addr) }}
                      connected={connected}
                      address={address}
                      large
                    />
                  </motion.div>
                </div>

                {/* How It Works */}
                <motion.div
                  initial={{ y: 40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="glass-card p-8 rounded-2xl"
                >
                  <h3 className="text-xl font-semibold mb-6 text-center">How It Works</h3>
                  
                  <div className="grid md:grid-cols-4 gap-6">
                    <StepCard
                      step={1}
                      title="Deposit USDC"
                      description="Deposit on Arc to open your credit line"
                      icon={<Wallet className="w-6 h-6" />}
                    />
                    <StepCard
                      step={2}
                      title="Trade Anywhere"
                      description="Use your margin across supported chains"
                      icon={<Activity className="w-6 h-6" />}
                    />
                    <StepCard
                      step={3}
                      title="Instant Top-up"
                      description="Yellow channels refill margin in <100ms"
                      icon={<Zap className="w-6 h-6" />}
                    />
                    <StepCard
                      step={4}
                      title="MEV Protected"
                      description="Commit-reveal swaps prevent frontrunning"
                      icon={<Shield className="w-6 h-6" />}
                    />
                  </div>
                </motion.div>

                {/* Sponsor Logos */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="flex items-center justify-center gap-8 mt-12 text-muted"
                >
                  <span className="text-sm">Powered by</span>
                  <div className="flex items-center gap-6">
                    <span className="chain-badge chain-arc">Arc</span>
                    <span className="chain-badge chain-base">Uniswap v4</span>
                    <span className="chain-badge chain-yellow">Yellow</span>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <footer className="container py-8 mt-auto">
          <div className="flex items-center justify-between text-sm text-muted">
            <p>Built for HackMoney 2026</p>
            <div className="flex items-center gap-4">
              <a href="https://github.com/N-45div/HackMoney2026" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">
                GitHub
              </a>
              <a href="https://docs.yellow.org" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">
                Docs
              </a>
            </div>
          </div>
        </footer>
      </main>
    </>
  )
}

function FeatureCard({ icon, title, description, color }: { 
  icon: React.ReactNode
  title: string
  description: string
  color: 'yellow' | 'blue' | 'cyan' | 'purple' | 'green'
}) {
  return (
    <div className="glass-card glass-card-hover p-5">
      <div className={`w-10 h-10 rounded-lg bg-${color}/10 flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <h4 className="font-semibold mb-1">{title}</h4>
      <p className="text-sm text-secondary">{description}</p>
    </div>
  )
}

function StepCard({ step, title, description, icon }: {
  step: number
  title: string
  description: string
  icon: React.ReactNode
}) {
  return (
    <div className="text-center">
      <div className="relative inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 mb-4">
        {icon}
        <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-xs font-bold flex items-center justify-center">
          {step}
        </span>
      </div>
      <h4 className="font-semibold mb-1">{title}</h4>
      <p className="text-sm text-muted">{description}</p>
    </div>
  )
}
