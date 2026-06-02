import Layout from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { User, Mail, Phone, MapPin, Shield, CheckCircle, ShieldAlert, CreditCard, Users, Link as LinkIcon, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ProfilePage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!user) return null;

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your account details and view your network status.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Info Card */}
          <div className="col-span-1 md:col-span-2 space-y-6">
            <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                  <User className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">
                    {user.firstName} {user.lastName}
                  </h2>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> {user.username || `User #${user.id}`}
                  </p>
                </div>
                <div className="ml-auto">
                  <span className={cn(
                    "px-3 py-1 text-xs font-medium rounded-full border",
                    user.status === "active" ? "bg-accent/10 text-accent border-accent/20" : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                  )}>
                    {user.status === "active" ? "Active" : "Pending"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs mb-1 uppercase tracking-wider font-semibold">Email Address</p>
                  <p className="font-medium text-foreground flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" /> {user.email}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1 uppercase tracking-wider font-semibold">Mobile Number</p>
                  <p className="font-medium text-foreground flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" /> {user.mobileNumber || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1 uppercase tracking-wider font-semibold">Country</p>
                  <p className="font-medium text-foreground flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" /> {user.countryCode || "US"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1 uppercase tracking-wider font-semibold">Joined Date</p>
                  <p className="font-medium text-foreground">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Address & Bank Details */}
            <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm space-y-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-primary" /> Financial & Contact Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Address</p>
                  <p className="font-medium text-foreground">{user.address || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">USDT Address</p>
                  <p className="font-mono text-foreground break-all bg-secondary/50 p-1.5 rounded text-xs">{user.usdtAddress || "Not provided"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Cards */}
          <div className="space-y-6">
            {/* KYC Status */}
            <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                <Shield className="w-4 h-4 text-primary" /> Verification
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                  <span className="text-sm font-medium">KYC Status</span>
                  {user.isKycVerified ? (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-accent">
                      <CheckCircle className="w-4 h-4" /> Verified
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-yellow-500">
                      <ShieldAlert className="w-4 h-4" /> Pending
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                  <span className="text-sm font-medium">Registration Fee</span>
                  {user.isPaid ? (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-accent">
                      <CheckCircle className="w-4 h-4" /> Paid
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                      Unpaid
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Network Info */}
            <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-primary" /> Network
              </h3>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs mb-1">My Referral Code</p>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium text-foreground bg-secondary/50 p-1.5 rounded">{user.referralCode}</span>
                  </div>
                </div>
                {user.sponsorReferralId && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Sponsor</p>
                    <div className="flex flex-col gap-0.5">
                      <p className="font-medium text-foreground">
                        {(user as any).sponsorName || "Unknown Sponsor"}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground bg-secondary/50 p-1 rounded inline-flex w-fit">
                        {user.sponsorReferralId}
                      </p>
                    </div>
                  </div>
                )}
                {user.placementSide && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Placement Preference</p>
                    <p className="font-medium text-foreground capitalize">{user.placementSide}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
