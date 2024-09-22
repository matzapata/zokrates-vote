ROOT_CIRCUIT = ./circuits/root.zok
OUT_DIR = ./circuits/out

INPUTS_ABI = ./inputs.json

compile-contracts:
	npx hardhat compile

compile-circuits:
	zokrates compile --input ${ROOT_CIRCUIT} --output ${OUT_DIR}/out --r1cs ${OUT_DIR}/out.r1cs --abi-spec ${OUT_DIR}/abi.json --debug
	zokrates setup --input ${OUT_DIR}/out -p ${OUT_DIR}/proving.key -v ${OUT_DIR}/verification.key

compile:
	@make compile-contracts
	@make compile-circuits

proof:
	zokrates compute-witness -i ${OUT_DIR}/out -s ${OUT_DIR}/abi.json -o ${OUT_DIR}/witness --circom-witness ${OUT_DIR}/out.wtns --abi --stdin < ${INPUTS_ABI}
	zokrates generate-proof --input ${OUT_DIR}/out --proving-key-path ${OUT_DIR}/proving.key --witness ${OUT_DIR}/witness --proof-path ${OUT_DIR}/proof.json

tests:
	npx hardhat test

clean:
	rm -rf ${OUT_DIR} && mkdir -p ${OUT_DIR}

