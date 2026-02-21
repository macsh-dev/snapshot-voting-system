import { ethers } from "hardhat";
import { MIN_DELAY } from "../helper-hardhat-config";
import { saveDeployment } from "../utils/deployments";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying TimeLock with account:", deployer.address);
  console.log("Min delay:", MIN_DELAY, "seconds");

  const TimeLock = await ethers.getContractFactory("TimeLock");
  const timeLock = await TimeLock.deploy(MIN_DELAY, [], [], deployer.address);
  await timeLock.waitForDeployment();

  const timelockAddress = await timeLock.getAddress();
  console.log("TimeLock deployed to:", timelockAddress);

  saveDeployment("TimeLock", timelockAddress);
  console.log("Address saved to deployments.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
