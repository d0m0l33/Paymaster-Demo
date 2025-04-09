// SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.13 <0.9.0;

contract Relayer {
  event RelayerLog(string indexed message);
  event CallExecuted(address indexed caller, address indexed target, uint256 value, bytes data);
  event BatchExecuted(uint256 nonce, Call[] calls);

  /// @notice A nonce used for replay protection.
  uint256 public nonce;

  /// @notice Represents a single call within a batch.
  struct Call {
        address to;
        uint256 value;
        bytes data;
    }

 
  function initialize() external payable {
    emit RelayerLog('Hello, world!');
  }
 
  function ping() external  {
    emit RelayerLog('Pong!');
  }

/**
    * @notice Executes a batch of calls directly.
    * @param calls An array of Call structs containing destination, ETH value, and calldata.
    */
  function execute(Call[] calldata calls) external payable {
      _executeBatch(calls);
  }

  /**
    * @dev Internal function that handles batch execution and nonce incrementation.
    * @param calls An array of Call structs.
    */
  function _executeBatch(Call[] calldata calls) internal {
      uint256 currentNonce = nonce;
      nonce++; // Increment nonce to protect against replay attacks
      for (uint256 i = 0; i < calls.length; i++) {
          _executeCall(calls[i]);
      }
      emit BatchExecuted(currentNonce, calls);
  }

  /**
    * @dev Internal function to execute a single call.
    * @param callItem The Call struct containing destination, value, and calldata.
    */
  function _executeCall(Call calldata callItem) internal {  
      (bool success,) = callItem.to.call{value: callItem.value}(callItem.data);
      require(success, "Call reverted");
      emit CallExecuted(msg.sender, callItem.to, callItem.value, callItem.data);
  }
}