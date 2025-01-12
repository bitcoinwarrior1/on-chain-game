# NoirepTech EVM game

This repo contains the smart contract code for NoirepTech's EVM game. This game allows players to select a unique point on an axis and win rewards if their pick is within the randomly generated radius. This randomly generated position must be provably random.

## Getting started

Install the dependencies with `npm i` & run the tests via `npx hardhat test`.

To get code coverage run `npx hardhat coverage`.

## Token

`CREP` is an ERC20 token used in this smart contract to place bets and earn winnings.

## Roles

### Player

A player can pick a position and double their money if their pick is within the chosen radius.

### Admin

An admin is responsible for setting the winning radius.

## Phases

### Entry phase

During the entry phase a player can choose a position on the xy axis. Each pick must be unique and costs 100 `CREP`. Each player can select only one position.

Each player must be whitelisted to play. If they are not on the whitelist, they cannot play.

### Claim phase

During the claim phase players who selected a position within the winning radius can claim their reward of 200 `CREP`. Players who picked a position outside the radius cannot claim.

## Contracts

- `CREP.sol` - the ERC20 token used to play the game. This token is based off OZ's ERC20 implementation.
- `IGame.sol` - The interface for `Game.sol`.
- `Game.sol` - the smart contract that contains the logic to play the game.
- `MerkleProof.sol` - OZ's smart contract to verify merkle proofs.

See https://github.com/OpenZeppelin/openzeppelin-contracts/releases/tag/v5.2.0 for more info (including tests) on the OZ contracts used here.

## Architecture

### Structs

```solidity
struct WinningPosition {
  uint256 x;
  uint256 y;
  uint256 radius;
}
```

```solidity
struct Position {
  uint256 x;
  uint256 y;
}
```

### Enums

```solidity
enum Phase {
  ENTRY,
  CLAIM
}
```

### Events

```solidity
event WinningPositionSet(WinningPosition pos);
event Played(address indexed player, Position pos);
event Claimed(address indexed player);
```

### Error codes

```solidity
error AdminCannotBeZero();
error TokenCannotBeZero();
error MerkleRootCannotBeZero();
error OnlyAdminAllowed();
error WinningPositionAlreadySet();
error NotWhitelisted();
error PositionAlreadySet();
error TransferFailed();
error XOutOfBounds();
error YOutOfBounds();
error PositionNotUnique();
error WinningPositionNotSet();
```

### Whitelist

The whitelist is generated by creating a merkle root and proof, instead of iterating through an array to populate a mapping. This saves a large amount of gas as iterating through 10s of thousands of addresses to populate a mapping is computationally expensive and would need to be broken up into multiple transactions.

A whitelist is generated in advance with the merkle root being hardcoded on deployment. This prevents a malicious user from generating their own proof using a different whitelist.

Players of this game will need to get a generated proof from our API to be able to prove that they are authorised. There is a helper function included in `whitelist/whitelist.ts` that will allow you to create such proofs.

### setWinningPosition

Set the winning position and radius. Calling this function ends the `entry` phase and commences the `claim` phase.

<table>
  <tr>
   <td><strong>Name</strong>
   </td>
   <td><strong>Type</strong>
   </td>
   <td><strong>Description</strong>
   </td>
  </tr>
  <tr>
   <td><code>setWinningPosition</code>
   </td>
   <td><code>WinningPosition</code>
   </td>
   <td>The winning position 
   </td>
  </tr>
</table>

This function can only be called by an `admin`. Positions must be within 100k \* 100k.

### getIsPositionUnique

<table>
  <tr>
   <td><strong>Name</strong>
   </td>
   <td><strong>Type</strong>
   </td>
   <td><strong>Description</strong>
   </td>
  </tr>
  <tr>
   <td><code>getIsPositionUnique</code>
   </td>
   <td><code>Position</code>
   </td>
   <td>The position selected by a player
   </td>
  </tr>
</table>

This function hashes the position and checks it against a mapping. If the position does not exist, it returns `true`, else `false`.

### enter

<table>
  <tr>
   <td><strong>Name</strong>
   </td>
   <td><strong>Type</strong>
   </td>
   <td><strong>Description</strong>
   </td>
  </tr>
  <tr>
   <td><code>enter</code>
   </td>
   <td><code>Position</code>
   </td>
   <td>The position selected by a player
   </td>
  </tr>
<tr>
   <td><code>proof</code>
   </td>
   <td><code>bytes32[]</code>
   </td>
   <td>The merkle proof that the player is included in the whitelist
   </td>
  </tr>
</table>

This function can only be called by a `whitelisted` address during the entry phase. The address must have approved the contract to spend `CREP` and the player must have at least 100 `CREP`.

This function requires that the position is unique, within bounds (100k \* 100k), and that a player can only play once.

### gaslessEnter

<table>
  <tr>
   <td><strong>Name</strong>
   </td>
   <td><strong>Type</strong>
   </td>
   <td><strong>Description</strong>
   </td>
  </tr>
  <tr>
   <td><code>gaslessEnter</code>
   </td>
   <td><code>Position</code>
   </td>
   <td>The position selected by a player
   </td>
    <td><code>signature</code>
    </td>
   <td>The signature of the player
   </td>
  </tr>
<tr>
   <td><code>proof</code>
   </td>
   <td><code>bytes32[]</code>
   </td>
   <td>The merkle proof that the player is included in the whitelist
   </td>
  </tr>
</table>

This function is like enter, except a paymaster covers the gas and provides the signature of the player. This function reverts if the signature recovery does not match a valid player. Players must sign a hashed message including the position struct and contract address. An implementation of this can be found in the test suite.

### claim

<table>
  <tr>
   <td><strong>Name</strong>
   </td>
   <td><strong>Type</strong>
   </td>
   <td><strong>Description</strong>
   </td>
  </tr>
  <tr>
   <td><code>Claim</code>
   </td>
    <td><code>address</code>
    </td>
   <td>The address of the player to claim
   </td>
  </tr>
</table>

This function claims the winnings for a selected player. This can only be called during the claim phase and will revert if a players position is not inside the winning radius.

### getIsWinner

<table>
  <tr>
   <td><strong>Name</strong>
   </td>
   <td><strong>Type</strong>
   </td>
   <td><strong>Description</strong>
   </td>
  </tr>
  <tr>
   <td><code>getIsWinner</code>
   </td>
    <td><code>address</code>
    </td>
   <td>The address of the player to check
   </td>
  </tr>
</table>

This function calculates if a player's position is within the winning radius. Must be in the claim phase to call this function.
