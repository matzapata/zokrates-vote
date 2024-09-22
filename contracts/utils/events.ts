import hre from "hardhat";

export async function loadCommitEvents(address: string, provider: any) {
    const abi = [
        "event Deposit(bytes32 commitment, uint256 index, uint256 timestamp)"
    ];
    const contract = new hre.ethers.Contract(address, abi, provider)
    const events = await contract.queryFilter(contract.filters.Commit())
    let deposits = []
    for (let event of events) {
        if (!(event as any)?.args.commitment) continue;
        deposits.push(BigInt((event as any)?.args.commitment))
    }

    return deposits;
}
