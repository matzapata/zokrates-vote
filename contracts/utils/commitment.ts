import * as crypto from "crypto";
import { buildMimcSponge } from "circomlibjs";

export async function generateCommitment(): Promise<{
    nullifier: bigint,
    secret: bigint,
    commitment: bigint,
    nullifierHash: bigint
}> {
    const mimc = await buildMimcSponge();
    const nullifier = BigInt("0x" + crypto.randomBytes(31).toString("hex"))
    const secret = BigInt("0x" + crypto.randomBytes(31).toString("hex"))
    const commitment = BigInt(mimc.F.toString(mimc.multiHash([nullifier, secret])))
    const nullifierHash = BigInt(mimc.F.toString(mimc.multiHash([nullifier])))

    return {
        nullifier: nullifier,
        secret: secret,
        commitment: commitment,
        nullifierHash: nullifierHash
    }
}
