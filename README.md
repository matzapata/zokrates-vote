
# Zokrates Tornado

A simple implementation of tornado to showcase zokrates.

Commands:

- `make compile` -> Compiles circuits and contracts
- `make compile-circuits` -> Compile circuits
- `make compile-contracts` -> Compile contracts
- `make tests` -> runs tests
- `make proof` -> Takes `contracts/input.json` to create a proof for the circuit

Details:

Circuits in `contracts/circuits`. Unlike tornado-core uses mimcsponge for both commitment and merkle tree. 
Fixed merkle tree class has it's own implementation in utils.
Within utils also functions to create commitments and collect events to rebuild the merkle tree locally.
Tests use `zokrates-js` to compile on the fly the circuits and create dynamic proofs leveraging fixtures.
MerkleTreeWithHistory.sol heavily inspired from tornado-core, pending to make it more generic for other use cases.
