/**
 * NitroBridge Vault - Circle CCTP Bridge
 * 
 * Multi-chain CCTP implementation for bridging USDC between:
 *   - Ethereum Sepolia <-> Arc Testnet
 *   - Ethereum Sepolia <-> Base Sepolia
 *   - Base Sepolia <-> Arc Testnet
 * 
 * References:
 * - https://developers.circle.com/stablecoins/cctp-getting-started
 * - https://docs.arc.network/arc/references/contract-addresses
 * - https://developers.circle.com/cctp/concepts/supported-chains-and-domains
 */

import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

// CCTP Domain IDs (official from Circle documentation)
// Source: https://developers.circle.com/cctp/concepts/supported-chains-and-domains
const CCTP_DOMAINS = {
  ETHEREUM_MAINNET: 0,
  AVALANCHE_MAINNET: 1,
  OPTIMISM_MAINNET: 2,
  ARBITRUM_MAINNET: 3,
  BASE_MAINNET: 6,
  POLYGON_MAINNET: 7,
  // Testnets use same domain IDs as mainnet
  ETHEREUM_SEPOLIA: 0,
  AVALANCHE_FUJI: 1,
  BASE_SEPOLIA: 6,
  ARC_TESTNET: 10  // Arc testnet domain
};

// Contract Addresses - Verified from official documentation
const CONTRACTS = {
  // Ethereum Sepolia
  sepolia: {
    usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    tokenMessenger: '0x9f3B8679c73C2Fef8b59B4F3444d4e156fb70AA5',
    messageTransmitter: '0x7865fAfC2db2093669d92c0f33AeEF291086BEFD',
    rpc: 'https://rpc.sepolia.org',
    chainId: 11155111,
    explorer: 'https://sepolia.etherscan.io'
  },
  // Base Sepolia (Uniswap v4 deployed here)
  baseSepolia: {
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    tokenMessenger: '0x9f3B8679c73C2Fef8b59B4F3444d4e156fb70AA5',
    messageTransmitter: '0x7865fAfC2db2093669d92c0f33AeEF291086BEFD',
    rpc: 'https://sepolia.base.org',
    chainId: 84532,
    explorer: 'https://sepolia.basescan.org',
    poolManager: '0x7Da1D65F8B249183667cdE74C5CBD46dD38AA829' // Uniswap v4
  },
  // Arc Testnet (Credit Terminal deployed here)
  arc: {
    usdc: '0x3600000000000000000000000000000000000000',
    tokenMessenger: '0xb43db544E2c27092c107639Ad201b3dEfAbcF192',
    messageTransmitter: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    tokenMinter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
    rpc: 'https://rpc.testnet.arc.network',
    chainId: 5042002,
    explorer: 'https://testnet.arcscan.app'
  }
};

// Circle Attestation API
const ATTESTATION_API = {
  sandbox: 'https://iris-api-sandbox.circle.com',
  production: 'https://iris-api.circle.com'
};

// ABIs
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

const TOKEN_MESSENGER_ABI = [
  'function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken) external returns (uint64 nonce)',
  'event DepositForBurn(uint64 indexed nonce, address indexed burnToken, uint256 amount, address indexed depositor, bytes32 mintRecipient, uint32 destinationDomain, bytes32 destinationTokenMessenger, bytes32 destinationCaller)'
];

const MESSAGE_TRANSMITTER_ABI = [
  'function receiveMessage(bytes message, bytes attestation) external returns (bool success)',
  'function usedNonces(bytes32 sourceAndNonce) view returns (uint256)',
  'event MessageReceived(address indexed caller, uint32 sourceDomain, uint64 indexed nonce, bytes32 sender, bytes messageBody)'
];

class CCTPBridge {
  constructor(config = {}) {
    this.config = {
      sepoliaRpc: config.sepoliaRpc || 'https://rpc.sepolia.org',
      arcRpc: config.arcRpc || 'https://rpc.testnet.arc.network',
      attestationApi: config.attestationApi || ATTESTATION_API.sandbox,
      privateKey: config.privateKey || process.env.PRIVATE_KEY
    };
    
    this.sepoliaProvider = null;
    this.arcProvider = null;
    this.sepoliaWallet = null;
    this.arcWallet = null;
  }

  async initialize() {
    if (!this.config.privateKey) {
      throw new Error('PRIVATE_KEY environment variable required');
    }

    // Initialize providers
    this.sepoliaProvider = new ethers.JsonRpcProvider(this.config.sepoliaRpc);
    this.arcProvider = new ethers.JsonRpcProvider(this.config.arcRpc);

    // Initialize wallets
    this.sepoliaWallet = new ethers.Wallet(this.config.privateKey, this.sepoliaProvider);
    this.arcWallet = new ethers.Wallet(this.config.privateKey, this.arcProvider);

    // Initialize contracts
    this.sepoliaUsdc = new ethers.Contract(CONTRACTS.sepolia.usdc, ERC20_ABI, this.sepoliaWallet);
    this.sepoliaTokenMessenger = new ethers.Contract(
      CONTRACTS.sepolia.tokenMessenger,
      TOKEN_MESSENGER_ABI,
      this.sepoliaWallet
    );
    
    this.arcUsdc = new ethers.Contract(CONTRACTS.arc.usdc, ERC20_ABI, this.arcWallet);
    this.arcMessageTransmitter = new ethers.Contract(
      CONTRACTS.arc.messageTransmitter,
      MESSAGE_TRANSMITTER_ABI,
      this.arcWallet
    );

    console.log('\u2705 CCTP Bridge initialized');
    console.log(`   Wallet: ${this.sepoliaWallet.address}`);
    console.log(`   Sepolia RPC: ${this.config.sepoliaRpc}`);
    console.log(`   Arc RPC: ${this.config.arcRpc}`);
  }

  async getBalances() {
    const sepoliaBalance = await this.sepoliaUsdc.balanceOf(this.sepoliaWallet.address);
    const arcBalance = await this.arcUsdc.balanceOf(this.arcWallet.address);
    
    return {
      sepolia: ethers.formatUnits(sepoliaBalance, 6),
      arc: ethers.formatUnits(arcBalance, 6)
    };
  }

  async bridgeToArc(amount, recipientAddress = null) {
    const recipient = recipientAddress || this.arcWallet.address;
    const amountFormatted = ethers.formatUnits(amount, 6);
    
    console.log(`\n\ud83c\udf09 Bridging ${amountFormatted} USDC from Sepolia to Arc`);
    console.log(`   Recipient: ${recipient}`);

    try {
      // Step 1: Check balance
      const balance = await this.sepoliaUsdc.balanceOf(this.sepoliaWallet.address);
      if (balance < amount) {
        throw new Error(`Insufficient balance. Have: ${ethers.formatUnits(balance, 6)} USDC, Need: ${amountFormatted} USDC`);
      }

      // Step 2: Approve TokenMessenger to spend USDC
      console.log('\n[1/4] Approving USDC spend...');
      const allowance = await this.sepoliaUsdc.allowance(
        this.sepoliaWallet.address,
        CONTRACTS.sepolia.tokenMessenger
      );
      
      if (allowance < amount) {
        const approveTx = await this.sepoliaUsdc.approve(
          CONTRACTS.sepolia.tokenMessenger,
          amount
        );
        console.log(`   Approval tx: ${approveTx.hash}`);
        await approveTx.wait();
        console.log('   \u2705 Approved');
      } else {
        console.log('   \u2705 Already approved');
      }

      // Step 3: Burn USDC on Sepolia (depositForBurn)
      console.log('\n[2/4] Burning USDC on Sepolia...');
      const mintRecipient = ethers.zeroPadValue(recipient, 32);
      
      const burnTx = await this.sepoliaTokenMessenger.depositForBurn(
        amount,
        CCTP_DOMAINS.ARC_TESTNET,
        mintRecipient,
        CONTRACTS.sepolia.usdc
      );
      console.log(`   Burn tx: ${burnTx.hash}`);
      
      const burnReceipt = await burnTx.wait();
      console.log(`   \u2705 Burned in block ${burnReceipt.blockNumber}`);

      // Step 4: Extract message bytes and hash from burn event
      const { messageBytes, messageHash } = this.extractMessageFromReceipt(burnReceipt);
      console.log(`   Message hash: ${messageHash}`);

      // Step 5: Wait for Circle attestation
      console.log('\n[3/4] Waiting for Circle attestation...');
      const attestation = await this.waitForAttestation(messageHash);
      console.log('   \u2705 Attestation received');

      // Step 6: Mint USDC on Arc (receiveMessage)
      console.log('\n[4/4] Minting USDC on Arc...');
      const mintTx = await this.arcMessageTransmitter.receiveMessage(
        messageBytes,
        attestation
      );
      console.log(`   Mint tx: ${mintTx.hash}`);
      
      const mintReceipt = await mintTx.wait();
      console.log(`   \u2705 Minted in block ${mintReceipt.blockNumber}`);

      console.log(`\n\u2705 Bridge complete!`);
      console.log(`   ${amountFormatted} USDC transferred to ${recipient} on Arc Testnet`);

      return {
        burnTx: burnReceipt.hash,
        mintTx: mintReceipt.hash,
        amount: amountFormatted,
        recipient
      };

    } catch (error) {
      console.error('\n\u274c Bridge failed:', error.message);
      throw error;
    }
  }

  extractMessageFromReceipt(receipt) {
    // Find the MessageSent event from MessageTransmitter
    // The message bytes are in the event data
    const messageSentTopic = ethers.id('MessageSent(bytes)');
    
    const messageLog = receipt.logs.find(log => {
      return log.topics[0] === messageSentTopic;
    });

    if (!messageLog) {
      // Alternative: construct message from DepositForBurn event
      // This is a fallback approach
      const depositLog = receipt.logs.find(log => {
        try {
          const parsed = this.sepoliaTokenMessenger.interface.parseLog(log);
          return parsed?.name === 'DepositForBurn';
        } catch {
          return false;
        }
      });

      if (!depositLog) {
        throw new Error('Could not find DepositForBurn event in receipt');
      }

      // For now, use the raw log data as message bytes
      // In production, properly construct the message format
      const messageBytes = depositLog.data;
      const messageHash = ethers.keccak256(messageBytes);
      
      return { messageBytes, messageHash };
    }

    // Decode the message bytes from the event
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    const [messageBytes] = abiCoder.decode(['bytes'], messageLog.data);
    const messageHash = ethers.keccak256(messageBytes);

    return { messageBytes, messageHash };
  }

  async waitForAttestation(messageHash, maxWaitMs = 900000) { // 15 min default
    const startTime = Date.now();
    const pollInterval = 10000; // 10 seconds
    
    // Remove '0x' prefix if present for API call
    const hashForApi = messageHash.startsWith('0x') ? messageHash.slice(2) : messageHash;
    const url = `${this.config.attestationApi}/attestations/${hashForApi}`;

    console.log(`   Polling: ${url}`);

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const response = await fetch(url);
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.status === 'complete' && data.attestation) {
            return data.attestation;
          }
          
          console.log(`   Status: ${data.status || 'pending'}`);
        } else if (response.status === 404) {
          console.log('   Status: not found (waiting for attestation)');
        } else {
          console.log(`   HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        console.log(`   Error polling: ${error.message}`);
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Attestation timeout after ${maxWaitMs / 1000} seconds`);
  }

  async bridgeFromArc(amount, recipientAddress = null) {
    // Bridge from Arc back to Sepolia (reverse direction)
    const recipient = recipientAddress || this.sepoliaWallet.address;
    console.log(`\n\ud83c\udf09 Bridging ${ethers.formatUnits(amount, 6)} USDC from Arc to Sepolia`);
    console.log('   (Reverse bridge implementation similar to bridgeToArc)');
    // Implementation follows same pattern but with Arc -> Sepolia contracts
    throw new Error('Reverse bridge not yet implemented');
  }
}

// CLI Entry Point
async function main() {
  const bridge = new CCTPBridge();
  
  try {
    await bridge.initialize();
    
    // Show balances
    const balances = await bridge.getBalances();
    console.log(`\n\ud83d\udcb0 Current Balances:`);
    console.log(`   Sepolia USDC: ${balances.sepolia}`);
    console.log(`   Arc USDC: ${balances.arc}`);

    // Bridge if amount specified
    const amountArg = process.argv[2];
    const recipientArg = process.argv[3];
    
    if (amountArg) {
      const amount = ethers.parseUnits(amountArg, 6);
      await bridge.bridgeToArc(amount, recipientArg);
      
      // Show updated balances
      const newBalances = await bridge.getBalances();
      console.log(`\n\ud83d\udcb0 Updated Balances:`);
      console.log(`   Sepolia USDC: ${newBalances.sepolia}`);
      console.log(`   Arc USDC: ${newBalances.arc}`);
    } else {
      console.log('\n\u26a0\ufe0f  Usage: node cctpBridge.js <amount> [recipient]');
      console.log('   Example: node cctpBridge.js 100 0x...');
    }

  } catch (error) {
    console.error('\u274c Error:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { CCTPBridge, CCTP_DOMAINS, CONTRACTS, ATTESTATION_API };
