
export const SEED = "mimcsponge";

export function buildHashFunction(mimcsponge: any) {
    return (l: bigint, r: bigint) => BigInt(mimcsponge.F.toString(mimcsponge.multiHash([l, r])))
}