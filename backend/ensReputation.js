import { ethers } from 'ethers';

// ENS Registry ABI (Sepolia)
const ENS_REGISTRY_ABI = [
  "function resolver(bytes32 node) view returns (address)",
  "function owner(bytes32 node) view returns (address)"
];

// Public Resolver ABI
const RESOLVER_ABI = [
  "function text(bytes32 node, string key) view returns (string)",
  "function setText(bytes32 node, string key, string value)"
];

// ENS namehash function
function namehash(name) {
  let node = '0x0000000000000000000000000000000000000000000000000000000000000000';
  if (name) {
    const labels = name.split('.');
    for (let i = labels.length - 1; i >= 0; i--) {
      const labelHash = ethers.keccak256(ethers.toUtf8Bytes(labels[i]));
      node = ethers.keccak256(ethers.concat([node, labelHash]));
    }
  }
  return node;
}

class ENSCreditReputation {
  constructor(providerUrl = 'https://rpc.sepolia.org') {
    this.provider = new ethers.JsonRpcProvider(providerUrl);
    this.registryAddress = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e'; // ENS Registry (same on all networks)
  }

  async initialize(privateKey) {
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.registry = new ethers.Contract(
      this.registryAddress,
      ENS_REGISTRY_ABI,
      this.wallet
    );
    console.log('✅ ENS Credit Reputation initialized');
  }

  async getResolver(ensName) {
    const node = namehash(ensName);
    const resolverAddress = await this.registry.resolver(node);
    if (resolverAddress === ethers.ZeroAddress) {
      throw new Error(`No resolver found for ${ensName}`);
    }
    return new ethers.Contract(resolverAddress, RESOLVER_ABI, this.wallet);
  }

  async getCreditScore(ensName) {
    try {
      const resolver = await this.getResolver(ensName);
      const node = namehash(ensName);
      const scoreJson = await resolver.text(node, 'vnd.credit-score');
      
      if (!scoreJson) return null;
      return JSON.parse(scoreJson);
    } catch (error) {
      console.error(`Failed to get credit score for ${ensName}:`, error.message);
      return null;
    }
  }

  async setCreditScore(ensName, score) {
    const resolver = await this.getResolver(ensName);
    const node = namehash(ensName);
    
    const scoreData = {
      score: score.score || 750,
      lastUpdated: new Date().toISOString(),
      totalDeposits: score.totalDeposits || '0',
      totalRepaid: score.totalRepaid || '0',
      onTimePayments: score.onTimePayments || 0,
      latePayments: score.latePayments || 0
    };
    
    const tx = await resolver.setText(node, 'vnd.credit-score', JSON.stringify(scoreData));
    await tx.wait();
    
    console.log(`✅ Credit score updated for ${ensName}:`, scoreData);
    return tx.hash;
  }

  async getCreditPolicy(ensName) {
    try {
      const resolver = await this.getResolver(ensName);
      const node = namehash(ensName);
      const policyJson = await resolver.text(node, 'vnd.credit-policy');
      
      if (!policyJson) return null;
      return JSON.parse(policyJson);
    } catch (error) {
      console.error(`Failed to get credit policy for ${ensName}:`, error.message);
      return null;
    }
  }

  async setCreditPolicy(ensName, policy) {
    const resolver = await this.getResolver(ensName);
    const node = namehash(ensName);
    
    const policyData = {
      maxCreditLimit: policy.maxCreditLimit || '10000000000', // 10k USDC
      collateralRatio: policy.collateralRatio || 150,
      autoTopUpEnabled: policy.autoTopUpEnabled ?? true,
      autoTopUpThreshold: policy.autoTopUpThreshold || 20, // 20%
      authorizedAgents: policy.authorizedAgents || []
    };
    
    const tx = await resolver.setText(node, 'vnd.credit-policy', JSON.stringify(policyData));
    await tx.wait();
    
    console.log(`✅ Credit policy updated for ${ensName}:`, policyData);
    return tx.hash;
  }

  // Generate ENS hash for on-chain reference
  getEnsHash(ensName) {
    return namehash(ensName);
  }
}

export { ENSCreditReputation, namehash };
