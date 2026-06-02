import Layout from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import {
  useGetDashboardSummary, getGetDashboardSummaryQueryKey,
  useGetRecentActivity, getGetRecentActivityQueryKey,
  useGetCommissionStats, getGetCommissionStatsQueryKey,
  useStripeCreateCheckoutSession, useStripeVerifyCheckoutSession, getGetCurrentUserQueryKey
} from "@/api-client";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-fetch";
import {
  TrendingUp, Users, Wallet, DollarSign,
  Activity, ArrowUpRight, Clock, CheckCircle,
  Zap, Network, Award, AlertCircle, CreditCard,
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
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [verifyingPayment, setVerifyingPayment] = useState(false);

  const createCheckoutSession = useStripeCreateCheckoutSession();
  const verifyCheckoutSession = useStripeVerifyCheckoutSession();

  const [coupon1, setCoupon1] = useState("");
  const [coupon2, setCoupon2] = useState("");
  const [paymentTab, setPaymentTab] = useState<"stripe" | "coupon">("stripe");
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [depositForm, setDepositForm] = useState({ amountInUSDT: "", blockchainNetwork: "TRC20", senderWalletAddress: "", screenshotUrl: "" });
  const [myDeposits, setMyDeposits] = useState<any[]>([]);
  const [platformUsdtAddress, setPlatformUsdtAddress] = useState("Loading address...");

  const fetchPlatformDetails = async () => {
    try {
      const res = await apiFetch("/api/deposits/platform-address");
      if (res.ok) {
        const data = await res.json();
        setPlatformUsdtAddress(data.address);
      }
    } catch { }
  };

  const fetchMyDeposits = async () => {
    try {
      const res = await apiFetch("/api/deposits/my-requests");
      if (res.ok) setMyDeposits(await res.json());
    } catch { }
  };

  const submitManualDeposit = useMutation({
    mutationFn: async (data: typeof depositForm) => {
      const res = await apiFetch("/api/deposits/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, amountInUSDT: parseFloat(data.amountInUSDT) }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to submit deposit");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Deposit Submitted!", description: "Admin will review your USDT payment and issue activation coupons upon approval." });
      setDepositForm({ amountInUSDT: "", blockchainNetwork: "TRC20", senderWalletAddress: "", screenshotUrl: "" });
      fetchMyDeposits();
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Submission Failed", description: err.message });
    },
  });

  const createCourseCheckoutSession = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiFetch("/api/auth/create-course-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create checkout session");
      }
      return res.json();
    },
  });

  const redeemCoupons = useMutation({
    mutationFn: async (data: { userId: number, coupon1: string, coupon2: string }) => {
      const res = await apiFetch("/api/auth/redeem-activation-coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to redeem coupons");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
      toast({ title: "Account Activated!", description: "You are now eligible for commissions." });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Activation Failed", description: err.message });
    }
  });

  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey(), enabled: !!user && user.status !== "pending" },
  });

  const { data: activity, isLoading: activityLoading } = useGetRecentActivity({
    query: { queryKey: getGetRecentActivityQueryKey(), enabled: !!user && user.status !== "pending" },
  });

  const { data: commStats } = useGetCommissionStats(
    {},
    { query: { queryKey: getGetCommissionStatsQueryKey({}), enabled: !!user && user.status !== "pending" } },
  );

  // Load user's deposit requests
  useEffect(() => {
    if (user) {
      fetchMyDeposits();
      if (user.status === "pending") {
        fetchPlatformDetails();
      }
    }
  }, [user]);

  // Check and run payment verification if redirected back from Stripe
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const sessionId = params.get("session_id");

    if (payment === "success" && sessionId) {
      // Remove checkout parameters from URL immediately to prevent infinite loops
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);

      setVerifyingPayment(true);
      verifyCheckoutSession.mutate(
        {
          data: { sessionId },
        },
        {
          onSuccess: () => {
            // Invalidate queries to refresh current user status and dashboard counters
            queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetRecentActivityQueryKey() });

            toast({
              title: "Payment Verified!",
              description: "Your $30 distributor registration fee is approved. Welcome to NetPro!",
            });
            setVerifyingPayment(false);
          },
          onError: (err: any) => {
            toast({
              variant: "destructive",
              title: "Verification Failed",
              description: err.message || "Failed to verify Stripe checkout session.",
            });
            setVerifyingPayment(false);
          },
        }
      );
    } else if (payment === "cancelled") {
      // Clean up URL immediately
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);

      toast({
        variant: "destructive",
        title: "Payment Cancelled",
        description: "Your registration checkout session was cancelled. You can complete it anytime.",
      });
    }

    // Handle course package success URL
    const coursePayment = params.get("course_payment");
    const courseSessionId = params.get("session_id");
    if (coursePayment === "success" && courseSessionId) {
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);

      setVerifyingPayment(true);
      verifyCheckoutSession.mutate(
        { data: { sessionId: courseSessionId } },
        {
          onSuccess: (data: any) => {
            queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetRecentActivityQueryKey() });
            toast({
              title: data?.status === "active" ? "🎉 Account Activated!" : "Payment Received!",
              description: data?.status === "active"
                ? "Your course package payment was verified. Your account is now active and placed in the network!"
                : "Payment received. Awaiting admin KYC review to complete activation.",
            });
            setVerifyingPayment(false);
          },
          onError: (err: any) => {
            toast({
              variant: "destructive",
              title: "Verification Failed",
              description: err.message || "Could not verify course payment.",
            });
            setVerifyingPayment(false);
          },
        }
      );
    } else if (coursePayment === "cancelled") {
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
      toast({
        variant: "destructive",
        title: "Purchase Cancelled",
        description: "Course package purchase was cancelled.",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient]);

  useEffect(() => {
    if (!authLoading && !user) setLocation("/login");
  }, [authLoading, user, setLocation]);

  if (verifyingPayment) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(199_89%_48%_/_0.08)_0%,_transparent_70%)] pointer-events-none" />
        <div className="w-full max-w-sm text-center space-y-4 relative z-10 bg-card border border-card-border rounded-xl p-8 shadow-xl">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/20 border border-accent/30 animate-pulse">
            <CheckCircle className="w-8 h-8 text-accent" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Verifying Payment</h2>
          <p className="text-sm text-muted-foreground">
            Confirming your payment with Stripe and activating your account. This only takes a moment...
          </p>
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mt-4" />
        </div>
      </div>
    );
  }

  if (authLoading || (summaryLoading && user?.status !== "pending")) {
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

        {/* Pending Activation Banner (Course Purchase) */}
        {user?.status === "pending" && (
          <div className="bg-card border border-yellow-500/25 rounded-xl p-5 relative overflow-hidden space-y-5">
            {/* Header */}
            <div className="flex items-center gap-2 text-yellow-500 font-semibold text-sm">
              <AlertCircle className="w-4 h-4" />
              Account Activation Required
            </div>

            <p className="text-xs text-muted-foreground">
              Your account is pending activation. You can activate via Stripe card payment, or ask your admin/sponsor to activate your account directly.
            </p>

            {/* Payment Method Tabs */}
            <div className="flex gap-1 bg-secondary rounded-lg p-1 w-fit">
              {(["stripe", "coupon"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setPaymentTab(tab as any)}
                  className={cn(
                    "px-4 py-1.5 rounded-md text-xs font-medium transition-all",
                    paymentTab === tab
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab === "stripe" ? "💳 Pay via Stripe" : "🎟️ Redeem Coupons"}
                </button>
              ))}
            </div>

            {/* ── STRIPE TAB ─────────────────────────────────────────────────── */}
            {paymentTab === "stripe" && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Pay ₹1,00,000 securely by card via Stripe. Upon payment success, your account is instantly activated and placed in the network tree automatically.
                </p>
                <button
                  disabled={createCourseCheckoutSession.isPending}
                  onClick={async () => {
                    try {
                      const sessionData = await createCourseCheckoutSession.mutateAsync(user.id);
                      if (sessionData?.url) {
                        window.location.href = sessionData.url;
                      } else {
                        toast({ variant: "destructive", title: "Checkout Error", description: "No redirect URL returned from Stripe." });
                      }
                    } catch (err: any) {
                      toast({ variant: "destructive", title: "Checkout Error", description: err.message || "Failed to create Stripe payment session." });
                    }
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-yellow-950 text-sm font-semibold rounded-lg transition-colors shadow-lg shadow-yellow-500/20 disabled:opacity-50"
                >
                  <CreditCard className="w-4 h-4" />
                  {createCourseCheckoutSession.isPending ? "Connecting..." : "Pay ₹1,00,000 via Stripe →"}
                </button>

                {/* Admin transfer alternative */}
                <div className="p-3 rounded-lg bg-secondary border border-border text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">Prefer offline payment?</p>
                  <p>Contact your admin or sponsor and provide them your Wallet ID. They can activate your account directly and transfer the USDT balance to your wallet.</p>
                </div>
              </div>
            )}

            {/* ── COUPON REDEMPTION ──────────────────────────────────────────── */}
            {paymentTab === "coupon" && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  If your admin has issued you two ₹50,000 activation coupon codes, enter them below to activate your account (3000 BV, binary tree placement, commission eligibility).
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <input
                    type="text"
                    placeholder="Coupon Code 1"
                    className="flex h-9 w-full sm:w-48 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={coupon1}
                    onChange={e => setCoupon1(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Coupon Code 2"
                    className="flex h-9 w-full sm:w-48 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={coupon2}
                    onChange={e => setCoupon2(e.target.value)}
                  />
                  <button
                    disabled={redeemCoupons.isPending || !coupon1 || !coupon2}
                    onClick={() => redeemCoupons.mutate({ userId: user.id, coupon1, coupon2 })}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    {redeemCoupons.isPending ? "Activating..." : "Activate Account"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}



        {/* KYC Verification Status — visible for all users */}
        <div className={cn(
          "rounded-xl p-4 border flex items-start gap-3",
          user?.isKycVerified
            ? "bg-accent/5 border-accent/20"
            : user?.status === "active"
            ? "bg-yellow-500/5 border-yellow-500/20"
            : "bg-card border-card-border"
        )}>
          <div className={cn(
            "p-2 rounded-lg shrink-0",
            user?.isKycVerified ? "bg-accent/15" : "bg-yellow-500/15"
          )}>
            {user?.isKycVerified
              ? <CheckCircle className="w-4 h-4 text-accent" />
              : <AlertCircle className="w-4 h-4 text-yellow-500" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={cn("text-sm font-semibold", user?.isKycVerified ? "text-accent" : "text-yellow-500")}>
                {user?.isKycVerified ? "KYC Verified" : "KYC Verification Pending"}
              </p>
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider",
                user?.isKycVerified
                  ? "bg-accent/20 text-accent border border-accent/25"
                  : "bg-yellow-500/20 text-yellow-500 border border-yellow-500/25"
              )}>
                {user?.isKycVerified ? "✓ Verified" : "Pending"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {user?.isKycVerified
                ? "Your identity has been verified by the admin. You are fully eligible for commissions and withdrawals."
                : user?.status === "active"
                ? "Your account is active but KYC verification is still pending. Some features may be restricted until admin completes the review."
                : "Your KYC documents will be reviewed by an admin after account activation."}
            </p>
          </div>
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

        {/* Commission Progress */}
        <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-foreground">Network & Commission Progress</h2>
              <p className="text-xs text-muted-foreground">Track your binary volume and referral rewards</p>
            </div>
            <div className="text-right space-y-1">
              <span className="block text-xs font-medium text-muted-foreground">3,000 BV per cycle → $70 bonus</span>
              <span className="inline-block text-xs font-medium text-accent bg-accent/10 px-2 py-0.5 rounded">10% Direct Commission</span>
            </div>
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

        {/* My Deposit Requests Section */}
        {myDeposits.length > 0 && (
          <div className="bg-card border border-card-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="w-5 h-5 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">My Deposit Requests</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 font-semibold text-muted-foreground">Date</th>
                    <th className="text-left py-2 font-semibold text-muted-foreground">Amount</th>
                    <th className="text-left py-2 font-semibold text-muted-foreground">Status</th>
                    <th className="text-left py-2 font-semibold text-muted-foreground">Network</th>
                    <th className="text-left py-2 font-semibold text-muted-foreground">Wallet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {myDeposits.map((d: any) => (
                    <tr key={d.id} className="hover:bg-secondary/10">
                      <td className="py-3 text-muted-foreground">{new Date(d.createdAt).toLocaleDateString()}</td>
                      <td className="py-3 font-semibold text-foreground">{d.amountInUSDT} USDT</td>
                      <td className="py-3">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
                          d.status === "PENDING" ? "bg-yellow-500/10 text-yellow-500" :
                          d.status === "APPROVED" ? "bg-accent/10 text-accent" : "bg-destructive/10 text-destructive"
                        )}>
                          {d.status}
                        </span>
                      </td>
                      <td className="py-3 text-muted-foreground">{d.blockchainNetwork}</td>
                      <td className="py-3 text-muted-foreground font-mono text-xs">{d.senderWalletAddress.slice(0,6)}...{d.senderWalletAddress.slice(-4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
