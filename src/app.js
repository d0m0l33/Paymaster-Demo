import {
  createWalletClient,
  createPublicClient,
  http,
  custom,
  parseEther,
  formatEther,
  encodeFunctionData,

} from 'viem';
import { mainnet } from 'viem/chains';
import { defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import erc20Json from './contracts/ERC20.json';
import alchemistJson from './contracts/alchemist.json';
import relayerJson from './contracts/relayer.json';


// Global variables
let sponsorClient; // local account constructed from a private key, can be used to sign transactions and messages
let userClient; // signed in JSON-RPC account
let userAddress; // signed in JSON-RPC address


// Define the Hoodi public/local testnet
// change default to public url if you want to use the public testnet
// by uncommenting the default: {http: ['/api'], webSocket: ['wss://ws.testnet.hoodi.xyz'],} line
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
    local: {
      http: ['http://localhost:8545'], // Use the proxied path
      webSocket: ['ws://localhost:8546'], // Replace if available
    },
     default: {
      http: ['/api'], // the proxied path
     // http: ['http://localhost:8545'], // swap with proxy path for public testne
      webSocket: ['ws://localhost:8546'], // Replace if available
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
  transport: http()
})

// contract addresses
const ALCHEMIST_ADDRESS = '0x7b5Ecee7cB983F0156C17D6b25fED0c69C70571a'; // ALCHEMIST address for testing
const YIELD_TOKEN_ADDRESS = '0xD6b6c4CcE8177051d29d9f436a7262c60541E822'; // YIELD token for testing 
const RELAYER_ADDRESS = '0xB39FCe240fb2855E390C0fCEa4c41938331F5694' // Relayer address for testing
const erc20ABI = erc20Json.abi;
const alchemistABI = alchemistJson.abi;
const relayerABI = relayerJson.abi;

// Initialize the app
async function init() {
  verifyHoodiConnection();
  updateHeaderAddresses();

  setupSponsorWallet();
  // Setup event listeners
  document.getElementById('connectWallet').addEventListener('click', connectWallet);
  document.getElementById('deposit').addEventListener('click', directDeposit);
  document.getElementById('viewBalance').addEventListener('click', totalValue);
  document.getElementById('relayerDeposit').addEventListener('click', callRelayerDeposit);
  document.getElementById('relayerDepositEIP7702Adjusted').addEventListener('click', callRelayerDepositEIP7702Adjusted);
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

// Setup sponsor wallet
async function setupSponsorWallet() {
  // Get private key from Vite environment variable
  let privateKey = import.meta.env.VITE_SPONSOR_PRIVATE_KEY;

  // viem signer account and authorized accounts can only be local accounts and not JSON-RPC accounts (like metamask) 
  // A Local Account performs signing of transactions & messages with a private key before executing a method over JSON-RPC.
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
  console.log('app sponsor account (should be funded) : ', sponsorAccount)
  sponsorClient = createWalletClient({
    account: sponsorAccount,
    chain: hoodiTestnet,
    transport: http()
  });

  // Variables to store balances
  let sponsorEthBalance, sponsorTokenBalance;

  // Check and log sponsor's ETH balance
  try {
    sponsorEthBalance = await publicClient.getBalance({
      address: sponsorAccount.address
    });
    console.log(`Sponsor account ETH balance: ${formatEther(sponsorEthBalance)} ETH`);
  } catch (error) {
    console.error("Error checking sponsor ETH balance:", error);
  }

  // Check and log sponsor's token balance
  try {
    sponsorTokenBalance = await publicClient.readContract({
      address: YIELD_TOKEN_ADDRESS,
      abi: erc20Json.abi,
      functionName: 'balanceOf',
      args: [sponsorAccount.address]
    });
    console.log(`Sponsor account token balance: ${formatEther(sponsorTokenBalance)} YIELD tokens`);
  } catch (error) {
    console.error("Error checking sponsor token balance:", error);
  }
  
  // Update sponsor information in the UI
  updateSponsorInfo(sponsorAccount.address, sponsorEthBalance, sponsorTokenBalance);
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
  console.log('signed in account : ', userClient);

  // Variables to store balances
  let userEthBalance, userTokenBalance;

  // Check and log user's ETH balance
  try {
    userEthBalance = await publicClient.getBalance({
      address: userAddress
    });
    console.log(`User account ETH balance: ${formatEther(userEthBalance)} ETH`);
  } catch (error) {
    console.error("Error checking user ETH balance:", error);
  }

  // Check and log user's token balance
  try {
    userTokenBalance = await publicClient.readContract({
      address: YIELD_TOKEN_ADDRESS,
      abi: erc20Json.abi,
      functionName: 'balanceOf',
      args: [userAddress]
    });
    console.log(`User account token balance: ${formatEther(userTokenBalance)} YIELD tokens`);
  } catch (error) {
    console.error("Error checking user token balance:", error);
  }
  
  // Update user information in the UI
  updateUserInfo(userEthBalance, userTokenBalance);
  
  // Update shares
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


// Function to call the deposit function on the Relayer contract
async function callRelayerDepositEIP7702Adjusted() {
  try {
    if (!userAddress) {
      updateStatus("Please connect your wallet first.");
      return;
    }
    
    updateStatus("Processing Relayer deposit...");

    // Get amount from input or use default
    const amountInput = document.getElementById('depositAmount').value;
    const amount = amountInput ? parseEther(amountInput) : parseEther('50'); // Default amount

    const approveAmount = amount;

    // Encode function calls for approval and deposit:
    const approveCallData = encodeFunctionData({
      abi: erc20Json.abi,
      functionName: 'approve',
      args: [ALCHEMIST_ADDRESS, approveAmount],
    });
    
    const depositCallData = encodeFunctionData({
      abi: alchemistJson.abi,
      functionName: 'depositEIP7702Adjusted',
      args: [YIELD_TOKEN_ADDRESS, amount, userAddress],
    });
    
    // Prepare the array of calls (each as a tuple: { target, value, data })
    const calls = [
      {
        target: YIELD_TOKEN_ADDRESS,
        value: BigInt(0),
        data: approveCallData,
      },
      {
        target: ALCHEMIST_ADDRESS,
        value: BigInt(0),
        data: depositCallData,
      },
    ];

    // Encode the execute function call with the array of calls
    const executeCallData = encodeFunctionData({
      abi: relayerABI,
      functionName: 'execute',
      args: [calls],
    });
    
    // Create authorization using sponsorClient for the Relayer contract
    const authorization = await sponsorClient.signAuthorization({
      account: sponsorClient.account,
      contractAddress: RELAYER_ADDRESS,
      exectuor: 'self'
    });
    console.log("Authorization generated:", authorization);
    
    // Send transaction to the sponsor account with the Relayer's execute function
    const hash = await sponsorClient.sendTransaction({
      to: sponsorClient.account.address,
      data: executeCallData,
      authorizationList: [authorization],
    });
    
    console.log("Transaction sent:", hash);
    updateStatus("Relayer execute tx: " + shortenHash(hash));
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log("Transaction receipt:", receipt);
    
    // Use the getDecodedLogs function to decode events
    const events = await getDecodedLogs(hash);
    console.log("Transaction events:", events);
    
    updateStatus("Relayer deposit completed successfully!");
    await totalValue();
    
  } catch (error) {
    console.error("Error in relayer deposit:", error);
    updateStatus("Failed to execute relayer deposit: " + (error.message || error));
  }
}

// Function to call the deposit function on the Relayer contract
async function callRelayerDeposit() {
  try {
    if (!userAddress) {
      updateStatus("Please connect your wallet first.");
      return;
    }
    
    updateStatus("Processing Relayer deposit...");

    // Get amount from input or use default
    const amountInput = document.getElementById('depositAmount').value;
    const amount = amountInput ? parseEther(amountInput) : parseEther('50'); // Default amount

    const approveAmount = amount;

    // Encode function calls for approval and deposit:
    const approveCallData = encodeFunctionData({
      abi: erc20Json.abi,
      functionName: 'approve',
      args: [ALCHEMIST_ADDRESS, approveAmount],
    });
    
    const depositCallData = encodeFunctionData({
      abi: alchemistJson.abi,
      functionName: 'deposit',
      args: [YIELD_TOKEN_ADDRESS, amount, userAddress],
    });
    
    // Prepare the array of calls (each as a tuple: { target, value, data })
    const calls = [
      {
        target: YIELD_TOKEN_ADDRESS,
        value: BigInt(0),
        data: approveCallData,
      },
      {
        target: ALCHEMIST_ADDRESS,
        value: BigInt(0),
        data: depositCallData,
      },
    ];

    // Encode the execute function call with the array of calls
    const executeCallData = encodeFunctionData({
      abi: relayerABI,
      functionName: 'execute',
      args: [calls],
    });
    
    // Create authorization using sponsorClient for the Relayer contract
    const authorization = await sponsorClient.signAuthorization({
      account: sponsorClient.account,
      contractAddress: RELAYER_ADDRESS,
      exectuor: 'self'
    });
    console.log("Authorization generated:", authorization);
    
    // Send transaction to the sponsor account with the Relayer's execute function
    const hash = await sponsorClient.sendTransaction({
      to: sponsorClient.account.address,
      data: executeCallData,
      authorizationList: [authorization],
    });
    
    console.log("Transaction sent:", hash);
    updateStatus("Relayer execute tx: " + shortenHash(hash));
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log("Transaction receipt:", receipt);
    
    // Use the getDecodedLogs function to decode events
    const events = await getDecodedLogs(hash);
    console.log("Transaction events:", events);
    
    updateStatus("Relayer deposit completed successfully!");
    await totalValue();
    
  } catch (error) {
    console.error("Error in relayer deposit:", error);
    updateStatus("Failed to execute relayer deposit: " + (error.message || error));
  }
}


// View total value of shares in Alchemist
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

/**
 * Fetches transaction receipt and decodes the event logs
 * @param {string} txHash - Transaction hash
 * @param {Array} abis - Array of ABIs to use for decoding (can include multiple contracts' ABIs)
 * @returns {Array} Decoded events with contract, name, args and raw log data
 */
async function getDecodedLogs(txHash) {
  try {
    // Wait for transaction receipt
    const receipt = await publicClient.waitForTransactionReceipt({ 
      hash: txHash 
    });
    
    console.log("Transaction status:", receipt.status);
    
    if (receipt.status !== 'success') {
      console.error("Transaction failed");
      return [];
    }
    
    // ABIs to use for decoding
    const abis = [erc20Json.abi, alchemistJson.abi];
    
    // Array to store decoded events
    const decodedEvents = [];
    
    // Process each log
    for (const log of receipt.logs) {
      let decoded = null;
      
      // Try each ABI until we find one that can decode the event
      for (const abi of abis) {
        try {
          decoded = decodeEventLog({
            abi,
            data: log.data,
            topics: log.topics,
          });
          
          // Add contract address and raw log info
          decodedEvents.push({
            contract: log.address,
            name: decoded.eventName,
            args: decoded.args,
            rawLog: log
          });
          
          // Successfully decoded this log, move to next
          break;
        } catch (e) {
          // This ABI couldn't decode the log, try next one
          continue;
        }
      }
      
      // If we couldn't decode the log with any ABI
      if (!decoded) {
        decodedEvents.push({
          contract: log.address,
          name: "Unknown",
          args: {},
          rawLog: log
        });
      }
    }
    
    console.log("Decoded events:", decodedEvents);
    return decodedEvents;
  } catch (error) {
    console.error("Error decoding logs:", error);
    return [];
  }
}
// Update sponsor address
function updateSponsorAddress(address) {
  document.getElementById('sponsorAddress').textContent = address ? shortenAddress(address) : '-';
}

// Update sponsor ETH balance
function updateSponsorBalance(balance) {
  document.getElementById('sponsorBalance').textContent = balance ? `${formatEther(balance)} ETH` : '-';
}

// Update sponsor token balance
function updateSponsorTokenBalance(balance) {
  // Get the sponsor's balance display element (note: there seems to be an ID conflict in your HTML)
  // You might want to fix this in the HTML by giving the sponsor token balance a unique ID
  const sponsorBalanceDisplay = document.getElementsByClassName('sponsorInfo')[0].querySelector('#balanceDisplay');
  sponsorBalanceDisplay.textContent = balance ? `${formatEther(balance)}` : '-';
}

// Display all sponsor info together
function updateSponsorInfo(address, ethBalance, tokenBalance) {
  updateSponsorAddress(address);
  updateSponsorBalance(ethBalance);
  updateSponsorTokenBalance(tokenBalance);
}

// Update user ETH balance
function updateUserBalance(balance) {
  // You might need to add this element to your HTML
  const userBalanceElement = document.getElementById('userETHBalanceDisplay');
  if (userBalanceElement) {
    userBalanceElement.textContent = balance ? `${formatEther(balance)} ETH` : '-';
  }
}

// Update user token balance
function updateUserTokenBalance(balance) {
  const userTokenElement = document.getElementById('userYieldBalanceDisplay');
  if (userTokenElement) {
    userTokenElement.textContent = balance ? `${formatEther(balance)} YIELD` : '-';
  }
}

// Display all user info together
function updateUserInfo(ethBalance, tokenBalance) {
  updateUserBalance(ethBalance);
  updateUserTokenBalance(tokenBalance);
}


function updateHeaderAddresses() {
  // Update footer addresses
  document.getElementById('headerAlchemistAddress').textContent = shortenAddress(ALCHEMIST_ADDRESS);
  document.getElementById('headerYieldTokenAddress').textContent = shortenAddress(YIELD_TOKEN_ADDRESS);
  document.getElementById('headerRelayerAddress').textContent = shortenAddress(RELAYER_ADDRESS);
  
  // Add click to copy functionality
  addCopyOnClick('headerAlchemistAddress', ALCHEMIST_ADDRESS);
  addCopyOnClick('headerYieldTokenAddress', YIELD_TOKEN_ADDRESS);
  addCopyOnClick('headerRelayerAddress', RELAYER_ADDRESS);
}

// Helper function to add click-to-copy functionality
function addCopyOnClick(elementId, textToCopy) {
  const element = document.getElementById(elementId);
  if (element) {
    element.style.cursor = 'pointer';
    element.title = 'Click to copy full address';
    element.addEventListener('click', () => {
      navigator.clipboard.writeText(textToCopy)
        .then(() => {
          const originalText = element.textContent;
          element.textContent = 'Copied!';
          setTimeout(() => {
            element.textContent = originalText;
          }, 1000);
        })
        .catch(err => {
          console.error('Could not copy text: ', err);
        });
    });
  }
}


