import Layout from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useGetUserTree, getGetUserTreeQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import { Network, Users, ChevronDown, ChevronUp, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface TreeNodeData {
  id: number;
  userId: number;
  firstName: string;
  lastName: string;
  status: string;
  packageType?: string | null;
  parentId?: number | null;
  leg?: string | null;
  leftChildId?: number | null;
  rightChildId?: number | null;
  leftBv: number;
  rightBv: number;
  depth: number;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      "text-xs px-1.5 py-0.5 rounded font-medium",
      status === "active" ? "bg-accent/20 text-accent" :
      status === "pending" ? "bg-yellow-500/20 text-yellow-500" :
      "bg-destructive/20 text-destructive"
    )}>
      {status}
    </span>
  );
}

function TreeNodeCard({ node, allNodes, depth = 0 }: { node: TreeNodeData; allNodes: TreeNodeData[]; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);

  const leftChild = node.leftChildId ? allNodes.find((n) => n.id === node.leftChildId) : null;
  const rightChild = node.rightChildId ? allNodes.find((n) => n.id === node.rightChildId) : null;
  const hasChildren = leftChild || rightChild;

  return (
    <div className="flex flex-col items-center">
      {/* Node card */}
      <div
        className={cn(
          "relative bg-card border rounded-xl p-3 min-w-[140px] max-w-[160px] text-center transition-all hover:border-primary/40 cursor-pointer",
          node.status === "active" ? "border-card-border hover:shadow-md" :
          node.status === "pending" ? "border-yellow-500/30" : "border-destructive/30 opacity-60"
        )}
        data-testid={`node-user-${node.userId}`}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {/* Avatar */}
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold mx-auto mb-2",
          node.status === "active" ? "bg-primary/20 text-primary" :
          node.status === "pending" ? "bg-yellow-500/20 text-yellow-500" :
          "bg-secondary text-muted-foreground"
        )}>
          {node.firstName.charAt(0)}{node.lastName.charAt(0)}
        </div>

        <p className="text-xs font-semibold text-foreground leading-tight truncate">
          {node.firstName} {node.lastName}
        </p>
        <StatusBadge status={node.status} />

        {node.packageType && (
          <p className="text-xs text-muted-foreground mt-1 capitalize">{node.packageType}</p>
        )}

        <div className="flex gap-2 justify-center mt-2">
          <div className="text-center">
            <p className="text-xs font-bold text-primary">{node.leftBv.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">L BV</p>
          </div>
          <div className="w-px bg-border" />
          <div className="text-center">
            <p className="text-xs font-bold text-accent">{node.rightBv.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">R BV</p>
          </div>
        </div>

        {hasChildren && (
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-secondary border border-border flex items-center justify-center">
            {expanded
              ? <ChevronUp className="w-3 h-3 text-muted-foreground" />
              : <ChevronDown className="w-3 h-3 text-muted-foreground" />
            }
          </div>
        )}
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div className="mt-6 flex gap-6 relative">
          {/* Connector lines */}
          <div className="absolute top-0 left-1/2 w-px h-3 bg-border -translate-x-1/2 -translate-y-3" />

          {leftChild && (
            <div className="flex flex-col items-center relative">
              <div className="absolute top-0 right-1/2 h-px bg-border" style={{ width: "50%" }} />
              <div className="flex items-center gap-1 mb-2">
                <span className="text-xs text-primary font-medium">LEFT</span>
              </div>
              <TreeNodeCard node={leftChild} allNodes={allNodes} depth={depth + 1} />
            </div>
          )}

          {!leftChild && (
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1 mb-2">
                <span className="text-xs text-muted-foreground">LEFT</span>
              </div>
              <div className="w-[140px] h-[120px] border-2 border-dashed border-border/50 rounded-xl flex items-center justify-center">
                <p className="text-xs text-muted-foreground/50">Empty slot</p>
              </div>
            </div>
          )}

          {rightChild && (
            <div className="flex flex-col items-center relative">
              <div className="absolute top-0 left-1/2 h-px bg-border" style={{ width: "50%" }} />
              <div className="flex items-center gap-1 mb-2">
                <span className="text-xs text-accent font-medium">RIGHT</span>
              </div>
              <TreeNodeCard node={rightChild} allNodes={allNodes} depth={depth + 1} />
            </div>
          )}

          {!rightChild && (
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1 mb-2">
                <span className="text-xs text-muted-foreground">RIGHT</span>
              </div>
              <div className="w-[140px] h-[120px] border-2 border-dashed border-border/50 rounded-xl flex items-center justify-center">
                <p className="text-xs text-muted-foreground/50">Empty slot</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function NetworkPage() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();

  const { data: treeNodes, isLoading } = useGetUserTree(
    user?.id ?? 0,
    { query: { queryKey: getGetUserTreeQueryKey(user?.id ?? 0), enabled: !!user?.id } },
  );

  useEffect(() => {
    if (!authLoading && !user) setLocation("/login");
  }, [authLoading, user, setLocation]);

  const rootNode = treeNodes?.find((n) => n.userId === user?.id);
  const totalActive = treeNodes?.filter((n) => n.status === "active").length ?? 0;
  const totalPending = treeNodes?.filter((n) => n.status === "pending").length ?? 0;

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Binary Network</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Your downline tree structure</p>
          </div>
          <div className="flex gap-3">
            <div className="text-center px-4 py-2 bg-card border border-card-border rounded-lg">
              <p className="text-lg font-bold text-foreground">{totalActive}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
            <div className="text-center px-4 py-2 bg-card border border-card-border rounded-lg">
              <p className="text-lg font-bold text-foreground">{totalPending}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
            <div className="text-center px-4 py-2 bg-card border border-card-border rounded-lg">
              <p className="text-lg font-bold text-foreground">{(treeNodes?.length ?? 1) - 1}</p>
              <p className="text-xs text-muted-foreground">Downline</p>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-4 py-2.5 bg-card border border-card-border rounded-lg text-xs">
          <Info className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-accent inline-block" /> Active</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" /> Pending</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-destructive inline-block" /> Suspended</span>
            <span className="text-muted-foreground">Click a node to expand/collapse its children</span>
          </div>
        </div>

        {/* Tree */}
        <div className="bg-card border border-card-border rounded-xl p-6 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : !rootNode ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <Network className="w-10 h-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No network tree yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Start recruiting to build your downline</p>
            </div>
          ) : (
            <div className="flex justify-center overflow-x-auto pb-4">
              <TreeNodeCard node={rootNode} allNodes={treeNodes ?? []} depth={0} />
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
