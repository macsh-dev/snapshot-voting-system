# Snapshot Voting System (ERC20 Governor)

A minimal on-chain governance system built with OpenZeppelin Contracts v5.x. Token holders propose, vote, queue, and execute changes via a timelock. This repository demonstrates the full lifecycle using a simple `Box` contract.

## Highlights
- ERC20Votes governance token with snapshot-based voting power
- OpenZeppelin Governor with quorum and simple counting
- Timelock-controlled execution for safety
- Production-style separated deployment scripts
- End-to-end tests covering the full governance flow

## Contracts
| Contract | Description |
|----------|-------------|
| `GovernanceToken.sol` | ERC20 + ERC20Permit + ERC20Votes token (1M supply) |
| `GovernorContract.sol` | Governor with settings, quorum, counting, timelock control |
| `TimeLock.sol` | TimelockController wrapper (1 hour delay) |
| `Box.sol` | Example governed contract (only timelock can call `store`) |

## Project Structure
```
snapshot-voting-system/
├── contracts/
│   ├── GovernanceToken.sol
│   ├── GovernorContract.sol
│   ├── TimeLock.sol
│   └── Box.sol
├── scripts/
│   ├── deploy-and-run.ts              # All-in-one (local testing)
│   ├── 01-deploy-governance-token.ts  # Deploy token + delegate
│   ├── 02-deploy-timelock.ts          # Deploy timelock
│   ├── 03-deploy-governor.ts          # Deploy governor + setup roles
│   ├── 04-deploy-box.ts              # Deploy Box (owned by timelock)
│   ├── 05-propose.ts                 # Create a proposal
│   ├── 06-vote.ts                    # Cast vote
│   └── 07-queue-and-execute.ts       # Queue + execute after timelock
├── test/
│   └── governance.test.ts
├── utils/
│   ├── deployments.ts                # Address tracking across scripts
│   ├── events.ts                     # Event log parser
│   └── hardhat-helpers.ts            # Block mining & time helpers
├── helper-hardhat-config.ts
├── hardhat.config.ts
└── package.json
```

## Prerequisites
- Node.js v18+
- npm

## Install
```bash
npm install
```

## Compile
```bash
npm run compile
```

## Test
```bash
npm test
```

## Deployment

### Quick Local Test (All-in-One)
Runs the entire governance lifecycle in a single ephemeral Hardhat instance:
```bash
npm run deploy
```

### Production-Style (Step by Step)
Each step runs as a separate script, with deployed addresses saved to `deployments/`. This mirrors how governance works in production where each step happens at different times.

**1. Start a persistent local node:**
```bash
npm run node
```

**2. In a separate terminal, run each step:**
```bash
npm run deploy:token      # Deploy GovernanceToken + delegate
npm run deploy:timelock   # Deploy TimeLock
npm run deploy:governor   # Deploy GovernorContract + setup roles
npm run deploy:box        # Deploy Box (owned by TimeLock)
npm run propose           # Create proposal to store 77 in Box
npm run vote              # Vote FOR the proposal
npm run execute           # Queue in timelock + execute
```

You can also deploy all contracts at once:
```bash
npm run deploy:all
```

## Governance Parameters
Configured in `helper-hardhat-config.ts`:

| Parameter | Value | Description |
|-----------|-------|-------------|
| `VOTING_DELAY` | 1 block | Wait before voting starts |
| `VOTING_PERIOD` | 50 blocks | Voting duration |
| `QUORUM_PERCENTAGE` | 4% | Minimum % of total supply that must vote |
| `MIN_DELAY` | 3600 sec | Timelock delay before execution |

## Governance Flow
```
1. Deploy    → Token, TimeLock, Governor, Box
2. Delegate  → token.delegate(self) to activate voting power
3. Propose   → Submit a proposal (e.g., "Store 77 in Box")
4. Wait      → VOTING_DELAY blocks
5. Vote      → Cast vote: For (1) / Against (0) / Abstain (2)
6. Wait      → VOTING_PERIOD blocks
7. Queue     → Queue passed proposal in TimeLock
8. Wait      → MIN_DELAY seconds
9. Execute   → Proposal executes, Box value changes
```

## Notes
- Voting power only counts after delegation.
- On local Hardhat, scripts auto-mine blocks and fast-forward time.
- Deployed addresses are tracked in `deployments/<network>-addresses.json` (gitignored).

## License
MIT
