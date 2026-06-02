import { Router, type IRouter } from "express";
import { db, networkNodesTable, usersTable } from "../db";
import { eq } from "drizzle-orm";
import { GetNetworkTreeQueryParams, GetUserTreeParams, PlaceNodeBody } from "../api-zod";
import { propagateBv } from "../lib/bfs";

import { appCache } from "../lib/cache";

const router: IRouter = Router();

async function buildTreeNodes(nodeIds: number[]): Promise<any[]> {
  if (nodeIds.length === 0) return [];

  const cacheKey = `network:nodes_users`;
  let cachedDb = appCache.get<{nodes: any[], users: any[]}>(cacheKey);
  
  let nodes, users;
  if (cachedDb) {
    nodes = cachedDb.nodes;
    users = cachedDb.users;
  } else {
    nodes = await db.select().from(networkNodesTable);
    users = await db.select().from(usersTable);
    appCache.set(cacheKey, { nodes, users }, 30 * 1000); // 30 sec cache
  }

  const userMap = new Map(users.map((u) => [u.id, u]));

  return nodes
    .filter((n) => nodeIds.includes(n.id))
    .map((node) => {
      const user = userMap.get(node.userId);
      return {
        id: node.id,
        userId: node.userId,
        firstName: user?.firstName ?? "Unknown",
        lastName: user?.lastName ?? "Unknown",
        status: user?.status ?? "pending",
        packageType: user?.packageType ?? null,
        sponsorId: node.sponsorId ?? null,
        parentId: node.parentId ?? null,
        leg: node.leg ?? null,
        leftChildId: node.leftChildId ?? null,
        rightChildId: node.rightChildId ?? null,
        leftBv: parseFloat(node.leftBv ?? "0"),
        rightBv: parseFloat(node.rightBv ?? "0"),
        depth: node.depth,
      };
    });
}

async function getAllDescendantIds(rootNodeId: number): Promise<number[]> {
  const cacheKey = `network:nodes_users`;
  let cachedDb = appCache.get<{nodes: any[], users: any[]}>(cacheKey);
  let allNodes;
  
  if (cachedDb) {
    allNodes = cachedDb.nodes;
  } else {
    allNodes = await db.select().from(networkNodesTable);
    const users = await db.select().from(usersTable);
    appCache.set(cacheKey, { nodes: allNodes, users }, 30 * 1000);
  }

  const nodeMap = new Map(allNodes.map((n) => [n.id, n]));

  const result: number[] = [];
  const queue: number[] = [rootNodeId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    result.push(currentId);
    const node = nodeMap.get(currentId);
    if (!node) continue;
    if (node.leftChildId) queue.push(node.leftChildId);
    if (node.rightChildId) queue.push(node.rightChildId);
  }

  return result;
}

router.get("/network/tree", async (req, res): Promise<void> => {
  const params = GetNetworkTreeQueryParams.safeParse(req.query);

  const cacheKey = `network:tree:${params.data?.rootUserId ?? 'admin'}`;
  const cachedTree = appCache.get(cacheKey);
  if (cachedTree) {
    res.json(cachedTree);
    return;
  }

  if (params.success && params.data.rootUserId) {
    // Subtree for specific user
    const [rootNode] = await db
      .select()
      .from(networkNodesTable)
      .where(eq(networkNodesTable.userId, params.data.rootUserId));

    if (!rootNode) {
      res.json([]);
      return;
    }

    const ids = await getAllDescendantIds(rootNode.id);
    const result = await buildTreeNodes(ids);
    appCache.set(cacheKey, result, 30 * 1000);
    res.json(result);
    return;
  }

  // Full tree (admin)
  const allNodes = await db.select().from(networkNodesTable);
  const ids = allNodes.map((n) => n.id);
  const result = await buildTreeNodes(ids);
  appCache.set(cacheKey, result, 30 * 1000);
  res.json(result);
});

router.get("/network/tree/:userId", async (req, res): Promise<void> => {
  const params = GetUserTreeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  const cacheKey = `network:tree:${params.data.userId}`;
  const cachedTree = appCache.get(cacheKey);
  if (cachedTree) {
    res.json(cachedTree);
    return;
  }

  const [rootNode] = await db
    .select()
    .from(networkNodesTable)
    .where(eq(networkNodesTable.userId, params.data.userId));

  if (!rootNode) {
    res.json([]);
    return;
  }

  const ids = await getAllDescendantIds(rootNode.id);
  const result = await buildTreeNodes(ids);
  appCache.set(cacheKey, result, 30 * 1000);
  res.json(result);
});

router.post("/network/place", async (req, res): Promise<void> => {
  const body = PlaceNodeBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { userId, newParentId, leg } = body.data;

  // Find the node for this user
  const [nodeToMove] = await db
    .select()
    .from(networkNodesTable)
    .where(eq(networkNodesTable.userId, userId));

  if (!nodeToMove) {
    res.status(404).json({ error: "Node not found for user" });
    return;
  }

  // Find the target parent node
  const [targetParentNode] = await db
    .select()
    .from(networkNodesTable)
    .where(eq(networkNodesTable.id, newParentId));

  if (!targetParentNode) {
    res.status(404).json({ error: "Target parent node not found" });
    return;
  }

  // Check target slot is free
  if (leg === "left" && targetParentNode.leftChildId) {
    res.status(400).json({ error: "Left slot already occupied" });
    return;
  }
  if (leg === "right" && targetParentNode.rightChildId) {
    res.status(400).json({ error: "Right slot already occupied" });
    return;
  }

  // Remove from old parent
  if (nodeToMove.parentId) {
    const [oldParent] = await db
      .select()
      .from(networkNodesTable)
      .where(eq(networkNodesTable.id, nodeToMove.parentId));

    if (oldParent) {
      if (oldParent.leftChildId === nodeToMove.id) {
        await db
          .update(networkNodesTable)
          .set({ leftChildId: null })
          .where(eq(networkNodesTable.id, oldParent.id));
      } else if (oldParent.rightChildId === nodeToMove.id) {
        await db
          .update(networkNodesTable)
          .set({ rightChildId: null })
          .where(eq(networkNodesTable.id, oldParent.id));
      }
    }
  }

  // Attach to new parent
  if (leg === "left") {
    await db
      .update(networkNodesTable)
      .set({ leftChildId: nodeToMove.id })
      .where(eq(networkNodesTable.id, targetParentNode.id));
  } else {
    await db
      .update(networkNodesTable)
      .set({ rightChildId: nodeToMove.id })
      .where(eq(networkNodesTable.id, targetParentNode.id));
  }

  // Update the moved node
  const newDepth = (targetParentNode.depth ?? 0) + 1;
  const [updated] = await db
    .update(networkNodesTable)
    .set({ parentId: newParentId, leg, depth: newDepth })
    .where(eq(networkNodesTable.id, nodeToMove.id))
    .returning();

  const user = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, updated.userId))
    .then((r) => r[0]);

  res.json({
    id: updated.id,
    userId: updated.userId,
    firstName: user?.firstName ?? "Unknown",
    lastName: user?.lastName ?? "Unknown",
    status: user?.status ?? "pending",
    packageType: user?.packageType ?? null,
    sponsorId: updated.sponsorId ?? null,
    parentId: updated.parentId ?? null,
    leg: updated.leg ?? null,
    leftChildId: updated.leftChildId ?? null,
    rightChildId: updated.rightChildId ?? null,
    leftBv: parseFloat(updated.leftBv ?? "0"),
    rightBv: parseFloat(updated.rightBv ?? "0"),
    depth: updated.depth,
  });
});

router.get("/network/stats", async (_req, res): Promise<void> => {
  const nodes = await db.select().from(networkNodesTable);
  const users = await db.select().from(usersTable);

  const activeNodes = users.filter((u) => u.status === "active").length;
  const pendingNodes = users.filter((u) => u.status === "pending").length;

  const totalLeftBv = nodes.reduce((sum, n) => sum + parseFloat(n.leftBv ?? "0"), 0);
  const totalRightBv = nodes.reduce((sum, n) => sum + parseFloat(n.rightBv ?? "0"), 0);

  res.json({
    totalNodes: nodes.length,
    activeNodes,
    pendingNodes,
    totalLeftBv,
    totalRightBv,
  });
});

export default router;
