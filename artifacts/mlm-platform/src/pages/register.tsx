import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRegisterUser, useVerifyReferral, getVerifyReferralQueryKey, useStripeCreateCheckoutSession } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Network, CheckCircle, AlertCircle, ChevronRight, ChevronLeft, Shield, UploadCloud, User, MapPin, Landmark, Wallet, Camera, FileText } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

// Step 1: Account Credentials
const step1Schema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(20, "Username too long"),
  walletId: z.string()
    .min(3, "Wallet ID must be at least 3 characters")
    .max(20, "Wallet ID too long")
    .regex(/^[A-Za-z0-9_-]+$/, "Only letters, numbers, hyphens and underscores allowed"),
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Confirm your password"),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

// Step 2: Personal Profile & Verification
const step2Schema = z.object({
  fullName: z.string().min(3, "Full name required"),
  mobileNumber: z.string().min(6, "Valid mobile number required"),
  dob: z.string().min(1, "Date of birth required"),
  gender: z.enum(["male", "female", "other"], { errorMap: () => ({ message: "Gender is required" }) }),
  profilePhoto: z.string().min(1, "Profile photo is required"),
  govtIdProof: z.string().min(1, "Government ID proof is required"),
});

// Step 3: Network & Financial details
const step3Schema = z.object({
  referrerId: z.string().min(4, "Referral code required"),
  countryCode: z.string().min(2, "Country required"),
  state: z.string().min(2, "State required"),
  city: z.string().min(2, "District/City required"),
  address: z.string().min(5, "Full address required"),
  bankDetails: z.string().optional(),
  agreedToTerms: z.literal(true, { errorMap: () => ({ message: "You must agree to terms" }) }),
});

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [refId, setRefId] = useState("");
  const [sponsorIdInput, setSponsorIdInput] = useState("");
  const [formData, setFormData] = useState<any>({});
  const [success, setSuccess] = useState(false);

  // Profile photo & ID upload preview states
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const [idPreview, setIdPreview] = useState<string | null>(null);

  const profileInputRef = useRef<HTMLInputElement>(null);
  const idInputRef = useRef<HTMLInputElement>(null);

  // Parse ref from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) {
      setRefId(ref);
      setSponsorIdInput(ref);
    }
  }, []);

  const { data: referralInfo, isLoading: verifyingRef } = useVerifyReferral(
    { refId },
    { query: { enabled: refId.length >= 4, queryKey: getVerifyReferralQueryKey({ refId }), retry: false } },
  );

  const form1 = useForm({
    resolver: zodResolver(step1Schema),
    defaultValues: { username: "", walletId: "", email: "", password: "", confirmPassword: "" },
  });

  const form2 = useForm({
    resolver: zodResolver(step2Schema),
    defaultValues: { fullName: "", mobileNumber: "", dob: "", gender: "male" as "male" | "female" | "other", profilePhoto: "", govtIdProof: "" },
  });

  const form3 = useForm({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      referrerId: refId,
      countryCode: "US",
      state: "",
      city: "",
      address: "",
      bankDetails: "",
      agreedToTerms: true as true
    },
  });

  // Sync refId to forms
  useEffect(() => {
    if (refId) {
      form3.setValue("referrerId", refId);
    }
  }, [refId]);

  const createCheckoutSession = useStripeCreateCheckoutSession();

  const register = useRegisterUser({
    mutation: {
      onSuccess: (data) => {
        // Create Stripe checkout session upon successful registration
        createCheckoutSession.mutate(
          {
            data: { userId: data.id },
          },
          {
            onSuccess: (sessionData) => {
              // Redirect to Stripe checkout page URL
              window.location.href = sessionData.url;
            },
            onError: () => {
              // Fallback to static success message if payment session creation fails
              setSuccess(true);
            },
          }
        );
      },
    },
  });

  // File Upload Helper to convert images to base64
  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    fieldChange: (val: string) => void,
    setPreview: (val: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        fieldChange(base64String);
        setPreview(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const onStep1 = (values: any) => {
    setFormData((prev: any) => ({ ...prev, ...values }));
    setStep(2);
  };

  const onStep2 = (values: any) => {
    setFormData((prev: any) => ({ ...prev, ...values }));
    setStep(3);
  };

  const onStep3 = (values: any) => {
    const combined = { ...formData, ...values };
    
    // Split Full Name into firstName and lastName
    const nameParts = combined.fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "Doe";

    const payload = {
      ...combined,
      firstName,
      lastName,
      packageType: "pro", // default package back compatibility
    };

    delete payload.fullName;

    register.mutate({ data: payload });
  };

  if (createCheckoutSession.isPending) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        {/* Background grid */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(199_89%_48%_/_0.08)_0%,_transparent_70%)] pointer-events-none" />
        <div className="w-full max-w-sm text-center space-y-4 relative z-10 bg-card border border-card-border rounded-xl p-8 shadow-xl">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 animate-pulse">
            <Wallet className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Creating Secure Payment Session</h2>
          <p className="text-sm text-muted-foreground">
            Setting up your secure $30 distributor registration fee checkout. You will be redirected to Stripe shortly. Please do not close or reload this page.
          </p>
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mt-4" />
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/20 border border-accent/30 mb-4">
            <CheckCircle className="w-8 h-8 text-accent" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Registration Submitted</h2>
          <p className="text-sm text-muted-foreground mb-6">Your onboarding details have been registered. Your account will activate once payment verification is approved by an administrator.</p>
          <Button onClick={() => setLocation("/login")} className="w-full" data-testid="button-go-login">Go to Login</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-y-auto py-12">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(199_89%_48%_/_0.08)_0%,_transparent_70%)] pointer-events-none" />

      <div className="relative w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 mb-3">
            <Network className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">NetPro Onboarding</h1>
          <p className="text-xs text-muted-foreground mt-1">Create your professional distributor account</p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8 relative z-10">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => s < step && setStep(s)}
                disabled={s >= step}
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all border",
                  s < step
                    ? "bg-accent/20 border-accent text-accent cursor-pointer hover:bg-accent/30"
                    : s === step
                    ? "bg-primary border-primary text-white shadow-lg shadow-primary/20"
                    : "bg-secondary border-border text-muted-foreground cursor-not-allowed"
                )}
              >
                {s < step ? <CheckCircle className="w-4 h-4 text-accent" /> : s}
              </button>
              {s < 3 && <div className={cn("w-12 h-0.5", s < step ? "bg-accent" : "bg-border")} />}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mb-6 px-4">
          <span className={cn(step === 1 && "text-primary font-medium")}>1. Credentials</span>
          <span className={cn(step === 2 && "text-primary font-medium")}>2. Profile & ID</span>
          <span className={cn(step === 3 && "text-primary font-medium")}>3. Network & Bank</span>
        </div>

        <div className="bg-card border border-card-border rounded-xl p-6 shadow-xl relative z-10">
          {/* STEP 1: Account Credentials */}
          {step === 1 && (
            <>
              <h2 className="text-base font-semibold mb-4 text-foreground flex items-center gap-2">
                <User className="w-4 h-4 text-primary" /> Account Credentials
              </h2>
              <Form {...form1}>
                <form onSubmit={form1.handleSubmit(onStep1)} className="space-y-4">
                  <FormField control={form1.control} name="username" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="distributor_pro" data-testid="input-username" className="bg-background border-input" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form1.control} name="walletId" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5">
                        <Wallet className="w-3.5 h-3.5 text-primary" /> Wallet ID
                        <span className="text-muted-foreground font-normal text-xs">(unique, used by admin to send you USDT)</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g. JOHN-2024"
                          data-testid="input-wallet-id"
                          className="bg-background border-input font-mono"
                          onChange={e => field.onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
                        />
                      </FormControl>
                      <p className="text-[11px] text-muted-foreground">Letters, numbers, hyphens and underscores only. Cannot be changed later.</p>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form1.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="distributor@example.com" data-testid="input-email" className="bg-background border-input" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form1.control} name="password" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input {...field} type="password" placeholder="••••••••" data-testid="input-password" className="bg-background border-input" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form1.control} name="confirmPassword" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <Input {...field} type="password" placeholder="••••••••" data-testid="input-confirm-password" className="bg-background border-input" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <Button type="submit" className="w-full mt-4" data-testid="button-step1-next">
                    Continue to Profile <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </form>
              </Form>
            </>
          )}

          {/* STEP 2: Personal Profile & Verification Documents */}
          {step === 2 && (
            <>
              <h2 className="text-base font-semibold mb-4 text-foreground flex items-center gap-2">
                <Camera className="w-4 h-4 text-primary" /> Profile & Verification
              </h2>
              <Form {...form2}>
                <form onSubmit={form2.handleSubmit(onStep2)} className="space-y-4">
                  <FormField control={form2.control} name="fullName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="John Doe" data-testid="input-fullname" className="bg-background border-input" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form2.control} name="mobileNumber" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mobile Number</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="+1 555-0100" data-testid="input-mobile" className="bg-background border-input" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form2.control} name="dob" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Birth</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" data-testid="input-dob" className="bg-background border-input" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <FormField control={form2.control} name="gender" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gender</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-background border-input">
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-card border-border">
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Profile Photo Uploader */}
                  <FormField control={form2.control} name="profilePhoto" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Profile Photo</FormLabel>
                      <FormControl>
                        <div>
                          <input
                            type="file"
                            ref={profileInputRef}
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleFileUpload(e, field.onChange, setProfilePreview)}
                          />
                          <button
                            type="button"
                            onClick={() => profileInputRef.current?.click()}
                            className={cn(
                              "w-full h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 hover:bg-muted/30 transition-all",
                              field.value ? "border-accent/40 bg-accent/5" : "border-border bg-background"
                            )}
                          >
                            {profilePreview ? (
                              <div className="relative w-20 h-20 rounded-full overflow-hidden border border-border">
                                <img src={profilePreview} alt="Profile preview" className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <>
                                <UploadCloud className="w-8 h-8 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground font-medium">Click to upload Profile Photo</span>
                              </>
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Government ID Uploader */}
                  <FormField control={form2.control} name="govtIdProof" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Government ID Proof (Passport, Driving License, etc.)</FormLabel>
                      <FormControl>
                        <div>
                          <input
                            type="file"
                            ref={idInputRef}
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleFileUpload(e, field.onChange, setIdPreview)}
                          />
                          <button
                            type="button"
                            onClick={() => idInputRef.current?.click()}
                            className={cn(
                              "w-full h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 hover:bg-muted/30 transition-all",
                              field.value ? "border-accent/40 bg-accent/5" : "border-border bg-background"
                            )}
                          >
                            {idPreview ? (
                              <div className="relative w-full h-full p-2 flex items-center justify-center gap-3">
                                <FileText className="w-8 h-8 text-accent flex-shrink-0" />
                                <div className="text-left">
                                  <p className="text-xs font-semibold text-foreground">ID Document Loaded</p>
                                  <p className="text-[10px] text-muted-foreground">Click to upload another file</p>
                                </div>
                              </div>
                            ) : (
                              <>
                                <UploadCloud className="w-8 h-8 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground font-medium">Click to upload Government ID Document</span>
                              </>
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="flex gap-4 mt-6">
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

          {/* STEP 3: Network Placement & Financials */}
          {step === 3 && (
            <>
              <h2 className="text-base font-semibold mb-2 text-foreground flex items-center gap-2">
                <Network className="w-4 h-4 text-primary" /> Placement & Financial details
              </h2>
              <div className="p-3 rounded-lg bg-accent/10 border border-accent/20 mb-4">
                <p className="text-xs text-accent font-medium">Registration fee: $30.00</p>
                <p className="text-xs text-muted-foreground mt-0.5">Payment will be processed after submission. Your account activates once verified by an admin.</p>
              </div>
              <Form {...form3}>
                <form onSubmit={form3.handleSubmit(onStep3)} className="space-y-4">
                  {/* Referral Code (Referrer) */}
                  <FormField control={form3.control} name="referrerId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Referral Code</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input {...field} placeholder="Referrer code" data-testid="input-referrer-id"
                            className="bg-background border-input pr-10"
                            onChange={(e) => {
                              field.onChange(e);
                              setRefId(e.target.value);
                            }} />
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
                        <p className="text-[11px] text-accent">Referrer: {referralInfo.maskedName}</p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Location Details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField control={form3.control} name="countryCode" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="US" data-testid="input-country" className="bg-background border-input" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form3.control} name="state" render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="California" data-testid="input-state" className="bg-background border-input" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form3.control} name="city" render={({ field }) => (
                      <FormItem>
                        <FormLabel>District/City</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Los Angeles" data-testid="input-city" className="bg-background border-input" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <FormField control={form3.control} name="address" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Address</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="123 Main St, Suite 400" data-testid="input-address" className="bg-background border-input" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Bank Account Details (Optional) */}
                  <FormField control={form3.control} name="bankDetails" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5"><Landmark className="w-3.5 h-3.5 text-muted-foreground" /> Bank Account Details (Optional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Bank Name, Account #, Routing #" data-testid="input-bank-details" className="bg-background border-input" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Terms & Agreement Acceptance */}
                  <FormField control={form3.control} name="agreedToTerms" render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-lg p-3 bg-muted/30 border border-border">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-xs font-semibold text-foreground cursor-pointer">Accept Terms & Conditions</FormLabel>
                        <p className="text-[10px] text-muted-foreground">
                          By continuing, you agree to NetPro's distributor policies, commission structure (10% direct referral, binary spillover matches), and network regulations.
                        </p>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {register.error && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>Registration failed. Email/Username may already be registered.</span>
                    </div>
                  )}

                  <div className="flex gap-4 mt-6">
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
          <Link href="/login" className="text-primary hover:underline font-medium" data-testid="link-login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

