// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "v4-periphery/src/utils/BaseHook.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

/// @title AntiSniperHook
/// @notice Uniswap v4 hook implementing commit-reveal scheme for MEV protection
/// @dev Deployed on Base Sepolia for NitroBridge Vault cross-chain margin system
contract AntiSniperHook is BaseHook {
    using PoolIdLibrary for PoolKey;

    // Commit-reveal storage
    struct Commitment {
        bytes32 hash;
        uint256 blockNumber;
        bool revealed;
    }
    
    mapping(address => mapping(PoolId => Commitment)) public commitments;
    mapping(address => mapping(PoolId => uint256)) public revealedAmounts;
    
    uint256 public constant REVEAL_DELAY = 2; // blocks
    uint256 public constant MIN_COMMITMENT_AGE = 1; // block
    
    event Commit(address indexed trader, PoolId indexed poolId, bytes32 hash);
    event Reveal(address indexed trader, PoolId indexed poolId, uint256 amount, uint256 nonce);
    event SwapExecuted(address indexed sender, PoolId indexed poolId, bool zeroForOne, int256 amountSpecified);
    
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
    
    /// @notice Trader commits to an order hash before executing swap
    /// @param _hash keccak256(abi.encodePacked(amount, nonce, msg.sender))
    /// @param poolId The pool ID for the commitment
    function commit(bytes32 _hash, PoolId poolId) external {
        commitments[msg.sender][poolId] = Commitment({
            hash: _hash,
            blockNumber: block.number,
            revealed: false
        });
        emit Commit(msg.sender, poolId, _hash);
    }
    
    /// @notice Reveal actual amount after minimum delay
    /// @param amount The swap amount being revealed
    /// @param nonce Random nonce used in commitment
    /// @param key The pool key
    function reveal(uint256 amount, uint256 nonce, PoolKey calldata key) external {
        PoolId poolId = key.toId();
        Commitment storage commitData = commitments[msg.sender][poolId];
        
        require(commitData.hash != bytes32(0), "No commitment");
        require(!commitData.revealed, "Already revealed");
        require(block.number >= commitData.blockNumber + MIN_COMMITMENT_AGE, "Too early");
        
        bytes32 expectedHash = keccak256(abi.encodePacked(amount, nonce, msg.sender));
        require(commitData.hash == expectedHash, "Invalid reveal");
        
        commitData.revealed = true;
        revealedAmounts[msg.sender][poolId] = amount;
        
        emit Reveal(msg.sender, poolId, amount, nonce);
    }
    
    /// @notice Internal hook called before swap - validates commitment if required
    function _beforeSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata params,
        bytes calldata hookData
    ) internal override returns (bytes4, BeforeSwapDelta, uint24) {
        PoolId poolId = key.toId();
        
        // If hookData contains "REQUIRE_COMMIT", enforce commitment check
        if (hookData.length > 0 && keccak256(hookData) == keccak256("REQUIRE_COMMIT")) {
            Commitment storage commitData = commitments[sender][poolId];
            require(commitData.revealed, "Commitment not revealed");
            
            // Verify amount matches (for exact input swaps)
            if (params.amountSpecified > 0) {
                require(
                    revealedAmounts[sender][poolId] == uint256(params.amountSpecified),
                    "Amount mismatch"
                );
            }
        }
        
        return (this.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }
    
    /// @notice Internal hook called after swap - clears commitment and emits event
    function _afterSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata hookData
    ) internal override returns (bytes4, int128) {
        PoolId poolId = key.toId();
        
        // Clear commitment after execution
        delete commitments[sender][poolId];
        delete revealedAmounts[sender][poolId];
        
        emit SwapExecuted(sender, poolId, params.zeroForOne, params.amountSpecified);
        
        return (this.afterSwap.selector, 0);
    }
    
    /// @notice Generate commitment hash off-chain
    /// @param amount The swap amount
    /// @param nonce Random nonce
    /// @param trader The trader address
    function generateCommitmentHash(uint256 amount, uint256 nonce, address trader) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(amount, nonce, trader));
    }
    
    /// @notice Check if a commitment exists and is valid
    function getCommitment(address trader, PoolId poolId) external view returns (Commitment memory) {
        return commitments[trader][poolId];
    }
}
