// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.0;

interface IHasher {
    function MiMCSponge(
        uint256 in_xL,
        uint256 in_xR,
        uint256 k
    ) external pure returns (uint256 xL, uint256 xR);
}
