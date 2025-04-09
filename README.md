# Alchemist EIP-7702 Paymaster Demo

This application demonstrates EIP-7702 account abstraction and sponsored transactions on the Hoodi public testnet, specifically for interacting with the Alchemix protocol.

## Overview

This dApp allows users to:
- Deposit tokens directly to Alchemist using their own wallet
- Use sponsored transactions where a sponsor pays the gas fees for another user
(This is will revert if not whitelisted)
- View their total value in the Alchemist protocol

The application uses viem's implementation of EIP-7702 for account abstraction and sponsored transactions.

## Setup and Installation

### Prerequisites
- Node.js (v16 or higher. >=18 recommended)
- npm or yarn
- MetaMask browser extension

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd paymaster
```

2. Install dependencies:
```bash
npm install
# or
yarn
```

3. Create a `.env` file in the project root with your sponsor account private key:
```
VITE_SPONSOR_PRIVATE_KEY=your_private_key_here
```

**⚠️ Security Warning**: Never commit your private key to version control or share it with others.

4. Start the development server:
```bash
npm run dev
# or
yarn dev
```

5. Open your browser and navigate to `http://localhost:3000`

## Local Development Setup

### Contract Setup and Deployment

This guide walks you through setting up a local development environment with Anvil forked from the Hoodi testnet.

#### 1. Run Local Fork

Pull the latest Alchemix Repo and navigate to the root directory:

```bash
# Start Anvil with Hoodi fork
anvil --fork-url https://rpc.hoodi.ethpandaops.io/ --hardfork prague --steps-tracing
```

**Note:** `--code-size-limit` is optional but can be useful if you want to include console logs which may increase contract size.

#### 2. Deploy Modified Alchemist V2

```bash
# Modify the Alchemist contract
# Edit src/alchemist/AlchemistV2.sol with new functions
# (or clear the entire file and paste the modified version)

# Create deployment script
# Create src/scripts/DeployAlchemix.s.sol and copy contents from src/contracts/DeployAlchemixi.s.sol

# Deploy the modified Alchemist
forge script src/scripts/DeployAlchemixV2Hoodi.s.sol --rpc-url http://localhost:8545 --broadcast -vvv
```

#### 3. Deploy Relayer Contract

```bash
# Create Relayer contract
# Create src/test/mocks/Relayer.sol and copy contents from src/contracts/Relayer.sol

# Create deployment script
# Create src/scripts/DeployRelayer.s.sol and copy contents from src/contracts/DeployRelayer.s.sol

# Deploy the Relayer
forge script src/scripts/DeployRelayer.s.sol --rpc-url http://localhost:8545 --broadcast -vvv
```

#### 4. Update Frontend Configuration

Make sure to update the frontend with the deployed addresses:

```javascript
const ALCHEMIST_ADDRESS = "AlchemistV2 Proxy"; // ALCHEMIST address for testing
const YIELD_TOKEN_ADDRESS = "test yield token"; // YIELD token for testing 
const RELAYER_ADDRESS = "Deployed Relayer"; // Relayer address for testing
```

#### 5. Fund Accounts as Needed

##### Fund Sponsor Account with ETH
```bash
cast rpc anvil_setBalance \
  SPONSOR_ACCOUNT_ADDRESS \
  0x3635C9ADC5DEA00000 \
  --rpc-url http://localhost:8545
```

##### Fund Recipient Account with ETH
```bash
cast rpc anvil_setBalance \
  RECIPIENT_ACCOUNT_ADDRESS \
  0x3635C9ADC5DEA00000 \
  --rpc-url http://localhost:8545
```

##### Fund Sponsor Account with Yield Tokens. Can use the anvil test account private key in the example to run the transaction from.
```bash
cast send \
  YIELD_TOKEN_ADDRESS \
  "transfer(address,uint256)(bool)" \
  SPONSOR_ACCOUNT_ADDRESS \
  100000000000000000000000 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --rpc-url http://localhost:8545
```

#### 5. MetaMask Setup

Add network [here](https://hoodi.ethpandaops.io/). You can add it manually with the following configuration:

- **Network Name**: Hoodi Testnet
- **RPC URL**: `http://localhost:8545`
- **Chain ID**: 560048
- **Currency Symbol**: ETH
- **Block Explorer URL**: `https://hoodi.etherscan.io/`


### Debugging Tips

- Use `--steps-tracing` with Anvil to see detailed execution traces
- When running large contracts with console logging, you may need to add `--code-size-limit`
- Check transactions in the Anvil logs for detailed error information
- Use `cast call` to test contract interactions without sending transactions


## Public Development Setup

Hoodi is a public testnet for testing EIP-7702 functionality:
### Adding Hoodi Testnet to MetaMask

Add network [here](https://hoodi.ethpandaops.io/). You can add it manually with the following configuration:

- **Network Name**: Hoodi Testnet
- **RPC URL**: `https://rpc.hoodi.ethpandaops.io/`
- **Chain ID**: 560048
- **Currency Symbol**: ETH
- **Block Explorer URL**: `https://hoodi.etherscan.io/`

## EIP-7702 and viem Implementation

This application uses viem's implementation of [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702), which introduces account abstraction features:

### Key EIP-7702 Features Demonstrated:

1. **Authorization-Based Transactions**:  
   The app demonstrates how to create and sign authorizations for transactions that can be executed by other users.

2. **Sponsored Transactions**:  
   The sponsor account (defined by the private key) pays for gas fees while the user benefits from the transaction execution.

3. **Batch Transactions**:  
   Multiple operations (token approval and deposit) are batched into a single transaction.

### viem Implementation:

The application uses viem's account abstraction features:

```javascript
// Authorizing sponsor account to execute the relayer contract code in the context of the sponsor account

// The sponsor account is also signing the transaction (this can be any local account)
const authorization = await sponsorClient.signAuthorization({
  account: sponsorClient.account,
  contractAddress: RELAYER_ADDRESS,
  exectuor: 'self'
});

// Sending a transaction with authorization

// 1)  Sending the executeCallData tx to the authorized account executor i.e. sponsor account
// 2)  The relayer contract function will be called in the context of the sponsor account
// 3)  During execution on chain, msg.sender will be the EOA previously authorized (Not the original smart contract address). 
// Since the same EOA sent the transaction, i.e. the sponsor account address, tx.origin will also be the sponsor account address.
// 4) Someone else could have been authroized, in which case tx.origin would still be the sponsor account address, 
// but msg.sender would be the another account address.
const hash = await sponsorClient.sendTransaction({
   to: sponsorClient.account.address,
   data: executeCallData,
   authorizationList: [authorization],
})
```


## Contract Addresses

The application can interact with the following contracts on the Hoodi testnet:

- **Alchemist**: `0x7b5Ecee7cB983F0156C17D6b25fED0c69C70571a`
- **Relayer**: `0xD6b6c4CcE8177051d29d9f436a7262c60541E822`
- **Yield Token**: `0xB39FCe240fb2855E390C0fCEa4c41938331F5694`

The `Relayer` contract, similar to the `BatchCallAndSponsor`, allows for EIP7702 batch & sponsored transactions. More [here](https://github.com/quiknode-labs/qn-guide-examples/blob/main/ethereum/eip-7702/src/BatchCallAndSponsor.sol).

## Usage

1. **Connect Wallet**:  
   Click "Connect Wallet" to connect your MetaMask wallet.

2. **Direct Deposit**:  
   Enter an amount and click "Deposit" to directly deposit funds to Alchemist from your wallet.

3. **Sponsor Deposit**:  
   Click "Sponsor Deposit" to create a transaction where the sponsor pays the gas fees,
   deposits yeild tokens and sends signed in user the shares.
   The sponsor account must be funded for this to work.


4. **Sponsored Deposit with Smart Account Blocking**:  
   Click "Sponsor Deposit(Smart Account Blocked)" to create a transaction where the alchemist will block the deposit because the account is an EIP7702 smart account.
   The sponsor account must be funded for this to be shown.


5. **View Total Value**:  
   Click "Total Value" to see your current total value of shares in the Alchemist protocol.

## Development

- **Frontend**: Vanilla JavaScript with viem for blockchain interaction
- **Build Tool**: Vite
- **Blockchain Library**: viem

### Project Structure

- `src/app.js` - Main application logic
- `index.html` - Main HTML file
- `vite.config.js` - Vite configuration
- `src/contracts/` - Contract ABIs

## License

ISC

## Troubleshooting

- **RPC Errors**: Make sure you're connected to the Hoodi testnet local fork/public
- **Transactions** using the default public rpc url may take up to two minutes for the UI to recieve messages.
- **Connection Issues**: Check MetaMask is unlocked and connected to the Hoodi network

## Resources

- [EIP-7702 Specification](https://eips.ethereum.org/EIPS/eip-7702)
- [viem Documentation](https://viem.sh/)
