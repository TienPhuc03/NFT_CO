# `Cer_NFT` Hardhat Project

This project contains the `Cer_NFT` ERC-721 certificate contract, Hardhat 3 configuration, an Ignition deployment module, and `mocha` integration tests built with `ethers`.

On Windows PowerShell, use `npx.cmd` and `npm.cmd` if script execution blocks `npx` or `npm`.

## Project Overview

- The certificate NFT contract lives in `contracts/Cer_NFT.sol`
- The default Ignition module deploys `Cer_NFT`
- The test suite covers role assignment and certificate issuance
- The config includes local simulated networks and a Sepolia target

## Usage

### Compile

```shell
npx.cmd hardhat compile
```

### Run tests

```shell
npx.cmd hardhat test
```

You can also run the `mocha` runner explicitly:

```shell
npx.cmd hardhat test mocha
```

### Deploy locally

```shell
npx.cmd hardhat ignition deploy ignition/modules/Cer_NFT.js
```

### Deploy to Sepolia

Set `SEPOLIA_RPC_URL` and `SEPOLIA_PRIVATE_KEY` before deploying.

If you prefer `hardhat-keystore`, you can store the private key with:

```shell
npx.cmd hardhat keystore set SEPOLIA_PRIVATE_KEY
```

Then deploy with:

```shell
npx.cmd hardhat ignition deploy --network sepolia ignition/modules/Cer_NFT.js
```
