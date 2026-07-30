import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import PasswordInput from "@/components/PasswordInput";
import { toast } from "sonner";
import { UtensilsCrossed, ArrowRight, Loader2 } from "lucide-react";

const BRAND_RED = "#e11d48";
const HERO_IMG = "https://images.unsplash.com/photo-1738605488100-913d2c8b5c4f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNTl8MHwxfHNlYXJjaHwzfHxjYWZldGVyaWElMjBicmVha2Zhc3QlMjBmb29kJTIwY29mZmVlJTIwdHJheXxlbnwwfHx8fDE3ODQ3NDM4ODh8MA&ixlib=rb-4.1.0&q=85";

function roleHome(role) {
  if (role === "admin") return "/admin";
  if (role === "chef") return "/chef";
  return "/dashboard";
}

export default function LoginPage() {
  const [empNum, setEmpNum] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const res = await login(empNum.trim(), password);
    setBusy(false);
    if (res.ok) {
      toast.success(`Welcome back, ${res.user.name}`);
      nav(roleHome(res.user.role), { replace: true });
    } else {
      toast.error(res.error || "Login failed");
    }
  };

  return (
    <div className="min-h-screen bg-background warm-grain">
      <div className="grid lg:grid-cols-5 min-h-screen">
        <div className="hidden lg:flex lg:col-span-2 relative overflow-hidden" style={{ backgroundColor: "#7f1d1d" }}>
          <img src={HERO_IMG} alt="Mess kitchen" className="absolute inset-0 w-full h-full object-cover opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80" />
          <div className="relative z-10 flex flex-col justify-between p-12 text-white h-full w-full">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: BRAND_RED }}>
                <UtensilsCrossed className="h-5 w-5 text-white" />
              </div>
              <span className="font-display font-extrabold text-xl tracking-tight">SUPER MILLER</span>
            </div>
            <div className="max-w-md">
              <p className="overline text-white/70 mb-4">Employee Mess Portal</p>
              <h1 className="font-display font-extrabold text-4xl lg:text-5xl leading-tight tracking-tight">
                Welcome to <span style={{ color: BRAND_RED }}>SUPER MILLER</span>.
              </h1>
              <p className="mt-6 text-white/80 leading-relaxed">
                Book your breakfast and dinner, track your monthly meals and deductions, all in one place.
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 flex items-center justify-center p-6 lg:p-12">
          <div className="w-full max-w-md">
            <div className="mb-10">
              <p className="overline text-muted-foreground mb-3">Employee sign-in</p>
              <h2 className="font-display text-4xl font-extrabold tracking-tight">
                Welcome to <span style={{ color: BRAND_RED }}>SUPER MILLER</span>.
              </h2>
              <p className="text-muted-foreground mt-3 leading-relaxed">
                Enter your Employee ID and password provided by your administrator.
              </p>
            </div>

            <Card className="border-border bg-card">
              <CardContent className="p-6 lg:p-8">
                <form onSubmit={submit} className="space-y-5" data-testid="login-form">
                  <div className="space-y-2">
                    <Label htmlFor="emp" className="overline">Employee ID</Label>
                    <Input id="emp" data-testid="login-employee-input" value={empNum}
                      onChange={(e) => setEmpNum(e.target.value)}
                      placeholder="e.g., EMP001" autoComplete="username" className="h-12" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pw" className="overline">Password</Label>
                    <PasswordInput id="pw" data-testid="login-password-input" value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Your password" autoComplete="current-password" className="h-12" required />
                  </div>
                  <Button
                    type="submit" disabled={busy} data-testid="login-submit-button"
                    className="w-full h-12 rounded-full font-semibold text-base group text-white"
                    style={{ backgroundColor: BRAND_RED }}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                      <>Sign in <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform duration-200" /></>
                    )}
                  </Button>
                </form>

                <p className="mt-6 text-center text-xs text-muted-foreground">
                  Forgot your password? Please contact your mess administrator.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
