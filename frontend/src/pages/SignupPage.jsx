import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import PasswordInput from "@/components/PasswordInput";
import { toast } from "sonner";
import { UtensilsCrossed, Loader2, ArrowRight } from "lucide-react";

const HERO_IMG = "https://images.pexels.com/photos/30485896/pexels-photo-30485896.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

export default function SignupPage() {
  const [empNum, setEmpNum] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { register } = useAuth();
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const res = await register(empNum.trim(), name.trim(), password, email.trim());
    setBusy(false);
    if (res.ok) {
      toast.success("Account created — welcome!");
      nav("/dashboard", { replace: true });
    } else {
      toast.error(res.error || "Signup failed");
    }
  };

  return (
    <div className="min-h-screen bg-background warm-grain">
      <div className="grid lg:grid-cols-5 min-h-screen">
        <div className="hidden lg:flex lg:col-span-2 relative overflow-hidden bg-[hsl(14,55%,25%)]">
          <img src={HERO_IMG} alt="Warm dinner" className="absolute inset-0 w-full h-full object-cover opacity-70" />
          <div className="absolute inset-0 bg-gradient-to-b from-[hsl(25,25%,15%)]/40 via-transparent to-[hsl(25,25%,15%)]/80" />
          <div className="relative z-10 flex flex-col justify-between p-12 text-white h-full w-full">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
                <UtensilsCrossed className="h-5 w-5 text-white" />
              </div>
              <span className="font-display font-bold text-xl tracking-tight">MessBook</span>
            </div>
            <div className="max-w-md">
              <p className="overline text-white/70 mb-4">Get started</p>
              <h1 className="font-display font-extrabold text-4xl lg:text-5xl leading-tight tracking-tight">
                Reserve every meal, effortlessly.
              </h1>
              <p className="mt-6 text-white/80 leading-relaxed">
                Sign up with your employee number. Add an email so we can help if you ever forget your password.
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 flex items-center justify-center p-6 lg:p-12">
          <div className="w-full max-w-md">
            <div className="mb-10">
              <p className="overline text-muted-foreground mb-3">Create account</p>
              <h2 className="font-display text-4xl font-extrabold tracking-tight">Join the mess.</h2>
              <p className="text-muted-foreground mt-3 leading-relaxed">
                Register once with your employee number. That's all you need.
              </p>
            </div>

            <Card className="border-border bg-card">
              <CardContent className="p-6 lg:p-8">
                <form onSubmit={submit} className="space-y-5" data-testid="signup-form">
                  <div className="space-y-2">
                    <Label className="overline">Employee Number</Label>
                    <Input data-testid="signup-employee-input" value={empNum}
                      onChange={(e) => setEmpNum(e.target.value)} placeholder="e.g., 100234" className="h-12" required />
                  </div>
                  <div className="space-y-2">
                    <Label className="overline">Full Name</Label>
                    <Input data-testid="signup-name-input" value={name}
                      onChange={(e) => setName(e.target.value)} placeholder="Priya Sharma" className="h-12" required />
                  </div>
                  <div className="space-y-2">
                    <Label className="overline">Email</Label>
                    <Input type="email" data-testid="signup-email-input" value={email}
                      onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="h-12" required />
                  </div>
                  <div className="space-y-2">
                    <Label className="overline">Password</Label>
                    <PasswordInput data-testid="signup-password-input" value={password}
                      onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 4 characters" className="h-12" required minLength={4} />
                  </div>
                  <Button type="submit" disabled={busy} data-testid="signup-submit-button"
                    className="w-full h-12 rounded-full font-semibold text-base group">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                      <>Create account <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform duration-200" /></>
                    )}
                  </Button>
                </form>

                <div className="mt-6 text-center text-sm text-muted-foreground">
                  Already registered?{" "}
                  <Link data-testid="go-to-login-link" to="/login" className="text-primary font-semibold hover:underline">
                    Sign in
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
