// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";

/// @title CreatePoolWithHook
/// @notice Creates a Uniswap v4 pool on Ethereum Sepolia with the AntiSniperHook attached
/// @dev Pool: ETH/USDC with 0.30% fee, tickSpacing 60, hook = AntiSniperHook
contract CreatePoolWithHook is Script {
    using PoolIdLibrary for PoolKey;

    // Ethereum Sepolia PoolManager (Uniswap v4)
    address constant POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;

    // AntiSniperHook deployed via CREATE2
    address constant ANTI_SNIPER_HOOK = 0x0A3b821941789AC5Ff334AB6C374bb23C98540c0;

    // Sepolia USDC
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;

    // sqrtPriceX96 for 1:1 price ratio = sqrt(1) * 2^96
    uint160 constant SQRT_PRICE_1_1 = 79228162514264337593543950336;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // currency0 must be < currency1 (sorted by address)
        // address(0) = native ETH, USDC = 0x1c7D...
        // Since address(0) < USDC address, currency0 = ETH, currency1 = USDC
        Currency currency0 = Currency.wrap(address(0)); // Native ETH
        Currency currency1 = Currency.wrap(USDC);

        PoolKey memory key = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 3000,        // 0.30%
            tickSpacing: 60,
            hooks: IHooks(ANTI_SNIPER_HOOK)
        });

        PoolId poolId = key.toId();

        console.log("Initializing pool on Sepolia PoolManager...");
        console.log("PoolManager:", POOL_MANAGER);
        console.log("Hook:", ANTI_SNIPER_HOOK);
        console.log("Currency0 (ETH):", Currency.unwrap(currency0));
        console.log("Currency1 (USDC):", USDC);
        console.log("Fee: 3000 (0.30%)");
        console.log("TickSpacing: 60");
        console.log("PoolId:");
        console.logBytes32(PoolId.unwrap(poolId));

        vm.startBroadcast(deployerPrivateKey);

        int24 tick = IPoolManager(POOL_MANAGER).initialize(key, SQRT_PRICE_1_1);

        console.log("Pool initialized at tick:");
        console.logInt(tick);

        vm.stopBroadcast();
    }
}
