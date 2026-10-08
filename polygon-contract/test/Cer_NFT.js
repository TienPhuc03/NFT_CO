import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.getOrCreate();

describe("Certificate of Origin NFT (C/O) - Peer Review Tests", function () {
  let certificateNFT;
  let admin, issuer, nonIssuer, exporter;
  let docHash;

  const tokenURI = "ipfs://bafybeibnc4f7j63vshv7g2y...";
  const validUntil = Math.floor(Date.now() / 1000) + 31536000; // 1 năm sau

  beforeEach(async function () {
    // Dùng ethers để tạo hash
    docHash = ethers.id("DOCUMENT_HASH_123");
    
    // Lấy signers từ ethers
    [admin, issuer, nonIssuer, exporter] = await ethers.getSigners();

    // Deploy contract dùng ethers
    const CertFactory = await ethers.getContractFactory("CertificateNFT");
    certificateNFT = await CertFactory.deploy();
    await certificateNFT.waitForDeployment();

    // Cấp quyền ISSUER_ROLE cho ví issuer
    const ISSUER_ROLE = await certificateNFT.ISSUER_ROLE();
    await certificateNFT.grantRole(ISSUER_ROLE, issuer.address);
  });

  describe("1. Kịch bản Negative Tests (Phục vụ Lỗi C3 & Table 2)", function () {
    it("Test 1: Revert khi mint trùng coReferenceNumber", async function () {
      await certificateNFT.connect(issuer).mintCO(exporter.address, "VN-D-2026-001", docHash, tokenURI, validUntil, 0);
      
      // Mint lần 2 với cùng số Reference
      await expect(
        certificateNFT.connect(issuer).mintCO(exporter.address, "VN-D-2026-001", docHash, tokenURI, validUntil, 0)
      ).to.be.revertedWith("Duplicate C/O reference for this issuer");
    });

    it("Test 2: Revert khi mint bởi tài khoản không có quyền ISSUER_ROLE", async function () {
      await expect(
        certificateNFT.connect(nonIssuer).mintCO(exporter.address, "VN-D-2026-002", docHash, tokenURI, validUntil, 0)
      ).to.be.revertedWithCustomError(certificateNFT, "AccessControlUnauthorizedAccount");
    });

    it("Test 3: Revert khi tài khoản khác (không phải cơ quan gốc) cố Revoke", async function () {
      await certificateNFT.connect(issuer).mintCO(exporter.address, "VN-D-2026-003", docHash, tokenURI, validUntil, 0);
      
      // Admin (có quyền cao nhất) nhưng không phải người mint ra C/O này cũng không được Revoke
      await certificateNFT.grantRole(await certificateNFT.ISSUER_ROLE(), admin.address);
      
      await expect(
        certificateNFT.connect(admin).revokeCertificate(1n) // Lưu ý: Truyền BigInt (1n) cho an toàn trong ethers v6
      ).to.be.revertedWith("Unauthorized: Not the original issuer");
    });

    it("Test 4: Revert khi Suspend một C/O đã bị Revoke", async function () {
      await certificateNFT.connect(issuer).mintCO(exporter.address, "VN-D-2026-004", docHash, tokenURI, validUntil, 0);
      
      // Revoke trước
      await certificateNFT.connect(issuer).revokeCertificate(1n);
      
      // Cố tình Suspend
      await expect(
        certificateNFT.connect(issuer).suspendCertificate(1n)
      ).to.be.revertedWith("Can only suspend a valid C/O");
    });

    it("Test 5: Soulbound Token - Revert khi cố tình Transfer", async function () {
      await certificateNFT.connect(issuer).mintCO(exporter.address, "VN-D-2026-005", docHash, tokenURI, validUntil, 0);
      
      // Exporter cố gửi C/O sang ví khác
      await expect(
        certificateNFT.connect(exporter).transferFrom(exporter.address, nonIssuer.address, 1n)
      ).to.be.revertedWith("C/O is a Soulbound Token: Transfer is disabled");
    });
  });

  describe("2. Kịch bản Đo Gas 50 Lần Mint (Phục vụ Lỗi C9 & Table 3)", function () {
    it("Mint 50 C/O tới 50 địa chỉ ví khác nhau và xuất thông số Gas", async function () {
      this.timeout(60000);
      let totalGas = 0n;
      let minGas = 10000000n; 
      let maxGas = 0n;
      const gasUsageArray = [];

      console.log("\n   [+] Bắt đầu mint 50 C/O...");

      for (let i = 1; i <= 50; i++) {
        // Tạo 1 địa chỉ ví Exporter ảo mới hoàn toàn cho mỗi lần mint bằng ethers gốc
        const randomExporter = ethers.Wallet.createRandom().address;
        const refNumber = `VN-D-2026-50MINT-${i}`;

        const tx = await certificateNFT.connect(issuer).mintCO(
          randomExporter,
          refNumber,
          docHash,
          tokenURI,
          validUntil,
          0 
        );

        const receipt = await tx.wait();
        const gasUsed = receipt.gasUsed;

        gasUsageArray.push(Number(gasUsed));
        totalGas += gasUsed;

        if (gasUsed < minGas) minGas = gasUsed;
        if (gasUsed > maxGas) maxGas = gasUsed;
      }

      const meanGas = Number(totalGas) / 50;
      
      // Tính độ lệch chuẩn (Standard Deviation)
      const variance = gasUsageArray.reduce((acc, val) => acc + Math.pow(val - meanGas, 2), 0) / 50;
      const sdGas = Math.sqrt(variance);

      console.log(`\n   --- KẾT QUẢ ĐO GAS MINT 50 C/O ---`);
      console.log(`   - Tổng số mẫu: 50`);
      console.log(`   - Mean (Trung bình): ${meanGas.toFixed(0)} gas`);
      console.log(`   - Min Gas: ${minGas.toString()}`);
      console.log(`   - Max Gas: ${maxGas.toString()}`);
      console.log(`   - Độ lệch chuẩn (SD): ±${sdGas.toFixed(2)} gas`);
      console.log(`   ----------------------------------\n`);
    });

    it("Thực nghiệm Hướng C: Đo đạc Gas chênh lệch (parentTokenId & CascadeRevoked)", async function () {
      // 1. Mint Root C/O (parentTokenId = 0)
      const txRoot = await certificateNFT.connect(issuer).mintCO(
        exporter.address,
        "VN-D-2026-ROOT-01",
        docHash,
        tokenURI,
        validUntil,
        0
      );
      const receiptRoot = await txRoot.wait();
      const gasRoot = receiptRoot.gasUsed;

      // 2. Mint Child Back-to-Back C/O (parentTokenId = 1)
      const txChild = await certificateNFT.connect(issuer).mintCO(
        exporter.address,
        "VN-D-2026-CHILD-01",
        docHash,
        tokenURI,
        validUntil,
        1
      );
      const receiptChild = await txChild.wait();
      const gasChild = receiptChild.gasUsed;
      const deltaGas = gasChild - gasRoot;

      // 3. Suspend (Status.Valid -> Status.Suspended)
      const txSuspend = await certificateNFT.connect(issuer).suspendCertificate(1n);
      const receiptSuspend = await txSuspend.wait();
      const gasSuspend = receiptSuspend.gasUsed;

      // 4. Reinstate (Status.Suspended -> Status.Valid)
      const txReinstate = await certificateNFT.connect(issuer).reinstateCertificate(1n);
      const receiptReinstate = await txReinstate.wait();
      const gasReinstate = receiptReinstate.gasUsed;

      // 5. Revoke (emits CascadeRevoked event)
      const txRevoke = await certificateNFT.connect(issuer).revokeCertificate(1n);
      const receiptRevoke = await txRevoke.wait();
      const gasRevoke = receiptRevoke.gasUsed;

      console.log(`\n   --- KẾT QUẢ ĐO ĐẠC HƯỚNG C (DIRECTION C & LIFECYCLE) ---`);
      console.log(`   - Mint Root C/O (parentTokenId = 0):        ${gasRoot.toString()} gas`);
      console.log(`   - Mint Child C/O (parentTokenId = 1):       ${gasChild.toString()} gas`);
      console.log(`   - Chênh lệch Gas khi gán parentTokenId:    +${deltaGas.toString()} gas (SSTORE nonzero)`);
      console.log(`   - Suspend C/O (Struct Packed):              ${gasSuspend.toString()} gas`);
      console.log(`   - Reinstate C/O (Khôi phục Valid):          ${gasReinstate.toString()} gas`);
      console.log(`   - Revoke C/O (Phát CascadeRevoked Event):   ${gasRevoke.toString()} gas`);
      console.log(`   ---------------------------------------------------------\n`);

      expect(gasChild).to.be.gt(gasRoot);
      expect(gasSuspend).to.be.lt(35000n); // Struct packing verifies ~32k gas
    });
  });
});