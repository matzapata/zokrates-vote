ROOT_CIRCUIT = ./circuits/root.zok

compile-contracts:
	@echo "Compiling contracts"
	npx hardhat compile

compile-circuits:
	@echo "Compiling circuits"
	ts-node ./scripts/compile-circuits.ts

compile:
	@make compile-contracts
	@make compile-circuits

tests:
	npx hardhat test

