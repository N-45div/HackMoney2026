// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {AntiSniperHook} from "../src/AntiSniperHook.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {HookMiner} from "v4-periphery/src/utils/HookMiner.sol";

/// @title DeployAntiSniperHook
/// @notice Deployment script for AntiSniperHook using CREATE2 salt mining
/// @dev Uniswap v4 hooks require specific flag bits in the deployed address.
///      Uses the deterministic CREATE2 deployer proxy (0x4e59b448...) which is
///      available on all standard EVM chains including Sepolia.
contract DeployAntiSniperHook is Script {
    // Standard CREATE2 Deployer Proxy (available on all EVM chains)
    // This proxy deploys contracts via CREATE2 when you send it: salt ++ initcode
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    // Base Sepolia PoolManager address (Uniswap v4)
    // Source: https://docs.uniswap.org/contracts/v4/deployments
    address constant BASE_SEPOLIA_POOL_MANAGER = 0x7Da1D65F8B249183667cdE74C5CBD46dD38AA829;
    
    // Ethereum Sepolia PoolManager address (Uniswap v4)
    address constant ETH_SEPOLIA_POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    
    function run() external returns (AntiSniperHook) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // Default to Ethereum Sepolia, can be overridden via env
        address poolManager = vm.envOr("POOL_MANAGER", ETH_SEPOLIA_POOL_MANAGER);
        
        require(poolManager != address(0), "Invalid PoolManager address");

        // Hook needs beforeSwap + afterSwap flags
        uint160 flags = uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG);

        bytes memory creationCode = type(AntiSniperHook).creationCode;
        bytes memory constructorArgs = abi.encode(poolManager);

        // Mine a CREATE2 salt that produces an address with the correct flag bits
        console.log("Mining CREATE2 salt for hook flags...");
        (address hookAddress, bytes32 salt) = HookMiner.find(
            CREATE2_DEPLOYER,
            flags,
            creationCode,
            constructorArgs
        );
        console.log("Found valid hook address:", hookAddress);
        console.log("Salt:");
        console.logBytes32(salt);

        // Build the payload for the CREATE2 deployer proxy: salt ++ initcode
        bytes memory initcode = abi.encodePacked(creationCode, constructorArgs);
        bytes memory payload = abi.encodePacked(salt, initcode);

        vm.startBroadcast(deployerPrivateKey);
        
        // Send the CREATE2 deployment via the deterministic deployer proxy
        (bool success,) = CREATE2_DEPLOYER.call(payload);
        require(success, "CREATE2 deployment failed");
        
        // Verify deployment
        require(hookAddress.code.length > 0, "Hook not deployed at expected address");
        
        AntiSniperHook hook = AntiSniperHook(hookAddress);
        
        console.log("AntiSniperHook deployed at:", address(hook));
        console.log("PoolManager:", poolManager);
        
        vm.stopBroadcast();
        
        return hook;
    }
}
