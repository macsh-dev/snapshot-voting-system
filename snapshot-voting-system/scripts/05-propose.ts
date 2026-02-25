import { ethers } from "hardhat";
import { Interface } from "ethers";
import {
  NEW_STORE_VALUE,
  FUNC,
  PROPOSAL_DESCRIPTION,
  VOTING_DELAY,
} from "../helper-hardhat-config";
import { getDeployment, saveDeployment } from "../utils/deployments";
import { parseEventByName } from "../utils/events";
import { isLocalNetwork, mineBlocks } from "../utils/hardhat-helpers";

async function main() {
  const governorAddress = getDeployment("GovernorContract");
  const boxAddress = getDeployment("Box");

  const governor = await ethers.getContractAt(
    "GovernorContract",
    governorAddress
  );
  const box = await ethers.getContractAt("Box", boxAddress);

  // Encode the function call
  const encodedFunctionCall = box.interface.encodeFunctionData(FUNC, [
    NEW_STORE_VALUE,
  ]);

  console.log("Creating proposal:", PROPOSAL_DESCRIPTION);
  console.log("Target contract (Box):", boxAddress);
  console.log("Function:", FUNC, "| Value:", NEW_STORE_VALUE);

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

  console.log("Proposal created! ID:", proposalId.toString());

  saveDeployment("ProposalId", proposalId.toString());

  // On local network, mine blocks to pass voting delay
  if (isLocalNetwork()) {
    console.log(`Mining ${VOTING_DELAY + 1} blocks to pass voting delay...`);
    await mineBlocks(VOTING_DELAY + 1);
    console.log("Voting delay passed. You can now vote.");
  } else {
    console.log(
      `Voting delay: ${VOTING_DELAY} blocks. Wait before voting on a live network.`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
