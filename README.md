
# Zokrates vote

Anonymous voting on Ethereum blockchain using zero knowledge proof with zokrates.


Commands:

- `make compile` -> Compiles circuits and contracts
- `make compile-circuits` -> Compile circuits
- `make compile-contracts` -> Compile contracts
- `make tests` -> runs tests
- `make proof` -> Takes `contracts/input.json` to create a proof for the circuit

Details:

Circuits in `contracts/circuits`.
Tests use `zokrates-js` to compile on the fly the circuits and create dynamic proofs leveraging fixtures.

How it works:

1. Admin registers validators
2. Voters create commitments and ask validators to include them in the tree
3. Validators validate user identity and include the commitment
4. Users summit their vote using zk proofs to indicate they belong to the tree and have the nullifier for a commitment
5. Vote is registered without revealing what each voter voted.
