import hre from "hardhat";
import { buildMimcSponge, mimcSpongecontract } from "circomlibjs";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { FixedMerkleTree } from "../utils/fixed-merkle-tree";

const SEED = "mimcsponge";
const TREE_LEVELS = 6;

describe("MerkleTreeWithHistory", function () {
  async function deployFixture() {
    const signers = await hre.ethers.getSigners()

    // deploy hashing function
    const MiMCSponge = new hre.ethers.ContractFactory(mimcSpongecontract.abi, mimcSpongecontract.createCode(SEED, 220), signers[0])
    const mimcSpongeContract = await MiMCSponge.deploy()
    const mimcsponge = await buildMimcSponge();

    // deploy tree
    const Tree = await hre.ethers.getContractFactory("MerkleTreeWithHistoryMock");
    const tree = await Tree.deploy(TREE_LEVELS, await mimcSpongeContract.getAddress())

    return { tree, mimcSpongeContract, mimcsponge };
  }

  describe('#constructor', () => {
    it('should initialize', async () => {
      const { tree } = await loadFixture(deployFixture);

      const zeroValue = await tree.ZERO_VALUE()
      const firstSubtree = await tree.filledSubtrees(0)
      expect(firstSubtree).to.be.equal(toFixedHex(zeroValue))

      const firstZero = await tree.zeros(0)
      expect(firstZero).to.be.equal(toFixedHex(zeroValue))
    })
  })

  describe('#insert', () => {
    it('should insert', async () => {
      const { tree, mimcsponge } = await loadFixture(deployFixture);
      
      const treeJs = new FixedMerkleTree(TREE_LEVELS, [], buildHashFunction(mimcsponge))

      for (let i = 1; i < TREE_LEVELS; i++) {
        await tree.insert(toFixedHex(i))
        treeJs.insert(BigInt(i))

        expect(BigInt(await tree.getLastRoot())).to.be.equal(treeJs.root)
      }
    })

    it('should reject if tree is full', async () => {
      const { tree } = await loadFixture(deployFixture);

      for (let i = 0; i < 2 ** TREE_LEVELS; i++) {
        await tree.insert(toFixedHex(i + 42))
      }

      await expect(tree.insert(toFixedHex(1337)))
        .to.be.revertedWith("Merkle tree is full. No more leaves can be added"); // Matching the revert reason
    })
  })

  describe('#isKnownRoot', () => {
    it('should work', async () => {
      const { tree, mimcsponge } = await loadFixture(deployFixture);
     
      const treeJs = new FixedMerkleTree(TREE_LEVELS, [], buildHashFunction(mimcsponge))

      
      for (let i = 1; i < 5; i++) {
        await tree.insert(toFixedHex(i))
        treeJs.insert(i)

        expect(await tree.isKnownRoot(toFixedHex(treeJs.root)))
          .to.be.equal(true)
      }

      // check outdated root
      await tree.insert(toFixedHex(42))
      expect(await tree.isKnownRoot(toFixedHex(treeJs.root)))
        .to.be.equal(true)
    })

    it('should not return uninitialized roots', async () => {
      const { tree } = await loadFixture(deployFixture);

      await tree.insert(toFixedHex(42))

      expect(await tree.isKnownRoot(toFixedHex(0))).to.be.eq(false)
    })
  })

});



function toFixedHex(number: bigint | boolean | number | string, length = 32) {
  let str = BigInt(number).toString(16)
  while (str.length < length * 2) str = '0' + str
  str = '0x' + str
  return str
}

function buildHashFunction(mimcsponge: any) {
  return (l: bigint, r: bigint) => BigInt(mimcsponge.F.toString(mimcsponge.multiHash([l, r])))
}