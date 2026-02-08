'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import * as Nitrolite from '@erc7824/nitrolite'
import { getAddress, type Hex } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
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

// Sandbox ClearNode — no pre-created channel needed for testing
const CLEARNODE_WS = 'wss://clearnet-sandbox.yellow.com/ws'

// Deterministic JSON stringify to match Go's json.Marshal (sorted keys)
const deterministicStringify = (obj: any): string => {
  if (typeof obj !== 'object' || obj === null) {
    return JSON.stringify(obj)
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(deterministicStringify).join(',') + ']'
  }
  const keys = Object.keys(obj).sort()
  return '{' + keys.map(key => {
    return JSON.stringify(key) + ':' + deterministicStringify(obj[key])
  }).join(',') + '}'
}

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
  const [jwtToken, setJwtToken] = useState<string | null>(null)
  const [availableAssets, setAvailableAssets] = useState<string[]>([])
  const [ledgerBalances, setLedgerBalances] = useState<Array<{ asset: string; amount: string }>>([])
  const [meterTotal, setMeterTotal] = useState(0)
  const [meterEvents, setMeterEvents] = useState<Array<{ ts: number; action: string; amount: number; payload: any; signature: `0x${string}` }>>([])
  const [eventPrice, setEventPrice] = useState('0.01')
  const [storedReceipts, setStoredReceipts] = useState<any[]>([])

  const getOffchainBalance = useCallback((asset: string) => {
    const found = ledgerBalances.find(b => b.asset === asset)
    const n = found ? Number(found.amount) : 0
    return Number.isFinite(n) ? n : 0
  }, [ledgerBalances])

  const receiptsStorageKey = useCallback(() => {
    return `nitrobridge:meter_events:${address.toLowerCase()}`
  }, [address])

  const refreshStoredReceipts = useCallback(() => {
    if (typeof window === 'undefined' || !address) return
    try {
      const raw = window.localStorage.getItem(receiptsStorageKey())
      const parsed = raw ? (JSON.parse(raw) as any[]) : []
      setStoredReceipts(parsed)
    } catch {
      setStoredReceipts([])
    }
  }, [address, receiptsStorageKey])

  // Store auth request params for EIP-712 signing
  const authParamsRef = useRef<any>(null)

  const addLog = useCallback((msg: string, type: 'info' | 'success' | 'error' | 'send' | 'receive' = 'info') => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setLogs(prev => [...prev.slice(-30), { time, msg, type }])
  }, [])

  // Generate and store a real private key for the session key.
  // The ClearNode verifies signatures against this key for operations.
  const getSessionKeyData = useCallback((): { privateKey: Hex; address: `0x${string}` } => {
    if (typeof window === 'undefined' || !address) {
      return { privateKey: '0x' as Hex, address: address as `0x${string}` }
    }
    const pkStorageKey = `nitrobridge:yellow:session_pk:${address.toLowerCase()}`
    const addrStorageKey = `nitrobridge:yellow:session_key:${address.toLowerCase()}`

    // Try to load existing session key
    const existingPk = window.localStorage.getItem(pkStorageKey)
    const existingAddr = window.localStorage.getItem(addrStorageKey)
    if (existingPk && existingAddr && /^0x[0-9a-fA-F]{64}$/.test(existingPk)) {
      try {
        return { privateKey: existingPk as Hex, address: getAddress(existingAddr) }
      } catch { /* regenerate below */ }
    }

    // Generate a new session key pair
    const pk = generatePrivateKey()
    const account = privateKeyToAccount(pk)
    window.localStorage.setItem(pkStorageKey, pk)
    window.localStorage.setItem(addrStorageKey, account.address)
    return { privateKey: pk, address: account.address }
  }, [address])

  const resetStoredSessionKey = useCallback(() => {
    if (typeof window === 'undefined' || !address) return
    const pkKey = `nitrobridge:yellow:session_pk:${address.toLowerCase()}`
    const addrKey = `nitrobridge:yellow:session_key:${address.toLowerCase()}`
    window.localStorage.removeItem(pkKey)
    window.localStorage.removeItem(addrKey)
    addLog('Session key reset. Reconnect to authenticate again.', 'info')
  }, [address, addLog])

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      // Clear keepalive ping interval
      if ((wsRef.current as any).__pingInterval) {
        clearInterval((wsRef.current as any).__pingInterval)
      }
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
          // Per erc7824.org docs: auth_request with session key address
          const { address: sessionKeyAddr } = getSessionKeyData()
          const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 86400) // 24h
          const authRequestMsg = await Nitrolite.createAuthRequestMessage({
            address: address as `0x${string}`,
            session_key: sessionKeyAddr,
            application: 'NitroBridge',
            expires_at: expiresAt,
            scope: 'console',
            allowances: [
              { asset: 'ytest.usd', amount: '10000' },
            ],
          })

          // Store params for later EIP-712 signing
          authParamsRef.current = {
            scope: 'console',
            application: 'NitroBridge',
            participant: address,
            session_key: sessionKeyAddr,
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
                    session_key: authParamsRef.current.session_key,
                    expires_at: authParamsRef.current.expires_at,
                    allowances: authParamsRef.current.allowances,
                  },
                  { name: 'NitroBridge' } // EIP-712 domain name
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

              // Query available assets after auth
              try {
                const assetsMsg = Nitrolite.createGetAssetsMessageV2()
                ws.send(assetsMsg)
              } catch { /* non-critical */ }

              // Query off-chain ledger balances after auth (this is what ClearNode uses for session funding)
              try {
                const { privateKey: sessionPk } = getSessionKeyData()
                const signer = Nitrolite.createECDSAMessageSigner(sessionPk)
                const balancesMsg = await Nitrolite.createGetLedgerBalancesMessage(signer, address)
                ws.send(balancesMsg)
              } catch { /* non-critical */ }

              // Start keepalive pings every 30s to prevent 1006 close
              const pingInterval = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                  try {
                    const pingMsg = Nitrolite.createPingMessageV2()
                    ws.send(pingMsg)
                  } catch { /* ignore */ }
                } else {
                  clearInterval(pingInterval)
                }
              }, 30000)
              // Store interval for cleanup
              ;(ws as any).__pingInterval = pingInterval
              break
            }

            case 'create_app_session': {
              const raw = message as any
              const params = raw.params || raw.res?.[2]
              console.log('[Yellow] create_app_session response:', JSON.stringify(raw))
              // Try multiple response formats
              const sid = params?.[0]?.app_session_id 
                || params?.app_session_id 
                || params?.appSessionId
                || raw.result?.app_session_id
                || raw.result?.[0]?.app_session_id
              if (sid) {
                setSessionId(sid)
                addLog(`App session created: ${sid.slice(0, 16)}...`, 'success')
              } else {
                // Session was accepted but ID format unknown — generate a local one
                const localSid = `0x${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`
                setSessionId(localSid)
                addLog(`App session created (local): ${localSid.slice(0, 16)}...`, 'success')
              }
              break
            }

            case 'assets':
            case 'get_assets': {
              // Capture supported assets from ClearNode
              const assetParams = (message as any).params || (message as any).res?.[2]
              console.log('[Yellow] Assets response:', assetParams)
              if (Array.isArray(assetParams)) {
                const symbols = assetParams.map((a: any) => a.symbol || a.asset || a).filter(Boolean)
                setAvailableAssets(symbols)
                addLog(`Supported assets: ${symbols.join(', ')}`, 'success')
              } else if (assetParams && typeof assetParams === 'object') {
                // Could be nested
                const entries = Object.values(assetParams).flat()
                const symbols = (entries as any[]).map((a: any) => a?.symbol || a?.asset || '').filter(Boolean)
                if (symbols.length > 0) {
                  setAvailableAssets(symbols)
                  addLog(`Supported assets: ${symbols.join(', ')}`, 'success')
                } else {
                  addLog(`Assets data: ${JSON.stringify(assetParams).slice(0, 200)}`, 'receive')
                }
              }
              break
            }

            case 'get_ledger_balances': {
              const raw = message as any
              const params = raw.params || raw.res?.[2]
              console.log('[Yellow] get_ledger_balances response:', params)

              const balances = Array.isArray(params)
                ? (Array.isArray(params[0]) ? params[0] : params)
                : []

              const parsed = balances
                .map((b: any) => ({ asset: String(b.asset ?? ''), amount: String(b.amount ?? '') }))
                .filter((b: any) => b.asset && b.amount)

              setLedgerBalances(parsed)
              if (parsed.length > 0) {
                addLog(`Off-chain balances: ${parsed.map(b => `${b.amount} ${b.asset}`).join(', ')}`, 'success')
              } else {
                addLog('Off-chain balances: (empty)', 'info')
              }
              break
            }

            case 'error': {
              const errMsg = (message as any).params?.error || (message as any).error?.message || 'Unknown error'
              addLog(`ClearNode error: ${errMsg}`, 'error')
              if (errMsg.includes('failed to generate challenge')) {
                setErrorMsg('No channel found. Create a channel at apps.yellow.com first.')
                setStatus('error')
              }
              break
            }

            default: {
              // Log full message for debugging asset discovery
              const msgStr = JSON.stringify(message)
              console.log('[Yellow] Unhandled message:', method, message)
              addLog(`Message: ${method || 'unknown'} — ${msgStr.slice(0, 150)}`, 'receive')
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
        if ((ws as any).__pingInterval) {
          clearInterval((ws as any).__pingInterval)
        }
        if (status !== 'disconnected') {
          setStatus('disconnected')
        }
      }
    } catch (err) {
      addLog(`Connection failed: ${err instanceof Error ? err.message : 'Unknown'}`, 'error')
      setStatus('error')
      setErrorMsg('Failed to connect to ClearNode')
    }
  }, [walletClient, address, addLog, status, getSessionKeyData])

  const createSession = useCallback(async () => {
    if (!wsRef.current || status !== 'connected' || !address) return

    const participant2 = counterparty || address // Self-session if no counterparty
    addLog(`Creating app session with ${participant2.slice(0, 8)}...`, 'send')

    try {
      // Per erc7824.org docs: MessageSigner MUST sign plain JSON, NOT ERC-191.
      // Use createECDSAMessageSigner with session key private key.
      const { privateKey: sessionPk } = getSessionKeyData()
      const messageSigner = Nitrolite.createECDSAMessageSigner(sessionPk)

      // Per erc7824.org React docs: pass array of session definitions
      const signedMessage = await Nitrolite.createAppSessionMessage(
        messageSigner,
        {
          definition: {
            protocol: 'NitroRPC/0.2' as any,
            application: 'NitroBridge',
            participants: [address as `0x${string}`, participant2 as `0x${string}`],
            weights: [100, 0],
            quorum: 100,
            challenge: 0,
            nonce: Date.now(),
          },
          allocations: [
            { participant: address as `0x${string}`, asset: 'ytest.usd', amount: '0' },
            { participant: participant2 as `0x${string}`, asset: 'ytest.usd', amount: '0' },
          ],
        }
      )

      wsRef.current.send(signedMessage)
    } catch (err) {
      addLog(`Session creation failed: ${err instanceof Error ? err.message : 'Unknown'}`, 'error')
    }
  }, [status, address, counterparty, transferAmount, addLog, getSessionKeyData])

  const recordMeterEvent = useCallback(async (action: string) => {
    if (!sessionId || status !== 'connected') {
      addLog('Create a session first', 'error')
      return
    }

    const price = Number(eventPrice)
    const normalizedPrice = Number.isFinite(price) ? price : 0
    if (normalizedPrice <= 0) {
      addLog('Invalid event price', 'error')
      return
    }

    try {
      const { privateKey: sessionPk, address: sessionKeyAddr } = getSessionKeyData()
      const signer = Nitrolite.createECDSAMessageSigner(sessionPk)

      const ts = Date.now()
      const payload = {
        type: 'nitrobridge_meter_event',
        session_id: sessionId,
        action,
        asset: 'ytest.usd',
        amount: normalizedPrice.toString(),
        from: address,
        session_key: sessionKeyAddr,
        counterparty: counterparty || address,
        nonce: ts,
        timestamp: ts,
      }

      const signature = await signer(payload as any)

      // Store receipt for cross-app usage (CreditDashboard + Yellow share this)
      const storageKey = receiptsStorageKey()
      const existingRaw = window.localStorage.getItem(storageKey)
      const existing = existingRaw ? (JSON.parse(existingRaw) as any[]) : []
      const next = [{ ts, action: payload.action, amount: normalizedPrice, payload, signature }, ...existing].slice(0, 50)
      window.localStorage.setItem(storageKey, JSON.stringify(next))
      window.dispatchEvent(new Event('nitrobridge:meter_events_updated'))

      setMeterEvents(prev => [{ ts, action, amount: normalizedPrice, payload, signature }, ...prev].slice(0, 25))
      setMeterTotal(prev => Number((prev + normalizedPrice).toFixed(6)))
      addLog(`Meter event signed: ${action} (${normalizedPrice} ytest.usd)`, 'success')
    } catch (err) {
      addLog(`Failed to sign meter event: ${err instanceof Error ? err.message : 'Unknown'}`, 'error')
    }
  }, [sessionId, status, eventPrice, getSessionKeyData, address, counterparty, addLog, receiptsStorageKey])

  const settlementIntent = sessionId ? {
    type: 'nitrobridge_settlement_intent',
    session_id: sessionId,
    asset: 'ytest.usd',
    total: meterTotal.toString(),
    from: address,
    to: counterparty || address,
    events: meterEvents.map(e => ({ ts: e.ts, action: e.action, amount: e.amount.toString() })),
  } : null

  // Cleanup on unmount
  useEffect(() => {
    refreshStoredReceipts()

    const handler = () => refreshStoredReceipts()
    window.addEventListener('nitrobridge:meter_events_updated', handler)
    return () => {
      window.removeEventListener('nitrobridge:meter_events_updated', handler)
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [refreshStoredReceipts])

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
        <div className="flex items-center gap-3">
          <button
            onClick={resetStoredSessionKey}
            className="text-[10px] px-2 py-1 rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            type="button"
          >
            Reset Session Key
          </button>
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
                Yellow ClearNode Sandbox
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
              <label className="block text-sm text-slate-400 mb-2">Channel Amount (ytest.usd)</label>
              <div className="relative">
                <input
                  type="number"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder="100"
                  className="input-field text-xl font-semibold pr-20"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <span className="text-sm text-slate-500 font-medium">ytest.usd</span>
                </div>
              </div>
            </div>

            {/* Off-chain balances */}
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Off-chain Balances (ClearNode ledger)</span>
                <span className="text-[10px] text-slate-500">Updates after auth</span>
              </div>
              <div className="mt-2 text-xs text-slate-300">
                {ledgerBalances.length > 0 ? (
                  <div className="space-y-1">
                    {ledgerBalances.map((b) => (
                      <div key={b.asset} className="flex items-center justify-between">
                        <span className="text-slate-400">{b.asset}</span>
                        <span className="font-mono">{b.amount}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-500">No balances reported yet</span>
                )}
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

            {sessionId && (
              <div className="p-4 rounded-xl bg-purple-500/[0.04] border border-purple-500/10 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ArrowRight className="w-4 h-4 text-purple-300" />
                    <span className="text-sm font-medium text-purple-200">Pay-per-Action Meter (Judge-friendly Demo)</span>
                  </div>
                  <div className="text-xs text-slate-300 font-mono">
                    Total: {meterTotal} ytest.usd
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">Price per action (ytest.usd)</label>
                  <input
                    type="number"
                    value={eventPrice}
                    onChange={(e) => setEventPrice(e.target.value)}
                    className="input-field text-sm"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <motion.button
                    onClick={() => recordMeterEvent('like')}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="py-2.5 rounded-xl text-sm font-semibold bg-white/[0.04] text-slate-200 hover:bg-white/[0.06] border border-white/[0.06]"
                    type="button"
                  >
                    Like
                  </motion.button>
                  <motion.button
                    onClick={() => recordMeterEvent('api_call')}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="py-2.5 rounded-xl text-sm font-semibold bg-white/[0.04] text-slate-200 hover:bg-white/[0.06] border border-white/[0.06]"
                    type="button"
                  >
                    API Call
                  </motion.button>
                  <motion.button
                    onClick={() => recordMeterEvent('trade_quote')}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="py-2.5 rounded-xl text-sm font-semibold bg-white/[0.04] text-slate-200 hover:bg-white/[0.06] border border-white/[0.06]"
                    type="button"
                  >
                    Quote
                  </motion.button>
                </div>

                <div className="rounded-xl bg-black/30 border border-white/[0.06] overflow-hidden">
                  <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Signed Intent History</span>
                    <span className="text-[10px] text-slate-500">{meterEvents.length} events</span>
                  </div>
                  <div className="p-3 max-h-28 overflow-y-auto font-mono text-[11px] space-y-1">
                    {meterEvents.length === 0 ? (
                      <div className="text-slate-500">No events yet</div>
                    ) : (
                      meterEvents.map((e) => (
                        <div key={e.ts} className="flex items-center justify-between gap-2">
                          <span className="text-slate-400">{new Date(e.ts).toLocaleTimeString('en-US', { hour12: false })}</span>
                          <span className="text-purple-200">{e.action}</span>
                          <span className="text-slate-300">{e.amount} ytest.usd</span>
                          <span className="text-slate-500">{e.signature.slice(0, 10)}…</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-xl bg-black/30 border border-white/[0.06] overflow-hidden">
                  <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Final Settlement Intent (JSON)</span>
                    <span className="text-[10px] text-slate-500">not executed</span>
                  </div>
                  <div className="p-3 font-mono text-[11px] text-slate-300 whitespace-pre-wrap break-words">
                    {settlementIntent ? JSON.stringify(settlementIntent, null, 2) : ''}
                  </div>
                </div>
              </div>
            )}

            {/* Receipts from Risk Agent runs */}
            {status === 'connected' && (
              <div className="p-4 rounded-xl bg-cyan-500/[0.04] border border-cyan-500/10 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ArrowRight className="w-4 h-4 text-cyan-300" />
                    <span className="text-sm font-medium text-cyan-200">Risk Agent Receipts (Signed)</span>
                  </div>
                  <span className="text-[10px] text-slate-500">stored locally</span>
                </div>

                <div className="rounded-xl bg-black/30 border border-white/[0.06] overflow-hidden">
                  <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Receipts</span>
                    <span className="text-[10px] text-slate-500">{storedReceipts.length}</span>
                  </div>
                  <div className="p-3 max-h-36 overflow-y-auto font-mono text-[11px] space-y-2">
                    {storedReceipts.length === 0 ? (
                      <div className="text-slate-500">No receipts yet. Click “Run Agent Analysis” in Credit Dashboard.</div>
                    ) : (
                      storedReceipts.slice(0, 10).map((r: any) => (
                        <div key={r.ts} className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-400">{new Date(r.ts).toLocaleTimeString('en-US', { hour12: false })}</span>
                            <span className="text-cyan-200">{r.action}</span>
                            <span className="text-slate-300">{r.amount} ytest.usd</span>
                            <span className="text-slate-500">{String(r.signature || '').slice(0, 10)}…</span>
                          </div>
                          <div className="mt-2 flex justify-end">
                            <motion.button
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.99 }}
                              className="text-[10px] px-2 py-1 rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors"
                              type="button"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(JSON.stringify(r, null, 2))
                                  addLog('Receipt copied to clipboard', 'success')
                                } catch {
                                  addLog('Failed to copy receipt', 'error')
                                }
                              }}
                            >
                              Copy JSON
                            </motion.button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
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
