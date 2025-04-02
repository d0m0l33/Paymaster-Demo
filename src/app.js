import {
  createWalletClient,
  createPublicClient,
  http,
  custom,
  parseEther,
  formatEther,
  encodeAbiParameters,
  parseAbiParameters,
  encodeFunctionData,
  getContract,
} from 'viem';
import { mainnet } from 'viem/chains';
import { defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import batchCallJson from './contracts/BatchCallAndSponsor.json';
import erc20Json from './contracts/ERC20.json';
import alchemistJson from './contracts/alchemist.json';

import { mnemonicToAccount } from 'viem/accounts'


// Global variables
let sponsorClient;
let userClient;
let userAddress;
let tempAccount;


// Define the Hoodi public testnet
export const hoodiTestnet = defineChain({
  id: 560048, // Replace with the actual chain ID for Hoodi testnet
  name: 'Hoodi Testnet',
  network: 'hoodi-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Hoodi Ether',
    symbol: 'ETH', // Update this if different
  },
  rpcUrls: {
    default: {
      http: ['/api'], // Use the proxied path
      webSocket: ['wss://ws.testnet.hoodi.xyz'], // Replace if available
    },
    public: {
      http: ['/api'], // Use the proxied path
      webSocket: ['wss://ws.testnet.hoodi.xyz'], // Replace if available
    },
  },
  blockExplorers: {
    default: {
      name: 'HoodiScan',
      url: 'https://hoodi.etherscan.io/', // Replace with actual explorer URL
    },
  },
  testnet: true,
})

// Create a client with the Hoodi testnet configuration
const publicClient = createPublicClient({
  chain: hoodiTestnet,
  transport: custom(window.ethereum)
})

// Contract addresses - replace with actual addresses
const ALCHEMIST_ADDRESS = '0x8b8d2eFB5Fc6B016A67B94c89493545D5271C992'; // Fixed the trailing period
const BATCH_CALL_SPONSOR_ADDRESS = '0x68545eceD4C6552cDc5AEc36177068D2BE12A101';
const YIELD_TOKEN_ADDRESS = '0x703bD932493Ad379075fA8aaC36518A3D6330B88'; // YIELD token for testing
const batchCallAndSponsorABI = batchCallJson.abi;
const erc20ABI = erc20Json.abi;
const alchemistABI = alchemistJson.abi;

// Initialize the app
async function init() {
  verifyHoodiConnection();
  setupSponsorWallet();

  // Setup event listeners
  document.getElementById('connectWallet').addEventListener('click', connectWallet);
  document.getElementById('deposit').addEventListener('click', directDeposit);
  document.getElementById('sponsorDeposit').addEventListener('click', sponsorDeposit);
  document.getElementById('viewBalance').addEventListener('click', totalValue);

  // Check if wallet is available
  if (window.ethereum) {
    // Auto-connect if previously connected
    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length > 0) {
        await setupWallet(accounts[0]);
      }
    } catch (error) {
      console.error("Failed to auto-connect:", error);
    }
  } else {
    updateStatus("Ethereum wallet not installed. Please install MetaMask or similar.");
  }
}

// Connect wallet function
async function connectWallet() {
  try {
    updateStatus("Connecting wallet...");
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    await setupWallet(accounts[0]);
    updateStatus("Wallet connected!");
  } catch (error) {
    console.error("Error connecting wallet:", error);
    updateStatus("Failed to connect wallet: " + error.message);
  }
}


// Setup wallet and contracts
async function setupSponsorWallet() {
  // Get private key from Vite environment variable
  let privateKey = import.meta.env.VITE_SPONSOR_PRIVATE_KEY;

  // viem signer account and authorized accounts can only be local accounts and not JSON-RPC accounts (like metamask) 
  // A Local Account performs signing of transactions & messages with a private key before executing a method over JSON-RPC.
  tempAccount = mnemonicToAccount('legal winner thank year wave sausage worth useful legal winner thank yellow');
  console.log('app temp account : ',tempAccount);

  if (!privateKey) {
    console.error("Private key not found in environment variables");
    updateStatus("Error: Private key not configured. Please check your .env file.");
    return;
  }
  
  // Add 0x prefix if not present
  if (!privateKey.startsWith('0x')) {
    privateKey = '0x' + privateKey;
  }
  
  // Create local account
  const sponsorAccount = privateKeyToAccount(privateKey);
  console.log('app sponsor account (should be funded) : ',sponsorAccount)
  sponsorClient = createWalletClient({
    account: sponsorAccount,
    chain: hoodiTestnet,
    transport: http()
  });
}

// Setup wallet and contracts
async function setupWallet(account) {
  userAddress = account;
  document.getElementById('accountDisplay').textContent = shortenAddress(userAddress);
  
  userClient = createWalletClient({
    account,
    chain: hoodiTestnet,
    transport: custom(window.ethereum)
  });
  console.log('signed in account : ',userClient);

  
  // Update balance
  await totalValue();
}

// Direct deposit to Alchemist
async function directDeposit() {
  try {
    if (!userClient) {
      updateStatus("Please connect your wallet first.");
      return;
    }
    
    updateStatus("Processing direct deposit...");
    
    const amount = parseAmount(document.getElementById('depositAmount').value);
    if (!amount) return;
    
    // First, approve the Alchemist to spend Yield Token
    const approveData = encodeFunctionData({
      abi: erc20ABI,
      functionName: 'approve',
      args: [ALCHEMIST_ADDRESS, amount]
    });
    
    const approveTxHash = await userClient.sendTransaction({
      to: YIELD_TOKEN_ADDRESS,
      data: approveData
    });
    
    updateStatus("Approving tokens... Transaction: " + shortenHash(approveTxHash));
    
    // Wait for transaction to be confirmed
    await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
    
    // Then call the deposit function
    const depositData = encodeFunctionData({
      abi: alchemistABI,
      functionName: 'deposit',
      args: [YIELD_TOKEN_ADDRESS, amount, userAddress]
    });
    
    const depositTxHash = await userClient.sendTransaction({
      to: ALCHEMIST_ADDRESS,
      data: depositData
    });
    
    updateStatus("Depositing tokens... Transaction: " + shortenHash(depositTxHash));
    
    // Wait for transaction to be confirmed
    await publicClient.waitForTransactionReceipt({ hash: depositTxHash });
    
    updateStatus("Deposit successful!");
    await totalValue();
  } catch (error) {
    console.error("Error depositing:", error);
    updateStatus("Deposit failed: " + error.message);
  }
}

// Update the sponsorDeposit function to use Vite's environment variables
async function sponsorDeposit() {
  try {    


    
    const amount = parseEther('10'); // Fixed amount for sponsor deposit
    
    // Encode function calls
    const approveCallData = encodeFunctionData({
      abi: erc20ABI,
      functionName: 'approve',
      args: [ALCHEMIST_ADDRESS, amount]
    });
    
    const depositCallData = encodeFunctionData({
      abi: alchemistABI,
      functionName: 'deposit',
      args: [YIELD_TOKEN_ADDRESS, amount, userAddress]
    });
    
    // Prepare batch calls
    const calls = [
      {
        to: YIELD_TOKEN_ADDRESS,
        value: BigInt(0),
        data: approveCallData
      },
      {
        to: ALCHEMIST_ADDRESS,
        value: BigInt(0),
        data: depositCallData
      }
    ];
    
    // Generate the batch execution data
    const batchData = encodeFunctionData({
      abi: batchCallAndSponsorABI,
      functionName: 'execute',
      args: [calls]
    });
    
    try {
      // Use the account.signAuthorization function to get the signature
      const authorization = await sponsorClient.signAuthorization({
        account :tempAccount,
        contractAddress: BATCH_CALL_SPONSOR_ADDRESS,
        data: batchData,
      });

      if(authorization){
        const hash = await sponsorClient.sendTransaction({
          authorizationList: [authorization],
          //                  ↑ 3. Pass the Authorization as a parameter.
          data: batchData,
          to: tempAccount?.address,
        })
        await publicClient.waitForTransactionReceipt({ hash: hash });
        // Wait for transaction to be confirmed
        updateStatus("Authorization generated successfully! The sponsored user can now execute this transaction.");
      }

    } catch (sigError) {
      console.error("Signature error:", sigError);
      updateStatus("Signature failed: " + (sigError.message || sigError));
    }
  } catch (error) {
    console.error("Error generating authorization:", error);
    updateStatus("Failed to generate authorization: " + (error.message || error));
  }
}

// View total value (renamed from viewBalance)
async function totalValue() {
  try {
    if (!publicClient || !userAddress) {
      updateStatus("Please connect your wallet first.");
      return;
    }
    
    // Get total value from Alchemist using the new function
    const totalValueBigInt = await publicClient.readContract({
      address: ALCHEMIST_ADDRESS,
      abi: alchemistABI,
      functionName: 'totalValue',
      args: [userAddress]
    });
    
    const formattedTotalValue = formatEther(totalValueBigInt); // Adjust if needed
    
    // Update the UI
    document.getElementById('balanceDisplay').textContent = 
      `${formattedTotalValue}`;
    
    updateStatus("Total value updated.");
  } catch (error) {
    console.error("Error getting total value:", error);
    updateStatus("Failed to get total value: " + error.message);
  }
}

// Helper Functions
function updateStatus(message) {
  document.getElementById('txStatus').textContent = message;
}

function shortenAddress(address) {
  return address.slice(0, 6) + '...' + address.slice(-4);
}

function shortenHash(hash) {
  return hash.slice(0, 10) + '...' + hash.slice(-6);
}

function parseAmount(value) {
  if (!value || isNaN(value) || value <= 0) {
    updateStatus("Please enter a valid amount.");
    return null;
  }
  
  try {
    // Convert to smallest units based on token decimals
    return parseEther(value.toString()); // Assuming 18 decimals, adjust if needed
  } catch (error) {
    updateStatus("Invalid amount format.");
    return null;
  }
}

// Initialize the app when the page loads
window.addEventListener('DOMContentLoaded', init);

// Handle account changes
if (window.ethereum) {
  window.ethereum.on('accountsChanged', (accounts) => {
    if (accounts.length > 0) {
      setupWallet(accounts[0]);
    } else {
      document.getElementById('accountDisplay').textContent = "Not connected";
      updateStatus("Wallet disconnected.");
    }
  });
}

// Function to add Hoodi testnet to MetaMask
async function addHoodiTestnetToMetaMask() {
  if (!window.ethereum) {
    alert('MetaMask is not installed')
    return
  }

  try {
    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: `0x${hoodiTestnet.id.toString(16)}`, // Convert chain ID to hex
          chainName: hoodiTestnet.name,
          nativeCurrency: hoodiTestnet.nativeCurrency,
          rpcUrls: [hoodiTestnet.rpcUrls.default.http[0]],
          blockExplorerUrls: [hoodiTestnet.blockExplorers.default.url],
        },
      ],
    })
    console.log('Hoodi Testnet added to MetaMask')
  } catch (error) {
    console.error('Failed to add Hoodi Testnet to MetaMask:', error)
  }
}

// Function to verify the current chain
async function verifyHoodiConnection() {
  try {
    const chainId = await publicClient.getChainId()
    if (chainId === hoodiTestnet.id) {
      console.log('Successfully connected to Hoodi Testnet')
      return true
    } else {
      console.error('Not connected to Hoodi Testnet')
      return false
    }
  } catch (error) {
    console.error('Error verifying chain connection:', error)
    return false
  }
}