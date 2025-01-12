import { expect } from "chai";
import { ethers } from "hardhat";
import { Game, CREP, CREP__factory, Game__factory } from "../typechain-types";
import { whitelistSample } from "../whitelist/whitelistSample";
import { getMerkleRootAndProof } from "../whitelist/merkle";

describe("Game Contract", function () {
  let game: Game;
  let gameAddress: string;
  let crepTokenAddress;
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

  it("should allow a whitelisted player to enter", async () => {
    const { proof } = getMerkleRootAndProof(whitelist, player1.address);
    const position = { x: 10, y: 20 };
    await game.connect(player1).enter(position, proof);

    const playerPosition = await game.positions(player1.address);
    expect(playerPosition.x).to.equal(position.x);
    expect(playerPosition.y).to.equal(position.y);
  });

  it("should revert if an invalid proof is provided, even if the user is on the whitelist", async () => {
    const { proof } = getMerkleRootAndProof([player2.address], player1.address);
    const position = { x: 10, y: 20 };
    await expect(
      game.connect(player1).enter(position, proof)
    ).to.be.revertedWith("Game.sol: address not whitelisted");
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
    ).to.be.revertedWith("Game.sol: address not whitelisted");
  });

  it("should not allow a player to enter twice", async () => {
    const { proof } = getMerkleRootAndProof(whitelist, player1.address);
    const position = { x: 10, y: 20 };
    await game.connect(player1).enter(position, proof);

    await expect(
      game.connect(player1).enter(position, proof)
    ).to.be.revertedWith("Game.sol: player already has a position");
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
    const { proof } = getMerkleRootAndProof(whitelist, player1.address);
    const { proof: proof2 } = getMerkleRootAndProof(whitelist, player2.address);
    const position1 = { x: 40, y: 40 };
    const position2 = { x: 80, y: 80 };
    await game.connect(player1).enter(position1, proof);
    await game.connect(player2).enter(position2, proof2);

    const winningPosition = { x: 50, y: 50, radius: 20 };
    await game.setWinningPosition(winningPosition);

    const initialBalance = await crepToken.balanceOf(player1.address);
    await game.claim([player1.address, player2.address]);

    const finalBalance = await crepToken.balanceOf(player1.address);
    expect(finalBalance - initialBalance).to.equal(ethers.parseEther("200"));
  });

  it("should not allow claims before the winning position is set", async () => {
    const { proof } = getMerkleRootAndProof(whitelist, player1.address);
    const position = { x: 40, y: 40 };
    await game.connect(player1).enter(position, proof);

    await expect(game.claim([player1.address])).to.be.revertedWith(
      "Game.sol: winning position has not been set yet"
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
});
