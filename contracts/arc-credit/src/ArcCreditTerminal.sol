// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";

contract ArcCreditTerminal is ERC20, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    
    struct CreditLine {
        uint256 deposited;      // Total USDC deposited
        uint256 borrowed;       // Current debt
        uint256 creditLimit;    // Max borrowable
        uint256 lastUpdate;     // Last activity timestamp
        bytes32 ensHash;        // ENS policy hash
    }
    
    mapping(address => CreditLine) public creditLines;
    mapping(address => bool) public authorizedAgents;
    
    uint256 public constant COLLATERAL_RATIO = 150; // 150% collateral required
    uint256 public constant LIQUIDATION_THRESHOLD = 120; // 120% before liquidation
    
    event Deposit(address indexed user, uint256 amount, bytes32 ensHash);
    event Borrow(address indexed user, uint256 amount);
    event Repay(address indexed user, uint256 amount);
    event MarginTopUp(address indexed user, uint256 amount, address indexed agent);
    event CCTPReceived(address indexed user, uint256 amount, bytes32 messageHash);
    
    constructor(address _usdc) ERC20("Arc Credit Token", "ACT") Ownable(msg.sender) {
        usdc = IERC20(_usdc);
    }
    
    function depositToCreditLine(uint256 amount, bytes32 ensHash) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        
        CreditLine storage line = creditLines[msg.sender];
        line.deposited += amount;
        line.creditLimit = (line.deposited * COLLATERAL_RATIO) / 100;
        line.lastUpdate = block.timestamp;
        line.ensHash = ensHash;
        
        _mint(msg.sender, amount); // Credit tokens represent deposit
        
        emit Deposit(msg.sender, amount, ensHash);
    }
    
    function requestMarginTopUp(uint256 amount) external nonReentrant {
        CreditLine storage line = creditLines[msg.sender];
        require(line.borrowed + amount <= line.creditLimit, "Exceeds credit limit");
        
        line.borrowed += amount;
        line.lastUpdate = block.timestamp;
        
        usdc.safeTransfer(msg.sender, amount);
        
        emit Borrow(msg.sender, amount);
    }
    
    function agentTopUp(address user, uint256 amount) external nonReentrant {
        require(authorizedAgents[msg.sender], "Not authorized agent");
        
        CreditLine storage line = creditLines[user];
        require(line.borrowed + amount <= line.creditLimit, "Exceeds credit limit");
        
        line.borrowed += amount;
        line.lastUpdate = block.timestamp;
        
        usdc.safeTransfer(user, amount);
        
        emit MarginTopUp(user, amount, msg.sender);
    }
    
    function receiveCCTP(uint256 amount, bytes32 messageHash) external nonReentrant {
        // Called by CCTP relayer after attestation
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        
        emit CCTPReceived(msg.sender, amount, messageHash);
    }
    
    function settleCredit(uint256 amount) external nonReentrant {
        CreditLine storage line = creditLines[msg.sender];
        require(amount <= line.borrowed, "Repay exceeds debt");
        
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        line.borrowed -= amount;
        line.lastUpdate = block.timestamp;
        
        emit Repay(msg.sender, amount);
    }
    
    function addAuthorizedAgent(address agent) external onlyOwner {
        authorizedAgents[agent] = true;
    }
    
    function removeAuthorizedAgent(address agent) external onlyOwner {
        authorizedAgents[agent] = false;
    }
    
    function getCreditInfo(address user) external view returns (CreditLine memory) {
        return creditLines[user];
    }
    
    function getAvailableCredit(address user) external view returns (uint256) {
        CreditLine memory line = creditLines[user];
        if (line.borrowed >= line.creditLimit) return 0;
        return line.creditLimit - line.borrowed;
    }
}
