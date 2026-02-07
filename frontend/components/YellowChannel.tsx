'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import * as Nitrolite from '@erc7824/nitrolite'
import { useWalletClient } from 'wagmi'
import {
  Zap,
  Wifi,
  WifiOff,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Radio,
  Send,
  LogOut,
  ArrowRight,
} from 'lucide-react'

interface YellowChannelProps {
  address: string
}

const CLEARNODE_WS = 'wss://clearnet-sandbox.yellow.com/ws'

type ConnectionStatus = 'disconnected' | 'connecting' | 'authenticating' | 'connected' | 'error'

export default function YellowChannel({ address }: YellowChannelProps) {
  const { data: walletClient } = useWalletClient()
  const wsRef = useRef<WebSocket | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [logs, setLogs] = useState<Array<{ time: string; msg: string; type: 'info' | 'success' | 'error' | 'send' | 'receive' }>>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [transferAmount, setTransferAmount] = useState('100')
  const [counterparty, setCounterparty] = useState('')
  const [transferring, setTransferring] = useState(false)
  const [jwtToken, setJwtToken] = useState<string | null>(null)
  const [sendAmount, setSendAmount] = useState('10')

  // Store auth request params for EIP-712 signing
  const authParamsRef = useRef<any>(null)

  const addLog = useCallback((msg: string, type: 'info' | 'success' | 'error' | 'send' | 'receive' = 'info') => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setLogs(prev => [...prev.slice(-30), { time, msg, type }])
  }, [])

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setStatus('disconnected')
    setSessionId(null)
    setJwtToken(null)
    addLog('Disconnected from ClearNode', 'info')
  }, [addLog])

  const connect = useCallback(async () => {
    if (!walletClient || !address) {
      setErrorMsg('Connect your wallet first')
      return
    }

    setStatus('connecting')
    setErrorMsg(null)
    addLog('Connecting to Yellow ClearNode...', 'info')

    try {
      const ws = new WebSocket(CLEARNODE_WS)
      wsRef.current = ws

      ws.onopen = async () => {
        addLog('WebSocket connected', 'success')
        setStatus('authenticating')
        addLog('Sending auth request...', 'send')

        try {
          // Create auth request
          const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 3600)
          const authRequestMsg = await Nitrolite.createAuthRequestMessage({
            address: address as `0x${string}`,
            session_key: address as `0x${string}`, // Use same address as session key for simplicity
            application: 'NitroBridge Vault',
            expires_at: expiresAt,
            scope: 'console',
            allowances: [
              { asset: 'ytest.usd', amount: '10000' },
            ],
          })

          // Store params for later EIP-712 signing
          authParamsRef.current = {
            scope: 'console',
            application: 'NitroBridge Vault',
            participant: address,
            expires_at: expiresAt,
            allowances: [
              { asset: 'ytest.usd', amount: '10000' },
            ],
          }

          ws.send(authRequestMsg)
        } catch (err) {
          addLog(`Auth request failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error')
          setStatus('error')
          setErrorMsg('Failed to create auth request')
        }
      }

      ws.onmessage = async (event) => {
        try {
          const message = Nitrolite.parseAnyRPCResponse(event.data.toString())
          if (!message) return

          const method = (message as any).method || (message as any).res?.[1]

          switch (method) {
            case 'auth_challenge': {
              addLog('Received auth challenge', 'receive')
              addLog('Signing EIP-712 auth verify...', 'send')

              try {
                // Create EIP-712 message signer
                const eip712Signer = Nitrolite.createEIP712AuthMessageSigner(
                  walletClient,
                  {
                    scope: authParamsRef.current.scope,
                    session_key: authParamsRef.current.participant, // Use participant (address) as session key
                    expires_at: authParamsRef.current.expires_at,
                    allowances: authParamsRef.current.allowances,
                  },
                  { name: 'NitroBridge Vault' }
                )

                const authVerifyMsg = await Nitrolite.createAuthVerifyMessage(
                  eip712Signer,
                  message as any,
                )
                ws.send(authVerifyMsg)
                addLog('Auth verify sent', 'send')
              } catch (err) {
                addLog(`EIP-712 signing failed: ${err instanceof Error ? err.message : 'Unknown'}`, 'error')
                setStatus('error')
                setErrorMsg('EIP-712 signing failed — check wallet')
              }
              break
            }

            case 'auth_verify': {
              const params = (message as any).params || (message as any).res?.[2]
              if (params?.success === false) {
                addLog('Authentication failed', 'error')
                setStatus('error')
                setErrorMsg('ClearNode rejected authentication')
                return
              }
              addLog('Authenticated with ClearNode!', 'success')
              if (params?.jwtToken) {
                setJwtToken(params.jwtToken)
                addLog('JWT token received for reconnection', 'info')
              }
              setStatus('connected')
              break
            }

            case 'create_app_session': {
              const params = (message as any).params || (message as any).res?.[2]
              const sid = params?.[0]?.app_session_id || params?.app_session_id
              if (sid) {
                setSessionId(sid)
                addLog(`App session created: ${sid.slice(0, 16)}...`, 'success')
              } else {
                addLog('App session response received', 'receive')
              }
              break
            }

            case 'error': {
              const errMsg = (message as any).params?.error || 'Unknown error'
              addLog(`ClearNode error: ${errMsg}`, 'error')
              break
            }

            default: {
              addLog(`Message: ${method || 'unknown'} — ${JSON.stringify(message).slice(0, 100)}`, 'receive')
            }
          }
        } catch (err) {
          addLog(`Parse error: ${err instanceof Error ? err.message : 'Unknown'}`, 'error')
        }
      }

      ws.onerror = () => {
        addLog('WebSocket error', 'error')
        setStatus('error')
        setErrorMsg('WebSocket connection error')
      }

      ws.onclose = (event) => {
        addLog(`WebSocket closed (${event.code})`, 'info')
        if (status !== 'disconnected') {
          setStatus('disconnected')
        }
      }
    } catch (err) {
      addLog(`Connection failed: ${err instanceof Error ? err.message : 'Unknown'}`, 'error')
      setStatus('error')
      setErrorMsg('Failed to connect to ClearNode')
    }
  }, [walletClient, address, addLog, status])

  const createSession = useCallback(async () => {
    if (!wsRef.current || status !== 'connected' || !address) return

    const participant2 = counterparty || address // Self-session if no counterparty
    addLog(`Creating app session with ${participant2.slice(0, 8)}...`, 'send')

    try {
      const messageSigner = async (payload: any) => {
        if (!walletClient) throw new Error('No wallet client')
        const message = JSON.stringify(payload)
        const signature = await walletClient.signMessage({ message })
        return signature as `0x${string}`
      }

      const signedMessage = await Nitrolite.createAppSessionMessage(
        messageSigner,
        {
          definition: {
            protocol: 'nitrobridge-margin-v1' as any,
            application: 'NitroBridge Vault',
            participants: [address as `0x${string}`, participant2 as `0x${string}`],
            weights: [100, 0],
            quorum: 100,
            challenge: 0,
            nonce: Date.now(),
          },
          allocations: [
            { participant: address as `0x${string}`, asset: 'ytest.usd', amount: transferAmount },
            { participant: participant2 as `0x${string}`, asset: 'ytest.usd', amount: '0' },
          ],
        }
      )

      wsRef.current.send(signedMessage)
    } catch (err) {
      addLog(`Session creation failed: ${err instanceof Error ? err.message : 'Unknown'}`, 'error')
    }
  }, [status, address, counterparty, transferAmount, walletClient, addLog])

  // Send off-chain transfer
  const sendTransfer = useCallback(async () => {
    if (!wsRef.current || status !== 'connected' || !sessionId || !address) {
      addLog('Cannot send: no active session', 'error')
      return
    }

    const recipient = counterparty || address
    setTransferring(true)
    addLog(`Sending ${sendAmount} ytest.usd to ${recipient.slice(0, 8)}...`, 'send')

    try {
      const messageSigner = async (payload: any) => {
        if (!walletClient) throw new Error('No wallet client')
        const message = JSON.stringify(payload)
        const signature = await walletClient.signMessage({ message })
        return signature as `0x${string}`
      }

      // Create transfer message using Nitrolite SDK
      // Transfer uses allocations array to specify new balances after transfer
      const transferMsg = await Nitrolite.createTransferMessage(
        messageSigner,
        {
          destination: recipient as `0x${string}`,
          allocations: [
            { destination: address as `0x${string}`, asset: 'ytest.usd', amount: '0' },
            { destination: recipient as `0x${string}`, asset: 'ytest.usd', amount: sendAmount },
          ],
        }
      )

      wsRef.current.send(transferMsg)
      addLog(`Transfer sent: ${sendAmount} ytest.usd`, 'success')
    } catch (err) {
      addLog(`Transfer failed: ${err instanceof Error ? err.message : 'Unknown'}`, 'error')
    } finally {
      setTransferring(false)
    }
  }, [status, sessionId, address, counterparty, sendAmount, walletClient, addLog])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  const statusColors: Record<ConnectionStatus, string> = {
    disconnected: 'text-slate-500',
    connecting: 'text-amber-400',
    authenticating: 'text-amber-400',
    connected: 'text-emerald-400',
    error: 'text-red-400',
  }

  const statusLabels: Record<ConnectionStatus, string> = {
    disconnected: 'Disconnected',
    connecting: 'Connecting...',
    authenticating: 'Authenticating...',
    connected: 'Connected',
    error: 'Error',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="glass-card p-6 md:p-7"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500/15 to-amber-500/15 border border-yellow-500/10 flex items-center justify-center">
            <Zap className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Yellow State Channel</h2>
            <p className="text-xs text-slate-500">Off-chain instant transfers via Nitrolite</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-emerald-400 animate-pulse' : status === 'error' ? 'bg-red-400' : 'bg-slate-600'}`} />
          <span className={`text-xs font-medium ${statusColors[status]}`}>{statusLabels[status]}</span>
        </div>
      </div>

      <div className="space-y-4">
        {/* Connection Controls */}
        {status === 'disconnected' || status === 'error' ? (
          <motion.button
            onClick={connect}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="w-full py-3.5 rounded-xl font-semibold text-sm btn-primary flex items-center justify-center gap-2"
          >
            <Wifi className="w-4 h-4 relative z-10" />
            <span className="relative z-10">Connect to Yellow ClearNode</span>
          </motion.button>
        ) : status === 'connecting' || status === 'authenticating' ? (
          <div className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-white/[0.04] text-amber-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm font-medium">{statusLabels[status]}</span>
          </div>
        ) : (
          <>
            {/* Connected — Session Controls */}
            <div className="p-3.5 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/10">
              <div className="flex items-center gap-2 mb-1">
                <Radio className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-sm font-medium text-emerald-400">ClearNode Connected</span>
              </div>
              <p className="text-xs text-slate-500">
                Sandbox: clearnet-sandbox.yellow.com
                {sessionId && (
                  <span className="block mt-1 text-emerald-400/70">
                    Session: {sessionId.slice(0, 20)}...
                  </span>
                )}
              </p>
            </div>

            {/* Counterparty */}
            <div>
              <label className="block text-sm text-slate-400 mb-2">Counterparty Address (optional)</label>
              <input
                type="text"
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                placeholder={`${address.slice(0, 10)}... (self)`}
                className="input-field text-sm"
              />
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm text-slate-400 mb-2">Channel Amount (USDC)</label>
              <div className="relative">
                <input
                  type="number"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder="100"
                  className="input-field text-xl font-semibold pr-20"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <span className="text-sm text-slate-500 font-medium">USDC</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
              <motion.button
                onClick={createSession}
                disabled={!!sessionId}
                whileHover={{ scale: sessionId ? 1 : 1.01 }}
                whileTap={{ scale: sessionId ? 1 : 0.99 }}
                className={`py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                  sessionId
                    ? 'bg-white/[0.04] text-slate-600 cursor-not-allowed'
                    : 'btn-primary'
                }`}
              >
                <Send className="w-3.5 h-3.5 relative z-10" />
                <span className="relative z-10">{sessionId ? 'Session Active' : 'Create Session'}</span>
              </motion.button>
              <motion.button
                onClick={disconnect}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 bg-white/[0.04] text-slate-400 hover:text-red-400 hover:bg-red-500/[0.08] border border-transparent hover:border-red-500/15 transition-all"
              >
                <LogOut className="w-3.5 h-3.5" />
                Disconnect
              </motion.button>
            </div>

            {/* Transfer Section - Only show when session is active */}
            {sessionId && (
              <div className="p-4 rounded-xl bg-yellow-500/[0.04] border border-yellow-500/10 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowRight className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm font-medium text-yellow-400">Instant Off-Chain Transfer</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <input
                      type="number"
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value)}
                      placeholder="10"
                      className="input-field text-sm w-full"
                    />
                  </div>
                  <motion.button
                    onClick={sendTransfer}
                    disabled={transferring || !sendAmount}
                    whileHover={{ scale: transferring ? 1 : 1.02 }}
                    whileTap={{ scale: transferring ? 1 : 0.98 }}
                    className={`py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      transferring
                        ? 'bg-yellow-500/20 text-yellow-400/50 cursor-wait'
                        : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                    }`}
                  >
                    {transferring ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5" />
                    )}
                    Send
                  </motion.button>
                </div>
                <p className="text-[10px] text-slate-500">
                  Transfers are instant (&lt;100ms) and gas-free via Yellow state channel.
                </p>
              </div>
            )}
          </>
        )}

        {/* Error */}
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-xl bg-red-500/[0.08] border border-red-500/15"
          >
            <div className="flex items-center gap-2 text-red-400">
              <XCircle className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">{errorMsg}</span>
            </div>
          </motion.div>
        )}

        {/* Live Log */}
        {logs.length > 0 && (
          <div className="rounded-xl bg-black/30 border border-white/[0.06] overflow-hidden">
            <div className="px-3 py-2 border-b border-white/[0.06] flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${status === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Live Channel Log</span>
            </div>
            <div className="p-3 max-h-48 overflow-y-auto font-mono text-[11px] space-y-1">
              {logs.map((log, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-slate-600 shrink-0">{log.time}</span>
                  <span className={
                    log.type === 'success' ? 'text-emerald-400' :
                    log.type === 'error' ? 'text-red-400' :
                    log.type === 'send' ? 'text-cyan-400' :
                    log.type === 'receive' ? 'text-amber-400' :
                    'text-slate-400'
                  }>
                    {log.type === 'send' ? '→ ' : log.type === 'receive' ? '← ' : ''}
                    {log.msg}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info */}
        <div className="pt-3 border-t border-white/[0.06] space-y-1.5">
          <p className="text-[10px] text-slate-500">
            Prerequisite:{' '}
            <a
              href="https://apps.yellow.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-yellow-400 hover:text-yellow-300 transition-colors"
            >
              Create a channel at apps.yellow.com
            </a>
          </p>
          <p className="text-[10px] text-slate-500">
            Uses @erc7824/nitrolite SDK — real WebSocket connection to Yellow ClearNode sandbox.
          </p>
          <p className="text-[10px] text-slate-500">
            <a
              href="https://erc7824.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-yellow-400 hover:text-yellow-300 transition-colors"
            >
              ERC-7824 Docs
            </a>
            {' · '}
            <a
              href="https://docs.yellow.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-yellow-400 hover:text-yellow-300 transition-colors"
            >
              Yellow Network Docs
            </a>
          </p>
        </div>
      </div>
    </motion.div>
  )
}
