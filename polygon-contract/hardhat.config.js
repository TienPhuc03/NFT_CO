import hardhatEthersPlugin from "@nomicfoundation/hardhat-ethers";
import hardhatIgnitionPlugin from "@nomicfoundation/hardhat-ignition";
import hardhatIgnitionEthersPlugin from "@nomicfoundation/hardhat-ignition-ethers";
import hardhatKeystorePlugin from "@nomicfoundation/hardhat-keystore";
import hardhatMochaPlugin from "@nomicfoundation/hardhat-mocha";
import hardhatEthersChaiMatchersPlugin from "@nomicfoundation/hardhat-ethers-chai-matchers";
import hardhatVerifyPlugin from "@nomicfoundation/hardhat-verify";
import { configVariable, defineConfig } from "hardhat/config";
import "dotenv/config";

export default defineConfig({
  plugins: [
    hardhatEthersPlugin,
    hardhatIgnitionPlugin,
    hardhatIgnitionEthersPlugin,
    hardhatKeystorePlugin,
    hardhatMochaPlugin,
    hardhatEthersChaiMatchersPlugin,
    hardhatVerifyPlugin,
  ],
  test: {
    mocha: {
      rootHooks: {
        async beforeAll() {
          const { network } = await import("hardhat");
          const { ethers } = await network.getOrCreate();
          globalThis.ethers = ethers;
        },
      },
    },
  },
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
    polygon_amoy: {
      type: "http",
      chainType: "l1",
      url: process.env.AMOY_RPC_URL || "https://polygon-amoy.drpc.org",
      accounts: [configVariable("PRIVATE_KEY")],
      gasPrice: 30000000000,
    },
  },
  etherscan: {
    apiKey: configVariable("POLYGONSCAN_API_KEY"),
  },
});


