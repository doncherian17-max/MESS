import { useState } from "react";
import client, { formatApiError } from "@/lib/api";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import PasswordInput from "@/components/PasswordInput";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function ChangePasswordDialog({ open, onOpenChange }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await client.post("/auth/change-password", { current_password: current, new_password: next });
      toast.success("Password updated");
      setCurrent(""); setNext("");
      onOpenChange(false);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="change-password-dialog">
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>Choose a new password. You&apos;ll stay signed in on this device.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label className="overline">Current password</Label>
            <PasswordInput value={current} onChange={(e) => setCurrent(e.target.value)}
              required data-testid="cp-current-input" />
          </div>
          <div className="space-y-2">
            <Label className="overline">New password</Label>
            <PasswordInput value={next} onChange={(e) => setNext(e.target.value)}
              required minLength={4} data-testid="cp-new-input" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy} data-testid="cp-submit-button">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
