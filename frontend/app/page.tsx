'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Wallet,
  Zap,
  Shield,
  Activity,
  TrendingUp,
  Layers,
  RefreshCw,
  Clock,
  DollarSign,
  Globe,
  Lock,
  ChevronRight,
  ExternalLink,
  Github,
  BookOpen,
  ArrowDownUp,
  ArrowUpRight,
} from 'lucide-react'
import { useAccount } from 'wagmi'
import ConnectWallet from '@/components/ConnectWallet'
import NetworkStatus from '@/components/NetworkStatus'

const CreditDashboard = dynamic(() => import('@/components/CreditDashboard'), { ssr: false })
const MarginTopUp = dynamic(() => import('@/components/MarginTopUp'), { ssr: false })
const ChainFlow = dynamic(() => import('@/components/ChainFlow'), { ssr: false })
const CCTPBridge = dynamic(() => import('@/components/CCTPBridge'), { ssr: false })
const BorrowRepay = dynamic(() => import('@/components/BorrowRepay'), { ssr: false })
const YellowChannel = dynamic(() => import('@/components/YellowChannel'), { ssr: false })
const AntiSniperSwap = dynamic(() => import('@/components/AntiSniperSwap'), { ssr: false })

export default function Home() {
  const { address, isConnected } = useAccount()
  const [activeTab, setActiveTab] = useState<'dashboard' | 'deposit' | 'borrow' | 'bridge' | 'yellow' | 'mev'>('dashboard')

  return (
    <>
      <div className="gradient-bg" />

      <main className="min-h-screen relative flex flex-col">
        {/* ─── Header ─── */}
        <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0a0e1a]/70 border-b border-white/[0.06]">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Zap className="w-4.5 h-4.5 text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-base font-bold gradient-text leading-tight">NitroBridge</h1>
                <p className="text-[10px] text-slate-500 font-medium tracking-wide uppercase">Vault Protocol</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3"
            >
              <NetworkStatus />
              <ConnectWallet />
            </motion.div>
          </div>
        </header>

        {/* ─── Content ─── */}
        <div className="flex-1">
          <AnimatePresence mode="wait">
            {isConnected ? (
              /* ═══════════ CONNECTED STATE ═══════════ */
              <motion.div
                key="connected"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="max-w-7xl mx-auto px-6 py-8"
              >
                <ChainFlow />

                {/* Tab Navigation */}
                <div className="flex items-center gap-1 mb-8 p-1 glass-card w-fit">
                  {[
                    { id: 'dashboard', label: 'Dashboard', icon: Activity },
                    { id: 'deposit', label: 'Deposit', icon: TrendingUp },
                    { id: 'borrow', label: 'Borrow / Repay', icon: ArrowUpRight },
                    { id: 'bridge', label: 'CCTP Bridge', icon: ArrowDownUp },
                    { id: 'yellow', label: 'Yellow Channel', icon: Zap },
                    { id: 'mev', label: 'MEV Shield', icon: Shield },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as typeof activeTab)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                        activeTab === tab.id
                          ? 'bg-white/[0.08] text-white shadow-sm'
                          : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
                      }`}
                    >
                      <tab.icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Main Content */}
                {activeTab === 'dashboard' && (
                  <div className="grid lg:grid-cols-2 gap-6">
                    <CreditDashboard address={address || ''} />
                    <BorrowRepay address={address || ''} />
                  </div>
                )}
                {activeTab === 'deposit' && (
                  <div className="grid lg:grid-cols-2 gap-6">
                    <MarginTopUp address={address || ''} />
                    <CreditDashboard address={address || ''} />
                  </div>
                )}
                {activeTab === 'borrow' && (
                  <div className="grid lg:grid-cols-2 gap-6">
                    <BorrowRepay address={address || ''} />
                    <CreditDashboard address={address || ''} />
                  </div>
                )}
                {activeTab === 'bridge' && (
                  <div className="grid lg:grid-cols-2 gap-6">
                    <CCTPBridge address={address || ''} />
                    <CreditDashboard address={address || ''} />
                  </div>
                )}
                {activeTab === 'yellow' && (
                  <div className="grid lg:grid-cols-2 gap-6">
                    <YellowChannel address={address || ''} />
                    <CreditDashboard address={address || ''} />
                  </div>
                )}
                {activeTab === 'mev' && (
                  <div className="grid lg:grid-cols-2 gap-6">
                    <AntiSniperSwap address={address || ''} />
                    <CreditDashboard address={address || ''} />
                  </div>
                )}

                {/* Features */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="grid md:grid-cols-3 gap-5 mt-10"
                >
                  <FeatureCard
                    icon={<Zap className="w-5 h-5 text-amber-400" />}
                    title="Instant Top-ups"
                    description="Sub-second margin refills via Yellow state channels"
                    gradient="from-amber-500/10 to-orange-500/5"
                    border="border-amber-500/10"
                  />
                  <FeatureCard
                    icon={<Shield className="w-5 h-5 text-blue-400" />}
                    title="MEV Protected"
                    description="Commit-reveal swaps on Uniswap v4 hooks"
                    gradient="from-blue-500/10 to-indigo-500/5"
                    border="border-blue-500/10"
                  />
                  <FeatureCard
                    icon={<Layers className="w-5 h-5 text-cyan-400" />}
                    title="Cross-Chain"
                    description="Seamless USDC bridging via Circle CCTP"
                    gradient="from-cyan-500/10 to-teal-500/5"
                    border="border-cyan-500/10"
                  />
                </motion.div>
              </motion.div>
            ) : (
              /* ═══════════ LANDING PAGE ═══════════ */
              <motion.div
                key="disconnected"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -20 }}
              >
                {/* ── Hero ── */}
                <section className="relative overflow-hidden">
                  {/* Decorative orbs */}
                  <div className="absolute top-20 left-1/4 w-96 h-96 bg-emerald-500/8 rounded-full blur-[120px] pointer-events-none" />
                  <div className="absolute top-40 right-1/4 w-80 h-80 bg-amber-500/6 rounded-full blur-[100px] pointer-events-none" />
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-40 bg-cyan-500/5 rounded-full blur-[80px] pointer-events-none" />

                  <div className="max-w-7xl mx-auto px-6 pt-20 pb-24 md:pt-32 md:pb-32 relative">
                    <div className="text-center max-w-4xl mx-auto">
                      {/* Badge */}
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.1, duration: 0.5 }}
                        className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm mb-8"
                      >
                        <span className="status-dot status-active" />
                        <span className="text-sm text-slate-300 font-medium">Live on Arc Testnet</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                      </motion.div>

                      {/* Headline */}
                      <motion.h1
                        initial={{ y: 30, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2, duration: 0.6 }}
                        className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.05] mb-6"
                      >
                        <span className="gradient-text">Instant Margin</span>
                        <br />
                        <span className="text-white">Across Chains</span>
                      </motion.h1>

                      {/* Subheadline */}
                      <motion.p
                        initial={{ y: 30, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3, duration: 0.6 }}
                        className="text-lg md:text-xl text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed"
                      >
                        Never get liquidated due to slow bridges. Sub-second margin top-ups
                        via Yellow state channels with MEV-protected execution on Uniswap v4.
                      </motion.p>

                      {/* CTA */}
                      <motion.div
                        initial={{ y: 30, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.4, duration: 0.6 }}
                        className="flex flex-col sm:flex-row items-center justify-center gap-4"
                      >
                        <ConnectWallet large />
                        <a
                          href="https://github.com/N-45div/HackMoney2026"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-6 py-4 rounded-xl text-sm font-medium text-slate-300 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.15] transition-all duration-200"
                        >
                          <Github className="w-4 h-4" />
                          View Source
                        </a>
                      </motion.div>
                    </div>

                    {/* Stats bar */}
                    <motion.div
                      initial={{ y: 40, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.55, duration: 0.5 }}
                      className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 max-w-3xl mx-auto"
                    >
                      <StatItem label="Settlement" value="<100ms" icon={<Clock className="w-4 h-4 text-emerald-400" />} />
                      <StatItem label="Gas Cost" value="$0" icon={<DollarSign className="w-4 h-4 text-amber-400" />} />
                      <StatItem label="Networks" value="3" icon={<Globe className="w-4 h-4 text-cyan-400" />} />
                      <StatItem label="MEV Shield" value="Active" icon={<Lock className="w-4 h-4 text-slate-300" />} />
                    </motion.div>
                  </div>
                </section>

                {/* ── How It Works ── */}
                <section className="relative border-t border-white/[0.04]">
                  <div className="max-w-7xl mx-auto px-6 py-24">
                    <motion.div
                      initial={{ y: 30, opacity: 0 }}
                      whileInView={{ y: 0, opacity: 1 }}
                      viewport={{ once: true, margin: '-100px' }}
                      transition={{ duration: 0.5 }}
                      className="text-center mb-16"
                    >
                      <p className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-3">How It Works</p>
                      <h2 className="text-3xl md:text-4xl font-bold text-white">Four steps to instant margin</h2>
                    </motion.div>

                    <div className="grid md:grid-cols-4 gap-6 md:gap-4">
                      {[
                        { step: 1, title: 'Deposit USDC', desc: 'Deposit on Arc Testnet to open your revolving credit line', icon: <Wallet className="w-6 h-6" />, color: 'text-cyan-400' },
                        { step: 2, title: 'Trade Anywhere', desc: 'Use your margin across supported chains seamlessly', icon: <Activity className="w-6 h-6" />, color: 'text-emerald-400' },
                        { step: 3, title: 'Instant Top-up', desc: 'Yellow state channels refill margin in under 100ms', icon: <Zap className="w-6 h-6" />, color: 'text-amber-400' },
                        { step: 4, title: 'MEV Protected', desc: 'Commit-reveal swaps on Uniswap v4 prevent frontrunning', icon: <Shield className="w-6 h-6" />, color: 'text-slate-300' },
                      ].map((item, i) => (
                        <motion.div
                          key={item.step}
                          initial={{ y: 30, opacity: 0 }}
                          whileInView={{ y: 0, opacity: 1 }}
                          viewport={{ once: true, margin: '-50px' }}
                          transition={{ delay: i * 0.1, duration: 0.4 }}
                          className="relative group"
                        >
                          {/* Connector line */}
                          {i < 3 && (
                            <div className="hidden md:block absolute top-10 left-[calc(50%+32px)] right-[calc(-50%+32px)] h-px bg-gradient-to-r from-white/10 to-white/5" />
                          )}
                          <div className="text-center">
                            <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] mb-5 group-hover:border-white/[0.15] group-hover:bg-white/[0.06] transition-all duration-300">
                              <span className={item.color}>{item.icon}</span>
                              <span className="absolute -top-2.5 -right-2.5 w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 text-[11px] font-bold flex items-center justify-center text-white shadow-lg">
                                {item.step}
                              </span>
                            </div>
                            <h4 className="font-semibold text-white mb-2">{item.title}</h4>
                            <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* ── Architecture ── */}
                <section className="relative border-t border-white/[0.04]">
                  <div className="max-w-7xl mx-auto px-6 py-24">
                    <motion.div
                      initial={{ y: 30, opacity: 0 }}
                      whileInView={{ y: 0, opacity: 1 }}
                      viewport={{ once: true, margin: '-100px' }}
                      transition={{ duration: 0.5 }}
                      className="text-center mb-16"
                    >
                      <p className="text-sm font-semibold text-cyan-400 uppercase tracking-wider mb-3">Architecture</p>
                      <h2 className="text-3xl md:text-4xl font-bold text-white">Built on battle-tested protocols</h2>
                    </motion.div>

                    <div className="grid md:grid-cols-3 gap-6">
                      <ArchCard
                        title="Yellow Nitrolite"
                        subtitle="State Channels"
                        description="Off-chain state channels enable sub-second margin top-ups with zero gas costs. Cryptographically signed states ensure security."
                        badge="yellow"
                        stats={[
                          { label: 'Latency', value: '<100ms' },
                          { label: 'Gas', value: '$0' },
                        ]}
                        delay={0}
                      />
                      <ArchCard
                        title="Circle CCTP"
                        subtitle="Cross-Chain Bridge"
                        description="Native USDC bridging between Sepolia and Arc Testnet with Circle attestation for trustless cross-chain transfers."
                        badge="circle"
                        stats={[
                          { label: 'Bridge Time', value: '~60s' },
                          { label: 'Asset', value: 'USDC' },
                        ]}
                        delay={0.1}
                      />
                      <ArchCard
                        title="Uniswap v4"
                        subtitle="MEV Protection"
                        description="Custom AntiSniperHook uses commit-reveal pattern to hide order details until execution, preventing frontrunning."
                        badge="base"
                        stats={[
                          { label: 'Pattern', value: 'Commit-Reveal' },
                          { label: 'Hook', value: 'beforeSwap' },
                        ]}
                        delay={0.2}
                      />
                    </div>
                  </div>
                </section>

                {/* ── Sponsors / Powered By ── */}
                <section className="border-t border-white/[0.04]">
                  <div className="max-w-7xl mx-auto px-6 py-16">
                    <motion.div
                      initial={{ opacity: 0 }}
                      whileInView={{ opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5 }}
                      className="text-center"
                    >
                      <p className="text-sm text-slate-500 mb-6 uppercase tracking-wider font-medium">Powered By</p>
                      <div className="flex flex-wrap items-center justify-center gap-4">
                        <span className="chain-badge chain-arc">Arc Network</span>
                        <span className="chain-badge chain-base">Uniswap v4</span>
                        <span className="chain-badge chain-yellow">Yellow Network</span>
                        <span className="chain-badge chain-circle">Circle CCTP</span>
                      </div>
                    </motion.div>
                  </div>
                </section>

                {/* ── CTA Banner ── */}
                <section className="border-t border-white/[0.04]">
                  <div className="max-w-7xl mx-auto px-6 py-24">
                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      whileInView={{ y: 0, opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5 }}
                      className="relative overflow-hidden rounded-3xl p-10 md:p-16 text-center"
                      style={{
                        background: 'linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(6,182,212,0.06) 50%, rgba(245,158,11,0.04) 100%)',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
                      <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Ready to trade without fear?</h2>
                      <p className="text-slate-400 mb-8 max-w-lg mx-auto">
                        Connect your wallet and experience instant cross-chain margin on Arc Testnet.
                      </p>
                      <div className="flex justify-center">
                        <ConnectWallet large />
                      </div>
                    </motion.div>
                  </div>
                </section>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ─── Footer ─── */}
        <footer className="border-t border-white/[0.04] mt-auto">
          <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                <Zap className="w-3 h-3 text-white" />
              </div>
              <span className="text-sm text-slate-500">Built for <span className="text-slate-300 font-medium">HackMoney 2026</span></span>
            </div>
            <div className="flex items-center gap-5">
              <a href="https://github.com/N-45div/HackMoney2026" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-white transition-colors">
                <Github className="w-4 h-4" />
                GitHub
              </a>
              <a href="https://docs.yellow.org" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-white transition-colors">
                <BookOpen className="w-4 h-4" />
                Docs
              </a>
            </div>
          </div>
        </footer>
      </main>
    </>
  )
}

/* ─── Sub-components ─── */

function StatItem({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="text-center p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
      <div className="flex items-center justify-center gap-2 mb-1.5">
        {icon}
        <span className="text-xl font-bold text-white">{value}</span>
      </div>
      <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">{label}</p>
    </div>
  )
}

function FeatureCard({ icon, title, description, gradient, border }: {
  icon: React.ReactNode
  title: string
  description: string
  gradient: string
  border: string
}) {
  return (
    <div className={`glass-card glass-card-hover p-6 bg-gradient-to-br ${gradient} ${border}`}>
      <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center mb-4">
        {icon}
      </div>
      <h4 className="font-semibold text-white mb-1.5">{title}</h4>
      <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
    </div>
  )
}

function ArchCard({ title, subtitle, description, badge, stats, delay }: {
  title: string
  subtitle: string
  description: string
  badge: 'yellow' | 'base' | 'circle' | 'arc'
  stats: { label: string; value: string }[]
  delay: number
}) {
  return (
    <motion.div
      initial={{ y: 30, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ delay, duration: 0.4 }}
      className="glass-card glass-card-hover p-7"
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-bold text-white text-lg">{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        <span className={`chain-badge chain-${badge}`}>{badge === 'circle' ? 'CCTP' : badge}</span>
      </div>
      <p className="text-sm text-slate-400 leading-relaxed mb-6">{description}</p>
      <div className="flex gap-4 pt-4 border-t border-white/[0.06]">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{s.label}</p>
            <p className="text-sm font-semibold text-white">{s.value}</p>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
