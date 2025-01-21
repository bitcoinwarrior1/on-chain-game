import { expect } from "chai";
import { ethers } from "hardhat";
import { Game, CREP, CREP__factory, Game__factory } from "../typechain-types";
import { whitelist as whitelistSample } from "../whitelist/whitelist";
import { getMerkleRootAndProof } from "../whitelist/merkle";

describe("Game Contract", function () {
  let game: Game;
  let gameAddress: string;
  let crepTokenAddress: string;
  let crepToken: CREP;
  let admin: SignerWithAddress;
  let player1: SignerWithAddress;
  let player2: SignerWithAddress;
  let unauthorisedPlayer: SignerWithAddress;
  let whitelist: string[] = [];

  beforeEach(async () => {
    const [deployer, addr1, addr2, addr3] = await ethers.getSigners();
    admin = deployer;
    player1 = addr1;
    player2 = addr2;
    unauthorisedPlayer = addr3;

    crepToken = await new CREP__factory().connect(deployer).deploy();
    crepTokenAddress = await crepToken.getAddress();
    whitelist = [
      ...whitelistSample,
      admin.address,
      player1.address,
      player2.address,
    ];

    const { root } = getMerkleRootAndProof(whitelist, admin.address);

    game = await new Game__factory()
      .connect(deployer)
      .deploy(admin, crepTokenAddress, root);
    gameAddress = await game.getAddress();

    await crepToken.mint(player1.address, ethers.parseEther("100"));
    await crepToken.mint(player2.address, ethers.parseEther("100"));

    await crepToken
      .connect(player1)
      .approve(gameAddress, ethers.parseEther("100"));
    await crepToken
      .connect(player2)
      .approve(gameAddress, ethers.parseEther("100"));
  });

  it("should revert if deployed with the admin address set to 0", async () => {
    const { root } = getMerkleRootAndProof(whitelist, admin.address);
    await expect(
      new Game__factory()
        .connect(admin)
        .deploy(ethers.ZeroAddress, crepTokenAddress, root)
    ).to.be.revertedWithCustomError(game, "AdminCannotBeZero");
  });

  it("should revert if deployed with the CREP token address set to 0", async () => {
    const { root } = getMerkleRootAndProof(whitelist, admin.address);
    await expect(
      new Game__factory()
        .connect(admin)
        .deploy(admin.address, ethers.ZeroAddress, root)
    ).to.be.revertedWithCustomError(game, "TokenCannotBeZero");
  });

  it("should revert if deployed with the merkle root set to 0", async () => {
    await expect(
      new Game__factory()
        .connect(admin)
        .deploy(admin.address, crepTokenAddress, ethers.encodeBytes32String(""))
    ).to.be.revertedWithCustomError(game, "MerkleRootCannotBeZero");
  });

  it("should allow a whitelisted player to enter", async () => {
    const { proof } = getMerkleRootAndProof(whitelist, player1.address);
    const position = { x: 10, y: 20 };
    await game.connect(player1).enter(position, proof);

    const playerPosition = await game.positions(player1.address);
    expect(playerPosition.x).to.equal(position.x);
    expect(playerPosition.y).to.equal(position.y);
  });

  it("should revert if either axis is out of bounds", async () => {
    const { proof } = getMerkleRootAndProof(whitelist, player1.address);
    const position = { x: 110_000, y: 20 };
    await expect(
      game.connect(player1).enter(position, proof)
    ).to.be.revertedWithCustomError(game, "XOutOfBounds");
    const position2 = { x: 11, y: 110_000 };
    await expect(
      game.connect(player1).enter(position2, proof)
    ).to.be.revertedWithCustomError(game, "YOutOfBounds");
  });

  it("should revert if an invalid proof is provided", async () => {
    const { proof } = getMerkleRootAndProof([player2.address], player1.address);
    const position = { x: 10, y: 20 };
    await expect(
      game.connect(player1).enter(position, proof)
    ).to.be.revertedWithCustomError(game, "NotWhitelisted");
  });

  it("should allow a player to gaslessly enter with a valid signature", async () => {
    const position = { x: 42, y: 88 };
    const messageHash = ethers.solidityPackedKeccak256(
      ["uint256", "uint256", "address"],
      [position.x, position.y, gameAddress]
    );
    const messageBytes = Uint8Array.from(
      Buffer.from(messageHash.slice(2), "hex")
    );
    const signature = await player1.signMessage(messageBytes);
    const { v, r, s } = ethers.Signature.from(signature);
    const { proof } = getMerkleRootAndProof(whitelist, player1.address);
    await game.connect(admin).gaslessEnter(position, v, r, s, proof);
    const playerPosition = await game.positions(player1.address);
    expect(playerPosition.x).to.equal(position.x);
    expect(playerPosition.y).to.equal(position.y);
  });

  it("should revert if a non-whitelisted player tries to enter", async () => {
    const position = { x: 10, y: 20 };
    const { proof } = getMerkleRootAndProof(
      whitelist,
      unauthorisedPlayer.address
    );
    await expect(
      game.connect(unauthorisedPlayer).enter(position, proof)
    ).to.be.revertedWithCustomError(game, "NotWhitelisted");
  });

  it("should not allow a player to enter twice", async () => {
    const { proof } = getMerkleRootAndProof(whitelist, player1.address);
    const position = { x: 10, y: 20 };
    await game.connect(player1).enter(position, proof);

    await expect(
      game.connect(player1).enter(position, proof)
    ).to.be.revertedWithCustomError(game, "PositionAlreadySet");
  });

  it("should set a winning position only once", async () => {
    const winningPosition = { x: 50, y: 50, radius: 10 };
    await game.setWinningPosition(winningPosition);

    const setWinningPos = await game.winningPos();
    expect(setWinningPos.x).to.equal(winningPosition.x);
    expect(setWinningPos.y).to.equal(winningPosition.y);
    expect(setWinningPos.radius).to.equal(winningPosition.radius);

    await expect(
      game.setWinningPosition(winningPosition)
    ).to.be.revertedWithCustomError(game, "WinningPositionAlreadySet");
  });

  it("should revert if anyone other than the admin tries to set a winning position", async () => {
    const winningPosition = { x: 50, y: 50, radius: 10 };
    await expect(
      game.connect(player2).setWinningPosition(winningPosition)
    ).to.be.revertedWithCustomError(game, "OnlyAdminAllowed");
  });

  it("should not allow claims before the winning position is set", async () => {
    const { proof } = getMerkleRootAndProof(whitelist, player1.address);
    const position = { x: 40, y: 40 };
    await game.connect(player1).enter(position, proof);

    await expect(game.claim([player1.address])).to.be.revertedWithCustomError(
      game,
      "WinningPositionNotSet"
    );
  });

  it("should verify a position is unique", async () => {
    const position1 = { x: 10, y: 10 };
    const position2 = { x: 10, y: 10 };
    const { proof } = getMerkleRootAndProof(whitelist, player1.address);
    await game.connect(player1).enter(position1, proof);
    const isUnique = await game.getIsPositionUnique(position2);
    expect(isUnique).to.be.false;
  });

  it("should revert if a position is not unique", async () => {
    const position = { x: 10, y: 10 };
    const { proof } = getMerkleRootAndProof(whitelist, player1.address);
    await game.connect(player1).enter(position, proof);
    const { proof: proof2 } = getMerkleRootAndProof(whitelist, player2.address);
    await expect(
      game.connect(player2).enter(position, proof2)
    ).to.be.revertedWithCustomError(game, "PositionNotUnique");
  });

  it("should allow players to claim winnings if they are within the radius", async () => {
    const { proof } = getMerkleRootAndProof(whitelist, player1.address);
    const { proof: proof2 } = getMerkleRootAndProof(whitelist, player2.address);
    const position1 = { x: 40, y: 40 };
    const position2 = { x: 80, y: 80 };
    await game.connect(player1).enter(position1, proof);
    await game.connect(player2).enter(position2, proof2);

    const winningPosition = { x: 50, y: 50, radius: 20 };
    await game.setWinningPosition(winningPosition);

    const initialBalance = await crepToken.balanceOf(player1.address);
    const initialBalance2 = await crepToken.balanceOf(player2.address);
    await game.claim([player1.address, player2.address]);
    expect(initialBalance2).to.equal(
      0,
      "player 2 should not have won anything"
    );

    const finalBalance = await crepToken.balanceOf(player1.address);
    expect(finalBalance - initialBalance).to.equal(ethers.parseEther("200"));
  });

  it("should not allow a non player to claim", async () => {
    const winningPosition = { x: 50, y: 50, radius: 20 };
    await game.setWinningPosition(winningPosition);
    const isWinner = await game.getIsWinner(player2.address);
    expect(isWinner).to.equal(false);
  });

  it("should revert if a player tries to enter in the claim phase", async () => {
    const winningPosition = { x: 50, y: 50, radius: 20 };
    await game.setWinningPosition(winningPosition);

    const { proof } = getMerkleRootAndProof(whitelist, player1.address);
    const position1 = { x: 40, y: 40 };
    await expect(
      game.connect(player1).enter(position1, proof)
    ).to.be.revertedWithCustomError(game, "IncorrectPhase");
  });

  it("should revert if a player tries to enter with x and y set to zero", async () => {
    const { proof } = getMerkleRootAndProof(whitelist, player1.address);
    const position1 = { x: 0, y: 0 };
    await expect(
      game.connect(player1).enter(position1, proof)
    ).to.be.revertedWithCustomError(game, "ZeroPosition");
  });

  it("should revert if a winning position has invalid values", async () => {
    const invalidPosition = { x: 0, y: 0, radius: 0 };
    await expect(
      game.setWinningPosition(invalidPosition)
    ).to.be.revertedWithCustomError(game, "ZeroPosition");
    const invalidPosition2 = { x: 111_111, y: 10, radius: 10 };
    await expect(
      game.setWinningPosition(invalidPosition2)
    ).to.be.revertedWithCustomError(game, "XOutOfBounds");
    const invalidPosition3 = { x: 10, y: 111_111, radius: 10 };
    await expect(
      game.setWinningPosition(invalidPosition3)
    ).to.be.revertedWithCustomError(game, "YOutOfBounds");

    const invalidPosition4 = { x: 10, y: 10, radius: 0 };
    await expect(
      game.setWinningPosition(invalidPosition4)
    ).to.be.revertedWithCustomError(game, "ZeroPosition");

    const invalidPosition5 = { x: 0, y: 0, radius: 10 };
    await expect(
      game.setWinningPosition(invalidPosition5)
    ).to.be.revertedWithCustomError(game, "ZeroPosition");
  });
});
