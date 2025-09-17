import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
	solidity: {
		version: "0.8.28",
		settings: {
			optimizer: { enabled: true, runs: 200 },
		},
	},
	networks: {
		sepolia: {
			url: process.env.SEPOLIA_RPC_URL || "",
			accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
		},
			arbSepolia: {
				url: process.env.ARB_SEPOLIA_RPC_URL || "",
				accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
			},
			opSepolia: {
				url: process.env.OP_SEPOLIA_RPC_URL || "",
				accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
			},
			baseSepolia: {
				url: process.env.BASE_SEPOLIA_RPC_URL || "",
				accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
			},
	},
};

export default config;
