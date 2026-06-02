import hardhatEthersPlugin from "@nomicfoundation/hardhat-ethers";
import hardhatIgnitionPlugin from "@nomicfoundation/hardhat-ignition";
import hardhatIgnitionEthersPlugin from "@nomicfoundation/hardhat-ignition-ethers";
import hardhatKeystorePlugin from "@nomicfoundation/hardhat-keystore";
import hardhatMochaPlugin from "@nomicfoundation/hardhat-mocha";
import hardhatVerifyPlugin from "@nomicfoundation/hardhat-verify";
import { configVariable, defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [
    hardhatEthersPlugin,
    hardhatIgnitionPlugin,
    hardhatIgnitionEthersPlugin,
    hardhatKeystorePlugin,
    hardhatMochaPlugin,
    hardhatVerifyPlugin,
  ],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
    polygon_amoy: {
      type: "http",
      chainType: "l1",
      url: "https://rpc-amoy.polygon.technology",
      accounts: ["0x86de4d60358fe7d947c85ee64af0c5628b6903ec5225b05e832cdad84f3bd324"], 
    },
  },
});


