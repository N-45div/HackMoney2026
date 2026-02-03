/**
 * NitroBridge Vault - Margin Monitor Agent
 * 
 * Real implementation using Yellow Network Nitrolite SDK for instant state channel transfers.
 * Based on official Yellow Network documentation: https://docs.yellow.org/docs/build/quick-start/
 */

import { createAppSessionMessage, parseRPCResponse } from '@erc7824/nitrolite';
import { ethers } from 'ethers';
import WebSocket from 'ws';
import dotenv from 'dotenv';

dotenv.config();

// Arc Testnet Configuration (from https://docs.arc.network/arc/references/contract-addresses)
const ARC_CONFIG = {
  rpc: 'https://rpc.testnet.arc.network',
  chainId: 5042002,
  usdc: '0x3600000000000000000000000000000000000000', // Native USDC on Arc Testnet
  explorer: 'https://testnet.arcscan.app'
};

// Yellow Network Configuration
const YELLOW_CONFIG = {
  sandbox: 'wss://clearnet-sandbox.yellow.com/ws',
  production: 'wss://clearnet.yellow.com/ws'
};

// Arc Credit Terminal ABI
const ARC_CREDIT_ABI = [
  'function getCreditInfo(address user) view returns (tuple(uint256 deposited, uint256 borrowed, uint256 creditLimit, uint256 lastUpdate, bytes32 ensHash))',
  'function getAvailableCredit(address user) view returns (uint256)',
  'function agentTopUp(address user, uint256 amount)',
  'function authorizedAgents(address) view returns (bool)',
  'event MarginTopUp(address indexed user, uint256 amount, address indexed agent)'
];

class MarginMonitorAgent {
  constructor(config = {}) {
    this.ws = null;
    this.wallet = null;
    this.arcProvider = null;
    this.arcContract = null;
    this.monitoredUsers = new Map();
    this.sessionId = null;
    this.isConnected = false;
    this.config = {
      yellowEndpoint: config.yellowEndpoint || YELLOW_CONFIG.sandbox,
      arcRpc: config.arcRpc || ARC_CONFIG.rpc,
      terminalAddress: config.terminalAddress || process.env.ARC_CREDIT_TERMINAL_ADDRESS,
      privateKey: config.privateKey || process.env.AGENT_PRIVATE_KEY,
      checkInterval: config.checkInterval || 10000 // 10 seconds
    };
  }

  async initialize() {
    if (!this.config.privateKey) {
      throw new Error('AGENT_PRIVATE_KEY environment variable required');
    }
    if (!this.config.terminalAddress) {
      throw new Error('ARC_CREDIT_TERMINAL_ADDRESS environment variable required');
    }

    // Initialize Arc provider and wallet
    this.arcProvider = new ethers.JsonRpcProvider(this.config.arcRpc);
    this.wallet = new ethers.Wallet(this.config.privateKey, this.arcProvider);
    
    // Initialize Arc Credit Terminal contract
    this.arcContract = new ethers.Contract(
      this.config.terminalAddress,
      ARC_CREDIT_ABI,
      this.wallet
    );

    // Verify agent is authorized
    const isAuthorized = await this.arcContract.authorizedAgents(this.wallet.address);
    if (!isAuthorized) {
      console.warn('⚠️  Agent not authorized on ArcCreditTerminal. Call addAuthorizedAgent() first.');
    }

    // Connect to Yellow Network ClearNode
    await this.connectToYellow();

    console.log('✅ Margin Monitor Agent initialized');
    console.log(`   Agent Address: ${this.wallet.address}`);
    console.log(`   Arc Terminal: ${this.config.terminalAddress}`);
    console.log(`   Yellow Endpoint: ${this.config.yellowEndpoint}`);
    console.log(`   Arc RPC: ${this.config.arcRpc}`);
  }

  async connectToYellow() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.config.yellowEndpoint);

      this.ws.on('open', () => {
        console.log('🟢 Connected to Yellow Network ClearNode');
        this.isConnected = true;
        resolve();
      });

      this.ws.on('message', (data) => {
        this.handleYellowMessage(parseRPCResponse(data.toString()));
      });

      this.ws.on('error', (error) => {
        console.error('❌ Yellow WebSocket error:', error.message);
        this.isConnected = false;
        reject(error);
      });

      this.ws.on('close', () => {
        console.log('� Disconnected from Yellow Network');
        this.isConnected = false;
        // Attempt reconnect after 5 seconds
        setTimeout(() => this.connectToYellow(), 5000);
      });
    });
  }

  handleYellowMessage(message) {
    if (!message) return;

    switch (message.type) {
      case 'session_created':
        this.sessionId = message.sessionId;
        console.log('✅ Yellow session created:', this.sessionId);
        break;
      case 'payment_received':
        console.log('💰 Payment received:', message.amount);
        break;
      case 'session_closed':
        console.log('📕 Yellow session closed');
        this.sessionId = null;
        break;
      case 'error':
        console.error('❌ Yellow error:', message.error);
        break;
      default:
        console.log('📨 Yellow message:', message);
    }
  }

  // EIP-191 message signer for Yellow Network
  async signMessage(message) {
    return await this.wallet.signMessage(message);
  }

  async createYellowSession(counterpartyAddress, allocations) {
    if (!this.isConnected) {
      throw new Error('Not connected to Yellow Network');
    }

    const appDefinition = {
      protocol: 'nitrobridge-margin-v1',
      participants: [this.wallet.address, counterpartyAddress],
      weights: [50, 50],
      quorum: 100,
      challenge: 0,
      nonce: Date.now()
    };

    const sessionMessage = await createAppSessionMessage(
      this.signMessage.bind(this),
      [{
        definition: appDefinition,
        allocations: allocations || [
          { participant: this.wallet.address, asset: 'usdc', amount: '0' },
          { participant: counterpartyAddress, asset: 'usdc', amount: '0' }
        ]
      }]
    );

    this.ws.send(sessionMessage);
    console.log('📤 Session creation request sent');
  }

  async startMonitoring(userAddress, options = {}) {
    const threshold = options.threshold || 0.2; // 20% default
    const topUpAmount = options.topUpAmount || null; // Auto-calculate if null

    this.monitoredUsers.set(userAddress.toLowerCase(), {
      threshold,
      topUpAmount,
      lastCheck: 0,
      lastTopUp: 0
    });

    console.log(`👁️  Started monitoring ${userAddress}`);
    console.log(`   Threshold: ${(threshold * 100).toFixed(0)}%`);

    // Start monitoring loop
    this.checkUser(userAddress);
    setInterval(() => this.checkUser(userAddress), this.config.checkInterval);
  }

  async checkUser(userAddress) {
    const userConfig = this.monitoredUsers.get(userAddress.toLowerCase());
    if (!userConfig) return;

    try {
      const creditInfo = await this.arcContract.getCreditInfo(userAddress);
      const available = await this.arcContract.getAvailableCredit(userAddress);

      const limit = creditInfo.creditLimit;
      if (limit === 0n) {
        console.log(`[${userAddress.slice(0, 8)}...] No credit line established`);
        return;
      }

      const ratio = Number(available) / Number(limit);
      const timestamp = new Date().toISOString();

      console.log(
        `[${timestamp}] ${userAddress.slice(0, 8)}... | ` +
        `Available: ${ethers.formatUnits(available, 6)} USDC | ` +
        `Limit: ${ethers.formatUnits(limit, 6)} USDC | ` +
        `Ratio: ${(ratio * 100).toFixed(1)}%`
      );

      // Check if top-up needed
      if (ratio < userConfig.threshold && available > 0n) {
        // Calculate top-up amount (restore to 80% of limit)
        const targetAvailable = (limit * 80n) / 100n;
        const topUpAmount = userConfig.topUpAmount 
          ? BigInt(userConfig.topUpAmount)
          : targetAvailable - available;

        if (topUpAmount > 0n) {
          await this.executeTopUp(userAddress, topUpAmount);
        }
      }
    } catch (error) {
      console.error(`❌ Error checking ${userAddress}:`, error.message);
    }
  }

  async executeTopUp(userAddress, amount) {
    const amountFormatted = ethers.formatUnits(amount, 6);
    console.log(`⚡ Initiating margin top-up for ${userAddress}: ${amountFormatted} USDC`);

    try {
      // Step 1: Create Yellow state channel session for instant off-chain transfer
      if (this.isConnected) {
        console.log('📡 Creating Yellow session for instant transfer...');
        await this.createYellowSession(userAddress, [
          { participant: this.wallet.address, asset: 'usdc', amount: amount.toString() },
          { participant: userAddress, asset: 'usdc', amount: '0' }
        ]);
        
        // Note: In production, wait for session confirmation before proceeding
        // The off-chain transfer happens instantly via state channel
        console.log('💸 Off-chain state channel transfer initiated');
      }

      // Step 2: On-chain settlement via Arc Credit Terminal
      console.log('📝 Submitting on-chain settlement...');
      const tx = await this.arcContract.agentTopUp(userAddress, amount, {
        gasLimit: 200000n
      });
      
      console.log(`   Transaction: ${ARC_CONFIG.explorer}/tx/${tx.hash}`);
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        console.log('✅ Margin top-up complete!');
        console.log(`   Block: ${receipt.blockNumber}`);
        console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
        
        // Update last top-up timestamp
        const userConfig = this.monitoredUsers.get(userAddress.toLowerCase());
        if (userConfig) {
          userConfig.lastTopUp = Date.now();
        }
      } else {
        throw new Error('Transaction reverted');
      }

    } catch (error) {
      console.error('❌ Top-up failed:', error.message);
      if (error.reason) {
        console.error('   Reason:', error.reason);
      }
    }
  }

  async getAgentBalance() {
    const usdc = new ethers.Contract(
      ARC_CONFIG.usdc,
      ['function balanceOf(address) view returns (uint256)'],
      this.arcProvider
    );
    const balance = await usdc.balanceOf(this.wallet.address);
    return ethers.formatUnits(balance, 6);
  }

  stop() {
    if (this.ws) {
      this.ws.close();
    }
    console.log('� Margin Monitor Agent stopped');
  }
}

// CLI Entry Point
async function main() {
  const agent = new MarginMonitorAgent();

  try {
    await agent.initialize();

    const agentBalance = await agent.getAgentBalance();
    console.log(`   Agent USDC Balance: ${agentBalance}`);

    const userToMonitor = process.env.USER_ADDRESS;
    if (userToMonitor) {
      await agent.startMonitoring(userToMonitor, {
        threshold: 0.2, // Top-up when below 20%
      });
    } else {
      console.log('\n⚠️  Set USER_ADDRESS env var to start monitoring a user');
      console.log('   Example: USER_ADDRESS=0x... npm start');
    }

    // Handle shutdown
    process.on('SIGINT', () => {
      agent.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to initialize agent:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { MarginMonitorAgent, ARC_CONFIG, YELLOW_CONFIG };
