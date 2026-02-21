import { ethers } from "hardhat";
import { getDeployment, saveDeployment } from "../utils/deployments";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying Box with account:", deployer.address);

  const timelockAddress = getDeployment("TimeLock");
  console.log("Box owner (TimeLock) at:", timelockAddress);

  const Box = await ethers.getContractFactory("Box");
  const box = await Box.deploy(timelockAddress);
  await box.waitForDeployment();

  const boxAddress = await box.getAddress();
  console.log("Box deployed to:", boxAddress);

  saveDeployment("Box", boxAddress);
  console.log("Address saved to deployments.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
