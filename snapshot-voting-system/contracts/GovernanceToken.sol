// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";

/// @title GovernanceToken
/// @notice ERC20 token with voting capabilities for on-chain governance.
/// @dev Token supply is permanently fixed at deployment and cannot be adjusted by governance.
/// Token holders must explicitly call `delegate()` before their tokens count as voting power.
/// Self-delegation is required even for the token holder to vote with their own tokens.
contract GovernanceToken is ERC20, ERC20Permit, ERC20Votes {
    uint256 public constant MAX_SUPPLY = 1_000_000 * 10 ** 18;

    constructor()
        ERC20("GovernanceToken", "GT")
        ERC20Permit("GovernanceToken")
    {
        _mint(msg.sender, MAX_SUPPLY);
    }

    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20, ERC20Votes) {
        super._update(from, to, value);
    }

    function nonces(
        address owner
    ) public view override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }
}
