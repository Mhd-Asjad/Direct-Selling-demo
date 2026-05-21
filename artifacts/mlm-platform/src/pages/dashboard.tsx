import Layout from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import {
  useGetDashboardSummary, getGetDashboardSummaryQueryKey,
  useGetRecentActivity, getGetRecentActivityQueryKey,
  useGetCommissionStats, getGetCommissionStatsQueryKey,
} from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useEffect } from "react";
import {
  TrendingUp, Users, Wallet, DollarSign,
  Activity, ArrowUpRight, Clock, CheckCircle,
  Zap, Network, Award,
} from "lucide-react";
import { cn } from "@/lib/utils";

const CYCLE_BV = 3000;

function StatCard({ label, value, sub, icon: Icon, accent = false, color = "primary" }: {
  label: string; value: string; sub?: string; icon: any; accent?: boolean; color?: string;
}) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-4 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
        <div className={cn("p-2 rounded-lg", accent ? "bg-accent/20" : "bg-primary/10")}>
          <Icon className={cn("w-4 h-4", accent ? "text-accent" : "text-primary")} />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function BvProgressBar({ label, current, target, color }: { label: string; current: number; target: number; color: string }) {
  const pct = Math.min(100, (current % target) / target * 100);
  const cycles = Math.floor(current / target);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full", color === "left" ? "bg-primary" : "bg-accent")} />
          <span className="text-sm font-medium text-foreground">{label} Leg</span>
          {cycles > 0 && (
            <span className="text-xs bg-accent/20 text-accent px-1.5 py-0.5 rounded font-medium">
              {cycles} cycle{cycles > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <span className="text-sm text-muted-foreground font-mono">{current.toFixed(0)} BV</span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700", color === "left" ? "bg-primary" : "bg-accent")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-xs text-muted-foreground">{(current % target).toFixed(0)} / {target} BV to next cycle</span>
        <span className="text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
      </div>
    </div>
  );
}

const activityIcons: Record<string, any> = {
  registration: Users,
  commission_earned: DollarSign,
  binary_match: Zap,
  coupon_created: Award,
  coupon_redeemed: CheckCircle,
  wash_reset: Activity,
};

const activityColors: Record<string, string> = {
  registration: "text-primary bg-primary/10",
  commission_earned: "text-accent bg-accent/10",
  binary_match: "text-yellow-500 bg-yellow-500/10",
  coupon_created: "text-purple-400 bg-purple-400/10",
  coupon_redeemed: "text-green-400 bg-green-400/10",
  wash_reset: "text-destructive bg-destructive/10",
};

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();

  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey(), enabled: !!user },
  });

  const { data: activity, isLoading: activityLoading } = useGetRecentActivity({
    query: { queryKey: getGetRecentActivityQueryKey(), enabled: !!user },
  });

  const { data: commStats } = useGetCommissionStats(
    {},
    { query: { queryKey: getGetCommissionStatsQueryKey({}), enabled: !!user } },
  );

  useEffect(() => {
    if (!authLoading && !user) setLocation("/login");
  }, [authLoading, user, setLocation]);

  if (authLoading || summaryLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  const referralUrl = `${window.location.origin}${import.meta.env.BASE_URL}register?ref=${user?.referralCode}`;

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">
              Welcome back, {user?.firstName}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
          {user?.status === "pending" && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <Clock className="w-4 h-4 text-yellow-500" />
              <span className="text-xs text-yellow-500 font-medium">Pending activation</span>
            </div>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Wallet Balance"
            value={`$${(summary?.walletBalance ?? 0).toFixed(2)}`}
            sub="Available to withdraw"
            icon={Wallet}
          />
          <StatCard
            label="Total Earned"
            value={`$${(summary?.totalEarned ?? 0).toFixed(2)}`}
            sub={`${commStats?.directReferralTotal?.toFixed(2) ?? "0"} direct`}
            icon={DollarSign}
            accent
          />
          <StatCard
            label="Direct Referrals"
            value={String(summary?.directReferrals ?? 0)}
            sub={`${summary?.totalDownline ?? 0} total downline`}
            icon={Users}
          />
          <StatCard
            label="Pending Cycles"
            value={String(summary?.pendingCycles ?? 0)}
            sub="$70 each when matched"
            icon={Zap}
            accent
          />
        </div>

        {/* BV Progress */}
        <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Binary Volume Progress</h2>
            <span className="text-xs text-muted-foreground">3,000 BV per cycle → $70 bonus</span>
          </div>
          <div className="space-y-4">
            <BvProgressBar label="Left" current={summary?.leftBv ?? 0} target={CYCLE_BV} color="left" />
            <BvProgressBar label="Right" current={summary?.rightBv ?? 0} target={CYCLE_BV} color="right" />
          </div>
          {summary && summary.leftBv >= CYCLE_BV && summary.rightBv >= CYCLE_BV && (
            <div className="mt-4 p-3 rounded-lg bg-accent/10 border border-accent/20 flex items-center gap-2">
              <Zap className="w-4 h-4 text-accent" />
              <p className="text-sm text-accent font-medium">Cycle ready! Commission is being processed.</p>
            </div>
          )}
        </div>

        {/* Referral link + activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Referral card */}
          <div className="bg-card border border-card-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Network className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Your Referral Link</h2>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary border border-border">
              <p className="text-xs text-muted-foreground font-mono flex-1 truncate" data-testid="text-referral-link">
                {referralUrl}
              </p>
            </div>
            <button
              data-testid="button-copy-referral"
              onClick={() => navigator.clipboard?.writeText(referralUrl)}
              className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
            >
              <ArrowUpRight className="w-4 h-4" /> Copy & Share Link
            </button>
            <div className="mt-3 flex gap-4 text-center">
              <div className="flex-1">
                <p className="text-lg font-bold text-foreground">{summary?.directReferrals ?? 0}</p>
                <p className="text-xs text-muted-foreground">Direct refs</p>
              </div>
              <div className="flex-1">
                <p className="text-lg font-bold text-foreground">{summary?.totalDownline ?? 0}</p>
                <p className="text-xs text-muted-foreground">Total downline</p>
              </div>
              <div className="flex-1">
                <p className="text-lg font-bold text-foreground">{user?.referralCode}</p>
                <p className="text-xs text-muted-foreground">Ref code</p>
              </div>
            </div>
          </div>

          {/* Activity feed */}
          <div className="bg-card border border-card-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Recent Activity</h2>
            </div>
            <div className="space-y-3">
              {activityLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="w-8 h-8 rounded-lg bg-secondary flex-shrink-0" />
                    <div className="flex-1 space-y-1">
                      <div className="h-3 bg-secondary rounded w-3/4" />
                      <div className="h-2 bg-secondary rounded w-1/2" />
                    </div>
                  </div>
                ))
              ) : activity?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No recent activity yet</p>
              ) : (
                activity?.slice(0, 5).map((item) => {
                  const Icon = activityIcons[item.type] ?? Activity;
                  const colorClass = activityColors[item.type] ?? "text-primary bg-primary/10";
                  return (
                    <div key={item.id} className="flex items-start gap-3" data-testid={`activity-item-${item.id}`}>
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", colorClass)}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground leading-snug">{item.message}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </span>
                          {item.amount && (
                            <span className="text-xs font-semibold text-accent">+${item.amount.toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
