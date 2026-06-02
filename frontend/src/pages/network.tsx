import Layout from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useGetUserTree, getGetUserTreeQueryKey } from "@/api-client";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import {
  Network,
  Trophy,
  Users,
  ChevronDown,
  ChevronRight,
  Info,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from "lucide-react";
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

// ─── Status dot ────────────────────────────────────────────────────────────
function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-block w-2 h-2 rounded-full flex-shrink-0",
        status === "active" ? "bg-primary" :
        status === "pending" ? "bg-yellow-500" :
        "bg-destructive"
      )}
    />
  );
}

// ─── BV progress mini-bar ─────────────────────────────────────────────────
function BvBar({ value, color }: { value: number; color: "left" | "right" }) {
  const pct = Math.min(100, (value / 3000) * 100);
  return (
    <div className="w-full h-1 rounded-full bg-muted overflow-hidden">
      <div
        className={cn(
          "h-full rounded-full transition-all",
          color === "left" ? "bg-primary" : "bg-accent"
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ─── Empty slot placeholder ────────────────────────────────────────────────
function EmptySlot({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-[120px] h-[100px] border border-dashed border-border/40 rounded-xl flex flex-col items-center justify-center gap-1 bg-secondary/10">
        <div className="w-7 h-7 rounded-full border-2 border-dashed border-border/50 flex items-center justify-center">
          <Users className="w-3.5 h-3.5 text-muted-foreground/40" />
        </div>
        <p className="text-[10px] text-muted-foreground/40 font-medium uppercase tracking-wider">{label}</p>
        <p className="text-[9px] text-muted-foreground/30">Empty</p>
      </div>
    </div>
  );
}

// ─── Recursive Tree Node ───────────────────────────────────────────────────
function TreeNodeCard({
  node,
  allNodes,
  depth = 0,
  isRoot = false,
}: {
  node: TreeNodeData;
  allNodes: TreeNodeData[];
  depth?: number;
  isRoot?: boolean;
}) {
  const [expanded, setExpanded] = useState(depth < 2);

  const leftChild = node.leftChildId
    ? allNodes.find((n) => n.id === node.leftChildId)
    : null;
  const rightChild = node.rightChildId
    ? allNodes.find((n) => n.id === node.rightChildId)
    : null;
  const hasChildren = !!(leftChild || rightChild);
  const showSlots = !leftChild || !rightChild;

  const initials = `${node.firstName.charAt(0)}${node.lastName.charAt(0)}`;

  const legColor =
    isRoot ? "root" : node.leg === "left" ? "left" : "right";

  return (
    <div className="flex flex-col items-center">
      {/* ── Node Card ── */}
      <div
        className={cn(
          "relative rounded-xl border p-3 w-[132px] select-none transition-all group",
          isRoot
            ? "border-primary/50 bg-primary/5 shadow-md shadow-primary/10"
            : node.status === "active"
            ? "border-card-border bg-card hover:border-primary/30 hover:shadow-sm"
            : node.status === "pending"
            ? "border-yellow-500/30 bg-yellow-500/5"
            : "border-destructive/30 bg-destructive/5 opacity-60",
          hasChildren ? "cursor-pointer" : "cursor-default"
        )}
        onClick={() => hasChildren && setExpanded((e) => !e)}
        title={`${node.firstName} ${node.lastName} • ${node.status} • L:${node.leftBv.toFixed(0)} BV  R:${node.rightBv.toFixed(0)} BV`}
      >
        {/* Leg badge */}
        {!isRoot && (
          <span
            className={cn(
              "absolute -top-2 left-1/2 -translate-x-1/2 text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider",
              legColor === "left"
                ? "bg-primary/15 text-primary border border-primary/20"
                : "bg-accent/15 text-accent border border-accent/20"
            )}
          >
            {node.leg}
          </span>
        )}

        {/* Avatar */}
        <div
          className={cn(
            "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold mx-auto mb-2 mt-1",
            isRoot
              ? "bg-primary text-primary-foreground"
              : node.status === "active"
              ? legColor === "left"
                ? "bg-primary/20 text-primary"
                : "bg-accent/20 text-accent"
              : node.status === "pending"
              ? "bg-yellow-500/20 text-yellow-500"
              : "bg-secondary text-muted-foreground"
          )}
        >
          {isRoot ? <Trophy className="w-4 h-4" /> : initials}
        </div>

        {/* Name + status */}
        <p className="text-[11px] font-semibold text-foreground text-center truncate leading-tight">
          {node.firstName} {node.lastName}
        </p>
        <div className="flex items-center justify-center gap-1 mt-0.5">
          <StatusDot status={node.status} />
          <span className="text-[9px] text-muted-foreground capitalize">{node.status}</span>
        </div>

        {/* BV bars */}
        <div className="mt-2 space-y-1.5">
          <div>
            <div className="flex justify-between items-center mb-0.5">
              <span className="text-[9px] text-primary font-medium">L BV</span>
              <span className="text-[9px] font-bold text-foreground">{node.leftBv.toFixed(0)}</span>
            </div>
            <BvBar value={node.leftBv} color="left" />
          </div>
          <div>
            <div className="flex justify-between items-center mb-0.5">
              <span className="text-[9px] text-accent font-medium">R BV</span>
              <span className="text-[9px] font-bold text-foreground">{node.rightBv.toFixed(0)}</span>
            </div>
            <BvBar value={node.rightBv} color="right" />
          </div>
        </div>

        {/* Expand/collapse indicator */}
        {hasChildren && (
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-card border border-border flex items-center justify-center shadow-sm">
            {expanded ? (
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
            )}
          </div>
        )}
      </div>

      {/* ── Children / Slots ── */}
      {(hasChildren || (showSlots && depth < 3)) && expanded && (
        <div className="flex flex-col items-center mt-6">
          {/* Vertical stem */}
          <div className="w-px h-4 bg-border" />

          <div className="flex items-start gap-4 relative">
            {/* Horizontal crossbar */}
            <div
              className="absolute top-0 bg-border"
              style={{
                height: "1px",
                left: "50%",
                right: "50%",
                // spans the gap between left and right branch centers
                // overridden below per branch via relative lines
              }}
            />

            {/* ── Left branch ── */}
            <div className="flex flex-col items-center relative">
              {/* left half of crossbar */}
              <div className="absolute top-0 right-1/2 left-[-50px] h-px bg-border" />
              <div className="w-px h-4 bg-border" />
              {leftChild ? (
                <TreeNodeCard
                  node={leftChild}
                  allNodes={allNodes}
                  depth={depth + 1}
                />
              ) : (
                <EmptySlot label="Left" />
              )}
            </div>

            {/* ── Right branch ── */}
            <div className="flex flex-col items-center relative">
              {/* right half of crossbar */}
              <div className="absolute top-0 left-1/2 right-[-50px] h-px bg-border" />
              <div className="w-px h-4 bg-border" />
              {rightChild ? (
                <TreeNodeCard
                  node={rightChild}
                  allNodes={allNodes}
                  depth={depth + 1}
                />
              ) : (
                <EmptySlot label="Right" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────
export default function NetworkPage() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const [zoom, setZoom] = useState(1);

  const { data: treeNodes, isLoading } = useGetUserTree(
    user?.id ?? 0,
    { query: { queryKey: getGetUserTreeQueryKey(user?.id ?? 0), enabled: !!user?.id } }
  );

  useEffect(() => {
    if (!authLoading && !user) setLocation("/login");
  }, [authLoading, user, setLocation]);

  const rootNode = treeNodes?.find((n) => n.userId === user?.id);
  const totalActive = treeNodes?.filter((n) => n.status === "active").length ?? 0;
  const totalPending = treeNodes?.filter((n) => n.status === "pending").length ?? 0;
  const totalDownline = (treeNodes?.length ?? 1) - 1;

  const rootLeftBv = rootNode?.leftBv ?? 0;
  const rootRightBv = rootNode?.rightBv ?? 0;
  const readyCycles = Math.floor(Math.min(rootLeftBv, rootRightBv) / 3000);

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-4 h-full flex flex-col">
        {/* ── Header ── */}
        <div className="flex items-start justify-between flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Network className="w-5 h-5 text-primary" />
              Binary Network
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Your downline tree — click any node to expand or collapse
            </p>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-card border border-card-border rounded-lg p-1">
            <button
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
              className="p-1.5 hover:bg-secondary rounded-md transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <span className="text-xs text-muted-foreground w-10 text-center font-mono">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
              className="p-1.5 hover:bg-secondary rounded-md transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="p-1.5 hover:bg-secondary rounded-md transition-colors"
              title="Reset zoom"
            >
              <Maximize2 className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* ── Stats bar ── */}
        <div className="grid grid-cols-5 gap-3 flex-shrink-0">
          <div className="col-span-1 bg-card border border-card-border rounded-xl px-4 py-3 text-center">
            <p className="text-lg font-bold text-foreground">{totalDownline}</p>
            <p className="text-xs text-muted-foreground">Downline</p>
          </div>
          <div className="col-span-1 bg-card border border-card-border rounded-xl px-4 py-3 text-center">
            <p className="text-lg font-bold text-primary">{totalActive}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </div>
          <div className="col-span-1 bg-card border border-card-border rounded-xl px-4 py-3 text-center">
            <p className="text-lg font-bold text-yellow-500">{totalPending}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
          <div className="col-span-1 bg-card border border-primary/20 bg-primary/5 rounded-xl px-4 py-3 text-center">
            <p className="text-lg font-bold text-primary">{rootLeftBv.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">Left BV</p>
          </div>
          <div className="col-span-1 bg-card border border-accent/20 bg-accent/5 rounded-xl px-4 py-3 text-center">
            <p className="text-lg font-bold text-accent">{rootRightBv.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">Right BV</p>
          </div>
        </div>

        {/* Cycle ready banner */}
        {readyCycles > 0 && (
          <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 bg-primary/10 border border-primary/20 rounded-xl text-sm">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-primary font-semibold">
              🎉 {readyCycles} binary cycle{readyCycles > 1 ? "s" : ""} ready — $70 × {readyCycles} = ${readyCycles * 70} bonus waiting!
            </span>
          </div>
        )}

        {/* ── Legend ── */}
        <div className="shrink-0 flex items-center gap-4 px-4 py-2 bg-card border border-card-border rounded-lg text-xs">
          <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary inline-block" /> Active</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" /> Pending</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-destructive inline-block" /> Suspended</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary inline-block" /> Left leg</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-accent inline-block" /> Right leg</span>
            <span className="text-muted-foreground/60">BV bars show progress toward 3,000 BV cycle</span>
          </div>
        </div>

        {/* ── Tree canvas ── */}
        <div className="flex-1 bg-card border border-card-border rounded-xl overflow-auto min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-full min-h-[300px]">
              <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : !rootNode ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center gap-3">
              <Network className="w-10 h-10 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">No network tree yet</p>
              <p className="text-xs text-muted-foreground/60">Start recruiting to build your downline</p>
            </div>
          ) : (
            <div
              className="p-8 flex justify-center"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "top center",
                minWidth: "max-content",
              }}
            >
              <TreeNodeCard
                node={rootNode}
                allNodes={treeNodes ?? []}
                depth={0}
                isRoot={true}
              />
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
