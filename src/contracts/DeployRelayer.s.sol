// SPDX-License-Identifier: MIT
pragma solidity >=0.8.13 <0.9.0;

import {Script} from "../../lib/forge-std/src/Script.sol";
import {console2} from "../../lib/forge-std/src/Test.sol"; 
import {Relayer} from "./Relayer.sol";

contract DeployRelayer is Script {
    // Alchemist contracts
    Relayer public relayer;

    function run() public {
        // Use the private key from environment for deployment
        // uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        uint256 deployerPrivateKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        address deployer = vm.addr(deployerPrivateKey);
        console2.log("Deployer address:", deployer);
        vm.startBroadcast(deployerPrivateKey);
        // Deploy the BatchCallAndSponsor contract
        relayer = new Relayer();
        console2.log("Deployed Relayer at:", address(relayer));
        vm.stopBroadcast();
    }
}