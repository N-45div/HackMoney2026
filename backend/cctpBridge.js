import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

// Circle CCTP Contract ABIs
const MESSAGE_TRANSMITTER_ABI = [
  "function sendMessage(uint256 destinationDomain, bytes32 recipient, bytes message) external returns (uint64 nonce)",
  "function receiveMessage(bytes message, bytes attestation) external returns (bool success)"
];

const TOKEN_MESSENGER_ABI = [
  "function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken) external returns (uint64 nonce)",
  "function receiveMessage(bytes message, bytes attestation) external"
];

// Domain IDs for CCTP
const DOMAINS = {
  ETHEREUM_SEPOLIA: 0,
  AVALANCHE_FUJI: 1,
  ARC_TESTNET: 5042002  // Arc testnet domain
};

// Contract addresses (Arc Testnet)
const ARC_CONTRACTS = {
  messageTransmitter: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
  tokenMessenger: '0xb43db544E2c27092c107639Ad201b3dEfAbcF192',
  usdc: '0x2e6a65532ED4F097Dd3703b22B7b5cF2F53cF9e6'
};

class CCTPBridge {
  constructor() {
    this.sepoliaProvider = new ethers.JsonRpcProvider('https://rpc.sepolia.org');
    this.arcProvider = new ethers.JsonRpcProvider('https://rpc-arc.testnet.circle.com');
  }

  async initialize(privateKey) {
    this.sepoliaWallet = new ethers.Wallet(privateKey, this.sepoliaProvider);
    this.arcWallet = new ethers.Wallet(privateKey, this.arcProvider);
    
    this.sepoliaTokenMessenger = new ethers.Contract(
      '0xEbA5e2E17C9F5C74796606606DaC65Fc4C56a8D6', // Sepolia Token Messenger
      TOKEN_MESSENGER_ABI,
      this.sepoliaWallet
    );
    
    this.arcMessageTransmitter = new ethers.Contract(
      ARC_CONTRACTS.messageTransmitter,
      MESSAGE_TRANSMITTER_ABI,
      this.arcWallet
    );

    console.log('✅ CCTP Bridge initialized');
  }

  async bridgeToArc(amount, recipientAddress) {
    console.log(`🌉 Bridging ${ethers.formatUnits(amount, 6)} USDC from Sepolia to Arc...`);
    
    try {
      // 1. Approve USDC spend on Sepolia
      const usdcSepolia = new ethers.Contract(
        '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Sepolia USDC
        ['function approve(address spender, uint256 amount) external returns (bool)'],
        this.sepoliaWallet
      );
      
      console.log('Approving USDC...');
      const approveTx = await usdcSepolia.approve(
        await this.sepoliaTokenMessenger.getAddress(),
        amount
      );
      await approveTx.wait();
      console.log('✅ Approved');
      
      // 2. Burn USDC on Sepolia
      console.log('Burning USDC on Sepolia...');
      const burnTx = await this.sepoliaTokenMessenger.depositForBurn(
        amount,
        DOMAINS.ARC_TESTNET,
        ethers.zeroPadValue(recipientAddress, 32),
        '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'
      );
      const burnReceipt = await burnTx.wait();
      console.log('🔥 Burned:', burnReceipt.hash);
      
      // Extract nonce from event
      const event = burnReceipt.logs.find(
        log => log.topics[0] === ethers.id('DepositForBurn(uint64,address,uint256,address,bytes32,uint32,address,bytes)')
      );
      const nonce = event ? parseInt(event.topics[1], 16) : null;
      console.log('Nonce:', nonce);
      
      // 3. Wait for attestation from Circle (usually 10-30 mins on mainnet, faster on testnet)
      console.log('⏳ Waiting for Circle attestation...');
      const attestation = await this.waitForAttestation(nonce);
      
      // 4. Mint USDC on Arc
      console.log('Minting on Arc...');
      const message = await this.fetchMessageBytes(nonce);
      const mintTx = await this.arcMessageTransmitter.receiveMessage(message, attestation);
      const mintReceipt = await mintTx.wait();
      
      console.log('✅ Bridge complete! Mint tx:', mintReceipt.hash);
      return mintReceipt.hash;
      
    } catch (error) {
      console.error('❌ Bridge failed:', error.message);
      throw error;
    }
  }

  async waitForAttestation(nonce, maxWait = 600000) {
    // Poll Circle attestation API
    const startTime = Date.now();
    const attestationUrl = `https://iris-api-sandbox.circle.com/v1/attestations/${nonce}`;
    
    while (Date.now() - startTime < maxWait) {
      try {
        const response = await fetch(attestationUrl);
        const data = await response.json();
        
        if (data.attestation) {
          console.log('✅ Attestation received');
          return data.attestation;
        }
        
        console.log('⏳ Waiting for attestation...');
        await new Promise(r => setTimeout(r, 10000)); // Check every 10s
        
      } catch (error) {
        console.log('⏳ Attestation not ready yet...');
        await new Promise(r => setTimeout(r, 10000));
      }
    }
    
    throw new Error('Attestation timeout');
  }

  async fetchMessageBytes(nonce) {
    // Fetch message from Circle API or event logs
    // This is simplified - in production you'd parse from burn event
    return '0x'; // Placeholder
  }

  async getUSDCBalance(address, network = 'arc') {
    const provider = network === 'arc' ? this.arcProvider : this.sepoliaProvider;
    const usdcAddress = network === 'arc' 
      ? ARC_CONTRACTS.usdc 
      : '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
    
    const usdc = new ethers.Contract(
      usdcAddress,
      ['function balanceOf(address) view returns (uint256)'],
      provider
    );
    
    const balance = await usdc.balanceOf(address);
    return ethers.formatUnits(balance, 6);
  }
}

// Example usage
async function main() {
  const bridge = new CCTPBridge();
  await bridge.initialize(process.env.PRIVATE_KEY);
  
  // Bridge 100 USDC to Arc
  const amount = ethers.parseUnits('100', 6);
  const recipient = process.env.RECIPIENT_ADDRESS;
  
  if (recipient) {
    await bridge.bridgeToArc(amount, recipient);
  } else {
    console.log('⚠️  Set RECIPIENT_ADDRESS env var');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { CCTPBridge, DOMAINS, ARC_CONTRACTS };
