import { expect } from "chai";
import { network } from "hardhat";

describe("Cer_NFT", function () {
  it("deploys successfully", async function () {
    const { ethers } = await network.create();
    const nft = await ethers.deployContract("Cer_NFT");

    await nft.waitForDeployment();

    expect(await nft.name()).to.equal("Certificate of Origin NFT");
    expect(await nft.symbol()).to.equal("CEO");
    expect(await nft.nextTokenId()).to.equal(1n);
  });

  it("grants admin and issuer roles to the deployer", async function () {
    const { ethers } = await network.create();
    const [deployer] = await ethers.getSigners();
    const nft = await ethers.deployContract("Cer_NFT");

    await nft.waitForDeployment();

    const adminRole = await nft.DEFAULT_ADMIN_ROLE();
    const issuerRole = await nft.ISSUER_ROLE();

    expect(await nft.hasRole(adminRole, deployer.address)).to.equal(true);
    expect(await nft.hasRole(issuerRole, deployer.address)).to.equal(true);
  });

  it("issues a certificate NFT and stores its metadata", async function () {
    const { ethers } = await network.create();
    const [issuer, exporter] = await ethers.getSigners();
    const nft = await ethers.deployContract("Cer_NFT");

    await nft.waitForDeployment();

    const coReferenceNumber = "CO-2026-0001";
    const documentHash = `0x${"11".repeat(32)}`;
    const ipfsCid = "bafybeigdyrzt5zzexamplecid";

    const tx = await nft.connect(issuer).issue_Cer(
      coReferenceNumber,
      documentHash,
      ipfsCid,
      exporter.address,
    );
    await tx.wait();

    const certificate = await nft.certificates(1n);

    expect(await nft.ownerOf(1n)).to.equal(exporter.address);
    expect(await nft.tokenURI(1n)).to.equal(`ipfs://${ipfsCid}`);
    expect(await nft.nextTokenId()).to.equal(2n);
    expect(certificate.tokenId).to.equal(1n);
    expect(certificate.coReferenceNumber).to.equal(coReferenceNumber);
    expect(certificate.documentHash).to.equal(documentHash);
    expect(certificate.ipfsCID).to.equal(ipfsCid);
    expect(certificate.issuerAddress).to.equal(issuer.address);
    expect(certificate.exporterAddress).to.equal(exporter.address);
    expect(certificate.issueDate).to.be.greaterThan(0n);
    expect(certificate.status).to.equal(0n);
    expect(certificate.revokedAt).to.equal(0n);
  });

  it("rejects certificate issuance from a non-issuer account", async function () {
    const { ethers } = await network.create();
    const [, attacker, exporter] = await ethers.getSigners();
    const nft = await ethers.deployContract("Cer_NFT");

    await nft.waitForDeployment();

    let thrownError;

    try {
      const tx = await nft.connect(attacker).issue_Cer(
        "CO-2026-0002",
        `0x${"22".repeat(32)}`,
        "bafybeiblockedissuercid",
        exporter.address,
      );
      await tx.wait();
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).to.not.equal(undefined);
    expect(String(thrownError)).to.include("AccessControlUnauthorizedAccount");
    expect(await nft.nextTokenId()).to.equal(1n);
  });
});
