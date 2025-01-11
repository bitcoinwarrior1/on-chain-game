// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "./interfaces/IGAME.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// TODO use reverts to save gas
// TODO add withdraw for excess funds in the pool
contract Game is IGAME {
    address public admin;
    IERC20 crep;
    mapping(address => bool) public whitelisted;
    WinningPosition public winningPos;
    Phase public currentPhase;
    mapping(address => Position) public positions;
    mapping(bytes32 => bool) public posHashes;
    uint playAmount = 100 ether;
    uint winAmount = 200 ether;

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
        return posHashes[hash];
    }

    /*
     * @dev see IGame.sol
     */
    function enter(Position calldata pos) external {
        require(whitelisted[msg.sender], "Game.sol: address not whitelisted");
        require(
            positions[msg.sender].x == 0,
            "Game.sol: player already has a position"
        );
        require(crep.transferFrom(msg.sender, address(this), playAmount));
        require(pos.x <= 100_000, "Game.sol: x out of bounds");
        require(pos.y <= 100_000, "Game.sol: y out of bounds");
        require(getIsPositionUnique(pos), "Game.sol: position not unique");
        positions[msg.sender] = pos;
    }

    /*
     * @dev see IGame.sol
     */
    function gaslessEnter(
        Position calldata pos,
        bytes calldata signature
    ) external {}

    /*
     * @dev see IGame.sol
     */
    function claim(address[] calldata winners) external {}

    /*
     * @dev see IGame.sol
     */
    function getIsWinner(address player) external view {}
}
