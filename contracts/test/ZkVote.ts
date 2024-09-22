import hre, { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { buildMimcSponge, mimcSpongecontract } from "circomlibjs";

import { expect } from "chai"
import { FixedMerkleTree } from "../utils/fixed-merkle-tree";
import { generateCommitment } from "../utils/commitment";
import { buildVerifier } from "../utils/verifier";

const SEED = "mimcsponge";
const TREE_LEVELS = 6;

describe("ZkVote", function () {

    async function deployFixture() {
        const signers = await hre.ethers.getSigners()
        const owner = signers[0]
        const validator = signers[1]
        const voter = signers[2]

        // voting options
        const votingOptions = 3;

        // deploy hashing function
        const MiMCSponge = new hre.ethers.ContractFactory(mimcSpongecontract.abi, mimcSpongecontract.createCode(SEED, 220), signers[0])
        const mimcSpongeContract = await MiMCSponge.deploy()
        const mimcsponge = await buildMimcSponge();

        // compile circuits and deploy verifier
        const cVerifier = await buildVerifier()
        const Verifier = new hre.ethers.ContractFactory(cVerifier.abi, cVerifier.bytecode, signers[0])
        const verifier = await Verifier.deploy()

        // deploy ZkVote
        const ZkVote = await hre.ethers.getContractFactory("ZkVote");
        const zkVote = await ZkVote.deploy(TREE_LEVELS, await mimcSpongeContract.getAddress(), await verifier.getAddress(), votingOptions);

        // register validator
        await zkVote.connect(owner).registerValidator(validator.address)

        return { zkVote, mimcsponge, cVerifier, verifier, votingOptions, owner, validator, voter };
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

    describe("#registerValidator", () => {
        it("should revert if not owner", async () => {
            const { zkVote, validator } = await loadFixture(deployFixture);
            
            const other = ethers.Wallet.createRandom().address
            await expect(zkVote.connect(validator).registerValidator(other))
                .to.be.revertedWith("Only owner")
        })

        it("should emit event", async () => {
            const { zkVote, owner } = await loadFixture(deployFixture);

            const other = ethers.Wallet.createRandom().address
            await expect(zkVote.connect(owner).registerValidator(other))
                .to.emit(zkVote, 'ValidatorRegistered')
                .withArgs(other)
        })
    })

    describe('#registerVoter', () => {
        it('should emit event', async () => {
            const { zkVote, validator } = await loadFixture(deployFixture);

            await expect(zkVote.connect(validator).registerVoter(toHex(10)))
                .to.emit(zkVote, 'VoterRegistered')
                .withArgs(toHex(10), "0x0", expectAny)

            await expect(zkVote.connect(validator).registerVoter(toHex(20)))
                .to.emit(zkVote, 'VoterRegistered')
                .withArgs(toHex(20), "0x1", expectAny)
        })

        it('should throw if commitment was already registered', async () => {
            const { zkVote, validator } = await loadFixture(deployFixture);

            const commitment = toHex(10)
            await expect(zkVote.connect(validator).registerVoter(commitment))
                .not.to.be.reverted

            // now repeat the same deposit expecting a reversion
            await expect(zkVote.connect(validator).registerVoter(commitment))
                .to.be.revertedWith("The commitment has already been submitted")
        })
    })

    describe("#vote", () => {
        it("should work", async () => {
            const { zkVote, cVerifier, mimcsponge, validator, voter } = await loadFixture(deployFixture);

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

            await expect(zkVote.connect(validator).registerVoter(toHex(commitment)))
                .not.to.be.reverted

            const selectedOption = 1
            const beforeVotes = await zkVote.getVotes(selectedOption)

            await expect(zkVote.connect(voter).vote(proof.proof, toHex(tree.root), toHex(nullifierHash), selectedOption))
                .not.to.be.reverted

            const afterVotes = await zkVote.getVotes(selectedOption)
            expect(afterVotes - beforeVotes).to.equal(1)
        })

        it('should prevent double voting', async () => {
            const { zkVote, validator, cVerifier, mimcsponge, voter } = await loadFixture(deployFixture);

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

            await expect(zkVote.connect(validator).registerVoter(toHex(commitment)))
                .not.to.be.reverted


            await expect(zkVote.connect(voter).vote(proof.proof, toHex(tree.root), toHex(nullifierHash), 0))
                .not.to.be.reverted

            await expect(zkVote.connect(voter).vote(proof.proof, toHex(tree.root), toHex(nullifierHash), 1))
                .to.be.revertedWith("Vote already registered")
        })


        it('should throw for unregistered commitments', async () => {
            const { zkVote, voter, cVerifier, mimcsponge } = await loadFixture(deployFixture);

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
            // await expect(zkVote.connect(validator).registerVoter(toHex(commitment)))

            await expect(zkVote.connect(voter).vote(proof.proof, toHex(tree.root), toHex(nullifierHash), 2))
                .to.be.revertedWith("Cannot find your merkle root")
        })

        it('should reject with tampered public inputs', async () => {
            const { zkVote, validator, voter, cVerifier, mimcsponge } = await loadFixture(deployFixture);

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

            await expect(zkVote.connect(validator).registerVoter(toHex(commitment)))
                .not.to.be.reverted

            // make the root differ from what proof holds
            const corruptedNullifierHash = toHex(1)

            const recipient = (await hre.ethers.getSigners())[0]
            await expect(zkVote.connect(voter).vote(proof.proof, toHex(tree.root), corruptedNullifierHash, 2))
                .to.be.revertedWith("Invalid withdraw proof")
        })
    })

    describe('#hasVoted', () => {
        it('should work', async () => {
            const { zkVote, validator, voter, cVerifier, mimcsponge } = await loadFixture(deployFixture);

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

            await expect(zkVote.connect(validator).registerVoter(toHex(commitment)))
                .not.to.be.reverted

            expect(await zkVote.hasVoted(toHex(nullifierHash))).to.be.false

            await expect(zkVote.connect(voter).vote(proof.proof, toHex(tree.root), toHex(nullifierHash), 2))
                .not.to.be.reverted

            expect(await zkVote.hasVoted(toHex(nullifierHash))).to.be.true
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