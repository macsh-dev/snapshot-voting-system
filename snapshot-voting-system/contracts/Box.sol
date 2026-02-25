// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Box is Ownable {
    uint256 private _value;

    event ValueChanged(uint256 newValue);

    constructor(address initialOwner) Ownable(initialOwner) {}

    uint256 public constant MAX_VALUE = 10_000;

    error ValueCannotBeZero();
    error ValueOutOfBounds(uint256 value, uint256 max);

    function store(uint256 newValue) public onlyOwner {
        if (newValue == 0) revert ValueCannotBeZero();
        if (newValue > MAX_VALUE) revert ValueOutOfBounds(newValue, MAX_VALUE);
        _value = newValue;
        emit ValueChanged(newValue);
    }

    function retrieve() public view returns (uint256) {
        return _value;
    }
}
