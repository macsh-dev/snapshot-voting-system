import { expect } from "chai";
import { ethers } from "hardhat";
import {
  GovernanceToken,
  TimeLock,
  GovernorContract,
  Box,
} from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
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
import { Interface } from "ethers";
import { parseEventByName } from "../utils/events";
import { increaseTime, mineBlocks } from "../utils/hardhat-helpers";

describe("Governor Flow", function () {
  let governanceToken: GovernanceToken;
  let timeLock: TimeLock;
  let governor: GovernorContract;
  let box: Box;
  let deployer: HardhatEthersSigner;

  beforeEach(async function () {
    [deployer] = await ethers.getSigners();

    const GovernanceTokenFactory =
      await ethers.getContractFactory("GovernanceToken");
    governanceToken = await GovernanceTokenFactory.deploy();
    await governanceToken.waitForDeployment();

    const delegateTx = await governanceToken.delegate(deployer.address);
    await delegateTx.wait(1);

    const TimeLockFactory = await ethers.getContractFactory("TimeLock");
    timeLock = await TimeLockFactory.deploy(
      MIN_DELAY,
      [],
      [],
      deployer.address
    );
    await timeLock.waitForDeployment();

    const GovernorFactory =
      await ethers.getContractFactory("GovernorContract");
    governor = await GovernorFactory.deploy(
      await governanceToken.getAddress(),
      await timeLock.getAddress(),
      VOTING_DELAY,
      VOTING_PERIOD,
      QUORUM_PERCENTAGE
    );
    await governor.waitForDeployment();

    const proposerRole = await timeLock.PROPOSER_ROLE();
    const executorRole = await timeLock.EXECUTOR_ROLE();
    const adminRole = await timeLock.DEFAULT_ADMIN_ROLE();

    await (
      await timeLock.grantRole(proposerRole, await governor.getAddress())
    ).wait(1);
    await (await timeLock.grantRole(executorRole, ADDRESS_ZERO)).wait(1);
    await (await timeLock.revokeRole(adminRole, deployer.address)).wait(1);

    const BoxFactory = await ethers.getContractFactory("Box");
    box = await BoxFactory.deploy(await timeLock.getAddress());
    await box.waitForDeployment();
  });

  it("can only be changed through governance", async function () {
    await expect(box.store(55)).to.be.revertedWithCustomError(
      box,
      "OwnableUnauthorizedAccount"
    );

    const encodedFunctionCall = box.interface.encodeFunctionData(FUNC, [
      NEW_STORE_VALUE,
    ]);

    const proposeTx = await governor.propose(
      [await box.getAddress()],
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

    let proposalState = await governor.state(proposalId);
    expect(proposalState).to.equal(0);

    await mineBlocks(VOTING_DELAY + 1);

    proposalState = await governor.state(proposalId);
    expect(proposalState).to.equal(1);

    const voteTx = await governor.castVoteWithReason(
      proposalId,
      1,
      "I like storing 77!"
    );
    await voteTx.wait(1);

    await mineBlocks(VOTING_PERIOD + 1);

    proposalState = await governor.state(proposalId);
    expect(proposalState).to.equal(4);

    const descriptionHash = ethers.keccak256(
      ethers.toUtf8Bytes(PROPOSAL_DESCRIPTION)
    );

    const queueTx = await governor.queue(
      [await box.getAddress()],
      [0],
      [encodedFunctionCall],
      descriptionHash
    );
    await queueTx.wait(1);

    proposalState = await governor.state(proposalId);
    expect(proposalState).to.equal(5);

    await increaseTime(MIN_DELAY + 1);

    const executeTx = await governor.execute(
      [await box.getAddress()],
      [0],
      [encodedFunctionCall],
      descriptionHash
    );
    await executeTx.wait(1);

    const boxValue = await box.retrieve();
    expect(boxValue).to.equal(NEW_STORE_VALUE);

    proposalState = await governor.state(proposalId);
    expect(proposalState).to.equal(7);
  });

  it("deploys governance system correctly", async function () {
    expect(await governanceToken.name()).to.equal("GovernanceToken");
    expect(await governor.name()).to.equal("GovernorContract");
    expect(await governor.votingDelay()).to.equal(VOTING_DELAY);
    expect(await governor.votingPeriod()).to.equal(VOTING_PERIOD);
    expect(await box.owner()).to.equal(await timeLock.getAddress());
    expect(await box.retrieve()).to.equal(0);
  });
});
