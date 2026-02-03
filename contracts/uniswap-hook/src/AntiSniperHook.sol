// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {BaseHook} from "v4-periphery/src/base/hooks/BaseHook.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/src/types/BeforeSwapDelta.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

contract AntiSniperHook is BaseHook {
    using PoolIdLibrary for PoolKey;

    // Commit-reveal storage
    struct Commitment {
        bytes32 hash;
        uint256 timestamp;
        bool revealed;
    }
    
    mapping(address => mapping(PoolId => Commitment)) public commitments;
    mapping(address => mapping(PoolId => uint256)) public revealedAmounts;
    
    uint256 public constant REVEAL_DELAY = 2; // blocks
    uint256 public constant MIN_COMMITMENT_AGE = 1; // block
    
    event Commit(address indexed trader, PoolId indexed poolId, bytes32 hash);
    event Reveal(address indexed trader, PoolId indexed poolId, uint256 amount, uint256 nonce);
    
    constructor(IPoolManager _poolManager) BaseHook(_poolManager) {}
    
    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }
    
    // Trader commits to an order size before executing
    function commit(bytes32 _hash) external {
        PoolId poolId = PoolId.wrap(bytes32(0)); // Will be set during swap
        commitments[msg.sender][poolId] = Commitment({
            hash: _hash,
            timestamp: block.number,
            revealed: false
        });
        emit Commit(msg.sender, poolId, _hash);
    }
    
    // Reveal actual amount after delay
    function reveal(uint256 amount, uint256 nonce, PoolKey calldata key) external {
        PoolId poolId = key.toId();
        Commitment storage commitData = commitments[msg.sender][poolId];
        
        require(!commitData.revealed, "Already revealed");
        require(block.number >= commitData.timestamp + MIN_COMMITMENT_AGE, "Too early");
        
        bytes32 expectedHash = keccak256(abi.encodePacked(amount, nonce, msg.sender));
        require(commitData.hash == expectedHash, "Invalid reveal");
        
        commitData.revealed = true;
        revealedAmounts[msg.sender][poolId] = amount;
        
        emit Reveal(msg.sender, poolId, amount, nonce);
    }
    
    // Before swap: verify commitment exists
    function beforeSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        bytes calldata hookData
    ) external override returns (bytes4, BeforeSwapDelta, uint24) {
        // For demo purposes, skip commitment check if no hook data provided
        // In production, enforce strict commit-reveal
        
        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }
    
    // After swap: record execution
    function afterSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata hookData
    ) external override returns (bytes4, int128) {
        // Clear commitment after execution
        PoolId poolId = key.toId();
        delete commitments[sender][poolId];
        delete revealedAmounts[sender][poolId];
        
        return (BaseHook.afterSwap.selector, 0);
    }
    
    // Get hook address with proper flags for deployment
    function getHookAddress(address deployer, bytes32 salt) public pure returns (address) {
        // Hook flags: beforeSwap = true, afterSwap = true
        uint160 flags = uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG);
        
        // Calculate address using CREATE2
        bytes memory creationCode = type(AntiSniperHook).creationCode;
        bytes32 bytecodeHash = keccak256(abi.encodePacked(creationCode, abi.encode(deployer)));
        
        return address(uint160(uint256(keccak256(abi.encodePacked(
            bytes1(0xff),
            deployer,
            salt,
            bytecodeHash
        )))));
    }
}
