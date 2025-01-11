# NoirepTech EVM game

This repo contains the smart contract code for NoirepTech's EVM game. This game allows players to select a unique point on an axis and win rewards if their pick is within the randomly generated radius. This randomly generated position must be provably random.

## Getting started

Install the dependencies with `npm i` & run the tests via `npx hardhat test`.

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

`CREP.sol` - the ERC20 token used to play the game.
`Game.sol` - the smart contract that contains the logic to play the game.

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
event WhiteListed(address indexed player);
event WinningPositionSet(WinningPosition pos);
event Played(address indexed player, Position pos);
event Claimed(address indexed player);
```

### setWhitelist

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
   <td><code>setWhitelist</code>
   </td>
   <td><code>address[]</code>
   </td>
   <td>An array of player addresses to whitelist
   </td>
  </tr>
</table>

Whitelisted addresses are stored in a mapping, and checked when a player makes a bet.

This function can only be called by an `admin`.

### getIsWhitelisted

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
   <td><code>getIsWhitelisted</code>
   </td>
   <td><code>address</code>
   </td>
   <td>The address of the player to check
   </td>
  </tr>
</table>

Returns `true` if whitelisted, else `false`.

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

This function can only be called by an `admin`.

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
</table>

This function can only be called by a `whitelisted` address during the entry phase. The address must have approved the contract to spend `CREP` and the player must have at least 100 `CREP`.

This function requires that the position is unique, and that a player can only play once.

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
</table>

This function is like enter, except a paymaster covers the gas and provides the signature of the player. This function reverts if the signature recovery does not match a valid player.

### getCurrentPhase

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
   <td><code>getCurrentPhase</code>
   </td>
  </tr>
</table>

Returns the current `Phase`.

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
