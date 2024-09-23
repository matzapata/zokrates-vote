
# Zokrates vote

Anonymous voting on Ethereum blockchain using zero knowledge proof with zokrates.


Commands:

- `make compile` -> Compiles circuits and contracts
- `make compile-circuits` -> Compile circuits and creates fixture proof for tests
- `make compile-contracts` -> Compile contracts
- `make tests` -> runs tests

Details:

Circuits in `contracts/circuits`.
Script in `scripts/compile-circuits.ts` uses `zokrates-js` to compile on the circuits, generate the verifier contract and a fixture proof for the tests.

How it works:

1. Admin registers validators
2. Voters create commitments and ask validators to include them in the tree
3. Validators validate user identity and include the commitment
4. Users summit their vote using zk proofs to indicate they belong to the tree and have the nullifier for a commitment
5. Vote is registered without revealing what each voter voted.
