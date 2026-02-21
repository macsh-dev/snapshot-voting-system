import { ethers } from "hardhat";
import { Interface } from "ethers";
import {
  VOTING_DELAY,
  VOTING_PERIOD,
  QUORUM_PERCENTAGE,
  MIN_DELAY,
  ADDRESS_ZERO,
  NEW_STORE_VALUE,
  FUNC,
  PROPOSAL_DESCRIPTION,
} from "../helper-hardhat-config";
import { parseEventByName } from "../utils/events";
import { increaseTime, mineBlocks } from "../utils/hardhat-helpers";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // 1. Deploy GovernanceToken + delegate
  const GovernanceToken = await ethers.getContractFactory("GovernanceToken");
  const governanceToken = await GovernanceToken.deploy();
  await governanceToken.waitForDeployment();
  const tokenAddress = await governanceToken.getAddress();
  console.log("GovernanceToken deployed to:", tokenAddress);

  await (await governanceToken.delegate(deployer.address)).wait(1);
  console.log("Delegated votes to deployer");

  // 2. Deploy TimeLock
  const TimeLock = await ethers.getContractFactory("TimeLock");
  const timeLock = await TimeLock.deploy(MIN_DELAY, [], [], deployer.address);
  await timeLock.waitForDeployment();
  const timelockAddress = await timeLock.getAddress();
  console.log("TimeLock deployed to:", timelockAddress);

  // 3. Deploy GovernorContract
  const Governor = await ethers.getContractFactory("GovernorContract");
  const governor = await Governor.deploy(
    tokenAddress,
    timelockAddress,
    VOTING_DELAY,
    VOTING_PERIOD,
    QUORUM_PERCENTAGE
  );
  await governor.waitForDeployment();
  const governorAddress = await governor.getAddress();
  console.log("GovernorContract deployed to:", governorAddress);

  // 4. Setup TimeLock roles
  const proposerRole = await timeLock.PROPOSER_ROLE();
  const executorRole = await timeLock.EXECUTOR_ROLE();
  const adminRole = await timeLock.DEFAULT_ADMIN_ROLE();

  await (await timeLock.grantRole(proposerRole, governorAddress)).wait(1);
  await (await timeLock.grantRole(executorRole, ADDRESS_ZERO)).wait(1);
  await (await timeLock.revokeRole(adminRole, deployer.address)).wait(1);
  console.log("TimeLock roles configured");

  // 5. Deploy Box (owned by TimeLock)
  const Box = await ethers.getContractFactory("Box");
  const box = await Box.deploy(timelockAddress);
  await box.waitForDeployment();
  const boxAddress = await box.getAddress();
  console.log("Box deployed to:", boxAddress);

  // 6. Propose
  const encodedFunctionCall = box.interface.encodeFunctionData(FUNC, [
    NEW_STORE_VALUE,
  ]);

  console.log("\nProposing:", PROPOSAL_DESCRIPTION);
  const proposeTx = await governor.propose(
    [boxAddress],
    [0],
    [encodedFunctionCall],
    PROPOSAL_DESCRIPTION
  );
  const proposeReceipt = await proposeTx.wait(1);

  const iface = governor.interface as Interface;
  const proposalId = parseEventByName(
    proposeReceipt!.logs,
    iface,
    "ProposalCreated"
  ).args.proposalId;
  console.log("Proposal created with ID:", proposalId.toString());

  // Mine blocks to pass voting delay
  await mineBlocks(VOTING_DELAY + 1);

  // 7. Vote FOR
  await (
    await governor.castVoteWithReason(
      proposalId,
      1,
      "I support storing 77 in the Box!"
    )
  ).wait(1);
  console.log("Voted FOR the proposal");

  // Mine blocks to end voting period
  await mineBlocks(VOTING_PERIOD + 1);

  // 8. Queue in TimeLock
  const descriptionHash = ethers.keccak256(
    ethers.toUtf8Bytes(PROPOSAL_DESCRIPTION)
  );
  await (
    await governor.queue(
      [boxAddress],
      [0],
      [encodedFunctionCall],
      descriptionHash
    )
  ).wait(1);
  console.log("Proposal queued in TimeLock");

  // Fast-forward past timelock delay
  await increaseTime(MIN_DELAY + 1);

  // 9. Execute
  await (
    await governor.execute(
      [boxAddress],
      [0],
      [encodedFunctionCall],
      descriptionHash
    )
  ).wait(1);
  console.log("Proposal executed!");

  const finalValue = await box.retrieve();
  console.log("\nBox value:", finalValue.toString());
  console.log("Full governance lifecycle completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
