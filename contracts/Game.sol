// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "./interfaces/IGame.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// TODO use reverts to save gas
contract Game is IGame {
    address public admin;
    IERC20 crep;
    mapping(address => bool) public whitelisted;
    WinningPosition public winningPos;
    Phase public currentPhase;
    mapping(address => Position) public positions;
    mapping(bytes32 => bool) public posHashes;
    uint playAmount = 100 ether;
    uint winAmount = 200 ether;
    mapping(address => bool) public claimed;

    constructor(address _admin, IERC20 _crepToken) {
        // TODO check 0 address
        // TODO set initial whitelist?
        admin = _admin;
        currentPhase = Phase.ENTRY;
        crep = _crepToken;
    }

    /*
     * @dev see IGame.sol
     */
    function setWhiteList(address[] calldata players) external {
        require(
            msg.sender == admin,
            "Game.sol: only the admin can call this function"
        );
        for (uint i = 0; i < players.length; i++) {
            whitelisted[players[i]] = true;
            emit WhiteListed(players[i]);
        }
    }

    /*
     * @dev see IGame.sol
     */
    function setWinningPosition(WinningPosition calldata pos) external {
        require(
            msg.sender == admin,
            "Game.sol: only the admin can call this function"
        );
        require(
            winningPos.radius == 0,
            "Game.sol: winning position is already set"
        );
        winningPos = pos;
        currentPhase = Phase.CLAIM;
        emit WinningPositionSet(pos);
    }

    /*
     * @dev see IGame.sol
     */
    function getIsPositionUnique(
        Position calldata pos
    ) public view returns (bool) {
        bytes32 hash = keccak256(abi.encodePacked(pos.x, pos.y));
        return !posHashes[hash];
    }

    /*
     * @dev see IGame.sol
     */
    function enter(Position calldata pos) external {
        _enter(pos, msg.sender);
    }

    /*
     * @dev internal function to handle entries
     */
    function _enter(Position calldata pos, address user) internal {
        require(whitelisted[user], "Game.sol: address not whitelisted");
        require(
            positions[user].x == 0,
            "Game.sol: player already has a position"
        );
        require(crep.transferFrom(user, address(this), playAmount));
        require(pos.x <= 100_000, "Game.sol: x out of bounds");
        require(pos.y <= 100_000, "Game.sol: y out of bounds");
        require(getIsPositionUnique(pos), "Game.sol: position not unique");
        // TODO refactor
        bytes32 hash = keccak256(abi.encodePacked(pos.x, pos.y));
        posHashes[hash] = true;
        positions[user] = pos;
        emit Entered(user, pos);
    }

    /*
     * @dev see IGame.sol
     */
    // TODO update docs
    function gaslessEnter(
        Position calldata pos,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        // TODO handle message string changes
        bytes32 messageHash = keccak256(
            abi.encodePacked(pos.x, pos.y, address(this))
        );
        address player = ecrecover(messageHash, v, r, s);
        _enter(pos, player);
    }

    /*
     * @dev see IGame.sol
     */
    function claim(address[] calldata players) external {
        for (uint i = 0; i < players.length; i++) {
            bool won = getIsWinner(players[i]);
            if (won && !claimed[players[i]]) {
                require(crep.transfer(players[i], winAmount));
                claimed[players[i]] = true;
                emit Claimed(players[i]);
            }
        }
    }

    /*
     * @dev see IGame.sol
     */
    function getIsWinner(address player) public view returns (bool) {
        require(
            currentPhase == Phase.CLAIM,
            "Game.sol: winning position has not been set yet"
        );
        Position memory pos = positions[player];
        return
            _isWithinRadius(
                pos.x,
                pos.y,
                winningPos.x,
                winningPos.y,
                winningPos.radius
            );
    }

    /*
     * @dev check whether a player's selection is within the winning range
     * @dev returns true if within the range, else false
     */
    function _isWithinRadius(
        uint256 x1,
        uint256 y1,
        uint256 x2,
        uint256 y2,
        uint256 radius
    ) internal pure returns (bool) {
        uint256 dx = x1 > x2 ? x1 - x2 : x2 - x1;
        uint256 dy = y1 > y2 ? y1 - y2 : y2 - y1;
        return dx * dx + dy * dy <= radius * radius;
    }
}
