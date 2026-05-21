import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRegisterUser, useVerifyReferral, getVerifyReferralQueryKey } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Network, CheckCircle, AlertCircle, ChevronRight, ChevronLeft, Package, Shield } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const step1Schema = z.object({
  referrerId: z.string().min(1, "Referral code required"),
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  email: z.string().email("Valid email required"),
  mobileNumber: z.string().min(6, "Mobile number required"),
  address: z.string().min(5, "Address required"),
  countryCode: z.string().min(2, "Country required"),
});

const step2Schema = z.object({
  packageType: z.enum(["starter", "pro", "elite"]),
  agreedToTerms: z.literal(true, { errorMap: () => ({ message: "You must agree to terms" }) }),
});

const step3Schema = z.object({
  password: z.string().min(8, "At least 8 characters"),
  confirmPassword: z.string().min(1, "Confirm your password"),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

const packages = [
  { id: "starter", name: "Starter", price: "$10", bv: "10 BV", description: "Perfect for getting started" },
  { id: "pro", name: "Pro", price: "$20", bv: "20 BV", description: "Most popular package" },
  { id: "elite", name: "Elite", price: "$30", bv: "30 BV", description: "Maximum earning potential" },
];

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [refId, setRefId] = useState("");
  const [formData, setFormData] = useState<any>({});
  const [success, setSuccess] = useState(false);

  // Parse ref from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) setRefId(ref);
  }, []);

  const { data: referralInfo, isLoading: verifyingRef } = useVerifyReferral(
    { refId },
    { query: { enabled: refId.length >= 4, queryKey: getVerifyReferralQueryKey({ refId }), retry: false } },
  );

  const form1 = useForm({
    resolver: zodResolver(step1Schema),
    defaultValues: { referrerId: refId, firstName: "", lastName: "", email: "", mobileNumber: "", address: "", countryCode: "US" },
  });

  const form2 = useForm({
    resolver: zodResolver(step2Schema),
    defaultValues: { packageType: "pro" as "starter" | "pro" | "elite", agreedToTerms: true as true },
  });

  const form3 = useForm({
    resolver: zodResolver(step3Schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (refId) form1.setValue("referrerId", refId);
  }, [refId]);

  const register = useRegisterUser({
    mutation: {
      onSuccess: () => setSuccess(true),
    },
  });

  const onStep1 = (values: any) => {
    setFormData((prev: any) => ({ ...prev, ...values }));
    setStep(2);
  };
  const onStep2 = (values: any) => {
    setFormData((prev: any) => ({ ...prev, ...values }));
    setStep(3);
  };
  const onStep3 = (values: any) => {
    register.mutate({ data: { ...formData, ...values } });
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/20 border border-accent/30 mb-4">
            <CheckCircle className="w-8 h-8 text-accent" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Registration Submitted</h2>
          <p className="text-sm text-muted-foreground mb-6">Your application is pending payment verification. An admin will activate your account shortly.</p>
          <Button onClick={() => setLocation("/login")} className="w-full" data-testid="button-go-login">Go to Login</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(199_89%_48%_/_0.08)_0%,_transparent_70%)]" />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 mb-3">
            <Network className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Join NetPro</h1>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                s < step ? "bg-accent text-white" : s === step ? "bg-primary text-white" : "bg-secondary text-muted-foreground"
              )}>
                {s < step ? <CheckCircle className="w-4 h-4" /> : s}
              </div>
              {s < 3 && <div className={cn("w-8 h-0.5", s < step ? "bg-accent" : "bg-border")} />}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mb-6 px-2">
          <span>Information</span>
          <span>Package</span>
          <span>Password</span>
        </div>

        <div className="bg-card border border-card-border rounded-xl p-6 shadow-xl">
          {/* STEP 1 */}
          {step === 1 && (
            <>
              <h2 className="text-base font-semibold mb-4 text-foreground">Personal Information</h2>
              <Form {...form1}>
                <form onSubmit={form1.handleSubmit(onStep1)} className="space-y-3">
                  <FormField control={form1.control} name="referrerId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Referral Code</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input {...field} placeholder="Sponsor referral code" data-testid="input-referrer-id"
                            className="bg-background border-input pr-10"
                            onChange={(e) => { field.onChange(e); setRefId(e.target.value); }} />
                          {field.value && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              {verifyingRef ? (
                                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                              ) : referralInfo?.isValid ? (
                                <CheckCircle className="w-4 h-4 text-accent" />
                              ) : (
                                <AlertCircle className="w-4 h-4 text-destructive" />
                              )}
                            </div>
                          )}
                        </div>
                      </FormControl>
                      {referralInfo?.isValid && (
                        <p className="text-xs text-accent">Sponsor: {referralInfo.maskedName}</p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form1.control} name="firstName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>First name</FormLabel>
                        <FormControl><Input {...field} placeholder="John" data-testid="input-first-name" className="bg-background border-input" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form1.control} name="lastName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last name</FormLabel>
                        <FormControl><Input {...field} placeholder="Doe" data-testid="input-last-name" className="bg-background border-input" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <FormField control={form1.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input {...field} type="email" placeholder="you@example.com" data-testid="input-email" className="bg-background border-input" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form1.control} name="countryCode" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <FormControl><Input {...field} placeholder="US" data-testid="input-country" className="bg-background border-input" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form1.control} name="mobileNumber" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mobile</FormLabel>
                        <FormControl><Input {...field} type="tel" placeholder="+1 555-0000" data-testid="input-mobile" className="bg-background border-input" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <FormField control={form1.control} name="address" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl><Input {...field} placeholder="123 Main St, City" data-testid="input-address" className="bg-background border-input" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <Button type="submit" className="w-full mt-2" data-testid="button-step1-next">
                    Continue <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </form>
              </Form>
            </>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <>
              <h2 className="text-base font-semibold mb-4 text-foreground">Choose Your Package</h2>
              <Form {...form2}>
                <form onSubmit={form2.handleSubmit(onStep2)} className="space-y-4">
                  <FormField control={form2.control} name="packageType" render={({ field }) => (
                    <FormItem>
                      <div className="grid gap-3">
                        {packages.map((pkg) => (
                          <button
                            key={pkg.id}
                            type="button"
                            data-testid={`button-package-${pkg.id}`}
                            onClick={() => field.onChange(pkg.id)}
                            className={cn(
                              "flex items-center gap-4 p-4 rounded-lg border-2 text-left transition-all",
                              field.value === pkg.id
                                ? "border-primary bg-primary/10"
                                : "border-border bg-background hover:border-border/80"
                            )}
                          >
                            <div className={cn(
                              "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                              pkg.id === "elite" ? "bg-yellow-500/20" : pkg.id === "pro" ? "bg-primary/20" : "bg-secondary"
                            )}>
                              <Package className={cn("w-5 h-5", pkg.id === "elite" ? "text-yellow-500" : pkg.id === "pro" ? "text-primary" : "text-muted-foreground")} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground">{pkg.name}</span>
                                {pkg.id === "pro" && <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded font-medium">Popular</span>}
                              </div>
                              <p className="text-xs text-muted-foreground">{pkg.description}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="font-bold text-foreground">{pkg.price}</p>
                              <p className="text-xs text-accent">{pkg.bv}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <div className="flex items-start gap-2">
                      <Shield className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-foreground">Terms & Agreement</p>
                        <p className="text-xs text-muted-foreground mt-0.5">By continuing you agree to the MLM Direct Selling terms, commission structure (10% direct referral, $70 binary match per 3,000 BV cycle), and the closed-loop coupon system.</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)} data-testid="button-step2-back">
                      <ChevronLeft className="w-4 h-4 mr-1" /> Back
                    </Button>
                    <Button type="submit" className="flex-1" data-testid="button-step2-next">
                      Continue <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </form>
              </Form>
            </>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <>
              <h2 className="text-base font-semibold mb-2 text-foreground">Set Your Password</h2>
              <div className="p-3 rounded-lg bg-accent/10 border border-accent/20 mb-4">
                <p className="text-xs text-accent font-medium">Registration fee: $30.00</p>
                <p className="text-xs text-muted-foreground mt-0.5">Payment will be processed after submission. Your account activates once verified by an admin.</p>
              </div>
              <Form {...form3}>
                <form onSubmit={form3.handleSubmit(onStep3)} className="space-y-4">
                  <FormField control={form3.control} name="password" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" placeholder="Minimum 8 characters" data-testid="input-password" className="bg-background border-input" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form3.control} name="confirmPassword" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" placeholder="Repeat your password" data-testid="input-confirm-password" className="bg-background border-input" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {register.error && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                      <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                      <p className="text-xs text-destructive">Registration failed. Please try again.</p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(2)} data-testid="button-step3-back">
                      <ChevronLeft className="w-4 h-4 mr-1" /> Back
                    </Button>
                    <Button type="submit" className="flex-1" disabled={register.isPending} data-testid="button-submit">
                      {register.isPending ? "Submitting..." : "Submit & Pay"}
                    </Button>
                  </div>
                </form>
              </Form>
            </>
          )}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-4">
          Already a member?{" "}
          <Link href="/login" className="text-primary hover:underline" data-testid="link-login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
