import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import client, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import PasswordInput from "@/components/PasswordInput";
import { toast } from "sonner";
import { UtensilsCrossed, Loader2 } from "lucide-react";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    if (!token) { toast.error("Missing reset token"); return; }
    setBusy(true);
    try {
      await client.post("/auth/reset-password", { token, new_password: pw });
      toast.success("Password reset. You can sign in now.");
      nav("/login", { replace: true });
    } catch (err) {
      toast.error(formatApiError(err));
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-background warm-grain flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
            <UtensilsCrossed className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight">MessBook</span>
        </div>
        <p className="overline text-muted-foreground mb-3">New password</p>
        <h1 className="font-display text-4xl font-extrabold tracking-tight mb-3">Set a new password</h1>
        <p className="text-muted-foreground leading-relaxed mb-8">
          Choose something you'll remember. Minimum 4 characters.
        </p>

        <Card className="border-border">
          <CardContent className="p-6 lg:p-8">
            <form onSubmit={submit} className="space-y-5" data-testid="reset-form">
              <div className="space-y-2">
                <Label className="overline">New password</Label>
                <PasswordInput value={pw} onChange={(e) => setPw(e.target.value)}
                  required minLength={4} className="h-12" data-testid="reset-password-input" />
              </div>
              <Button type="submit" disabled={busy} data-testid="reset-submit-button"
                className="w-full h-12 rounded-full font-semibold">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reset password"}
              </Button>
              <div className="text-center text-sm text-muted-foreground">
                <Link to="/login" className="text-primary hover:underline" data-testid="reset-to-login-link">Back to sign in</Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
