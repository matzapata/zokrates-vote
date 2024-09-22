import fs from "fs"
import path from "path"
import solc from "solc";
const zokrates = require("fix-esm").require("zokrates-js");

export async function buildVerifier() {
    const provider = await zokrates.initialize();
    const source = fs.readFileSync(path.join(__dirname, "../circuits/root.zok")).toString();
    const circuit = provider.compile(source);
    const keypair = provider.setup(circuit.program);
    const verifierSolidity = await provider.exportSolidityVerifier(keypair.vk)

    const output = JSON.parse(solc.compile(JSON.stringify({
        language: 'Solidity',
        sources: { 'Verifier.sol': { content: verifierSolidity } },
        settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } } }
    })));

    return {
        circuit,
        keypair,
        provider,
        abi: output.contracts['Verifier.sol'].Verifier.abi,
        bytecode: output.contracts['Verifier.sol'].Verifier.evm.bytecode.object
    }
}