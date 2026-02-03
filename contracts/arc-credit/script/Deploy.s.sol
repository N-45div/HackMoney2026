// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ArcCreditTerminal} from "../src/ArcCreditTerminal.sol";

contract DeployArcCreditTerminal is Script {
    // Arc Testnet USDC - Official address from https://docs.arc.network/arc/references/contract-addresses
    address constant ARC_TESTNET_USDC = 0x3600000000000000000000000000000000000000;
    
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
