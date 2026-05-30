import Layout from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import {
  useGetWallet, getGetWalletQueryKey,
  useListWalletTransactions, getListWalletTransactionsQueryKey,
  useListCoupons, getListCouponsQueryKey,
  useCreateCoupon, useRedeemCoupon, useUpdateWalletPin,
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Wallet, ArrowDownLeft, ArrowUpRight, Plus, Copy, Check,
  Tag, Lock, Unlock, AlertCircle, CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const pinSetSchema = z.object({
  pin: z.string().min(4).max(6).regex(/^\d+$/, "PIN must be digits only"),
  currentPin: z.string().optional(),
});

const couponCreateSchema = z.object({
  amount: z.coerce.number().min(1, "Amount must be at least $1"),
  pin: z.string().min(4, "Enter your PIN"),
});

const couponRedeemSchema = z.object({
  code: z.string().min(1, "Coupon code required"),
});

export default function WalletPage() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showSetPin, setShowSetPin] = useState(false);
  const [showCreateCoupon, setShowCreateCoupon] = useState(false);
  const [showRedeem, setShowRedeem] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const { data: wallet, isLoading: walletLoading } = useGetWallet({
    query: { queryKey: getGetWalletQueryKey(), enabled: !!user },
  });

  const { data: transactions } = useListWalletTransactions({
    query: { queryKey: getListWalletTransactionsQueryKey(), enabled: !!user },
  });

  const { data: coupons } = useListCoupons({
    query: { queryKey: getListCouponsQueryKey(), enabled: !!user },
  });

  const invalidateWallet = () => {
    queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListWalletTransactionsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListCouponsQueryKey() });
  };

  const setPinForm = useForm({
    resolver: zodResolver(pinSetSchema),
    defaultValues: { pin: "", currentPin: "" },
  });

  const createCouponForm = useForm({
    resolver: zodResolver(couponCreateSchema),
    defaultValues: { amount: 10, pin: "" },
  });

  const redeemForm = useForm({
    resolver: zodResolver(couponRedeemSchema),
    defaultValues: { code: "" },
  });

  const updatePin = useUpdateWalletPin({
    mutation: {
      onSuccess: () => {
        toast({ title: "PIN updated successfully" });
        setShowSetPin(false);
        setPinForm.reset();
        invalidateWallet();
      },
    },
  });

  const createCoupon = useCreateCoupon({
    mutation: {
      onSuccess: (coupon) => {
        toast({ title: `Coupon ${coupon.code} created!` });
        setShowCreateCoupon(false);
        createCouponForm.reset();
        invalidateWallet();
      },
      onError: () => {
        toast({ title: "Failed to create coupon", variant: "destructive" });
      },
    },
  });

  const redeemCoupon = useRedeemCoupon({
    mutation: {
      onSuccess: (coupon) => {
        toast({ title: `Coupon redeemed: $${coupon.amount} applied` });
        setShowRedeem(false);
        redeemForm.reset();
        invalidateWallet();
      },
      onError: () => {
        toast({ title: "Invalid or already used coupon", variant: "destructive" });
      },
    },
  });

  useEffect(() => {
    if (!authLoading && !user) setLocation("/login");
  }, [authLoading, user, setLocation]);

  const handleCopy = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (walletLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-xl font-bold text-foreground">E-Wallet</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your balance, coupons, and transactions</p>
        </div>

        {/* Wallet card */}
        <div className="relative bg-gradient-to-br from-primary/20 via-card to-card border border-primary/30 rounded-2xl p-6 overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">Available Balance</span>
            </div>
            <p className="text-4xl font-bold text-foreground mb-1" data-testid="text-wallet-balance">
              ${(wallet?.availableBalance ?? 0).toFixed(2)}
            </p>
            <div className="flex gap-6 mt-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Total Earned</p>
                <p className="font-semibold text-foreground">${(wallet?.totalEarned ?? 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Total Spent</p>
                <p className="font-semibold text-foreground">${(wallet?.totalSpent ?? 0).toFixed(2)}</p>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <Button
                size="sm"
                onClick={() => setShowCreateCoupon(true)}
                disabled={!wallet?.hasPin}
                data-testid="button-create-coupon"
              >
                <Plus className="w-4 h-4 mr-1" /> Generate Coupon
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowRedeem(true)} data-testid="button-redeem-coupon">
                <Tag className="w-4 h-4 mr-1" /> Redeem Coupon
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowSetPin(true)}
                data-testid="button-set-pin"
                className="ml-auto cursor-pointer"
              >
                {wallet?.hasPin ? <Unlock className="w-4 h-4 mr-1" /> : <Lock className="w-4 h-4 mr-1" />}
                {wallet?.hasPin ? "Change PIN" : "Set PIN"}
              </Button>
            </div>
            {!wallet?.hasPin && (
              <div className="mt-3 flex items-center gap-2 text-xs text-yellow-500">
                <AlertCircle className="w-3.5 h-3.5" />
                Set a wallet PIN to enable coupon generation
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Coupons */}
          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Your Coupons</h2>
            </div>
            <div className="divide-y divide-border max-h-72 overflow-auto">
              {coupons?.length === 0 ? (
                <div className="p-8 text-center">
                  <Tag className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No coupons yet</p>
                </div>
              ) : (
                coupons?.map((coupon) => (
                  <div key={coupon.id} className="flex items-center gap-3 px-5 py-3" data-testid={`coupon-${coupon.id}`}>
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                      coupon.status === "active" ? "bg-accent/20" : "bg-secondary"
                    )}>
                      {coupon.status === "active"
                        ? <Tag className="w-4 h-4 text-accent" />
                        : <CheckCircle className="w-4 h-4 text-muted-foreground" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-foreground truncate">{coupon.code}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium",
                          coupon.status === "active" ? "bg-accent/20 text-accent" : "bg-secondary text-muted-foreground"
                        )}>
                          {coupon.status}
                        </span>
                        <span className="text-xs text-muted-foreground">${coupon.amount.toFixed(2)}</span>
                      </div>
                    </div>
                    {coupon.status === "active" && (
                      <button
                        data-testid={`button-copy-coupon-${coupon.id}`}
                        onClick={() => handleCopy(coupon.code)}
                        className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                      >
                        {copiedCode === coupon.code
                          ? <Check className="w-4 h-4 text-accent" />
                          : <Copy className="w-4 h-4 text-muted-foreground" />
                        }
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Transactions */}
          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Transactions</h2>
            </div>
            <div className="divide-y divide-border max-h-72 overflow-auto">
              {transactions?.length === 0 ? (
                <div className="p-8 text-center">
                  <Wallet className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No transactions yet</p>
                </div>
              ) : (
                transactions?.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 px-5 py-3" data-testid={`transaction-${tx.id}`}>
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                      tx.type === "credit" ? "bg-accent/10" : "bg-destructive/10"
                    )}>
                      {tx.type === "credit"
                        ? <ArrowDownLeft className="w-4 h-4 text-accent" />
                        : <ArrowUpRight className="w-4 h-4 text-destructive" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground leading-snug truncate">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className={cn("text-sm font-bold flex-shrink-0",
                      tx.type === "credit" ? "text-accent" : "text-destructive"
                    )}>
                      {tx.type === "credit" ? "+" : "-"}${tx.amount.toFixed(2)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Set PIN dialog */}
      <Dialog open={showSetPin} onOpenChange={setShowSetPin}>
        <DialogContent className="bg-card border-card-border">
          <DialogHeader>
            <DialogTitle>{wallet?.hasPin ? "Change Wallet PIN" : "Set Wallet PIN"}</DialogTitle>
            <DialogDescription>A 4-6 digit PIN is required for coupon generation</DialogDescription>
          </DialogHeader>
          <Form {...setPinForm}>
            <form onSubmit={setPinForm.handleSubmit((v) => updatePin.mutate({ data: { pin: v.pin, currentPin: v.currentPin || null } }))} className="space-y-4">
              {wallet?.hasPin && (
                <FormField control={setPinForm.control} name="currentPin" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current PIN</FormLabel>
                    <FormControl><Input {...field} type="password" placeholder="••••" maxLength={6} data-testid="input-current-pin" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
              <FormField control={setPinForm.control} name="pin" render={({ field }) => (
                <FormItem>
                  <FormLabel>New PIN (4-6 digits)</FormLabel>
                  <FormControl><Input {...field} type="password" placeholder="••••" maxLength={6} data-testid="input-new-pin" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={updatePin.isPending} data-testid="button-confirm-pin">
                {updatePin.isPending ? "Saving..." : "Save PIN"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Create coupon dialog */}
      <Dialog open={showCreateCoupon} onOpenChange={setShowCreateCoupon}>
        <DialogContent className="bg-card border-card-border">
          <DialogHeader>
            <DialogTitle>Generate Coupon</DialogTitle>
            <DialogDescription>Convert wallet balance to a reusable coupon code</DialogDescription>
          </DialogHeader>
          <Form {...createCouponForm}>
            <form onSubmit={createCouponForm.handleSubmit((v) => createCoupon.mutate({ data: v }))} className="space-y-4">
              <div className="p-3 rounded-lg bg-secondary border border-border text-xs text-muted-foreground">
                Available: <span className="font-bold text-foreground">${(wallet?.availableBalance ?? 0).toFixed(2)}</span>
              </div>
              <FormField control={createCouponForm.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount ($)</FormLabel>
                  <FormControl><Input {...field} type="number" min={1} step="0.01" data-testid="input-coupon-amount" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={createCouponForm.control} name="pin" render={({ field }) => (
                <FormItem>
                  <FormLabel>Wallet PIN</FormLabel>
                  <FormControl><Input {...field} type="password" placeholder="••••" maxLength={6} data-testid="input-coupon-pin" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={createCoupon.isPending} data-testid="button-confirm-coupon">
                {createCoupon.isPending ? "Generating..." : "Generate Coupon"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Redeem coupon dialog */}
      <Dialog open={showRedeem} onOpenChange={setShowRedeem}>
        <DialogContent className="bg-card border-card-border">
          <DialogHeader>
            <DialogTitle>Redeem Coupon</DialogTitle>
            <DialogDescription>Enter a coupon code to apply at checkout</DialogDescription>
          </DialogHeader>
          <Form {...redeemForm}>
            <form onSubmit={redeemForm.handleSubmit((v) => redeemCoupon.mutate({ data: v }))} className="space-y-4">
              <FormField control={redeemForm.control} name="code" render={({ field }) => (
                <FormItem>
                  <FormLabel>Coupon Code</FormLabel>
                  <FormControl><Input {...field} placeholder="COUPON-XXXXXX-MLM" data-testid="input-coupon-code" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={redeemCoupon.isPending} data-testid="button-confirm-redeem">
                {redeemCoupon.isPending ? "Redeeming..." : "Redeem"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
