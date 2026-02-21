import { ethers } from "hardhat";
import {
  MIN_DELAY,
  NEW_STORE_VALUE,
  FUNC,
  PROPOSAL_DESCRIPTION,
} from "../helper-hardhat-config";
import { getDeployment } from "../utils/deployments";
import { isLocalNetwork, increaseTime } from "../utils/hardhat-helpers";

async function main() {
  const governorAddress = getDeployment("GovernorContract");
  const boxAddress = getDeployment("Box");

  const governor = await ethers.getContractAt(
    "GovernorContract",
    governorAddress
  );
  const box = await ethers.getContractAt("Box", boxAddress);

  const encodedFunctionCall = box.interface.encodeFunctionData(FUNC, [
    NEW_STORE_VALUE,
  ]);
  const descriptionHash = ethers.keccak256(
    ethers.toUtf8Bytes(PROPOSAL_DESCRIPTION)
  );

  // Queue
  console.log("Queueing proposal in TimeLock...");
  const queueTx = await governor.queue(
    [boxAddress],
    [0],
    [encodedFunctionCall],
    descriptionHash
  );
  await queueTx.wait(1);
  console.log("Proposal queued!");

  // Fast-forward past timelock delay on local network
  if (isLocalNetwork()) {
    console.log(`Fast-forwarding ${MIN_DELAY + 1}s past timelock delay...`);
    await increaseTime(MIN_DELAY + 1);
  } else {
    console.log(
      `Timelock delay: ${MIN_DELAY}s. Wait before executing on a live network.`
    );
    return;
  }

  // Execute
  console.log("Executing proposal...");
  const executeTx = await governor.execute(
    [boxAddress],
    [0],
    [encodedFunctionCall],
    descriptionHash
  );
  await executeTx.wait(1);
  console.log("Proposal executed!");

  // Verify
  const finalValue = await box.retrieve();
  console.log("\nBox value after governance execution:", finalValue.toString());
  console.log("Governance lifecycle completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
