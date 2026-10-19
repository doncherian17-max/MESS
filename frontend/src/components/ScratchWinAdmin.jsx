import { useEffect, useState } from "react";
import client, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Gift, Loader2, Trophy, RefreshCw } from "lucide-react";

const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) : "—");

function ConfigForm({ cfg, onSaved }) {
  const [form, setForm] = useState(cfg);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setForm(cfg); }, [cfg]);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await client.put("/admin/scratch/config", {
        enabled: form.enabled, target: Number(form.target), winners: Number(form.winners), reward: form.reward,
      });
      toast.success("Scratch & Win settings saved");
      onSaved(data);
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={save} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end" data-testid="scratch-config-form">
      <div className="space-y-2">
        <Label className="overline">Feature</Label>
        <div className="flex items-center gap-3 h-10">
          <Switch checked={form.enabled} onCheckedChange={(v) => setForm((p) => ({ ...p, enabled: v }))} data-testid="scratch-enabled-switch" />
          <span className="text-sm font-medium">{form.enabled ? "Enabled" : "Disabled"}</span>
        </div>
      </div>
      <div className="space-y-2">
        <Label className="overline">Daily dinner target</Label>
        <Input type="number" min={1} value={form.target} onChange={(e) => setForm((p) => ({ ...p, target: e.target.value }))}
          className="h-10" data-testid="scratch-target-input" />
      </div>
      <div className="space-y-2">
        <Label className="overline">Winners per day</Label>
        <Input type="number" min={1} value={form.winners} onChange={(e) => setForm((p) => ({ ...p, winners: e.target.value }))}
          className="h-10" data-testid="scratch-winners-input" />
      </div>
      <div className="space-y-2">
        <Label className="overline">Winner message</Label>
        <Input value={form.reward} maxLength={120} onChange={(e) => setForm((p) => ({ ...p, reward: e.target.value }))}
          placeholder="WINNER" className="h-10" data-testid="scratch-reward-input" />
      </div>
      <div className="sm:col-span-2 lg:col-span-4">
        <Button type="submit" disabled={busy || !form.target || !form.winners} className="rounded-full" data-testid="scratch-config-save">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save settings"}
        </Button>
      </div>
    </form>
  );
}

function DayCard({ day }) {
  const pct = Math.min(100, Math.round((day.bookings / day.target) * 100));
  return (
    <div className="rounded-xl border p-5 space-y-3" data-testid={`scratch-admin-day-${day.dinner_date}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="overline text-muted-foreground">{day.day_label}&apos;s dinner</p>
          <p className="font-mono-plex text-sm">{day.dinner_date}</p>
        </div>
        <Badge className="rounded-full" variant={day.unlocked ? "default" : "outline"} data-testid={`scratch-admin-unlocked-${day.dinner_date}`}>
          {day.unlocked ? "Unlocked" : "Locked"}
        </Badge>
      </div>
      <Progress value={pct} className="h-2" />
      <div className="grid grid-cols-3 text-center text-sm">
        <div><div className="font-bold text-lg" data-testid={`scratch-admin-bookings-${day.dinner_date}`}>{day.bookings}/{day.target}</div><div className="text-xs text-muted-foreground">Booked</div></div>
        <div><div className="font-bold text-lg">{day.scratched}</div><div className="text-xs text-muted-foreground">Scratched</div></div>
        <div><div className="font-bold text-lg" data-testid={`scratch-admin-winners-${day.dinner_date}`}>{day.winners_count}/{day.max_winners}</div><div className="text-xs text-muted-foreground">Winners</div></div>
      </div>
      {day.winners.length > 0 && (
        <ul className="text-sm space-y-1">
          {day.winners.map((w) => (
            <li key={w.employee_number} className="flex items-center gap-2">
              <Trophy className="h-3.5 w-3.5 text-amber-500" /> {w.name} <span className="font-mono-plex text-xs text-muted-foreground">#{w.employee_number}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function HistoryTable({ rows }) {
  return (
    <div className="rounded-xl border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="py-3">Dinner date</TableHead>
            <TableHead>Unlocked at</TableHead>
            <TableHead>Scratched</TableHead>
            <TableHead>Winners</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground" data-testid="scratch-history-empty">No history yet.</TableCell></TableRow>
          ) : rows.map((r) => (
            <TableRow key={r.dinner_date} data-testid={`scratch-history-row-${r.dinner_date}`}>
              <TableCell className="font-mono-plex text-sm">{r.dinner_date}</TableCell>
              <TableCell className="text-sm">{fmtTime(r.unlocked_at)}</TableCell>
              <TableCell>{r.scratched}</TableCell>
              <TableCell className="text-sm">
                {r.winners.length ? r.winners.map((w) => `${w.name} (#${w.employee_number})`).join(", ") : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function ScratchWinAdmin() {
  const [overview, setOverview] = useState(null);
  const [history, setHistory] = useState([]);

  const load = async () => {
    try {
      const [o, h] = await Promise.all([client.get("/admin/scratch/overview"), client.get("/admin/scratch/history")]);
      setOverview(o.data);
      setHistory(h.data);
    } catch (err) { toast.error(formatApiError(err)); }
  };
  useEffect(() => { load(); }, []);

  if (!overview) return <div className="text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;

  return (
    <div className="space-y-8" data-testid="scratch-win-admin">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          <h3 className="font-display text-2xl font-bold">Daily Scratch &amp; Win</h3>
        </div>
        <Button variant="outline" size="sm" className="rounded-full gap-2" onClick={load} data-testid="scratch-admin-refresh">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>
      <p className="text-sm text-muted-foreground -mt-4">
        Once a dinner&apos;s bookings reach the target, everyone who booked it gets one scratch card. Winners are drawn
        randomly on the server until the daily winner limit is used up.
      </p>
      <ConfigForm cfg={overview.config} onSaved={() => load()} />
      <div className="grid md:grid-cols-2 gap-4">
        {overview.days.map((d) => <DayCard key={d.dinner_date} day={d} />)}
      </div>
      <div className="space-y-3">
        <h4 className="font-display text-lg font-bold">History</h4>
        <HistoryTable rows={history} />
      </div>
    </div>
  );
}
