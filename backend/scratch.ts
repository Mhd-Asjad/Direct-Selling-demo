import { db } from "./src/db/index.js";
import { networkNodesTable } from "./src/db/schema/network.js";

async function main() {
  const allNodes = await db.select().from(networkNodesTable);
  const nodeMap = new Map(allNodes.map(n => [n.id, n]));
  
  let hasCycle = false;
  for (const startNode of allNodes) {
    const visited = new Set<number>();
    let currentId: number | null | undefined = startNode.parentId;
    while (currentId) {
      if (visited.has(currentId)) {
        console.log("CYCLE DETECTED IN PARENT CHAIN AT NODE", currentId, "STARTING FROM", startNode.id);
        hasCycle = true;
        break;
      }
      visited.add(currentId);
      const n = nodeMap.get(currentId);
      currentId = n?.parentId;
    }
  }
  console.log("Has parent cycle?", hasCycle);
  process.exit(0);
}
main().catch(console.error);
