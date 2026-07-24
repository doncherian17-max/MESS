import { useState } from "react";
import client, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";

/**
 * If the logged-in user has no email on file, this dialog blocks the dashboard
 * until they set one. Used to guarantee notifications (day-cancel emails,
 * password resets) can reach every user.
 */
export default function RequireEmailGate() {
  const { user, updateUser } = useAuth();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const needsEmail = user && !user.email;
  if (!needsEmail) return null;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await client.patch("/auth/me", { email: email.trim() });
      updateUser({ email: data.email });
      toast.success("Email saved");
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent
        data-testid="require-email-dialog"
        className="max-w-md"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <DialogTitle>One-time step: add your email</DialogTitle>
          <DialogDescription>
            We now require an email on every account so we can reach you when the mess has to cancel a meal, or if you ever forget your password. This is a quick one-time step.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label className="overline">Email address</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoFocus
              className="h-11"
              data-testid="require-email-input"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy || !email} data-testid="require-email-submit" className="w-full h-11 rounded-full font-semibold">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save email"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
