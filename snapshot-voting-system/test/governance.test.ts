import { expect } from "chai";
import { ethers } from "hardhat";
import {
  GovernanceToken,
  TimeLock,
  GovernorContract,
  Box,
  MerkleAirdrop,
} from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import {
  VOTING_DELAY,
  VOTING_PERIOD,
  QUORUM_PERCENTAGE,
  MIN_DELAY,
  ADDRESS_ZERO,
  NEW_STORE_VALUE,
  FUNC,
  PROPOSAL_DESCRIPTION,
  PROPOSAL_THRESHOLD,
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
  let voter1: HardhatEthersSigner;
  let voter2: HardhatEthersSigner;
  let voter3: HardhatEthersSigner;

  beforeEach(async function () {
    [deployer, voter1, voter2, voter3] = await ethers.getSigners();

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
      QUORUM_PERCENTAGE,
      PROPOSAL_THRESHOLD
    );
    await governor.waitForDeployment();

    const proposerRole = await timeLock.PROPOSER_ROLE();
    const executorRole = await timeLock.EXECUTOR_ROLE();
    const cancellerRole = await timeLock.CANCELLER_ROLE();
    const adminRole = await timeLock.DEFAULT_ADMIN_ROLE();

    await (
      await timeLock.grantRole(proposerRole, await governor.getAddress())
    ).wait(1);
    await (await timeLock.grantRole(executorRole, ADDRESS_ZERO)).wait(1);
    await (
      await timeLock.grantRole(cancellerRole, await governor.getAddress())
    ).wait(1);
    await (await timeLock.revokeRole(adminRole, deployer.address)).wait(1);

    const BoxFactory = await ethers.getContractFactory("Box");
    box = await BoxFactory.deploy(await timeLock.getAddress());
    await box.waitForDeployment();
  });

  // Helper to create a proposal and return its ID
  async function createProposal(description?: string) {
    const encodedFunctionCall = box.interface.encodeFunctionData(FUNC, [
      NEW_STORE_VALUE,
    ]);
    const desc = description || PROPOSAL_DESCRIPTION;

    const proposeTx = await governor.propose(
      [await box.getAddress()],
      [0],
      [encodedFunctionCall],
      desc
    );
    const proposeReceipt = await proposeTx.wait(1);

    const iface = governor.interface as Interface;
    const proposalId = parseEventByName(
      proposeReceipt!.logs,
      iface,
      "ProposalCreated"
    ).args.proposalId;

    return { proposalId, encodedFunctionCall, description: desc };
  }

  it("can only be changed through governance", async function () {
    await expect(box.store(55)).to.be.revertedWithCustomError(
      box,
      "OwnableUnauthorizedAccount"
    );

    const { proposalId, encodedFunctionCall } = await createProposal();

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

  // --- GovernanceToken: nonces override ---
  describe("GovernanceToken nonces", function () {
    it("returns the correct nonce for an address", async function () {
      const nonce = await governanceToken.nonces(deployer.address);
      expect(nonce).to.equal(0);
    });

    it("increments nonce after a permit call", async function () {
      const spender = voter1.address;
      const value = ethers.parseEther("100");
      const nonce = await governanceToken.nonces(deployer.address);
      const deadline = ethers.MaxUint256;

      const tokenAddress = await governanceToken.getAddress();
      const name = await governanceToken.name();

      const domain = {
        name,
        version: "1",
        chainId: 31337,
        verifyingContract: tokenAddress,
      };

      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      };

      const message = {
        owner: deployer.address,
        spender,
        value,
        nonce,
        deadline,
      };

      const signature = await deployer.signTypedData(domain, types, message);
      const { v, r, s } = ethers.Signature.from(signature);

      await governanceToken.permit(
        deployer.address,
        spender,
        value,
        deadline,
        v,
        r,
        s
      );

      const newNonce = await governanceToken.nonces(deployer.address);
      expect(newNonce).to.equal(nonce + 1n);
    });
  });

  // --- GovernorContract: proposalNeedsQueuing ---
  describe("proposalNeedsQueuing", function () {
    it("returns true for proposals (timelock-controlled governor)", async function () {
      const { proposalId } = await createProposal();
      const needsQueuing = await governor.proposalNeedsQueuing(proposalId);
      expect(needsQueuing).to.equal(true);
    });
  });

  // --- GovernorContract: _cancel (via cancel) ---
  describe("Proposal cancellation", function () {
    it("allows proposer to cancel a pending proposal", async function () {
      const { proposalId, encodedFunctionCall, description } =
        await createProposal("Cancel test proposal");

      let proposalState = await governor.state(proposalId);
      expect(proposalState).to.equal(0); // Pending

      const descriptionHash = ethers.keccak256(
        ethers.toUtf8Bytes(description)
      );

      await governor.cancel(
        [await box.getAddress()],
        [0],
        [encodedFunctionCall],
        descriptionHash
      );

      proposalState = await governor.state(proposalId);
      expect(proposalState).to.equal(2); // Canceled
    });

    it("reverts when cancelling a queued proposal without authority", async function () {
      const desc = "Cancel queued proposal";
      const { proposalId, encodedFunctionCall } = await createProposal(desc);

      await mineBlocks(VOTING_DELAY + 1);

      await governor.castVoteWithReason(proposalId, 1, "yes");

      await mineBlocks(VOTING_PERIOD + 1);

      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(desc));

      await governor.queue(
        [await box.getAddress()],
        [0],
        [encodedFunctionCall],
        descriptionHash
      );

      let proposalState = await governor.state(proposalId);
      expect(proposalState).to.equal(5); // Queued

      // Proposer still meets threshold (0), so cancel reverts with GovernorUnableToCancel
      await expect(
        governor.cancel(
          [await box.getAddress()],
          [0],
          [encodedFunctionCall],
          descriptionHash
        )
      ).to.be.revertedWithCustomError(governor, "GovernorUnableToCancel");
    });
  });

  // --- Failed proposals ---
  describe("Failed proposals", function () {
    it("fails when quorum is not met", async function () {
      // Transfer most tokens away so deployer has < 4% of supply
      const totalSupply = await governanceToken.totalSupply();
      const keepAmount = (totalSupply * 3n) / 100n; // Keep 3%, quorum is 4%
      const transferAmount = totalSupply - keepAmount;

      // Transfer to voter1 but DON'T delegate (so voting power doesn't count)
      await governanceToken.transfer(voter1.address, transferAmount);

      // Need to mine a block so the checkpoint is recorded
      await mineBlocks(1);

      const { proposalId } = await createProposal("Quorum fail test");

      await mineBlocks(VOTING_DELAY + 1);

      // Deployer votes yes but only has 3% of supply
      await governor.castVoteWithReason(proposalId, 1, "yes");

      await mineBlocks(VOTING_PERIOD + 1);

      // State 3 = Defeated
      const proposalState = await governor.state(proposalId);
      expect(proposalState).to.equal(3);
    });

    it("fails when majority votes against", async function () {
      // Give voter1 more tokens than deployer and delegate
      const totalSupply = await governanceToken.totalSupply();
      const transferAmount = (totalSupply * 60n) / 100n; // 60% to voter1

      await governanceToken.transfer(voter1.address, transferAmount);
      await governanceToken.connect(voter1).delegate(voter1.address);

      await mineBlocks(1);

      const { proposalId } = await createProposal("Majority against test");

      await mineBlocks(VOTING_DELAY + 1);

      // Deployer votes for (40%)
      await governor.castVoteWithReason(proposalId, 1, "yes");
      // Voter1 votes against (60%)
      await governor.connect(voter1).castVoteWithReason(proposalId, 0, "no");

      await mineBlocks(VOTING_PERIOD + 1);

      // State 3 = Defeated
      const proposalState = await governor.state(proposalId);
      expect(proposalState).to.equal(3);
    });
  });

  // --- Multi-voter scenarios ---
  describe("Multi-voter scenarios", function () {
    it("counts votes from multiple voters correctly", async function () {
      const totalSupply = await governanceToken.totalSupply();
      const voter1Amount = (totalSupply * 30n) / 100n;
      const voter2Amount = (totalSupply * 20n) / 100n;

      await governanceToken.transfer(voter1.address, voter1Amount);
      await governanceToken.transfer(voter2.address, voter2Amount);
      await governanceToken.connect(voter1).delegate(voter1.address);
      await governanceToken.connect(voter2).delegate(voter2.address);

      await mineBlocks(1);

      const { proposalId } = await createProposal("Multi-voter test");

      await mineBlocks(VOTING_DELAY + 1);

      // Deployer (50%) votes for, voter1 (30%) votes for, voter2 (20%) abstains
      await governor.castVoteWithReason(proposalId, 1, "yes");
      await governor.connect(voter1).castVoteWithReason(proposalId, 1, "agree");
      await governor
        .connect(voter2)
        .castVoteWithReason(proposalId, 2, "abstain");

      await mineBlocks(VOTING_PERIOD + 1);

      // State 4 = Succeeded
      const proposalState = await governor.state(proposalId);
      expect(proposalState).to.equal(4);

      // Verify vote counts
      const { againstVotes, forVotes, abstainVotes } =
        await governor.proposalVotes(proposalId);
      expect(againstVotes).to.equal(0);
      expect(forVotes).to.be.gt(0);
      expect(abstainVotes).to.be.gt(0);
    });
  });

  // --- Edge cases ---
  describe("Edge cases", function () {
    it("reverts when voting after the voting period ends", async function () {
      const { proposalId } = await createProposal("Late vote test");

      await mineBlocks(VOTING_DELAY + 1);
      await mineBlocks(VOTING_PERIOD + 1);

      // Voting period is over, state should be Defeated (no votes cast)
      const proposalState = await governor.state(proposalId);
      expect(proposalState).to.equal(3); // Defeated

      await expect(
        governor.castVoteWithReason(proposalId, 1, "too late")
      ).to.be.revertedWithCustomError(governor, "GovernorUnexpectedProposalState");
    });

    it("reverts on double voting", async function () {
      const { proposalId } = await createProposal("Double vote test");

      await mineBlocks(VOTING_DELAY + 1);

      await governor.castVoteWithReason(proposalId, 1, "first vote");

      await expect(
        governor.castVoteWithReason(proposalId, 1, "second vote")
      ).to.be.revertedWithCustomError(governor, "GovernorAlreadyCastVote");
    });

    it("reverts when voting before voting delay passes", async function () {
      const { proposalId } = await createProposal("Early vote test");

      // Don't mine blocks - still in pending state
      await expect(
        governor.castVoteWithReason(proposalId, 1, "too early")
      ).to.be.revertedWithCustomError(governor, "GovernorUnexpectedProposalState");
    });
  });
});

describe("MerkleAirdrop", function () {
  let governanceToken: GovernanceToken;
  let merkleAirdrop: MerkleAirdrop;
  let deployer: HardhatEthersSigner;
  let addr1: HardhatEthersSigner;
  let addr2: HardhatEthersSigner;
  let addr3: HardhatEthersSigner;
  let tree: StandardMerkleTree<[string, string]>;
  let airdropAmount: bigint;

  beforeEach(async function () {
    [deployer, addr1, addr2, addr3] = await ethers.getSigners();

    const GovernanceTokenFactory =
      await ethers.getContractFactory("GovernanceToken");
    governanceToken = await GovernanceTokenFactory.deploy();
    await governanceToken.waitForDeployment();

    const amount1 = ethers.parseEther("1000");
    const amount2 = ethers.parseEther("2000");
    const amount3 = ethers.parseEther("500");
    airdropAmount = amount1 + amount2 + amount3;

    // Build Merkle tree: [address, amount]
    const values: [string, string][] = [
      [addr1.address, amount1.toString()],
      [addr2.address, amount2.toString()],
      [addr3.address, amount3.toString()],
    ];
    tree = StandardMerkleTree.of(values, ["address", "uint256"]);

    const MerkleAirdropFactory =
      await ethers.getContractFactory("MerkleAirdrop");
    merkleAirdrop = await MerkleAirdropFactory.deploy(
      await governanceToken.getAddress(),
      tree.root
    );
    await merkleAirdrop.waitForDeployment();

    // Transfer airdrop tokens from deployer to the airdrop contract
    await governanceToken.transfer(
      await merkleAirdrop.getAddress(),
      airdropAmount
    );
  });

  function getProof(address: string): { amount: bigint; proof: string[] } {
    for (const [i, v] of tree.entries()) {
      if (v[0] === address) {
        return { amount: BigInt(v[1]), proof: tree.getProof(i) };
      }
    }
    throw new Error("Address not found in tree");
  }

  it("allows a valid claim", async function () {
    const { amount, proof } = getProof(addr1.address);

    await merkleAirdrop.claim(addr1.address, amount, proof);

    expect(await governanceToken.balanceOf(addr1.address)).to.equal(amount);
    expect(await merkleAirdrop.hasClaimed(addr1.address)).to.equal(true);
  });

  it("reverts on double claim", async function () {
    const { amount, proof } = getProof(addr1.address);

    await merkleAirdrop.claim(addr1.address, amount, proof);

    await expect(
      merkleAirdrop.claim(addr1.address, amount, proof)
    ).to.be.revertedWithCustomError(merkleAirdrop, "AlreadyClaimed");
  });

  it("reverts with invalid proof", async function () {
    const { amount } = getProof(addr1.address);
    const { proof: wrongProof } = getProof(addr2.address);

    await expect(
      merkleAirdrop.claim(addr1.address, amount, wrongProof)
    ).to.be.revertedWithCustomError(merkleAirdrop, "InvalidProof");
  });

  it("verifies token balances after multiple claims", async function () {
    const claim1 = getProof(addr1.address);
    const claim2 = getProof(addr2.address);
    const claim3 = getProof(addr3.address);

    await merkleAirdrop.claim(addr1.address, claim1.amount, claim1.proof);
    await merkleAirdrop.claim(addr2.address, claim2.amount, claim2.proof);
    await merkleAirdrop.claim(addr3.address, claim3.amount, claim3.proof);

    expect(await governanceToken.balanceOf(addr1.address)).to.equal(
      claim1.amount
    );
    expect(await governanceToken.balanceOf(addr2.address)).to.equal(
      claim2.amount
    );
    expect(await governanceToken.balanceOf(addr3.address)).to.equal(
      claim3.amount
    );

    // Airdrop contract should have 0 remaining
    expect(
      await governanceToken.balanceOf(await merkleAirdrop.getAddress())
    ).to.equal(0);
  });
});
