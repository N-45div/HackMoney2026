// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {AntiSniperHook} from "../src/AntiSniperHook.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";

/// @title DeployAntiSniperHook
/// @notice Deployment script for AntiSniperHook on Base Sepolia
/// @dev Uniswap v4 PoolManager addresses from https://docs.uniswap.org/contracts/v4/deployments
contract DeployAntiSniperHook is Script {
    // Base Sepolia PoolManager address (Uniswap v4)
    // Source: https://docs.uniswap.org/contracts/v4/deployments
    address constant BASE_SEPOLIA_POOL_MANAGER = 0x7Da1D65F8B249183667cdE74C5CBD46dD38AA829;
    
    // Ethereum Sepolia PoolManager address (Uniswap v4)
    address constant ETH_SEPOLIA_POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    
    function run() external returns (AntiSniperHook) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // Default to Base Sepolia, can be overridden via env
        address poolManager = vm.envOr("POOL_MANAGER", BASE_SEPOLIA_POOL_MANAGER);
        
        require(poolManager != address(0), "Invalid PoolManager address");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy hook - note: for v4 hooks, address must have correct flags
        // This is a simplified deployment - production needs CREATE2 mining for correct address
        AntiSniperHook hook = new AntiSniperHook(IPoolManager(poolManager));
        
        console.log("AntiSniperHook deployed at:", address(hook));
        console.log("PoolManager:", poolManager);
        
        vm.stopBroadcast();
        
        return hook;
    }
    
    /// @notice Helper to find a valid hook address using CREATE2
    /// @dev Hook addresses must have specific flag bits set in the address
    function findHookAddress(
        address deployer,
        bytes32 salt,
        address poolManager
    ) public pure returns (address) {
        // Hook flags required: beforeSwap, afterSwap
        uint160 flags = uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG);
        
        bytes memory creationCode = abi.encodePacked(
            type(AntiSniperHook).creationCode,
            abi.encode(poolManager)
        );
        
        bytes32 hash = keccak256(abi.encodePacked(
            bytes1(0xff),
            deployer,
            salt,
            keccak256(creationCode)
        ));
        
        address hookAddress = address(uint160(uint256(hash)));
        
        // Verify flags match
        require(
            uint160(hookAddress) & flags == flags,
            "Address doesn't have correct flags"
        );
        
        return hookAddress;
    }
    
    /// @notice Mine for a valid CREATE2 salt that produces correct hook flags
    function mineSalt(address deployer, address poolManager, uint256 startSalt) public pure returns (bytes32) {
        uint160 flags = uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG);
        
        bytes memory creationCode = abi.encodePacked(
            type(AntiSniperHook).creationCode,
            abi.encode(poolManager)
        );
        bytes32 initCodeHash = keccak256(creationCode);
        
        for (uint256 i = startSalt; i < startSalt + 100000; i++) {
            bytes32 salt = bytes32(i);
            address hookAddress = address(uint160(uint256(keccak256(abi.encodePacked(
                bytes1(0xff),
                deployer,
                salt,
                initCodeHash
            )))));
            
            if (uint160(hookAddress) & flags == flags) {
                return salt;
            }
        }
        
        revert("No valid salt found in range");
    }
}
