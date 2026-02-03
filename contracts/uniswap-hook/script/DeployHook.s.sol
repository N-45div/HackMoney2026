// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {AntiSniperHook} from "../src/AntiSniperHook.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";

contract DeployAntiSniperHook is Script {
    // This will need to be set after PoolManager is deployed
    // For now, use a placeholder or deploy PoolManager first
    address constant POOL_MANAGER = address(0); // TODO: Set after PoolManager deployment
    
    function run() external returns (AntiSniperHook) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        require(POOL_MANAGER != address(0), "Set POOL_MANAGER address first");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy hook - note: for v4 hooks, address must have correct flags
        // This is a simplified deployment - production needs CREATE2 mining
        AntiSniperHook hook = new AntiSniperHook(IPoolManager(POOL_MANAGER));
        
        console.log("AntiSniperHook deployed at:", address(hook));
        console.log("PoolManager:", POOL_MANAGER);
        
        vm.stopBroadcast();
        
        return hook;
    }
    
    // Helper to find a valid hook address using CREATE2
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
}
