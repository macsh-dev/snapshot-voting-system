import { ethers } from "hardhat";
import {
  VOTING_DELAY,
  VOTING_PERIOD,
  QUORUM_PERCENTAGE,
  ADDRESS_ZERO,
} from "../helper-hardhat-config";
import { getDeployment, saveDeployment } from "../utils/deployments";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying GovernorContract with account:", deployer.address);

  const tokenAddress = getDeployment("GovernanceToken");
  const timelockAddress = getDeployment("TimeLock");
  console.log("Using GovernanceToken at:", tokenAddress);
  console.log("Using TimeLock at:", timelockAddress);

  // Deploy Governor
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

  // Setup TimeLock roles
  console.log("Setting up TimeLock roles...");
  const timeLock = await ethers.getContractAt("TimeLock", timelockAddress);

  const proposerRole = await timeLock.PROPOSER_ROLE();
  const executorRole = await timeLock.EXECUTOR_ROLE();
  const adminRole = await timeLock.DEFAULT_ADMIN_ROLE();

  await (await timeLock.grantRole(proposerRole, governorAddress)).wait(1);
  console.log("Granted PROPOSER_ROLE to Governor");

  await (await timeLock.grantRole(executorRole, ADDRESS_ZERO)).wait(1);
  console.log("Granted EXECUTOR_ROLE to ADDRESS_ZERO (anyone can execute)");

  await (await timeLock.revokeRole(adminRole, deployer.address)).wait(1);
  console.log("Revoked ADMIN_ROLE from deployer");

  saveDeployment("GovernorContract", governorAddress);
  console.log("Address saved to deployments.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
