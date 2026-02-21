import { ethers } from "hardhat";
import { saveDeployment } from "../utils/deployments";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying GovernanceToken with account:", deployer.address);

  const GovernanceToken = await ethers.getContractFactory("GovernanceToken");
  const governanceToken = await GovernanceToken.deploy();
  await governanceToken.waitForDeployment();

  const tokenAddress = await governanceToken.getAddress();
  console.log("GovernanceToken deployed to:", tokenAddress);

  // Delegate voting power to deployer
  const tx = await governanceToken.delegate(deployer.address);
  await tx.wait(1);
  console.log("Delegated voting power to deployer:", deployer.address);

  saveDeployment("GovernanceToken", tokenAddress);
  console.log("Address saved to deployments.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
