// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "./interfaces/IGame.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract Game is IGame {
    address public admin;
    IERC20 immutable crep;
    bytes32 public immutable merkleRootWhitelist;
    WinningPosition public winningPos;
    Phase public currentPhase;
    mapping(address => Position) public positions;
    mapping(bytes32 => bool) public posHashes;
    uint public immutable playAmount = 100 ether;
    uint public immutable winAmount = 200 ether;
    mapping(address => bool) public claimed;

    constructor(address _admin, IERC20 _crepToken, bytes32 _merkleRoot) {
        if (_admin == address(0)) revert AdminCannotBeZero();
        if (_merkleRoot == bytes32(0)) revert MerkleRootCannotBeZero();
        if (_crepToken == IERC20(address(0))) revert TokenCannotBeZero();
        admin = _admin;
        currentPhase = Phase.ENTRY;
        crep = _crepToken;
        merkleRootWhitelist = _merkleRoot;
    }

    /*
     * @dev see IGame.sol
     */
    function setWinningPosition(WinningPosition calldata pos) external {
        if (msg.sender != admin) revert OnlyAdminAllowed();
        if (winningPos.radius != 0) revert WinningPositionAlreadySet();
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
    function enter(Position calldata pos, bytes32[] calldata proof) external {
        _enter(pos, msg.sender, proof);
    }

    /*
     * @dev internal function to handle entries
     */
    function _enter(
        Position calldata pos,
        address user,
        bytes32[] calldata proof
    ) internal {
        if (currentPhase != Phase.ENTRY) revert IncorrectPhase();
        if (
            !MerkleProof.verify(
                proof,
                merkleRootWhitelist,
                keccak256(abi.encodePacked(user))
            )
        ) revert NotWhitelisted();
        if (positions[user].x != 0 && positions[user].y != 0)
            revert PositionAlreadySet();
        if (!crep.transferFrom(user, address(this), playAmount))
            revert TransferFailed();
        if (pos.x > 100_000) revert XOutOfBounds();
        if (pos.y > 100_000) revert YOutOfBounds();
        if (!getIsPositionUnique(pos)) revert PositionNotUnique();
        bytes32 hash = keccak256(abi.encodePacked(pos.x, pos.y));
        posHashes[hash] = true;
        positions[user] = pos;
        emit Entered(user, pos);
    }

    /*
     * @dev see IGame.sol
     */
    function gaslessEnter(
        Position calldata pos,
        uint8 v,
        bytes32 r,
        bytes32 s,
        bytes32[] calldata proof
    ) external {
        bytes32 messageHash = keccak256(
            abi.encodePacked(pos.x, pos.y, address(this))
        );
        address player = _getSignerFromMsgAndSig(messageHash, v, r, s);
        _enter(pos, player, proof);
    }

    /*
     * @dev do signature verification on the message hash with the prefix added
     * @param _hashedMessage - the hashed message
     * @param _v - signature param
     * @param _r - signature param
     * @param _s - signature param
     * @return the ecrecovered address
     */
    function _getSignerFromMsgAndSig(
        bytes32 _hashedMessage,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) internal pure returns (address) {
        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        bytes32 prefixedHashMessage = keccak256(
            abi.encodePacked(prefix, _hashedMessage)
        );
        return ecrecover(prefixedHashMessage, _v, _r, _s);
    }

    /*
     * @dev see IGame.sol
     */
    function claim(address[] calldata players) external {
        for (uint i = 0; i < players.length; i++) {
            bool won = getIsWinner(players[i]);
            if (won && !claimed[players[i]]) {
                if (!crep.transfer(players[i], winAmount))
                    revert TransferFailed();
                claimed[players[i]] = true;
                emit Claimed(players[i]);
            }
        }
    }

    /*
     * @dev see IGame.sol
     */
    function getIsWinner(address player) public view returns (bool) {
        if (currentPhase != Phase.CLAIM) revert WinningPositionNotSet();
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
