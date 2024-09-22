// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.0;

import "./MerkleTreeWithHistory.sol";
import "./Interfaces/IVerifier.sol";

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Tornado is MerkleTreeWithHistory, ReentrancyGuard {
    uint256 public immutable denomination;
    IVerifier immutable verifier;

    mapping(bytes32 => bool) public nullifierHashes;
    mapping(bytes32 => bool) public commitments;

    event Deposit(bytes32 commitment, uint256 index, uint256 timestamp); // used to rebuild the merkle tree to generate the proof
    event Withdrawal(address to, bytes32 nullifierHash);

    constructor(
        uint256 _denomination,
        uint32 _levels,
        IHasher _hasher,
        IVerifier _verifier
    ) MerkleTreeWithHistory(_levels, _hasher) {
        denomination = _denomination;
        verifier = _verifier;
    }

    // collect native, insert in the merkle tree and emit event to allow for reconstruction of merkle tree
    // _commitment = hash(nullifier + secret)
    function deposit(bytes32 _commitment) external payable nonReentrant {
        require(
            msg.value == denomination,
            "Wrong denomination. All deposits should be equal amount"
        );
        require(
            commitments[_commitment] == false,
            "The commitment has been submitted"
        );

        uint256 insertedIndex = _insert(_commitment);

        commitments[_commitment] = true;

        emit Deposit(_commitment, insertedIndex, block.timestamp);
    }

    function withdraw(
        Proof memory _proof,
        bytes32 _root,
        bytes32 _nullifierHash,
        address payable _recipient
    ) external nonReentrant {
        require(
            nullifierHashes[_nullifierHash] == false,
            "The note has been already spent"
        );
        require(isKnownRoot(_root) == true, "Cannot find your merkle root");
        require(
            verifier.verifyTx(
                _proof,
                [uint256(_root), uint256(_nullifierHash)]
            ),
            "Invalid withdraw proof"
        );

        nullifierHashes[_nullifierHash] = true;

        _recipient.transfer(denomination);

        emit Withdrawal(_recipient, _nullifierHash);
    }

    function isSpent(bytes32 _nullifierHash) public view returns (bool) {
        return nullifierHashes[_nullifierHash];
    }
}
