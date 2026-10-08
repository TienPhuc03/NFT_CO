import { expect } from "chai";

describe("Baseline B1 (CORegistry) - Gas Measurement Tests", function () {
  let coRegistry;
  let deployGas;

  beforeEach(async function () {
    const RegistryFactory = await ethers.getContractFactory("CORegistry");
    coRegistry = await RegistryFactory.deploy();
    await coRegistry.waitForDeployment();

    const deployTx = coRegistry.deploymentTransaction();
    if (deployTx) {
      const deployReceipt = await deployTx.wait();
      deployGas = deployReceipt.gasUsed;
    }
  });

  it("Should measure exact gas consumption for registerCO and changeStatus", async function () {
    const docHash = ethers.id("DOCUMENT_HASH_BASELINE_001");

    // 1. Measure Gas for registerCO (First Registration)
    const txRegister1 = await coRegistry.registerCO(docHash);
    const receiptRegister1 = await txRegister1.wait();
    const gasRegister1 = receiptRegister1.gasUsed;

    // Verify record state
    const record1 = await coRegistry.records(1);
    expect(record1.documentHash).to.equal(docHash);
    expect(record1.status).to.equal(0);
    expect(await coRegistry.nextId()).to.equal(2n);

    // Measure Gas for registerCO (Subsequent Registration)
    const docHash2 = ethers.id("DOCUMENT_HASH_BASELINE_002");
    const txRegister2 = await coRegistry.registerCO(docHash2);
    const receiptRegister2 = await txRegister2.wait();
    const gasRegister2 = receiptRegister2.gasUsed;

    // 2. Measure Gas for changeStatus (0 -> 1: Suspended)
    const txSuspend = await coRegistry.changeStatus(1, 1);
    const receiptSuspend = await txSuspend.wait();
    const gasSuspend = receiptSuspend.gasUsed;

    const recordSuspended = await coRegistry.records(1);
    expect(recordSuspended.status).to.equal(1);

    // 3. Measure Gas for changeStatus (1 -> 2: Revoked)
    const txRevoke = await coRegistry.changeStatus(1, 2);
    const receiptRevoke = await txRevoke.wait();
    const gasRevoke = receiptRevoke.gasUsed;

    const recordRevoked = await coRegistry.records(1);
    expect(recordRevoked.status).to.equal(2);

    // Format clear console.log output showing exact gas used
    console.log("\n   ============================================================");
    console.log("   BASELINE B1 (CORegistry) GAS MEASUREMENT RESULTS");
    console.log("   ============================================================");
    if (deployGas) {
      console.log(`   - Contract Deployment:                  ${deployGas.toString()} gas`);
    }
    console.log(`   - registerCO (Record #1):               ${gasRegister1.toString()} gas`);
    console.log(`   - registerCO (Record #2):               ${gasRegister2.toString()} gas`);
    console.log(`   - changeStatus (0 -> 1 [Suspended]):    ${gasSuspend.toString()} gas`);
    console.log(`   - changeStatus (1 -> 2 [Revoked]):      ${gasRevoke.toString()} gas`);
    console.log("   ============================================================\n");
  });
});

