// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.0;

import "./MerkleTreeWithHistory.sol";
import "./Interfaces/IVerifier.sol";

contract ZkVote is MerkleTreeWithHistory {
    IVerifier immutable verifier;

    mapping(bytes32 => bool) public nullifierHashes;
    mapping(bytes32 => bool) public commitments;

    uint256 public immutable numOptions;
    mapping (uint256 => uint256) public votes;

    address owner;
    mapping(address => bool) isValidator;

    event Vote(uint256 option);
    event VoterRegistered(bytes32 commitment, uint256 index, uint256 timestamp); // used to rebuild the merkle tree to generate the proof
    event ValidatorRegistered(address validator);

    constructor(
        uint32 _levels,
        IHasher _hasher,
        IVerifier _verifier,
        uint256 _numOptions
    ) MerkleTreeWithHistory(_levels, _hasher) {
        owner = msg.sender;
        numOptions = _numOptions;
        verifier = _verifier;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyValidator() {
        require(isValidator[msg.sender] == true, "Only validator");
        _;
    }

    function registerValidator(address _validator) external onlyOwner {
        isValidator[_validator] = true;

        emit ValidatorRegistered(_validator);
    }

    function registerVoter(bytes32 _commitment) external onlyValidator {
        require(
            commitments[_commitment] == false,
            "The commitment has already been submitted"
        );

        uint256 insertedIndex = _insert(_commitment);

        commitments[_commitment] = true;

        emit VoterRegistered(_commitment, insertedIndex, block.timestamp);
    }

    function vote(
        Proof memory _proof,
        bytes32 _root,
        bytes32 _nullifierHash,
        uint256 _option
    ) external {
        require(_option < numOptions, "Invalid option");
        require(
            nullifierHashes[_nullifierHash] == false,
            "Vote already registered"
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

        votes[_option] += 1;

        emit Vote(_option);
    }

    function hasVoted(bytes32 _nullifierHash) public view returns (bool) {
        return nullifierHashes[_nullifierHash];
    }

    function getVotes(uint256 _option) public view returns (uint256) {
        require(_option < numOptions, "Invalid option");
        return votes[_option];
    }
}
