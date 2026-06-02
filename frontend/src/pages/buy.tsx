import { useEffect, useState } from "react";
import { useSearch, useLocation } from "wouter";
import { useGetCourseReferral, getGetCourseReferralQueryKey, usePurchaseCourse } from "@/api-client";
import { BookOpen, ShieldCheck, Zap, CheckCircle, AlertTriangle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function BuyPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const courseId = parseInt(params.get("courseId") ?? "0");
  const refCode = params.get("ref") ?? "";
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [pin, setPin] = useState("");
  const [purchased, setPurchased] = useState<{ couponCode: string; bvAssigned: number; directCommission: number; courseName: string } | null>(null);

  const { data: referral, isLoading: referralLoading, error: referralError } = useGetCourseReferral(
    { courseId, refCode },
    { query: { queryKey: getGetCourseReferralQueryKey({ courseId, refCode }), enabled: !!courseId && !!refCode } },
  );

  const purchase = usePurchaseCourse({
    mutation: {
      onSuccess: (result) => {
        setPurchased({
          couponCode: result.couponCode,
          bvAssigned: result.bvAssigned,
          directCommission: result.directCommission,
          courseName: result.course.name,
        });
        toast({ title: "Purchase successful!", description: `Coupon: ${result.couponCode}` });
      },
      onError: (e: any) => {
        const msg = e?.response?.data?.error ?? e?.message ?? "Purchase failed";
        toast({ title: "Purchase failed", description: msg, variant: "destructive" });
      },
    },
  });

  const course = referral?.course;
  const isValid = !!courseId && !!refCode && !referralError;

  if (!courseId || !refCode) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-card border border-card-border rounded-2xl p-8 text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto" />
          <h1 className="text-xl font-bold text-foreground">Invalid Referral Link</h1>
          <p className="text-sm text-muted-foreground">This link is missing a course ID or referral code. Please ask your sponsor for a valid link.</p>
          <Button variant="outline" onClick={() => setLocation("/login")}>Go to Login</Button>
        </div>
      </div>
    );
  }

  if (purchased) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-card border border-card-border rounded-2xl p-8 text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Purchase Complete!</h1>
            <p className="text-sm text-muted-foreground mt-1">You've successfully purchased <strong>{purchased.courseName}</strong></p>
          </div>

          <div className="bg-secondary/40 rounded-xl p-4 space-y-3 text-left">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Coupon Code</span>
              <span className="text-sm font-mono font-bold text-primary">{purchased.couponCode}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">BV Assigned</span>
              <span className="text-sm font-bold text-accent">{purchased.bvAssigned.toFixed(0)} BV</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Sponsor Commission</span>
              <span className="text-sm font-medium text-foreground">${purchased.directCommission.toFixed(2)}</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">Your coupon code is active and can be redeemed from your wallet.</p>

          <Button className="w-full" onClick={() => setLocation("/wallet")}>View My Wallet</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-5">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <BookOpen className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Course Purchase</h1>
          <p className="text-sm text-muted-foreground">Complete your purchase via referral link</p>
        </div>

        {/* Course card */}
        <div className={cn(
          "bg-card border rounded-2xl p-6 space-y-4 transition-all",
          referralLoading ? "border-card-border animate-pulse" : isValid ? "border-accent/40" : "border-destructive/40"
        )}>
          {referralLoading ? (
            <div className="space-y-3">
              <div className="h-5 bg-secondary rounded w-3/4" />
              <div className="h-4 bg-secondary rounded w-1/2" />
              <div className="h-8 bg-secondary rounded w-1/3 mt-2" />
            </div>
          ) : referralError ? (
            <div className="flex items-center gap-3 text-destructive">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold">Invalid Referral Link</p>
                <p className="text-xs text-muted-foreground mt-0.5">This course or referral code is not valid or has been deactivated.</p>
              </div>
            </div>
          ) : course ? (
            <>
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">{course.name}</h2>
                    {course.description && <p className="text-sm text-muted-foreground mt-0.5">{course.description}</p>}
                  </div>
                  <span className="text-2xl font-bold text-foreground shrink-0">${course.price.toFixed(2)}</span>
                </div>
                {(course.minPrice != null || course.maxPrice != null) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Price range: ${(course.minPrice ?? 0).toFixed(0)} – ${(course.maxPrice ?? course.price).toFixed(0)}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-4 pt-2 border-t border-border">
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs text-muted-foreground">{course.bvAmount.toFixed(0)} BV assigned on purchase</span>
                </div>
              </div>

              {/* Sponsor info */}
              <div className="flex items-center gap-2 bg-accent/10 rounded-lg px-3 py-2">
                <ShieldCheck className="w-4 h-4 text-accent flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-foreground">Sponsored by {referral.sponsorName}</p>
                  <p className="text-xs text-muted-foreground">Referral code: {referral.sponsorCode}</p>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Purchase form */}
        {!referralError && !referralLoading && course && (
          <div className="bg-card border border-card-border rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Complete Purchase</h3>
            <p className="text-xs text-muted-foreground">
              You must be logged in to purchase. The course price will be debited from your E-Wallet balance.
            </p>

            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Lock className="w-3 h-3" /> Wallet PIN (if set)
              </label>
              <Input
                type="password"
                placeholder="Enter your wallet PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                maxLength={8}
                data-testid="input-purchase-pin"
              />
              <p className="text-xs text-muted-foreground">Leave blank if you haven't set a PIN yet.</p>
            </div>

            <div className="flex items-center justify-between py-3 border-t border-border">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-xl font-bold text-foreground">${course.price.toFixed(2)}</span>
            </div>

            <Button
              className="w-full"
              disabled={purchase.isPending}
              onClick={() => {
                purchase.mutate({
                  data: {
                    courseId,
                    referralCode: refCode,
                    pin: pin || undefined,
                  },
                });
              }}
              data-testid="button-confirm-purchase"
            >
              {purchase.isPending ? "Processing..." : `Purchase for $${course.price.toFixed(2)}`}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Don't have an account?{" "}
              <a
                href={`/register?ref=${refCode}`}
                className="text-primary hover:underline"
              >
                Register first
              </a>
              {" "}then return to this page.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
