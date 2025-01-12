import { expect } from "chai";
import { ethers } from "hardhat";
import { Game, CREP, CREP__factory, Game__factory } from "../typechain-types";

describe("Game Contract", function () {
  let game: Game;
  let crepTokenAddress;
  let crepToken: CREP;
  let admin: SignerWithAddress;
  let player1: SignerWithAddress;
  let player2: SignerWithAddress;

  beforeEach(async () => {
    const [deployer, addr1, addr2] = await ethers.getSigners();
    admin = deployer;
    player1 = addr1;
    player2 = addr2;

    crepToken = await new CREP__factory().connect(deployer).deploy();
    crepTokenAddress = await crepToken.getAddress();

    game = await new Game__factory()
      .connect(deployer)
      .deploy(admin, crepTokenAddress);
    const gameAddress = await game.getAddress();

    await crepToken.mint(player1.address, ethers.parseEther("100"));
    await crepToken.mint(player2.address, ethers.parseEther("100"));

    await crepToken
      .connect(player1)
      .approve(gameAddress, ethers.parseEther("100"));
    await crepToken
      .connect(player2)
      .approve(gameAddress, ethers.parseEther("100"));
  });

  it("should allow the admin to set the whitelist", async () => {
    await game.setWhiteList([player1.address]);
    expect(await game.whitelisted(player1.address)).to.be.true;
  });

  it("should revert if a non-admin tries to set the whitelist", async () => {
    await expect(
      game.connect(player1).setWhiteList([player1.address])
    ).to.be.revertedWith("Game.sol: only the admin can call this function");
  });

  it("should allow a whitelisted player to enter", async () => {
    await game.setWhiteList([player1.address]);
    const position = { x: 10, y: 20 };
    await game.connect(player1).enter(position);

    const playerPosition = await game.positions(player1.address);
    expect(playerPosition.x).to.equal(position.x);
    expect(playerPosition.y).to.equal(position.y);
  });

  it("should revert if a non-whitelisted player tries to enter", async () => {
    const position = { x: 10, y: 20 };
    await expect(game.connect(player1).enter(position)).to.be.revertedWith(
      "Game.sol: address not whitelisted"
    );
  });

  it("should not allow a player to enter twice", async () => {
    await game.setWhiteList([player1.address]);
    const position = { x: 10, y: 20 };
    await game.connect(player1).enter(position);

    await expect(game.connect(player1).enter(position)).to.be.revertedWith(
      "Game.sol: player already has a position"
    );
  });

  it("should set a winning position only once", async () => {
    const winningPosition = { x: 50, y: 50, radius: 10 };
    await game.setWinningPosition(winningPosition);

    const setWinningPos = await game.winningPos();
    expect(setWinningPos.x).to.equal(winningPosition.x);
    expect(setWinningPos.y).to.equal(winningPosition.y);
    expect(setWinningPos.radius).to.equal(winningPosition.radius);

    await expect(game.setWinningPosition(winningPosition)).to.be.revertedWith(
      "Game.sol: winning position is already set"
    );
  });

  it("should allow players to claim winnings if they are within the radius", async () => {
    await game.setWhiteList([player1.address, player2.address]);

    const position1 = { x: 40, y: 40 };
    const position2 = { x: 80, y: 80 };
    await game.connect(player1).enter(position1);
    await game.connect(player2).enter(position2);

    const winningPosition = { x: 50, y: 50, radius: 20 };
    await game.setWinningPosition(winningPosition);

    const initialBalance = await crepToken.balanceOf(player1.address);
    await game.claim([player1.address, player2.address]);

    const finalBalance = await crepToken.balanceOf(player1.address);
    expect(finalBalance - initialBalance).to.equal(ethers.parseEther("200"));
  });

  it("should not allow claims before the winning position is set", async () => {
    await game.setWhiteList([player1.address]);

    const position = { x: 40, y: 40 };
    await game.connect(player1).enter(position);

    await expect(game.claim([player1.address])).to.be.revertedWith(
      "Game.sol: winning position has not been set yet"
    );
  });

  it("should verify a position is unique", async () => {
    const position1 = { x: 10, y: 10 };
    const position2 = { x: 10, y: 10 };

    await game.setWhiteList([player1.address]);
    await game.connect(player1).enter(position1);

    const isUnique = await game.getIsPositionUnique(position2);
    expect(isUnique).to.be.false;
  });
});
