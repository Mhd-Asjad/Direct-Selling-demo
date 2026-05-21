import { db, networkNodesTable } from "@workspace/db";
import { eq, isNull } from "drizzle-orm";

/**
 * BFS Spillover: Finds the first available child slot (left or right)
 * starting from a given root node, searching breadth-first.
 * Returns { parentId, leg } of the first open slot.
 */
export async function bfsPlacement(
  rootNodeId: number,
  preferredLeg: "left" | "right" = "left",
): Promise<{ parentId: number; leg: "left" | "right" } | null> {
  const queue: number[] = [rootNodeId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const [node] = await db
      .select()
      .from(networkNodesTable)
      .where(eq(networkNodesTable.id, currentId));

    if (!node) continue;

    // Check preferred leg first
    const firstLeg = preferredLeg;
    const secondLeg = preferredLeg === "left" ? "right" : "left";

    const leftChild = node.leftChildId;
    const rightChild = node.rightChildId;

    if (!leftChild) return { parentId: node.id, leg: "left" };
    if (!rightChild) return { parentId: node.id, leg: "right" };

    // Both occupied — enqueue children
    queue.push(leftChild);
    queue.push(rightChild);
  }

  return null;
}

/**
 * Propagates BV upward from a placed node to all ancestors.
 * leg: which leg the new volume was added on (relative to each ancestor).
 */
export async function propagateBv(
  nodeId: number,
  bvAmount: number,
): Promise<void> {
  const [startNode] = await db
    .select()
    .from(networkNodesTable)
    .where(eq(networkNodesTable.id, nodeId));
  if (!startNode) return;

  let currentId: number | null = startNode.parentId;
  let childId = nodeId;

  while (currentId !== null && currentId !== undefined) {
    const [current] = await db
      .select()
      .from(networkNodesTable)
      .where(eq(networkNodesTable.id, currentId));
    if (!current) break;

    if (current.leftChildId === childId) {
      // new volume came from left sub-tree
      await db
        .update(networkNodesTable)
        .set({ leftBv: String(parseFloat(current.leftBv ?? "0") + bvAmount) })
        .where(eq(networkNodesTable.id, currentId));
    } else if (current.rightChildId === childId) {
      await db
        .update(networkNodesTable)
        .set({ rightBv: String(parseFloat(current.rightBv ?? "0") + bvAmount) })
        .where(eq(networkNodesTable.id, currentId));
    }

    childId = currentId;
    currentId = current.parentId;
  }
}
