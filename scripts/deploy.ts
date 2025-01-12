import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import { whitelist } from "../whitelist/whitelist";
import { getMerkleRootAndProof } from "../whitelist/merkle";

dotenv.config();

async function main() {
  const admin = process.env.ADMIN_ADDRESS!;
  if (!admin) throw new Error("Admin address is not set in the .env file");
  const { root } = getMerkleRootAndProof(whitelist, admin);
  console.log("Deploying contracts...");

  const CREP = await ethers.getContractFactory("CREP");
  const crep = await CREP.deploy();
  const crepAddress = await crep.getAddress();
  console.log(`CREP deployed to: ${crepAddress}`);

  const Game = await ethers.getContractFactory("Game");
  const game = await Game.deploy(admin, crepAddress, root);
  const gameAddress = await game.getAddress();
  console.log(`Game deployed to: ${gameAddress}`);
  console.log("Deployment complete.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
