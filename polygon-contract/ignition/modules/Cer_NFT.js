import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("CerNFTModule", (m) => {
  const cerNft = m.contract("Cer_NFT");

  return { cerNft };
});
