import Layout from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import {
  useGetFinancialStats, getGetFinancialStatsQueryKey,
  useListUsers, getListUsersQueryKey,
  useUpdateUserStatus, useApprovePayment,
  useGetNetworkTree, getGetNetworkTreeQueryKey,
  useGetGlobalBvStats, getGetGlobalBvStatsQueryKey,
  useListWashHistory, getListWashHistoryQueryKey,
  useExecuteWashReset,
  usePlaceNode,
  useGetNetworkStats, getGetNetworkStatsQueryKey,
  useListAdminCourses, getListAdminCoursesQueryKey,
  useCreateAdminCourse,
  useUpdateAdminCourse,
  useDeleteAdminCourse,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  TrendingUp, TrendingDown, Users, BarChart3,
  RefreshCw, Zap, AlertTriangle, CheckCircle, Ban, UserCheck,
  Network, DollarSign, Activity, History, BookOpen, Plus, Pencil, Trash2,
  Camera, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const TABS = ["Overview", "USDT Deposits", "Payments", "Users", "Network", "BV Stats", "Courses", "Wash Reset"] as const;
type Tab = typeof TABS[number];

const washSchema = z.object({
  adminPin: z.string().min(4, "Enter admin PIN"),
  reason: z.string().optional(),
});

const courseSchema = z.object({
  name: z.string().min(1, "Name required"),
  description: z.string().optional(),
  price: z.coerce.number().min(0, "Price must be ≥ 0"),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  bvAmount: z.coerce.number().optional(),
});

export default function AdminPage() {
  const [, setLocation] = useLocation();
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [confirmWash, setConfirmWash] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [courseDialog, setCourseDialog] = useState<{ open: boolean; mode: "create" | "edit"; id?: number }>({ open: false, mode: "create" });
  const [selectedKycUser, setSelectedKycUser] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [actionPending, setActionPending] = useState<number | null>(null);
  const [usdtDeposits, setUsdtDeposits] = useState<any[]>([]);
  const [usdtDepositsLoading, setUsdtDepositsLoading] = useState(false);
  const [depositActionPending, setDepositActionPending] = useState<number | null>(null);

  const { data: financialStats } = useGetFinancialStats({
    query: { queryKey: getGetFinancialStatsQueryKey(), enabled: !!isAdmin },
  });

  const { data: users, isLoading: usersLoading } = useListUsers(
    { status: statusFilter as any, search: userSearch },
    { query: { queryKey: getListUsersQueryKey({ status: statusFilter as any, search: userSearch }), enabled: !!isAdmin } },
  );

  const { data: networkTree } = useGetNetworkTree(
    {},
    { query: { queryKey: getGetNetworkTreeQueryKey({}), enabled: !!isAdmin && activeTab === "Network" } },
  );

  const { data: bvStats } = useGetGlobalBvStats({
    query: { queryKey: getGetGlobalBvStatsQueryKey(), enabled: !!isAdmin },
  });

  const { data: washHistory } = useListWashHistory({
    query: { queryKey: getListWashHistoryQueryKey(), enabled: !!isAdmin },
  });

  const { data: networkStats } = useGetNetworkStats({
    query: { queryKey: getGetNetworkStatsQueryKey(), enabled: !!isAdmin },
  });

  const fetchSubmissions = async () => {
    if (!isAdmin) return;
    setSubmissionsLoading(true);
    try {
      const res = await fetch("/api/onboarding/admin/submissions");
      if (res.ok) setSubmissions(await res.json());
    } finally { setSubmissionsLoading(false); }
  };

  const handleSubmissionAction = async (id: number, action: "approve" | "reject", reason?: string) => {
    setActionPending(id);
    try {
      const res = await fetch(`/api/onboarding/admin/submissions/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "reject" ? { reason } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: action === "approve" ? "Payment approved — coupons issued!" : "Submission rejected." });
      fetchSubmissions();
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey({}) });
    } catch (err: any) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    } finally { setActionPending(null); }
  };

  useEffect(() => { if (activeTab === "Payments") fetchSubmissions(); }, [activeTab, isAdmin]);

  const fetchUsdtDeposits = async () => {
    if (!isAdmin) return;
    setUsdtDepositsLoading(true);
    try {
      const res = await fetch("/api/admin/deposits");
      if (res.ok) setUsdtDeposits(await res.json());
    } finally { setUsdtDepositsLoading(false); }
  };

  const handleDepositApprove = async (id: number) => {
    setDepositActionPending(id);
    try {
      const res = await fetch(`/api/admin/deposits/${id}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({
        title: "Deposit Approved!",
        description: `2 activation coupons issued: ${data.coupon1} & ${data.coupon2}`,
      });
      fetchUsdtDeposits();
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey({}) });
    } catch (err: any) {
      toast({ title: "Approval failed", description: err.message, variant: "destructive" });
    } finally { setDepositActionPending(null); }
  };

  const handleDepositReject = async (id: number) => {
    const reason = prompt("Rejection reason (optional):");
    if (reason === null) return; // cancelled
    setDepositActionPending(id);
    try {
      const res = await fetch(`/api/admin/deposits/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "Deposit rejected." });
      fetchUsdtDeposits();
    } catch (err: any) {
      toast({ title: "Rejection failed", description: err.message, variant: "destructive" });
    } finally { setDepositActionPending(null); }
  };

  useEffect(() => { if (activeTab === "USDT Deposits") fetchUsdtDeposits(); }, [activeTab, isAdmin]);

  const { data: courses, isLoading: coursesLoading } = useListAdminCourses({
    query: { queryKey: getListAdminCoursesQueryKey(), enabled: !!isAdmin && activeTab === "Courses" },
  });

  const updateStatus = useUpdateUserStatus({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey({}) });
        toast({ title: "User status updated" });
      },
    },
  });

  const approvePayment = useApprovePayment({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey({}) });
        toast({ title: "Payment approved — user activated" });
      },
    },
  });

  const washReset = useExecuteWashReset({
    mutation: {
      onSuccess: (result) => {
        toast({ title: `Wash Reset executed — $${result.totalAmountWiped.toFixed(2)} wiped from ${result.walletsReset} wallets` });
        setConfirmWash(false);
        queryClient.invalidateQueries({ queryKey: getGetFinancialStatsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListWashHistoryQueryKey() });
      },
    },
  });

  const createCourse = useCreateAdminCourse({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminCoursesQueryKey() });
        toast({ title: "Course created" });
        setCourseDialog({ open: false, mode: "create" });
        courseForm.reset();
      },
      onError: (e: any) => toast({ title: "Failed to create course", description: e?.message, variant: "destructive" }),
    },
  });

  const updateCourse = useUpdateAdminCourse({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminCoursesQueryKey() });
        toast({ title: "Course updated" });
        setCourseDialog({ open: false, mode: "create" });
        courseForm.reset();
      },
      onError: (e: any) => toast({ title: "Failed to update course", description: e?.message, variant: "destructive" }),
    },
  });

  const deleteCourse = useDeleteAdminCourse({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminCoursesQueryKey() });
        toast({ title: "Course deactivated" });
      },
    },
  });

  const washForm = useForm({
    resolver: zodResolver(washSchema),
    defaultValues: { adminPin: "", reason: "" },
  });

  const courseForm = useForm<z.infer<typeof courseSchema>>({
    resolver: zodResolver(courseSchema),
    defaultValues: { name: "", description: "", price: 0, minPrice: undefined, maxPrice: undefined, bvAmount: 3000 },
  });

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) setLocation("/dashboard");
  }, [authLoading, user, isAdmin, setLocation]);

  const washRatio = financialStats?.washRatio ?? 0;
  const ratioPercent = Math.min(100, washRatio * 100);

  function openEditCourse(c: { id: number; name: string; description?: string | null; price: number; minPrice?: number | null; maxPrice?: number | null; bvAmount: number }) {
    courseForm.reset({
      name: c.name,
      description: c.description ?? "",
      price: c.price,
      minPrice: c.minPrice ?? undefined,
      maxPrice: c.maxPrice ?? undefined,
      bvAmount: c.bvAmount,
    });
    setCourseDialog({ open: true, mode: "edit", id: c.id });
  }

  function onCourseSubmit(v: z.infer<typeof courseSchema>) {
    if (courseDialog.mode === "create") {
      createCourse.mutate({ data: v });
    } else if (courseDialog.id) {
      updateCourse.mutate({ id: courseDialog.id, data: v });
    }
  }

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Admin Nexus</h1>
            <p className="text-sm text-muted-foreground mt-0.5">System oversight and control center</p>
          </div>
          {financialStats?.isInsolvent && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/30 animate-pulse">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <span className="text-xs font-bold text-destructive">INSOLVENT — WASH RESET REQUIRED</span>
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-secondary rounded-lg p-1 w-fit flex-wrap">
          {TABS.map((tab) => (
            <button
              key={tab}
              data-testid={`tab-${tab.toLowerCase().replace(/\s+/g, "-")}`}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2 rounded-md text-sm font-medium transition-all",
                activeTab === tab
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* USDT DEPOSITS TAB */}
        {activeTab === "USDT Deposits" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Manual USDT Deposit Requests</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Review, approve, or reject course payment deposits submitted by users</p>
              </div>
              <Button size="sm" variant="outline" onClick={fetchUsdtDeposits} disabled={usdtDepositsLoading}>
                <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", usdtDepositsLoading && "animate-spin")} /> Refresh
              </Button>
            </div>

            <div className="bg-card border border-card-border rounded-xl overflow-hidden">
              {usdtDepositsLoading ? (
                <div className="p-8 text-center"><div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" /></div>
              ) : usdtDeposits.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">No USDT deposit requests yet</div>
              ) : (
                <div className="divide-y divide-border">
                  {usdtDeposits.map((d) => (
                    <div key={d.id} className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-foreground text-sm">
                              {d.user ? `${d.user.firstName} ${d.user.lastName}` : `User #${d.userId}`}
                            </span>
                            {d.user?.email && <span className="text-xs text-muted-foreground">({d.user.email})</span>}
                            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
                              d.status === "PENDING" ? "bg-yellow-500/10 text-yellow-500" :
                              d.status === "APPROVED" ? "bg-accent/10 text-accent" : "bg-destructive/10 text-destructive"
                            )}>{d.status}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
                            <span>Amount: <span className="text-foreground font-semibold">{d.amountInUSDT} USDT</span></span>
                            <span>Network: <span className="text-foreground">{d.blockchainNetwork}</span></span>
                            <span className="col-span-2">Sender Wallet: <span className="text-foreground font-mono break-all">{d.senderWalletAddress}</span></span>
                            {d.screenshotUrl && (
                              <a href={d.screenshotUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline col-span-2">📎 View Screenshot</a>
                            )}
                            <span className="text-muted-foreground/60">Submitted: {new Date(d.createdAt).toLocaleString()}</span>
                            {d.reviewedAt && <span className="text-muted-foreground/60">Reviewed: {new Date(d.reviewedAt).toLocaleString()}</span>}
                          </div>
                          {d.status === "APPROVED" && d.coupon1Code && (
                            <div className="p-2 rounded bg-accent/5 border border-accent/20 text-xs space-y-0.5">
                              <p className="text-accent font-medium">✓ Coupons Issued</p>
                              <p className="font-mono text-foreground">{d.coupon1Code}</p>
                              <p className="font-mono text-foreground">{d.coupon2Code}</p>
                            </div>
                          )}
                          {d.status === "REJECTED" && d.rejectionReason && (
                            <p className="text-xs text-destructive bg-destructive/5 px-2 py-1 rounded">Reason: {d.rejectionReason}</p>
                          )}
                        </div>
                        {d.status === "PENDING" && (
                          <div className="flex flex-col gap-2 shrink-0">
                            <Button
                              size="sm"
                              className="h-8 px-3 text-xs"
                              onClick={() => handleDepositApprove(d.id)}
                              disabled={depositActionPending === d.id}
                            >
                              <CheckCircle className="w-3 h-3 mr-1" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-3 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                              onClick={() => handleDepositReject(d.id)}
                              disabled={depositActionPending === d.id}
                            >
                              <Ban className="w-3 h-3 mr-1" /> Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PAYMENTS TAB */}
        {activeTab === "Payments" && (

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Payment Submissions</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Review and approve manual payment submissions from new users</p>
              </div>
              <Button size="sm" variant="outline" onClick={fetchSubmissions} disabled={submissionsLoading}>
                <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", submissionsLoading && "animate-spin")} /> Refresh
              </Button>
            </div>

            <div className="bg-card border border-card-border rounded-xl overflow-hidden">
              {submissionsLoading ? (
                <div className="p-8 text-center"><div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" /></div>
              ) : submissions.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">No payment submissions yet</div>
              ) : (
                <div className="divide-y divide-border">
                  {submissions.map((s) => (
                    <div key={s.id} className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-foreground text-sm">User #{s.userId}</span>
                            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
                              s.paymentMethod === "manual_usdt" ? "bg-blue-500/10 text-blue-400" : "bg-green-500/10 text-green-400"
                            )}>
                              {s.paymentMethod === "manual_usdt" ? "USDT Transfer" : "Cash in Hand"}
                            </span>
                            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
                              s.status === "pending" ? "bg-yellow-500/10 text-yellow-500" :
                              s.status === "approved" ? "bg-accent/10 text-accent" : "bg-destructive/10 text-destructive"
                            )}>{s.status}</span>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
                            {s.paymentMethod === "manual_usdt" ? (
                              <>
                                <span>Wallet: <span className="text-foreground font-mono">{s.senderWalletAddress ?? "—"}</span></span>
                                <span>Network: <span className="text-foreground">{s.blockchainNetwork ?? "—"}</span></span>
                                <span>Amount: <span className="text-foreground font-semibold">{s.transferredAmount ? `$${parseFloat(s.transferredAmount).toFixed(2)}` : "—"}</span></span>
                                <span>Date: <span className="text-foreground">{s.paymentDateTime ? new Date(s.paymentDateTime).toLocaleString() : "—"}</span></span>
                              </>
                            ) : (
                              <>
                                <span>Ref: <span className="text-foreground font-mono">{s.paymentReferenceNumber ?? "—"}</span></span>
                                <span>Collector: <span className="text-foreground">{s.collectorName ?? "—"} (ID: {s.collectorId ?? "—"})</span></span>
                                <span>Date: <span className="text-foreground">{s.paymentDate ? new Date(s.paymentDate).toLocaleDateString() : "—"}</span></span>
                                {s.remarks && <span className="col-span-2">Remarks: <span className="text-foreground">{s.remarks}</span></span>}
                              </>
                            )}
                            {s.paymentScreenshotUrl && (
                              <a href={s.paymentScreenshotUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline col-span-2">📎 View Screenshot</a>
                            )}
                            <span className="text-muted-foreground/60">Submitted: {new Date(s.createdAt).toLocaleString()}</span>
                          </div>
                          {s.rejectionReason && (
                            <p className="mt-2 text-xs text-destructive bg-destructive/5 px-2 py-1 rounded">Rejected: {s.rejectionReason}</p>
                          )}
                        </div>
                        {s.status === "pending" && (
                          <div className="flex flex-col gap-2 shrink-0">
                            <Button
                              size="sm"
                              className="h-8 px-3 text-xs"
                              onClick={() => handleSubmissionAction(s.id, "approve")}
                              disabled={actionPending === s.id}
                            >
                              <CheckCircle className="w-3 h-3 mr-1" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-3 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                              onClick={() => {
                                const reason = prompt("Rejection reason:");
                                if (reason !== null) handleSubmissionAction(s.id, "reject", reason);
                              }}
                              disabled={actionPending === s.id}
                            >
                              <Ban className="w-3 h-3 mr-1" /> Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* OVERVIEW TAB */}
        {activeTab === "Overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Total Inflow", value: `$${(financialStats?.totalInflow ?? 0).toFixed(2)}`, icon: TrendingUp, color: "accent" },
                { label: "Total Outflow", value: `$${(financialStats?.totalOutflow ?? 0).toFixed(2)}`, icon: TrendingDown, color: "destructive" },
                { label: "Commission Paid", value: `$${(financialStats?.totalCommissionPaid ?? 0).toFixed(2)}`, icon: DollarSign, color: "primary" },
                { label: "Members", value: String(networkStats?.totalNodes ?? 0), icon: Users, color: "purple" },
              ].map((s) => (
                <div key={s.label} className="bg-card border border-card-border rounded-xl p-4" data-testid={`admin-stat-${s.label.toLowerCase().replace(/\s+/g, "-")}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
                    <s.icon className={cn("w-4 h-4", s.color === "accent" ? "text-accent" : s.color === "destructive" ? "text-destructive" : s.color === "purple" ? "text-purple-400" : "text-primary")} />
                  </div>
                  <p className="text-xl font-bold text-foreground">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Wash ratio gauge */}
            <div className="bg-card border border-card-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground">Inflow / Outflow Ratio</h2>
                </div>
                <span className={cn("text-sm font-bold", washRatio > 1 ? "text-destructive" : washRatio > 0.8 ? "text-yellow-500" : "text-accent")}>
                  {(washRatio * 100).toFixed(1)}%
                </span>
              </div>
              <div className="h-3 bg-secondary rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-700",
                    washRatio > 1 ? "bg-destructive" : washRatio > 0.8 ? "bg-yellow-500" : "bg-accent"
                  )}
                  style={{ width: `${Math.min(ratioPercent, 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
                <span>Healthy (&lt;80%)</span>
                <span>Warning (80%)</span>
                <span>Critical (100%)</span>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border text-center">
                <div>
                  <p className="text-sm font-bold text-foreground">${(financialStats?.retentionPool ?? 0).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Retention (60%)</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">${(financialStats?.overheadPool ?? 0).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Overhead (30%)</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">${(financialStats?.commissionPool ?? 0).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Commission (10%)</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === "Users" && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <Input
                placeholder="Search users..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="max-w-xs"
                data-testid="input-user-search"
              />
              <div className="flex gap-1">
                {["", "active", "pending", "suspended"].map((s) => (
                  <button
                    key={s}
                    data-testid={`filter-${s || "all"}`}
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                      statusFilter === s ? "bg-primary text-white" : "bg-secondary text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {s || "All"}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-card border border-card-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Member</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Package</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Joined</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {usersLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={5} className="px-4 py-3">
                          <div className="h-4 bg-secondary rounded animate-pulse w-full" />
                        </td>
                      </tr>
                    ))
                  ) : users?.map((u) => (
                    <tr key={u.id} className="hover:bg-secondary/20 transition-colors" data-testid={`user-row-${u.id}`}>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground">{u.firstName} {u.lastName}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
                            u.status === "active" ? "bg-accent/20 text-accent" :
                            u.status === "pending" ? "bg-yellow-500/20 text-yellow-500" :
                            "bg-destructive/20 text-destructive"
                          )}>
                            {u.status}
                          </span>
                          {u.status === "pending" && (
                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider",
                              u.isPaid ? "bg-accent/20 text-accent border border-accent/25" : "bg-destructive/20 text-destructive border border-destructive/25"
                            )}>
                              {u.isPaid ? "Paid" : "Unpaid"}
                            </span>
                          )}
                        </div>
                        {u.role === "admin" && (
                          <span className="ml-1 text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded mt-1 inline-block">admin</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground capitalize">{u.packageType ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {u.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-primary border-primary/30 hover:bg-primary/10 h-7 px-2"
                                onClick={() => setSelectedKycUser(u)}
                                data-testid={`button-view-kyc-${u.id}`}
                              >
                                <FileText className="w-3 h-3 mr-1" /> View KYC
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-accent border-accent/30 hover:bg-accent/10 h-7 px-2"
                                onClick={() => approvePayment.mutate({ id: u.id })}
                                disabled={approvePayment.isPending}
                                data-testid={`button-approve-${u.id}`}
                              >
                                <UserCheck className="w-3 h-3 mr-1" /> Approve
                              </Button>
                            </>
                          )}
                          {u.status === "active" && u.role !== "admin" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive border-destructive/30 hover:bg-destructive/10 h-7 px-2"
                              onClick={() => updateStatus.mutate({ id: u.id, data: { status: "suspended" } })}
                              data-testid={`button-suspend-${u.id}`}
                            >
                              <Ban className="w-3 h-3 mr-1" /> Suspend
                            </Button>
                          )}
                          {u.status === "suspended" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-accent border-accent/30 hover:bg-accent/10 h-7 px-2"
                              onClick={() => updateStatus.mutate({ id: u.id, data: { status: "active" } })}
                              data-testid={`button-activate-${u.id}`}
                            >
                              <CheckCircle className="w-3 h-3 mr-1" /> Activate
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users?.length === 0 && !usersLoading && (
                <div className="p-8 text-center text-sm text-muted-foreground">No users found</div>
              )}
            </div>
          </div>
        )}

        {/* NETWORK TAB */}
        {activeTab === "Network" && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Total Nodes", value: networkStats?.totalNodes ?? 0 },
                { label: "Active Nodes", value: networkStats?.activeNodes ?? 0 },
                { label: "Pending", value: networkStats?.pendingNodes ?? 0 },
              ].map((s) => (
                <div key={s.label} className="bg-card border border-card-border rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="bg-card border border-card-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Network className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Global Tree ({networkTree?.length ?? 0} nodes)</h2>
              </div>
              <div className="space-y-2 max-h-96 overflow-auto">
                {networkTree?.map((node) => (
                  <div key={node.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors" data-testid={`network-row-${node.id}`}
                    style={{ paddingLeft: `${12 + node.depth * 20}px` }}>
                    <div className={cn("w-2 h-2 rounded-full flex-shrink-0",
                      node.status === "active" ? "bg-accent" : node.status === "pending" ? "bg-yellow-500" : "bg-destructive"
                    )} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-foreground">{node.firstName} {node.lastName}</span>
                      {node.leg && <span className="ml-2 text-xs text-muted-foreground capitalize">({node.leg})</span>}
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground flex-shrink-0">
                      <span className="text-primary">L: {node.leftBv.toFixed(0)}</span>
                      <span className="text-accent">R: {node.rightBv.toFixed(0)}</span>
                      <span className={cn("px-1.5 py-0.5 rounded",
                        node.status === "active" ? "bg-accent/20 text-accent" : "bg-yellow-500/20 text-yellow-500"
                      )}>{node.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* BV STATS TAB */}
        {activeTab === "BV Stats" && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: "Global Left BV", value: `${(bvStats?.globalLeftBv ?? 0).toFixed(0)} BV`, icon: TrendingUp },
              { label: "Global Right BV", value: `${(bvStats?.globalRightBv ?? 0).toFixed(0)} BV`, icon: TrendingUp },
              { label: "Matched Cycles", value: String(bvStats?.totalMatchedCycles ?? 0), icon: Zap },
              { label: "Total Bonus Paid", value: `$${(bvStats?.totalBonusPaid ?? 0).toFixed(2)}`, icon: DollarSign },
              { label: "Active Members", value: String(bvStats?.activeMemberCount ?? 0), icon: Users },
              { label: "Per Cycle Bonus", value: "$70.00", icon: Activity },
            ].map((s) => (
              <div key={s.label} className="bg-card border border-card-border rounded-xl p-5" data-testid={`bv-stat-${s.label.toLowerCase().replace(/\s+/g, "-")}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
                  <s.icon className="w-4 h-4 text-primary" />
                </div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* COURSES TAB */}
        {activeTab === "Courses" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Course Catalog</h2>
                <span className="text-xs text-muted-foreground">({courses?.length ?? 0} courses)</span>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  courseForm.reset({ name: "", description: "", price: 0, bvAmount: 3000 });
                  setCourseDialog({ open: true, mode: "create" });
                }}
                data-testid="button-add-course"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Course
              </Button>
            </div>

            <div className="bg-card border border-card-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Course</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Price</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Price Range</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">BV</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {coursesLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={6} className="px-4 py-3">
                          <div className="h-4 bg-secondary rounded animate-pulse w-full" />
                        </td>
                      </tr>
                    ))
                  ) : courses?.map((c) => (
                    <tr key={c.id} className="hover:bg-secondary/20 transition-colors" data-testid={`course-row-${c.id}`}>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground">{c.name}</p>
                          {c.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{c.description}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-semibold text-foreground">${c.price.toFixed(2)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">
                          {c.minPrice != null || c.maxPrice != null
                            ? `$${(c.minPrice ?? 0).toFixed(0)} – $${(c.maxPrice ?? c.price).toFixed(0)}`
                            : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-primary font-medium">{c.bvAmount.toFixed(0)} BV</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
                          c.isActive ? "bg-accent/20 text-accent" : "bg-secondary text-muted-foreground"
                        )}>
                          {c.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2"
                            onClick={() => openEditCourse(c)}
                            data-testid={`button-edit-course-${c.id}`}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                          {c.isActive && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                              onClick={() => deleteCourse.mutate({ id: c.id })}
                              disabled={deleteCourse.isPending}
                              data-testid={`button-deactivate-course-${c.id}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {courses?.length === 0 && !coursesLoading && (
                <div className="p-8 text-center text-sm text-muted-foreground">No courses yet — add one above</div>
              )}
            </div>
          </div>
        )}

        {/* WASH RESET TAB */}
        {activeTab === "Wash Reset" && (
          <div className="space-y-4">
            <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
                <div>
                  <h2 className="text-sm font-bold text-destructive mb-1">Wash Reset Engine</h2>
                  <p className="text-xs text-muted-foreground">
                    The Wash Reset wipes all unredeemed E-Wallet balances and resets the commission ratio. This action is
                    irreversible and should only be executed when the Outflow/Inflow ratio exceeds 100% (system insolvent).
                  </p>
                  <div className="flex items-center gap-3 mt-3">
                    <div className="flex items-center gap-1.5">
                      <span className={cn("w-2 h-2 rounded-full", financialStats?.isInsolvent ? "bg-destructive animate-pulse" : "bg-accent")} />
                      <span className="text-xs font-medium text-muted-foreground">
                        Status: {financialStats?.isInsolvent ? "INSOLVENT" : "Healthy"}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">Ratio: {((financialStats?.washRatio ?? 0) * 100).toFixed(1)}%</span>
                  </div>
                  <Button
                    className="mt-4 bg-destructive hover:bg-destructive/90"
                    onClick={() => setConfirmWash(true)}
                    data-testid="button-wash-reset"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" /> Execute Wash Reset
                  </Button>
                </div>
              </div>
            </div>

            <div className="bg-card border border-card-border rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                <History className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">Reset History</h2>
              </div>
              {washHistory?.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">No wash resets executed yet</div>
              ) : (
                <div className="divide-y divide-border">
                  {washHistory?.map((e) => (
                    <div key={e.id} className="px-5 py-3 flex items-center gap-4" data-testid={`wash-event-${e.id}`}>
                      <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
                        <RefreshCw className="w-4 h-4 text-destructive" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {e.walletsReset} wallets reset — ${e.totalAmountWiped.toFixed(2)} wiped
                        </p>
                        {e.reason && <p className="text-xs text-muted-foreground mt-0.5">{e.reason}</p>}
                        <p className="text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Wash reset confirm dialog */}
      <Dialog open={confirmWash} onOpenChange={setConfirmWash}>
        <DialogContent className="bg-card border-card-border">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Confirm Wash Reset
            </DialogTitle>
            <DialogDescription>
              This will permanently wipe all unredeemed wallet balances. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <Form {...washForm}>
            <form onSubmit={washForm.handleSubmit((v) => washReset.mutate({ data: v }))} className="space-y-4">
              <FormField control={washForm.control} name="reason" render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason (optional)</FormLabel>
                  <FormControl><Input {...field} placeholder="Insolvent — ratio exceeded 100%" data-testid="input-wash-reason" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={washForm.control} name="adminPin" render={({ field }) => (
                <FormItem>
                  <FormLabel>Admin PIN</FormLabel>
                  <FormControl><Input {...field} type="password" placeholder="••••" data-testid="input-admin-pin" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full bg-destructive hover:bg-destructive/90" disabled={washReset.isPending} data-testid="button-confirm-wash">
                {washReset.isPending ? "Executing..." : "Confirm Wash Reset"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Course create/edit dialog */}
      <Dialog open={courseDialog.open} onOpenChange={(v) => setCourseDialog((p) => ({ ...p, open: v }))}>
        <DialogContent className="bg-card border-card-border max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              {courseDialog.mode === "create" ? "Add Course" : "Edit Course"}
            </DialogTitle>
            <DialogDescription>
              {courseDialog.mode === "create"
                ? "Create a new course available for purchase via referral links."
                : "Update course details. Price and BV changes apply to future purchases only."}
            </DialogDescription>
          </DialogHeader>
          <Form {...courseForm}>
            <form onSubmit={courseForm.handleSubmit(onCourseSubmit)} className="space-y-3">
              <FormField control={courseForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Course Name</FormLabel>
                  <FormControl><Input {...field} placeholder="e.g. Leadership Mastery" data-testid="input-course-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={courseForm.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl><Input {...field} placeholder="Short course description" data-testid="input-course-description" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={courseForm.control} name="price" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price ($)</FormLabel>
                    <FormControl><Input {...field} type="number" step="0.01" placeholder="299.00" data-testid="input-course-price" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={courseForm.control} name="bvAmount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>BV Amount</FormLabel>
                    <FormControl><Input {...field} type="number" placeholder="3000" data-testid="input-course-bv" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={courseForm.control} name="minPrice" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min Price (optional)</FormLabel>
                    <FormControl><Input {...field} type="number" step="0.01" placeholder="199.00" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={courseForm.control} name="maxPrice" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Price (optional)</FormLabel>
                    <FormControl><Input {...field} type="number" step="0.01" placeholder="499.00" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={createCourse.isPending || updateCourse.isPending}
                data-testid="button-save-course"
              >
                {(createCourse.isPending || updateCourse.isPending)
                  ? "Saving..."
                  : courseDialog.mode === "create" ? "Create Course" : "Save Changes"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* KYC details dialog */}
      <Dialog open={!!selectedKycUser} onOpenChange={(open) => !open && setSelectedKycUser(null)}>
        <DialogContent className="bg-card border-card-border max-w-2xl overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <FileText className="w-5 h-5 text-primary" />
              KYC Verification Documents
            </DialogTitle>
            <DialogDescription>
              Review the registration details and government-issued ID for verification.
            </DialogDescription>
          </DialogHeader>

          {selectedKycUser && (
            <div className="space-y-6 mt-4">
              {/* Personal Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-secondary/20 p-4 rounded-xl border border-border/40">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Distributor Name</p>
                  <p className="text-sm font-bold text-foreground mt-0.5">{selectedKycUser.firstName} {selectedKycUser.lastName}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Username</p>
                  <p className="text-sm font-bold text-foreground mt-0.5">@{selectedKycUser.username || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Email Address</p>
                  <p className="text-sm text-foreground mt-0.5">{selectedKycUser.email}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Mobile Number</p>
                  <p className="text-sm text-foreground mt-0.5">{selectedKycUser.mobileNumber || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Date of Birth</p>
                  <p className="text-sm text-foreground mt-0.5">{selectedKycUser.dob ? new Date(selectedKycUser.dob).toLocaleDateString(undefined, { dateStyle: 'medium' }) : "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Gender</p>
                  <p className="text-sm capitalize text-foreground mt-0.5">{selectedKycUser.gender || "—"}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Residential Address</p>
                  <p className="text-sm text-foreground mt-0.5">
                    {selectedKycUser.address ? `${selectedKycUser.address}, ` : ""}
                    {selectedKycUser.city ? `${selectedKycUser.city}, ` : ""}
                    {selectedKycUser.state ? `${selectedKycUser.state}, ` : ""}
                    {selectedKycUser.countryCode || ""}
                  </p>
                </div>
                {selectedKycUser.bankDetails && (
                  <div className="md:col-span-2">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Bank details</p>
                    <p className="text-sm text-foreground mt-0.5">{selectedKycUser.bankDetails}</p>
                  </div>
                )}
              </div>

              {/* Documents grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Profile Photo */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-primary" /> Profile Photo
                  </p>
                  <div className="aspect-square bg-secondary/10 border border-border/60 rounded-xl overflow-hidden flex items-center justify-center relative group">
                    {selectedKycUser.profilePhoto ? (
                      <img
                        src={selectedKycUser.profilePhoto}
                        alt="Profile proof"
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
                        <Camera className="w-8 h-8 text-muted-foreground/50" />
                        <span className="text-xs text-muted-foreground">No Profile Photo Uploaded</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Government ID Proof */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-primary" /> Government ID Proof
                  </p>
                  <div className="aspect-square bg-secondary/10 border border-border/60 rounded-xl overflow-hidden flex items-center justify-center relative group">
                    {selectedKycUser.govtIdProof ? (
                      <img
                        src={selectedKycUser.govtIdProof}
                        alt="Government ID proof"
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
                        <FileText className="w-8 h-8 text-muted-foreground/50" />
                        <span className="text-xs text-muted-foreground">No ID Proof Uploaded</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons in dialog */}
              <div className="flex gap-3 justify-end pt-4 border-t border-border">
                <Button
                  variant="outline"
                  onClick={() => setSelectedKycUser(null)}
                  className="h-9"
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    approvePayment.mutate({ id: selectedKycUser.id });
                    setSelectedKycUser(null);
                  }}
                  disabled={approvePayment.isPending}
                  className="bg-accent hover:bg-accent/90 h-9"
                >
                  <UserCheck className="w-4 h-4 mr-1.5" /> Approve & Activate Distributor
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
