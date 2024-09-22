import hre, { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { buildMimcSponge, mimcSpongecontract } from "circomlibjs";

import { expect } from "chai"
import { FixedMerkleTree } from "../utils/fixed-merkle-tree";
import { generateCommitment } from "../utils/commitment";
import { buildVerifier } from "../utils/verifier";


const SEED = "mimcsponge";
const TREE_LEVELS = 6;

describe("Tornado", function () {

    async function deployFixture() {
        const denomination = hre.ethers.parseEther("0.1")
        const signers = await hre.ethers.getSigners()

        // deploy hashing function
        const MiMCSponge = new hre.ethers.ContractFactory(mimcSpongecontract.abi, mimcSpongecontract.createCode(SEED, 220), signers[0])
        const mimcSpongeContract = await MiMCSponge.deploy()
        const mimcsponge = await buildMimcSponge();

        // compile circuits and deploy verifier
        const cVerifier = await buildVerifier()
        const Verifier = new hre.ethers.ContractFactory(cVerifier.abi, cVerifier.bytecode, signers[0])
        const verifier = await Verifier.deploy()

        // deploy tree
        const Tornado = await hre.ethers.getContractFactory("Tornado");
        const tornado = await Tornado.deploy(denomination, TREE_LEVELS, await mimcSpongeContract.getAddress(), await verifier.getAddress());


        return { tornado, mimcsponge, cVerifier, verifier, denomination };
    }

    describe("#circuit", () => {
        it("Should verify transaction", async () => {
            const { mimcsponge, cVerifier } = await loadFixture(deployFixture);

            // generate commitment
            const { commitment, nullifier, nullifierHash, secret } = await generateCommitment()

            // generate proof
            const tree = new FixedMerkleTree(TREE_LEVELS, [commitment], buildHashFunction(mimcsponge));
            const path = tree.path(commitment)

            const { witness } = cVerifier.provider.computeWitness(cVerifier.circuit, [
                tree.root.toString(),
                nullifierHash.toString(),
                secret.toString(),
                nullifier.toString(),
                path.pathElements,
                path.pathDirection
            ]);
            const proof = cVerifier.provider.generateProof(
                cVerifier.circuit.program,
                witness,
                cVerifier.keypair.pk
            );

            // verify off-chain
            const isVerified = cVerifier.provider.verify(cVerifier.keypair.vk, proof);
            expect(isVerified).to.be.true;
        })
    })

    describe('#deposit', () => {
        it('should emit event', async () => {
            const { tornado, denomination } = await loadFixture(deployFixture);

            await expect(tornado.deposit(toHex(10), { value: toHex(denomination) }))
                .to.emit(tornado, 'Deposit')
                .withArgs(toHex(10), "0x0", expectAny)

            await expect(tornado.deposit(toHex(20), { value: toHex(denomination) }))
                .to.emit(tornado, 'Deposit')
                .withArgs(toHex(20), "0x1", expectAny)
        })

        it('should throw if there is a such commitment', async () => {
            const { tornado, denomination } = await loadFixture(deployFixture);

            const commitment = toHex(10)
            await expect(tornado.deposit(commitment, { value: toHex(denomination) }))
                .not.to.be.reverted

            // now repeat the same deposit expecting a reversion
            await expect(tornado.deposit(commitment, { value: toHex(denomination) }))
                .to.be.revertedWith("The commitment has been submitted")
        })
    })

    describe("#withdraw", () => {
        it("should work", async () => {
            const { tornado, denomination, cVerifier, mimcsponge } = await loadFixture(deployFixture);

            // generate commitment
            const { commitment, nullifier, nullifierHash, secret } = await generateCommitment()

            // generate proof
            const tree = new FixedMerkleTree(TREE_LEVELS, [commitment], buildHashFunction(mimcsponge));
            const path = tree.path(commitment)
            const { witness } = cVerifier.provider.computeWitness(cVerifier.circuit, [
                tree.root.toString(),
                nullifierHash.toString(),
                secret.toString(),
                nullifier.toString(),
                path.pathElements,
                path.pathDirection
            ]);
            const proof = cVerifier.provider.generateProof(
                cVerifier.circuit.program,
                witness,
                cVerifier.keypair.pk
            );

            await expect(tornado.deposit(toHex(commitment), { value: toHex(denomination) }))
                .not.to.be.reverted

            const recipient = (await hre.ethers.getSigners())[1] // first signer pays for gas
            const beforeBalance = await ethers.provider.getBalance(recipient)
            await expect(tornado.withdraw(proof.proof, toHex(tree.root), toHex(nullifierHash), recipient))
                .not.to.be.reverted

            const afterBalance = await ethers.provider.getBalance(recipient)
            expect((afterBalance - denomination) === beforeBalance).to.be.true
        })

        it('should prevent double spend', async () => {
            const { tornado, denomination, cVerifier, mimcsponge } = await loadFixture(deployFixture);

            // generate commitment
            const { commitment, nullifier, nullifierHash, secret } = await generateCommitment()

            // generate proof
            const tree = new FixedMerkleTree(TREE_LEVELS, [commitment], buildHashFunction(mimcsponge));
            const path = tree.path(commitment)
            const { witness } = cVerifier.provider.computeWitness(cVerifier.circuit, [
                tree.root.toString(),
                nullifierHash.toString(),
                secret.toString(),
                nullifier.toString(),
                path.pathElements,
                path.pathDirection
            ]);
            const proof = cVerifier.provider.generateProof(
                cVerifier.circuit.program,
                witness,
                cVerifier.keypair.pk
            );

            await expect(tornado.deposit(toHex(commitment), { value: toHex(denomination) }))
                .not.to.be.reverted

            const recipient = (await hre.ethers.getSigners())[1] // first signer pays for gas
            await expect(tornado.withdraw(proof.proof, toHex(tree.root), toHex(nullifierHash), recipient))
                .not.to.be.reverted

            await expect(tornado.withdraw(proof.proof, toHex(tree.root), toHex(nullifierHash), recipient))
                .to.be.revertedWith("The note has been already spent")
        })


          it('should throw for corrupted merkle tree root', async () => {
            const { tornado, cVerifier, mimcsponge } = await loadFixture(deployFixture);

            // generate commitment
            const { commitment, nullifier, nullifierHash, secret } = await generateCommitment()

            // generate proof
            const tree = new FixedMerkleTree(TREE_LEVELS, [commitment], buildHashFunction(mimcsponge));
            const path = tree.path(commitment)
            const { witness } = cVerifier.provider.computeWitness(cVerifier.circuit, [
                tree.root.toString(),
                nullifierHash.toString(),
                secret.toString(),
                nullifier.toString(),
                path.pathElements,
                path.pathDirection
            ]);
            const proof = cVerifier.provider.generateProof(
                cVerifier.circuit.program,
                witness,
                cVerifier.keypair.pk
            );

            // Omit deposit
            // await expect(tornado.deposit(toHex(commitment), { value: toHex(denomination) }))

            const recipient = (await hre.ethers.getSigners())[0]
            await expect(tornado.withdraw(proof.proof, toHex(tree.root), toHex(nullifierHash), recipient))
                .to.be.revertedWith("Cannot find your merkle root")
          })

          it('should reject with tampered public inputs', async () => {
            const { tornado, denomination, cVerifier, mimcsponge } = await loadFixture(deployFixture);

            // generate commitment
            const { commitment, nullifier, nullifierHash, secret } = await generateCommitment()

            // generate proof
            const tree = new FixedMerkleTree(TREE_LEVELS, [commitment], buildHashFunction(mimcsponge));
            const path = tree.path(commitment)
            const { witness } = cVerifier.provider.computeWitness(cVerifier.circuit, [
                tree.root.toString(),
                nullifierHash.toString(),
                secret.toString(),
                nullifier.toString(),
                path.pathElements,
                path.pathDirection
            ]);
            const proof = cVerifier.provider.generateProof(
                cVerifier.circuit.program,
                witness,
                cVerifier.keypair.pk
            );

            await expect(tornado.deposit(toHex(commitment), { value: toHex(denomination) }))
                .not.to.be.reverted

            // make the root differ from what proof holds
            const corruptedNullifierHash = toHex(1)

            const recipient = (await hre.ethers.getSigners())[0]
            await expect(tornado.withdraw(proof.proof, toHex(tree.root), corruptedNullifierHash, recipient))
                .to.be.revertedWith("Invalid withdraw proof")
          })
    })

    describe('#isSpent', () => {
        it('should work', async () => {
            const { tornado, denomination, cVerifier, mimcsponge } = await loadFixture(deployFixture);

            // generate commitment
            const { commitment, nullifier, nullifierHash, secret } = await generateCommitment()

            // generate proof
            const tree = new FixedMerkleTree(TREE_LEVELS, [commitment], buildHashFunction(mimcsponge));
            const path = tree.path(commitment)
            const { witness } = cVerifier.provider.computeWitness(cVerifier.circuit, [
                tree.root.toString(),
                nullifierHash.toString(),
                secret.toString(),
                nullifier.toString(),
                path.pathElements,
                path.pathDirection
            ]);
            const proof = cVerifier.provider.generateProof(
                cVerifier.circuit.program,
                witness,
                cVerifier.keypair.pk
            );

            await expect(tornado.deposit(toHex(commitment), { value: toHex(denomination) }))
                .not.to.be.reverted

            expect(await tornado.isSpent(toHex(nullifierHash))).to.be.false

            const recipient = (await hre.ethers.getSigners())[0]
            await expect(tornado.withdraw(proof.proof, toHex(tree.root), toHex(nullifierHash), recipient))
                .not.to.be.reverted

            expect(await tornado.isSpent(toHex(nullifierHash))).to.be.true
        })
      })
});

function buildHashFunction(mimcsponge: any) {
    return (l: bigint, r: bigint) => BigInt(mimcsponge.F.toString(mimcsponge.multiHash([l, r])))
}

const toHex = (number: string | number | bigint, length = 32) =>
    '0x' +
    BigInt(number)
        .toString(16)
        .padStart(length * 2, '0')

function expectAny() {
    return true
}