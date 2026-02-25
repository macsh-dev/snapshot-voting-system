import { ethers } from "hardhat";
import { VOTING_PERIOD } from "../helper-hardhat-config";
import { getDeployment } from "../utils/deployments";
import { isLocalNetwork, mineBlocks } from "../utils/hardhat-helpers";

// Vote values: 0 = Against, 1 = For, 2 = Abstain
const VOTE_WAY = 1; // For
const VOTE_REASON = "I support storing 77 in the Box!";

async function main() {
  const governorAddress = getDeployment("GovernorContract");
  const proposalId = getDeployment("ProposalId");

  const governor = await ethers.getContractAt(
    "GovernorContract",
    governorAddress
  );

  console.log("Voting on proposal:", proposalId);
  console.log("Vote: FOR | Reason:", VOTE_REASON);

  const voteTx = await governor.castVoteWithReason(
    proposalId,
    VOTE_WAY,
    VOTE_REASON
  );
  await voteTx.wait(1);
  console.log("Vote cast successfully!");

  // On local network, mine blocks to end voting period
  if (isLocalNetwork()) {
    console.log(`Mining ${VOTING_PERIOD + 1} blocks to end voting period...`);
    await mineBlocks(VOTING_PERIOD + 1);
    console.log("Voting period ended. You can now queue and execute.");
  } else {
    console.log(
      `Voting period: ${VOTING_PERIOD} blocks. Wait before queuing on a live network.`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
