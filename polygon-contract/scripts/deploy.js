import { network } from "hardhat";
import fs from "fs";

async function main() {
  const { ethers } = await network.getOrCreate();
  const [deployer] = await ethers.getSigners();

  console.log("========================================================");
  console.log("🚀 Bắt đầu quá trình deploy hợp đồng thông minh");
  console.log("========================================================");
  console.log("Ví deployer  :", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Số dư ví     :", ethers.formatEther(balance), "POL");

  // Xử lý gasPrice trên mạng Polygon Amoy
  // Node RPC công khai thường trả về gasPrice quá cao (500 Gwei),
  // dẫn tới lỗi "gas required exceeds allowance" khi số dư ví nhỏ.
  // Đặt mức 30 Gwei (chuẩn của Polygon Amoy) giúp deploy thành công với chi phí tiết kiệm.
  const networkInfo = await ethers.provider.getNetwork();
  const isPolygonAmoy = networkInfo.chainId === 80002n;
  const gasPrice = isPolygonAmoy ? ethers.parseUnits("30", "gwei") : undefined;
  const overrides = gasPrice ? { gasPrice } : {};

  if (isPolygonAmoy) {
    console.log("Mạng         : Polygon Amoy Testnet (ChainId: 80002)");
    console.log("Cấu hình phí : Cố định gasPrice = 30 Gwei (tránh lỗi exceeds allowance)");
  }

  // 1. Deploy CertificateNFT
  console.log("\n[1/2] Đang deploy CertificateNFT...");
  const NFTFactory = await ethers.getContractFactory("CertificateNFT");
  const nftContract = await NFTFactory.deploy(overrides);
  await nftContract.waitForDeployment();
  const nftAddress = await nftContract.getAddress();
  console.log("✅ CertificateNFT đã được deploy tại:", nftAddress);

  // Cấp ISSUER_ROLE cho ví deployer để có thể mint C/O ngay
  const ISSUER_ROLE = await nftContract.ISSUER_ROLE();
  const grantTx = await nftContract.grantRole(ISSUER_ROLE, deployer.address, overrides);
  await grantTx.wait();
  console.log("✅ Đã cấp quyền ISSUER_ROLE cho ví deployer");

  // 2. Deploy CORegistry (Baseline B1)
  console.log("\n[2/2] Đang deploy CORegistry (Baseline B1)...");
  const RegistryFactory = await ethers.getContractFactory("CORegistry");
  const registryContract = await RegistryFactory.deploy(overrides);
  await registryContract.waitForDeployment();
  const registryAddress = await registryContract.getAddress();
  console.log("✅ CORegistry đã được deploy tại:", registryAddress);

  // Lưu thông tin địa chỉ contract đã deploy
  const deploymentData = {
    network: isPolygonAmoy ? "polygon_amoy" : "hardhat",
    chainId: networkInfo.chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      CertificateNFT: nftAddress,
      CORegistry: registryAddress,
    },
  };
  fs.writeFileSync(
    "./deployed_addresses.json",
    JSON.stringify(deploymentData, null, 2)
  );

  console.log("\n========================================================");
  console.log("🎉 TỔNG KẾT ĐỊA CHỈ HỢP ĐỒNG ĐÃ DEPLOY THÀNH CÔNG");
  console.log("========================================================");
  console.log("- CertificateNFT :", nftAddress);
  console.log("- CORegistry     :", registryAddress);
  console.log("💾 Đã lưu thông tin hợp đồng vào: deployed_addresses.json");
  console.log("========================================================\n");
}

main().catch((error) => {
  console.error("❌ Lỗi khi deploy:", error);
  process.exitCode = 1;
});