import { useAuth } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { AlertCircle, Shield, Users, FileText } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLocation } from "wouter";

export default function AuthPage() {
  const { login } = useAuth();
  const [_, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await login(email, password);
      setLocation("/");
    } catch (err: any) {
      setError(err.message || "Invalid credentials");
    } finally {
      setIsLoading(false);
    }
  };

  const quickLogin = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("password123");
  };

  return (
    <div className="min-h-screen bg-muted/40 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 animate-in zoom-in-95 duration-500">
        <div className="text-center space-y-2">
          <img 
            src="/attached_assets/IMG_0336_1765864713224.png" 
            alt="SkyRich Tech Solutions" 
            className="h-16 w-auto object-contain mx-auto mb-4"
          />
          <h1 className="text-2xl font-display font-bold tracking-tight text-foreground">KaizenFlow</h1>
          <p className="text-muted-foreground">Risk Assessment System</p>
        </div>

        <Card className="border-muted/60 shadow-lg" data-testid="card-login">
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>Enter your credentials to access the system</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <Alert variant="destructive" data-testid="alert-error">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="input-email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  data-testid="input-password"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full h-11 text-base" 
                disabled={isLoading}
                data-testid="button-login"
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-border">
              <p className="text-xs text-muted-foreground mb-3 text-center">
                Quick Login (click to fill credentials)
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => quickLogin("john.smith@example.com")}
                  className="text-xs"
                  data-testid="button-demo-initiator"
                  type="button"
                >
                  Initiator (Maint)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => quickLogin("mike.manager@example.com")}
                  className="text-xs"
                  data-testid="button-demo-mgr-maint"
                  type="button"
                >
                  Manager (Maint)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => quickLogin("peter.hod@example.com")}
                  className="text-xs"
                  data-testid="button-demo-hod-prod"
                  type="button"
                >
                  HOD (Production)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => quickLogin("helen.hod@example.com")}
                  className="text-xs"
                  data-testid="button-demo-hod-maint"
                  type="button"
                >
                  HOD (Maint)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => quickLogin("agm.sharma@example.com")}
                  className="text-xs"
                  data-testid="button-demo-agm"
                  type="button"
                >
                  AGM
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => quickLogin("gm.gupta@example.com")}
                  className="text-xs"
                  data-testid="button-demo-gm"
                  type="button"
                >
                  GM
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setEmail("admin@example.com"); setPassword("admin123"); }}
                  className="text-xs col-span-2"
                  data-testid="button-demo-admin"
                  type="button"
                >
                  Admin (admin@example.com / admin123)
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-4 text-center text-xs text-muted-foreground">
          <div className="flex flex-col items-center gap-1">
            <Shield className="h-4 w-4" />
            <span>Secure</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Users className="h-4 w-4" />
            <span>Role Based</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <FileText className="h-4 w-4" />
            <span>Audit Trail</span>
          </div>
        </div>
      </div>
    </div>
  );
}
