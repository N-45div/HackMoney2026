import { defineChain } from 'viem'

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
    default: { name: 'Arc Explorer', url: 'https://explorer.testnet.arc.network' },
  },
  testnet: true,
})

// Deployed contract addresses
export const CONTRACTS = {
  ARC_CREDIT_TERMINAL: '0xd1835d13A9694F0E9329FfDE9b18936CE872aae5' as const,
  USDC: '0x3600000000000000000000000000000000000000' as const,
  TOKEN_MESSENGER: '0xb43db544E2c27092c107639Ad201b3dEfAbcF192' as const,
  MESSAGE_TRANSMITTER: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA' as const,
} as const

// Deployment transaction links
export const DEPLOYMENT_TX = {
  ARC_CREDIT_TERMINAL: 'https://explorer.testnet.arc.network/tx/0xf30bfc37a23013a8f68d2b5375f5f5b19ddc5934b889923d91ba91462b61970f',
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
