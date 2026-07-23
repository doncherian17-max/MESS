import { useState } from "react";
import { Link } from "react-router-dom";
import client, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { UtensilsCrossed, ArrowLeft, Loader2, MailCheck } from "lucide-react";

export default function ForgotPasswordPage() {
  const [empNum, setEmpNum] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await client.post("/auth/forgot-password", { employee_number: empNum.trim() });
      setSent(true);
      toast.success("If your account has an email on file, a reset link has been sent.");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-background warm-grain flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <Link to="/login" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 text-sm" data-testid="back-to-login-link">
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
        <div className="mb-8 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
            <UtensilsCrossed className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight">MessBook</span>
        </div>
        <p className="overline text-muted-foreground mb-3">Recover access</p>
        <h1 className="font-display text-4xl font-extrabold tracking-tight mb-3">Forgot your password?</h1>
        <p className="text-muted-foreground leading-relaxed mb-8">
          Enter your employee number. If we find an email on file, we'll send you a reset link.
        </p>

        <Card className="border-border">
          <CardContent className="p-6 lg:p-8">
            {sent ? (
              <div className="text-center py-6" data-testid="forgot-success-message">
                <MailCheck className="h-12 w-12 text-secondary mx-auto mb-4" />
                <h3 className="font-display font-bold text-xl mb-2">Check your inbox</h3>
                <p className="text-muted-foreground text-sm">
                  If your employee account has an email set, you'll receive reset instructions shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-5" data-testid="forgot-form">
                <div className="space-y-2">
                  <Label className="overline">Employee number</Label>
                  <Input value={empNum} onChange={(e) => setEmpNum(e.target.value)}
                    required className="h-12" data-testid="forgot-employee-input" />
                </div>
                <Button type="submit" disabled={busy} data-testid="forgot-submit-button"
                  className="w-full h-12 rounded-full font-semibold">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
