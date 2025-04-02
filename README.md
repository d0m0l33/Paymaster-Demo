

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
- Node.js (v16 or higher)
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

## Contract Addresses

The application interacts with the following contracts on the Hoodi testnet:

- **Alchemist**: `0x8b8d2eFB5Fc6B016A67B94c89493545D5271C992`
- **BatchCallAndSponsor**: `0x68545eceD4C6552cDc5AEc36177068D2BE12A101`
- **Test Yield Token**: `0x703bD932493Ad379075fA8aaC36518A3D6330B88`

## Hoodi Public Testnet Information

Hoodi is a public testnet for testing EIP-7702 functionality:

- **Chain ID**: 560048
- **Currency**: ETH (18 decimals)
- **RPC URL**: `https://rpc.hoodi.ethpandaops.io/`
- **Block Explorer**: `https://hoodi.etherscan.io/`

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
// Creating authorization with a local account
const authorization = await sponsorClient.signAuthorization({
  account: tempAccount,
  contractAddress: BATCH_CALL_SPONSOR_ADDRESS,
  data: batchData,
});

// Sending a transaction with authorization
const hash = await sponsorClient.sendTransaction({
  authorizationList: [authorization],
  data: batchData,
  to: tempAccount?.address,
})
```

## Usage

1. **Connect Wallet**:  
   Click "Connect Wallet" to connect your MetaMask wallet.

2. **Direct Deposit**:  
   Enter an amount and click "Deposit" to directly deposit funds to Alchemist from your wallet.

3. **Sponsored Deposit**:  
   Click "Sponsor Deposit" to create a transaction where the sponsor pays the gas fees.

4. **View Total Value**:  
   Click "Total Value" to see your current total value in the Alchemist protocol.

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

- **RPC Errors**: Make sure you're connected to the Hoodi testnet
- **Transactions** using the default rpc url can take up to two minutes for the UI to recieve messages.
- **Connection Issues**: Check MetaMask is unlocked and connected to the Hoodi network

## Resources

- [EIP-7702 Specification](https://eips.ethereum.org/EIPS/eip-7702)
- [viem Documentation](https://viem.sh/)
