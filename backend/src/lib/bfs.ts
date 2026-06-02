import { db, networkNodesTable, usersTable } from "../db";
import { eq } from "drizzle-orm";

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

    const leftChild = node.leftChildId;
    const rightChild = node.rightChildId;

    if (!leftChild) return { parentId: node.id, leg: "left" };
    if (!rightChild) return { parentId: node.id, leg: "right" };

    // Both occupied — enqueue children (preferred leg first)
    if (preferredLeg === "left") {
      queue.push(leftChild);
      queue.push(rightChild);
    } else {
      queue.push(rightChild);
      queue.push(leftChild);
    }
  }

  return null;
}

/**
 * Propagates BV upward from a placed node to all ancestors.
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

    // We also need the user record to update total and residual BV
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, current.userId));

    if (current.leftChildId === childId) {
      await db
        .update(networkNodesTable)
        .set({ leftBv: String(parseFloat(current.leftBv ?? "0") + bvAmount) })
        .where(eq(networkNodesTable.id, currentId));

      if (user) {
        await db
          .update(usersTable)
          .set({ 
            leftBv: String(parseFloat(user.leftBv ?? "0") + bvAmount),
            residualLeftBv: String(parseFloat(user.residualLeftBv ?? "0") + bvAmount)
          })
          .where(eq(usersTable.id, user.id));
      }
    } else if (current.rightChildId === childId) {
      await db
        .update(networkNodesTable)
        .set({ rightBv: String(parseFloat(current.rightBv ?? "0") + bvAmount) })
        .where(eq(networkNodesTable.id, currentId));

      if (user) {
        await db
          .update(usersTable)
          .set({ 
            rightBv: String(parseFloat(user.rightBv ?? "0") + bvAmount),
            residualRightBv: String(parseFloat(user.residualRightBv ?? "0") + bvAmount)
          })
          .where(eq(usersTable.id, user.id));
      }
    }

    childId = currentId;
    currentId = current.parentId;
  }
}

/**
 * Returns an ordered list of ancestor userIds (nearest first) for a given node.
 * Used to check binary cycles after BV propagation.
 */
export async function getAncestorUserIds(nodeId: number): Promise<number[]> {
  const [startNode] = await db
    .select()
    .from(networkNodesTable)
    .where(eq(networkNodesTable.id, nodeId));
  if (!startNode) return [];

  const ancestors: number[] = [];
  let currentId: number | null = startNode.parentId;

  while (currentId !== null && currentId !== undefined) {
    const [current] = await db
      .select()
      .from(networkNodesTable)
      .where(eq(networkNodesTable.id, currentId));
    if (!current) break;
    ancestors.push(current.userId);
    currentId = current.parentId;
  }

  return ancestors;
}
