// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ArcCreditTerminal} from "../src/ArcCreditTerminal.sol";

contract DeployArcCreditTerminal is Script {
    // Arc Testnet USDC contract address
    address constant ARC_TESTNET_USDC = 0x2e6A65532Ed4f097Dd3703B22b7b5cf2f53Cf9E6;
    
    function run() external returns (ArcCreditTerminal) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        ArcCreditTerminal terminal = new ArcCreditTerminal(ARC_TESTNET_USDC);
        
        console.log("ArcCreditTerminal deployed at:", address(terminal));
        console.log("USDC Token:", ARC_TESTNET_USDC);
        
        vm.stopBroadcast();
        
        return terminal;
    }
}
