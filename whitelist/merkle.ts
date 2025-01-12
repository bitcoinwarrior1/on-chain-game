import { MerkleTree } from "merkletreejs";
import keccak256 = require("keccak256");

/**
 * Helper function to create the whitelist and generate Merkle root and proof
 * @param whitelistedAddresses - The addresses to whitelist
 * @param user - The current user
 * @returns The Merkle root (as a string) and the proof for the user
 */
export function getMerkleRootAndProof(
  whitelistedAddresses: string[],
  user: string
): { root: string; proof: string[] } {
  const leaves = whitelistedAddresses.map((addr) => keccak256(addr));
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  const root = tree.getHexRoot();
  const leaf = keccak256(user);
  const proof = tree.getProof(leaf).map((p) => `0x${p.data.toString("hex")}`);

  return { root, proof };
}
