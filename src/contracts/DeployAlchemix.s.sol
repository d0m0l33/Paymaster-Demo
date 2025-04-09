// SPDX-License-Identifier: MIT
pragma solidity >=0.8.13 <0.9.0;

import {Script, console2} from "forge-std/Script.sol";
import "../../lib/openzeppelin-contracts/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {AlchemistV2} from "..s/AlchemistV2.sol";
import {AlchemicTokenV2} from "../AlchemicTokenV2.sol";
import {TransmuterV2} from "../TransmuterV2.sol";
import {TransmuterBuffer} from "../TransmuterBuffer.sol";
import {Whitelist} from "../utils/Whitelist.sol";
import {TestERC20} from "../test/mocks/TestERC20.sol";
import {TestYieldToken} from "../test/mocks/TestYieldToken.sol";
import {TestYieldTokenAdapter} from "../test/mocks/TestYieldTokenAdapter.sol";
import {IAlchemistV2AdminActions} from "../interfaces/alchemist/IAlchemistV2AdminActions.sol";
import {SafeERC20} from "../libraries/SafeERC20.sol";
import {ProxyAdmin} from "../../lib/openzeppelin-contracts/contracts/proxy/transparent/ProxyAdmin.sol";

contract DeployAlchemixV2Hoodi is Script {
    // Alchemist contracts
    AlchemistV2 public alchemist;
    TransmuterV2 public transmuter;
    TransmuterBuffer public transmuterBuffer;

    // Proxy contracts
    TransparentUpgradeableProxy public proxyAlchemist;
    TransparentUpgradeableProxy public proxyTransmuter;
    TransparentUpgradeableProxy public proxyTransmuterBuffer;

    // Contract components
    AlchemistV2 public alchemistLogic;
    TransmuterV2 public transmuterLogic;
    TransmuterBuffer public transmuterBufferLogic;
    AlchemicTokenV2 public alToken;
    TestYieldTokenAdapter public tokenAdapter;
    Whitelist public whitelist;

    // Token addresses
    address public fakeUnderlyingToken;
    address public fakeYieldToken;

    // Parameters for AlchemicTokenV2
    string public _name = "Alchemix USD";
    string public _symbol = "alUSD";
    uint256 public _flashFee = 1e16; // 0.01 or 1% flash fee
    address public alOwner;
    
    // Target accounts to fund
    address public targetAccount = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
    address public sponsorAccount = 0x95348aB9cd98a89CeC12Ab9B281eAFFE10d01Bbe;

    ProxyAdmin public proxyAdmin;

    function run() public {
        // Use the private key from environment for deployment
        // uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        // alOwner = vm.addr(deployerPrivateKey);

        proxyAdmin = new ProxyAdmin();
        console2.log("Deployed ProxyAdmin at:", address(proxyAdmin));

        alOwner = address(0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266);
        uint256 deployerPrivateKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80; // First Anvil test account

        console2.log("Deploying Alchemix V2 contracts to Hoodi testnet...");
        console2.log("Generated deployer account:");
        console2.log("Private Key:", vm.toString(deployerPrivateKey));
        console2.log("alOwner Address:", alOwner);
        console2.log("Target Account Address:", targetAccount);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy fake tokens for testing
        TestERC20 testToken = new TestERC20(0, 18);
        fakeUnderlyingToken = address(testToken);
        console2.log("Deployed test underlying token at:", fakeUnderlyingToken);

        TestYieldToken testYieldToken = new TestYieldToken(fakeUnderlyingToken);
        fakeYieldToken = address(testYieldToken);
        console2.log("Deployed test yield token at:", fakeYieldToken);

        // Deploy core contracts
        alToken = new AlchemicTokenV2(_name, _symbol, _flashFee);
        console2.log("Deployed AlchemicToken at:", address(alToken));

        tokenAdapter = new TestYieldTokenAdapter(fakeYieldToken);
        console2.log("Deployed TokenAdapter at:", address(tokenAdapter));

        transmuterBufferLogic = new TransmuterBuffer();
        console2.log("Deployed TransmuterBuffer Logic at:", address(transmuterBufferLogic));

        transmuterLogic = new TransmuterV2();
        console2.log("Deployed TransmuterV2 Logic at:", address(transmuterLogic));

        alchemistLogic = new AlchemistV2();
        console2.log("Deployed AlchemistV2 Logic at:", address(alchemistLogic));

        whitelist = new Whitelist();
        console2.log("Deployed Whitelist at:", address(whitelist));

        // Deploy and initialize proxies
        // TransmuterBuffer proxy
        bytes memory transBufParams = abi.encodeWithSelector(
            TransmuterBuffer.initialize.selector, 
            alOwner, 
            address(alToken)
        );

        proxyTransmuterBuffer = new TransparentUpgradeableProxy(
            address(transmuterBufferLogic), 
            address(proxyAdmin), 
            transBufParams
        );
        console2.log("Deployed TransmuterBuffer Proxy at:", address(proxyTransmuterBuffer));

        transmuterBuffer = TransmuterBuffer(address(proxyTransmuterBuffer));

        // TransmuterV2 proxy
        bytes memory transParams = abi.encodeWithSelector(
            TransmuterV2.initialize.selector, 
            address(alToken), 
            fakeUnderlyingToken, 
            address(transmuterBuffer), 
            whitelist
        );

        proxyTransmuter = new TransparentUpgradeableProxy(
            address(transmuterLogic), 
            address(proxyAdmin), 
            transParams
        );
        console2.log("Deployed TransmuterV2 Proxy at:", address(proxyTransmuter));
        
        transmuter = TransmuterV2(address(proxyTransmuter));

        // AlchemistV2 proxy
        IAlchemistV2AdminActions.InitializationParams memory params = IAlchemistV2AdminActions.InitializationParams({
            admin: address(alOwner),
            debtToken: address(alToken),
            transmuter: address(transmuterBuffer),
            minimumCollateralization: 2 * 1e18,
            protocolFee: 1000,
            protocolFeeReceiver: address(alOwner), // Setting owner as fee receiver
            mintingLimitMinimum: 1,
            mintingLimitMaximum: uint256(type(uint160).max),
            mintingLimitBlocks: 300,
            whitelist: address(whitelist)
        });

        bytes memory alchemParams = abi.encodeWithSelector(AlchemistV2.initialize.selector, params);
        proxyAlchemist = new TransparentUpgradeableProxy(
            address(alchemistLogic), 
            address(proxyAdmin), 
            alchemParams
        );
        console2.log("Deployed AlchemistV2 Proxy at:", address(proxyAlchemist));
        
        alchemist = AlchemistV2(address(proxyAlchemist));

        // Configure the system
        console2.log("Configuring the system...");

        // Whitelist alchemist proxy for minting tokens
        alToken.setWhitelist(address(proxyAlchemist), true);

        // Create token adapter configs for both yield and underlying tokens
        IAlchemistV2AdminActions.UnderlyingTokenConfig memory underlyingTokenConfig = IAlchemistV2AdminActions.UnderlyingTokenConfig({
            repayLimitMinimum: 1,
            repayLimitMaximum: 1000,
            repayLimitBlocks: 10,
            liquidationLimitMinimum: 1,
            liquidationLimitMaximum: 1000,
            liquidationLimitBlocks: 7200
        });

        alchemist.addUnderlyingToken(address(fakeUnderlyingToken), underlyingTokenConfig);

        IAlchemistV2AdminActions.YieldTokenConfig memory yieldTokenConfig = IAlchemistV2AdminActions.YieldTokenConfig({
            adapter: address(tokenAdapter), 
            maximumLoss: 1, 
            maximumExpectedValue: 1e50, 
            creditUnlockBlocks: 1
        });

        alchemist.addYieldToken(address(fakeYieldToken), yieldTokenConfig);

        // Enable token adapters
        alchemist.setYieldTokenEnabled(address(fakeYieldToken), true);
        alchemist.setUnderlyingTokenEnabled(address(fakeUnderlyingToken), true);

        // Setup transmuter connections
        transmuterBuffer.setAlchemist(address(proxyAlchemist));
        transmuterBuffer.setTransmuter(fakeUnderlyingToken, address(transmuter));
        
        // Set owner as keeper
        alchemist.setKeeper(alOwner, true);
        
        // Set flow rate for transmuter buffer
        transmuterBuffer.setFlowRate(fakeUnderlyingToken, 325e18);

        console2.log("Initialization complete!");
        console2.log("Minting test tokens to deployer and target account...");

        // Mint some test tokens to the deployer
        TestERC20(fakeUnderlyingToken).mint(alOwner, 10_000_000e18);
        // Seed the system with initial funds
        SafeERC20.safeApprove(address(fakeUnderlyingToken), address(fakeYieldToken), 1_000_000e18);
        TestYieldToken(fakeYieldToken).mint(1_000_000e18, alOwner);

        
        // Mint 100,000 units of fakeUnderlyingToken to the target account
        uint256 targetAmount = 100_000 * 10**18; // 100,000 tokens with 18 decimals
        TestERC20(fakeUnderlyingToken).mint(targetAccount, targetAmount);
        TestERC20(fakeUnderlyingToken).mint(sponsorAccount, targetAmount);
        console2.log("Minted", targetAmount, "underlying tokens to", targetAccount);
        
        // Now transfer the yield tokens to the target account
        uint256 yieldBalance = TestYieldToken(fakeYieldToken).balanceOf(alOwner);
        console2.log("AlOwner Yield Balance", yieldBalance);

        // Transfer 100,000 units of fakeYieldToken to the target account
        SafeERC20.safeTransfer(address(fakeYieldToken), targetAccount, targetAmount);
        console2.log("Transferred", targetAmount, "yield tokens to", targetAccount);
        console2.log("Deployment completed successfully!");

        vm.stopBroadcast();
    }
}