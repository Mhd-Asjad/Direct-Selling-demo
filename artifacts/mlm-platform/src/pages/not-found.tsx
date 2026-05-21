import { Link } from "wouter";
import { Network, Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsl(199_89%_48%_/_0.06)_0%,_transparent_70%)]" />
      <div className="relative text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-6">
          <Network className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-6xl font-bold text-foreground mb-2">404</h1>
        <p className="text-lg font-semibold text-foreground mb-2">Page not found</p>
        <p className="text-sm text-muted-foreground mb-8 max-w-sm">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button asChild>
            <Link href="/dashboard" data-testid="link-dashboard">
              <Home className="w-4 h-4 mr-2" /> Dashboard
            </Link>
          </Button>
          <Button variant="outline" onClick={() => window.history.back()} data-testid="button-go-back">
            <ArrowLeft className="w-4 h-4 mr-2" /> Go back
          </Button>
        </div>
      </div>
    </div>
  );
}
