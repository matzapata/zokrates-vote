import fs from "fs";
import path from "path";
import { buildMimcSponge } from "circomlibjs";
import { generateCommitment } from "../utils/commitment";
import { FixedMerkleTree } from "../utils/fixed-merkle-tree";
import { buildHashFunction } from "../utils/mimc";
const zokrates = require("fix-esm").require("zokrates-js");

const ROOT_ZOK = path.join(__dirname, "../circuits/root.zok");
const OUT_SOL = path.join(__dirname, "../contracts/Verifier.sol");
const OUT_FIXTURE = path.join(__dirname, "../test/fixtures/proof.json")

const TREE_LEVELS = 6;

async function main() {
    const mimcsponge = await buildMimcSponge();
    const provider = await zokrates.initialize();

    const source = fs.readFileSync(ROOT_ZOK).toString();
    const circuit = provider.compile(source);
    const keypair = provider.setup(circuit.program);
    
    // generate solidity verifier
    const verifierSolidity = await provider.exportSolidityVerifier(keypair.vk)
    fs.writeFileSync(OUT_SOL, verifierSolidity);

    // generate proof inputs
    const { commitment, nullifier, nullifierHash, secret } = await generateCommitment()
    const tree = new FixedMerkleTree(TREE_LEVELS, [commitment], buildHashFunction(mimcsponge));
    const path = tree.path(commitment)
   
    // generate proof
    const { witness } = provider.computeWitness(circuit, [
        tree.root.toString(),
        nullifierHash.toString(),
        secret.toString(),
        nullifier.toString(),
        path.pathElements,
        path.pathDirection
    ]);
    const proof = provider.generateProof(
        circuit.program,
        witness,
        keypair.pk
    );

    // verify off-chain
    const isVerified = provider.verify(keypair.vk, proof);
    console.log("Verification result", isVerified);

    // write proof to fixtures
    fs.writeFileSync(OUT_FIXTURE, JSON.stringify({
        root: tree.root.toString(),
        commitment: commitment.toString(),
        nullifierHash: nullifierHash.toString(),
        secret: secret.toString(),
        nullifier: nullifier.toString(),
        pathElements: path.pathElements,
        pathDirection: path.pathDirection,
        proof
    }, null, 2));
}

main()
    .then(() => console.log("OK"))
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })