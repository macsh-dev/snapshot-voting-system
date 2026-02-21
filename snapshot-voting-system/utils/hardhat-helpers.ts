import { network } from "hardhat";

export function isLocalNetwork(): boolean {
  return network.config.chainId === 31337;
}

export async function mineBlock(): Promise<void> {
  await network.provider.send("evm_mine", []);
}

export async function mineBlocks(count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    await mineBlock();
  }
}

export async function increaseTime(seconds: number): Promise<void> {
  await network.provider.send("evm_increaseTime", [seconds]);
  await mineBlock();
}
