import Layout from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import {
  useListCommissions, getListCommissionsQueryKey,
  useGetCommissionStats, getGetCommissionStatsQueryKey,
} from "@/api-client";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { DollarSign, Zap, TrendingUp, Award, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const CYCLE_THRESHOLD = 3000;

function CommissionBadge({ type }: { type: string }) {
  if (type === "direct_referral") {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
        <DollarSign className="w-3 h-3" /> Direct 10%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent font-medium">
      <Zap className="w-3 h-3" /> Binary Match
    </span>
  );
}

export default function CommissionsPage() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();

  const { data: commissions, isLoading } = useListCommissions(
    {},
    { query: { queryKey: getListCommissionsQueryKey({}), enabled: !!user } },
  );

  const { data: stats } = useGetCommissionStats(
    {},
    { query: { queryKey: getGetCommissionStatsQueryKey({}), enabled: !!user } },
  );

  useEffect(() => {
    if (!authLoading && !user) setLocation("/login");
  }, [authLoading, user, setLocation]);

  const leftPct = Math.min(100, ((stats?.leftBv ?? 0) % CYCLE_THRESHOLD) / CYCLE_THRESHOLD * 100);
  const rightPct = Math.min(100, ((stats?.rightBv ?? 0) % CYCLE_THRESHOLD) / CYCLE_THRESHOLD * 100);

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-foreground">Commissions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your earnings history and cycle progress</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Earned", value: `$${(stats?.totalEarned ?? 0).toFixed(2)}`, icon: TrendingUp, color: "accent" },
            { label: "Direct Referral", value: `$${(stats?.directReferralTotal ?? 0).toFixed(2)}`, icon: DollarSign, color: "primary" },
            { label: "Binary Match", value: `$${(stats?.binaryMatchTotal ?? 0).toFixed(2)}`, icon: Zap, color: "yellow" },
            { label: "Pending Cycles", value: `${stats?.pendingCycles ?? 0} cycles`, icon: Award, color: "purple" },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-card-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
                <s.icon className={cn("w-4 h-4", s.color === "accent" ? "text-accent" : s.color === "yellow" ? "text-yellow-500" : s.color === "purple" ? "text-purple-400" : "text-primary")} />
              </div>
              <p className="text-xl font-bold text-foreground" data-testid={`stat-${s.label.toLowerCase().replace(/\s+/g, "-")}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* BV Cycle tracker */}
        {/* <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Binary Cycle Tracker</h2>
            <span className="text-xs text-muted-foreground ml-auto">3,000 BV matched = $70 bonus</span>
          </div>
          <div className="space-y-4">
            {[
              { label: "Left Leg", bv: stats?.leftBv ?? 0, residual: stats?.residualLeftBv ?? 0, pct: leftPct, color: "primary" },
              { label: "Right Leg", bv: stats?.rightBv ?? 0, residual: stats?.residualRightBv ?? 0, pct: rightPct, color: "accent" },
            ].map((leg) => (
              <div key={leg.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-foreground">{leg.label}</span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{leg.bv.toFixed(0)} BV total</span>
                    {leg.residual > 0 && <span className="text-primary">+{leg.residual.toFixed(0)} residual</span>}
                  </div>
                </div>
                <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-700", leg.color === "accent" ? "bg-accent" : "bg-primary")}
                    style={{ width: `${leg.pct}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-muted-foreground">
                    {(leg.bv % CYCLE_THRESHOLD).toFixed(0)} / 3,000 BV
                  </span>
                  <span className="text-xs text-muted-foreground">{leg.pct.toFixed(0)}%</span>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <span className="text-xs text-muted-foreground">Matched BV:</span>
              <span className="text-xs font-bold text-foreground">{(stats?.matchedBv ?? 0).toFixed(0)}</span>
              <span className="ml-auto text-xs text-muted-foreground">Completed cycles:</span>
              <span className="text-xs font-bold text-foreground">{stats?.pendingCycles ?? 0}</span>
            </div>
          </div>
        </div> */}

        {/* Commission table */}
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Commission History</h2>
          </div>

          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="w-8 h-8 rounded bg-secondary flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-secondary rounded w-2/3" />
                    <div className="h-2 bg-secondary rounded w-1/3" />
                  </div>
                  <div className="h-4 bg-secondary rounded w-16" />
                </div>
              ))}
            </div>
          ) : commissions?.length === 0 ? (
            <div className="p-12 text-center">
              <DollarSign className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No commissions yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Start referring members to earn commissions</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {commissions?.map((c) => (
                <div key={c.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-secondary/30 transition-colors" data-testid={`commission-row-${c.id}`}>
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                    c.type === "direct_referral" ? "bg-primary/10" : "bg-accent/10"
                  )}>
                    {c.type === "direct_referral"
                      ? <DollarSign className="w-4 h-4 text-primary" />
                      : <Zap className="w-4 h-4 text-accent" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <CommissionBadge type={c.type} />
                    </div>
                    {c.sourceUserName && (
                      <p className="text-xs text-muted-foreground">From {c.sourceUserName}</p>
                    )}
                    {c.bvMatched && (
                      <p className="text-xs text-muted-foreground">{c.bvMatched.toFixed(0)} BV matched</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-accent">+${c.amount.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
