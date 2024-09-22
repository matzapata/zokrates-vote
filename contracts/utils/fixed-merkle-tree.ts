import { ethers } from 'hardhat'

const ZERO_VALUE = BigInt('21663839004416932945382355908790599225266501822907911457504978515578255421292') // = keccak256("tornado") % FIELD_SIZE

type BigIntish = number | string | bigint

export class FixedMerkleTree {
    private elements: bigint[] = []
    private layers: bigint[][] = []
    private zeros: bigint[] = []
    private capacity = 0
    private levels = 0
    private hashFn: (l: bigint, right: bigint) => bigint
    public root: bigint;

    constructor(levels: number, elements: BigIntish[], hashFn: (l: bigint, right: bigint) => bigint, zero_value: bigint = ZERO_VALUE) {
        this.levels = levels
        this.capacity = 2 ** this.levels
        this.hashFn = hashFn

        this.zeros[0] = zero_value
        for (let i = 1; i <= levels; i++) {
            this.zeros[i] = this.hashFn(this.zeros[i - 1], this.zeros[i - 1]);
        }

        this.elements = elements ? elements.map(e => BigInt(e)) : [];

        const { root, layers } = this.computeTree(this.elements)

        this.layers = layers
        this.root = root
    }

    insert(element: BigIntish) {
        if (this.elements.length > this.capacity) {
            throw new Error('Tree is full')
        }

        this.elements.push(BigInt(element))

        const { root, layers } = this.computeTree(this.elements)

        this.layers = layers
        this.root = root
    }

    path(element: BigIntish) {
        let pathElements = []
        let pathIndices = []

        // calculate path
        let index = this.layers[0].findIndex(e => BigInt(e) == BigInt(element))

        for (let level = 0; level < this.levels; level++) {
            pathIndices[level] = index % 2
            pathElements[level] =
                index % 2 === 0
                    ? (index + 1 < this.layers[level].length
                        ? this.layers[level][index + 1]
                        : this.zeros[level]
                    ) : this.layers[level][index - 1]

            index /= 2
        }

        return {
            pathElements: pathElements.map((v) => v.toString()),
            pathIndices: pathIndices.map((v) => v.toString()),
            pathDirection: pathIndices.map((v) => v === 0 ? false : true),
        }
    }

    private computeTree(elements: bigint[]): { root: bigint, layers: bigint[][] } {
        let layers: bigint[][] = []
        layers[0] = elements.slice() // layers[0] = base | layers[level] = root
        for (let level = 1; level <= this.levels; level++) {
            layers[level] = []
            for (let i = 0; i < Math.ceil(layers[level - 1].length / 2); i++) {
                const leftElement = layers[level - 1][i * 2]
                const hasRightSibling = (i * 2 + 1) < layers[level - 1].length;
                const rightElement = hasRightSibling
                    ? layers[level - 1][i * 2 + 1]
                    : this.zeros[level - 1];

                layers[level][i] = this.hashFn(leftElement, rightElement)
            }
        }

        const root = layers[this.levels].length > 0 ? layers[this.levels][0] : this.zeros[this.levels - 1]

        return { root, layers };
    }


}
