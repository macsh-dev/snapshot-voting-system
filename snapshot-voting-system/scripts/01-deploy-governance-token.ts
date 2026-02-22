import { ethers } from "hardhat";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
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
  console.log("GovernanceToken address saved to deployments.");

  // Deploy MerkleAirdrop — distribute 90% of supply to mitigate centralization risk
  // Deployer keeps 10% for operational needs; 90% goes to airdrop for community distribution
  const airdropAmount = ethers.parseEther("900000"); // 900k tokens for airdrop
  const signers = await ethers.getSigners();
  const perRecipient = airdropAmount / 2n;
  const values: [string, string][] = [
    [signers[1]?.address ?? deployer.address, perRecipient.toString()],
    [signers[2]?.address ?? deployer.address, perRecipient.toString()],
  ];
  const tree = StandardMerkleTree.of(values, ["address", "uint256"]);

  const MerkleAirdrop = await ethers.getContractFactory("MerkleAirdrop");
  const merkleAirdrop = await MerkleAirdrop.deploy(tokenAddress, tree.root);
  await merkleAirdrop.waitForDeployment();

  const airdropAddress = await merkleAirdrop.getAddress();
  console.log("MerkleAirdrop deployed to:", airdropAddress);

  // Transfer tokens to airdrop contract
  await (await governanceToken.transfer(airdropAddress, airdropAmount)).wait(1);
  console.log("Transferred", ethers.formatEther(airdropAmount), "tokens to MerkleAirdrop");

  saveDeployment("MerkleAirdrop", airdropAddress);
  console.log("MerkleAirdrop address saved to deployments.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
