import * as fs from "fs";
import * as path from "path";
import { network } from "hardhat";

const DEPLOYMENTS_DIR = path.join(__dirname, "..", "deployments");
const DEPLOYMENTS_FILE = path.join(
  DEPLOYMENTS_DIR,
  `${network.name}-addresses.json`
);

interface Deployments {
  [key: string]: string;
}

function loadDeployments(): Deployments {
  if (!fs.existsSync(DEPLOYMENTS_FILE)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(DEPLOYMENTS_FILE, "utf-8"));
}

function saveDeploymentsFile(deployments: Deployments): void {
  if (!fs.existsSync(DEPLOYMENTS_DIR)) {
    fs.mkdirSync(DEPLOYMENTS_DIR, { recursive: true });
  }
  fs.writeFileSync(DEPLOYMENTS_FILE, JSON.stringify(deployments, null, 2));
}

export function saveDeployment(name: string, address: string): void {
  const deployments = loadDeployments();
  deployments[name] = address;
  saveDeploymentsFile(deployments);
}

export function getDeployment(name: string): string {
  const deployments = loadDeployments();
  const address = deployments[name];
  if (!address) {
    throw new Error(
      `Deployment "${name}" not found for network "${network.name}". Run the corresponding deploy script first.`
    );
  }
  return address;
}

export function clearDeployments(): void {
  if (fs.existsSync(DEPLOYMENTS_FILE)) {
    fs.unlinkSync(DEPLOYMENTS_FILE);
  }
}
