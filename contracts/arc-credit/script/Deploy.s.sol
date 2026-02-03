// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {ArcCreditTerminal} from "../src/ArcCreditTerminal.sol";

contract DeployArcCreditTerminal is Script {
    // Arc Testnet USDC contract address
    address constant ARC_TESTNET_USDC = 0x2e6a65532ED4F097Dd3703b22B7b5cF2F53cF9e6;
    
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
