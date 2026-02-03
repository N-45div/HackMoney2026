import { NitroliteClient } from '@erc7824/nitrolite';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

// Arc Credit Terminal ABI (simplified)
const ARC_CREDIT_ABI = [
  "function getCreditInfo(address user) view returns (tuple(uint256 deposited, uint256 borrowed, uint256 creditLimit, uint256 lastUpdate, bytes32 ensHash))",
  "function getAvailableCredit(address user) view returns (uint256)",
  "function agentTopUp(address user, uint256 amount)",
  "event MarginTopUp(address indexed user, uint256 amount, address indexed agent)"
];

class MarginMonitorAgent {
  constructor() {
    this.yellowClient = null;
    this.arcProvider = null;
    this.arcContract = null;
    this.monitoredUsers = new Map();
  }

  async initialize() {
    // Initialize Yellow Nitrolite client
    this.yellowClient = new NitroliteClient({
      clearnodeUrl: 'wss://clearnet-sandbox.yellow.com/ws',
      privateKey: process.env.AGENT_PRIVATE_KEY,
    });

    // Initialize Arc connection
    this.arcProvider = new ethers.JsonRpcProvider('https://rpc-arc.testnet.circle.com');
    this.arcContract = new ethers.Contract(
      process.env.ARC_CREDIT_TERMINAL_ADDRESS,
      ARC_CREDIT_ABI,
      new ethers.Wallet(process.env.AGENT_PRIVATE_KEY, this.arcProvider)
    );

    console.log('✅ Margin Monitor Agent initialized');
    console.log('🔗 Yellow Sandbox:', 'wss://clearnet-sandbox.yellow.com/ws');
    console.log('🔗 Arc Testnet:', 'https://rpc-arc.testnet.circle.com');
  }

  async startMonitoring(userAddress, threshold = 0.2) {
    // threshold: top-up when available credit < 20% of limit
    this.monitoredUsers.set(userAddress, { threshold, lastCheck: 0 });
    
    console.log(`👁️  Started monitoring ${userAddress} with threshold ${threshold * 100}%`);
    
    // Check every 10 seconds
    setInterval(() => this.checkUser(userAddress), 10000);
  }

  async checkUser(userAddress) {
    try {
      const creditInfo = await this.arcContract.getCreditInfo(userAddress);
      const available = await this.arcContract.getAvailableCredit(userAddress);
      
      const limit = creditInfo.creditLimit;
      const threshold = this.monitoredUsers.get(userAddress)?.threshold || 0.2;
      
      // Calculate if top-up needed
      const ratio = Number(available) / Number(limit);
      
      console.log(`[${new Date().toISOString()}] ${userAddress}: ${(ratio * 100).toFixed(2)}% available`);
      
      if (ratio < threshold && available > 0) {
        await this.executeTopUp(userAddress, available);
      }
    } catch (error) {
      console.error(`❌ Error checking ${userAddress}:`, error.message);
    }
  }

  async executeTopUp(userAddress, amount) {
    console.log(`⚡ Executing top-up for ${userAddress}: ${ethers.formatUnits(amount, 6)} USDC`);
    
    try {
      // 1. Open Yellow state channel session (instant)
      const session = await this.yellowClient.createSession({
        counterparty: userAddress,
        amount: amount.toString(),
      });
      
      console.log('📡 Yellow session opened:', session.id);
      
      // 2. Off-chain transfer (instant, zero gas)
      await session.transfer({
        to: userAddress,
        amount: amount.toString(),
      });
      
      console.log('💸 Instant off-chain transfer complete');
      
      // 3. On-chain settlement via Arc contract
      const tx = await this.arcContract.agentTopUp(userAddress, amount);
      await tx.wait();
      
      console.log('✅ On-chain settlement complete:', tx.hash);
      
      // 4. Close session
      await session.close();
      
    } catch (error) {
      console.error('❌ Top-up failed:', error.message);
    }
  }

  async openCreditChannel(userAddress, depositAmount) {
    // Open a state channel with the user for credit line
    const channel = await this.yellowClient.createChannel({
      counterparty: userAddress,
      deposit: depositAmount.toString(),
    });
    
    console.log('🔐 Credit channel opened:', channel.id);
    return channel;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const agent = new MarginMonitorAgent();
  
  agent.initialize().then(() => {
    // Monitor example user (replace with actual address)
    const userToMonitor = process.env.USER_ADDRESS;
    if (userToMonitor) {
      agent.startMonitoring(userToMonitor, 0.2); // 20% threshold
    } else {
      console.log('⚠️  Set USER_ADDRESS env var to start monitoring');
    }
  });
}

export { MarginMonitorAgent };
