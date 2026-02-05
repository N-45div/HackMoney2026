import { defineChain } from 'viem'
import { baseSepolia, sepolia } from 'viem/chains'

// Arc Testnet chain definition
export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.testnet.arc.network'],
    },
  },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: 'https://testnet.arcscan.app' },
  },
  testnet: true,
})

// Re-export standard chains for convenience
export { baseSepolia, sepolia }

// All supported chains
export const SUPPORTED_CHAINS = [arcTestnet, baseSepolia, sepolia] as const

// Arc Testnet contract addresses
export const ARC_CONTRACTS = {
  CREDIT_TERMINAL: '0xd1835d13A9694F0E9329FfDE9b18936CE872aae5' as const,
  USDC: '0x3600000000000000000000000000000000000000' as const,
  TOKEN_MESSENGER: '0xb43db544E2c27092c107639Ad201b3dEfAbcF192' as const,
  MESSAGE_TRANSMITTER: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA' as const,
} as const

// Base Sepolia contract addresses (Uniswap v4)
export const BASE_SEPOLIA_CONTRACTS = {
  POOL_MANAGER: '0x7Da1D65F8B249183667cdE74C5CBD46dD38AA829' as const,
  USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const,
  TOKEN_MESSENGER: '0x9f3B8679c73C2Fef8b59B4F3444d4e156fb70AA5' as const,
  MESSAGE_TRANSMITTER: '0x7865fAfC2db2093669d92c0f33AeEF291086BEFD' as const,
  // AntiSniperHook will be deployed here - placeholder until deployed
  ANTI_SNIPER_HOOK: '0x0000000000000000000000000000000000000000' as const,
} as const

// Ethereum Sepolia contract addresses
export const SEPOLIA_CONTRACTS = {
  USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as const,
  TOKEN_MESSENGER: '0x9f3B8679c73C2Fef8b59B4F3444d4e156fb70AA5' as const,
  MESSAGE_TRANSMITTER: '0x7865fAfC2db2093669d92c0f33AeEF291086BEFD' as const,
} as const

// Legacy export for backward compatibility
export const CONTRACTS = ARC_CONTRACTS

// Deployment transaction links
export const DEPLOYMENT_TX = {
  ARC_CREDIT_TERMINAL: 'https://testnet.arcscan.app/tx/0xf30bfc37a23013a8f68d2b5375f5f5b19ddc5934b889923d91ba91462b61970f',
} as const

// CCTP Domain IDs
export const CCTP_DOMAINS = {
  ETHEREUM: 0,
  BASE: 6,
  ARC: 10,
} as const

/**
 * ArcCreditTerminal ABI - Generated from actual deployed contract
 * Source: contracts/arc-credit/src/ArcCreditTerminal.sol
 * Deployed: 0xd1835d13A9694F0E9329FfDE9b18936CE872aae5 on Arc Testnet (5042002)
 */
export const ARC_CREDIT_TERMINAL_ABI = [
  // Constructor
  {
    inputs: [{ name: '_usdc', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  // depositToCreditLine(uint256 amount, bytes32 ensHash) - Main deposit function
  {
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'ensHash', type: 'bytes32' },
    ],
    name: 'depositToCreditLine',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // requestMarginTopUp(uint256 amount) - User requests margin top-up
  {
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'requestMarginTopUp',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // agentTopUp(address user, uint256 amount) - Agent-initiated top-up
  {
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'agentTopUp',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // settleCredit(uint256 amount) - Repay borrowed amount
  {
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'settleCredit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // receiveCCTP(uint256 amount, bytes32 messageHash) - CCTP bridge callback
  {
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'messageHash', type: 'bytes32' },
    ],
    name: 'receiveCCTP',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // addAuthorizedAgent(address agent) - Owner only
  {
    inputs: [{ name: 'agent', type: 'address' }],
    name: 'addAuthorizedAgent',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // removeAuthorizedAgent(address agent) - Owner only
  {
    inputs: [{ name: 'agent', type: 'address' }],
    name: 'removeAuthorizedAgent',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // getCreditInfo(address user) - Returns full CreditLine struct
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getCreditInfo',
    outputs: [
      {
        components: [
          { name: 'deposited', type: 'uint256' },
          { name: 'borrowed', type: 'uint256' },
          { name: 'creditLimit', type: 'uint256' },
          { name: 'lastUpdate', type: 'uint256' },
          { name: 'ensHash', type: 'bytes32' },
        ],
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  // getAvailableCredit(address user) - Returns available credit
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getAvailableCredit',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // creditLines(address) - Public mapping getter
  {
    inputs: [{ name: '', type: 'address' }],
    name: 'creditLines',
    outputs: [
      { name: 'deposited', type: 'uint256' },
      { name: 'borrowed', type: 'uint256' },
      { name: 'creditLimit', type: 'uint256' },
      { name: 'lastUpdate', type: 'uint256' },
      { name: 'ensHash', type: 'bytes32' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  // authorizedAgents(address) - Check if agent is authorized
  {
    inputs: [{ name: '', type: 'address' }],
    name: 'authorizedAgents',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  // usdc() - USDC token address
  {
    inputs: [],
    name: 'usdc',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  // owner() - Contract owner
  {
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Constants
  {
    inputs: [],
    name: 'COLLATERAL_RATIO',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'LIQUIDATION_THRESHOLD',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'ensHash', type: 'bytes32' },
    ],
    name: 'Deposit',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
    name: 'Borrow',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
    name: 'Repay',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: true, name: 'agent', type: 'address' },
    ],
    name: 'MarginTopUp',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'messageHash', type: 'bytes32' },
    ],
    name: 'CCTPReceived',
    type: 'event',
  },
] as const

// ERC20 ABI (minimal for USDC)
export const ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

// AntiSniperHook ABI - Generated from contracts/uniswap-hook/src/AntiSniperHook.sol
// Deployed on Base Sepolia for MEV-protected swaps
export const ANTI_SNIPER_HOOK_ABI = [
  {
    inputs: [{ name: '_poolManager', type: 'address', internalType: 'contract IPoolManager' }],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    inputs: [
      { name: '_hash', type: 'bytes32' },
      { name: 'poolId', type: 'bytes32', internalType: 'PoolId' },
    ],
    name: 'commit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'key', type: 'tuple', components: [
        { name: 'currency0', type: 'address' },
        { name: 'currency1', type: 'address' },
        { name: 'fee', type: 'uint24' },
        { name: 'tickSpacing', type: 'int24' },
        { name: 'hooks', type: 'address' },
      ]},
    ],
    name: 'reveal',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'trader', type: 'address' },
    ],
    name: 'generateCommitmentHash',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [
      { name: 'trader', type: 'address' },
      { name: 'poolId', type: 'bytes32', internalType: 'PoolId' },
    ],
    name: 'getCommitment',
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'hash', type: 'bytes32' },
          { name: 'blockNumber', type: 'uint256' },
          { name: 'revealed', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'MIN_COMMITMENT_AGE',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'REVEAL_DELAY',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'trader', type: 'address' },
      { indexed: true, name: 'poolId', type: 'bytes32' },
      { indexed: false, name: 'hash', type: 'bytes32' },
    ],
    name: 'Commit',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'trader', type: 'address' },
      { indexed: true, name: 'poolId', type: 'bytes32' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'nonce', type: 'uint256' },
    ],
    name: 'Reveal',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'sender', type: 'address' },
      { indexed: true, name: 'poolId', type: 'bytes32' },
      { indexed: false, name: 'zeroForOne', type: 'bool' },
      { indexed: false, name: 'amountSpecified', type: 'int256' },
    ],
    name: 'SwapExecuted',
    type: 'event',
  },
] as const
