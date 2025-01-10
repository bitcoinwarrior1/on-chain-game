// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

interface IGAME {
    struct WinningPosition {
        uint256 x;
        uint256 y;
        uint256 radius;
    }

    struct Position {
        uint256 x;
        uint256 y;
    }

    enum Phase {
        ENTRY,
        CLAIM
    }

    /*
     * @dev sets the whitelist, only players on the whitelist can participate
     * @param players - an array of approved players
     */
    function setWhiteList(address[] players) external;

    /*
     * @dev checks if a given user is on the whitelist
     * @param player - the address of the player to check
     * @return true if the player is whitelist, else false
     */
    function getIsWhitelisted(address player) external view returns (bool);

    /*
     * @dev sets the winning position and radius
     * @dev can only be called by an admin
     * @dev calling this function ends the entry phase and starts the claim phase
     * @param pos - the winning position
     */
    function setWinningPosition(WinningPosition pos) external;

    /*
     * @dev checks if the position is unique
     * @dev hashes the struct and checks it against a mapping
     * @dev this function is also called by play
     * @param pos - the position to check
     * @return true if unique, else false
     */
    function getIsPositionUnique(Position pos) external returns (bool);

    /*
     * @dev allows the player to set a position
     * @dev costs 100 CREP
     * @dev player must be whitelisted, have the appropriate balance & have set an approval great enough
     * @param pos - the position to set
     */
    function play(Position pos) external;

    /*
     * @dev gets the current phase by checking if a winning position has been set or not
     * @return Phase.ENTRY if a winning position has not been set, else PHASE.CLAIM
     */
    function getCurrentPhase() external returns (Phase);

    /*
     * @dev claim winnings for a particular player
     * @dev player must be within the winning radius
     * @param winners - an array of winning players to claim
     */
    function claim(address[] winners) external;

    /*
     * @dev check if a player is within the winning radius
     * @param player - the address of the player to check
     * @return true if within, else false
     */
    function getIsWinner(address player) external view;
}
