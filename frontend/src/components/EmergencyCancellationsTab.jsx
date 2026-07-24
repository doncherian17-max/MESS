import { useEffect, useState } from "react";
import client, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { AlertTriangle, RefreshCcw, Loader2, Plus, ShieldAlert } from "lucide-react";

function todayISO() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}
function fmtDT(iso) {
  try { return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); }
  catch { return iso; }
}

export default function EmergencyCancellationsTab({ employees }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ date: todayISO(), meal_type: "both", reason: "", applies_to: "all", employee_ids: [] });

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await client.get("/admin/emergency-cancellations");
      setItems(data);
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.reason.trim()) { toast.error("Reason is mandatory"); return; }
    if (form.applies_to === "selected" && form.employee_ids.length === 0) {
      toast.error("Select at least one employee"); return;
    }
    setBusy(true);
    try {
      const { data } = await client.post("/admin/emergency-cancellations", form);
      toast.success(`Emergency cancellation applied · ${data.affected} bookings cancelled · ${data.emailed} notified`);
      setForm({ date: todayISO(), meal_type: "both", reason: "", applies_to: "all", employee_ids: [] });
      await load();
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setBusy(false); }
  };

  const reopen = async (id) => {
    if (!window.confirm("Reopen bookings for this date/meal? Employees will be able to book again (subject to cutoff).")) return;
    try {
      await client.post(`/admin/emergency-cancellations/${id}/reopen`);
      toast.success("Bookings reopened");
      await load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const toggleEmp = (id) => {
    setForm((f) => f.employee_ids.includes(id)
      ? { ...f, employee_ids: f.employee_ids.filter((x) => x !== id) }
      : { ...f, employee_ids: [...f.employee_ids, id] });
  };

  const filteredEmployees = (employees || []).filter((u) => u.role !== "admin");

  return (
    <Card className="border-border">
      <CardContent className="p-6 lg:p-8">
        <div className="mb-6 flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h3 className="font-display text-2xl font-bold">Emergency cancellations</h3>
            <p className="text-sm text-muted-foreground mt-1">
              For operational emergencies. Marks bookings as <span className="font-mono-plex">emergency_cancelled</span> so they&apos;re excluded from all counts &amp; reports, and blocks further bookings for the affected meal until you reopen.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end mb-6" data-testid="emergency-form">
          <div className="space-y-2">
            <Label className="overline">Date</Label>
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
              required data-testid="emergency-date" className="h-11" />
          </div>
          <div className="space-y-2">
            <Label className="overline">Meal</Label>
            <Select value={form.meal_type} onValueChange={(v) => setForm({ ...form, meal_type: v })}>
              <SelectTrigger className="h-11" data-testid="emergency-meal"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="both">Both meals</SelectItem>
                <SelectItem value="breakfast">Breakfast only</SelectItem>
                <SelectItem value="dinner">Dinner only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="overline">Applies to</Label>
            <Select value={form.applies_to} onValueChange={(v) => setForm({ ...form, applies_to: v, employee_ids: v === "all" ? [] : form.employee_ids })}>
              <SelectTrigger className="h-11" data-testid="emergency-applies-to"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All employees</SelectItem>
                <SelectItem value="selected">Selected employees</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={busy || !form.reason.trim()}
            data-testid="emergency-submit" className="rounded-full h-11 gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ShieldAlert className="h-4 w-4" /> Cancel &amp; block</>}
          </Button>
          <div className="md:col-span-4 space-y-2">
            <Label className="overline">Reason (mandatory)</Label>
            <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
              required placeholder="e.g., Water supply cut in mess block — service resuming tomorrow"
              className="min-h-[80px]" data-testid="emergency-reason" />
          </div>
          {form.applies_to === "selected" && (
            <div className="md:col-span-4 space-y-2">
              <Label className="overline">Employees ({form.employee_ids.length} selected)</Label>
              <div className="rounded-lg border border-border p-3 max-h-52 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-2" data-testid="emergency-employees-picker">
                {filteredEmployees.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded hover:bg-accent">
                    <input type="checkbox" checked={form.employee_ids.includes(u.id)}
                      onChange={() => toggleEmp(u.id)} className="rounded" />
                    <span className="truncate"><span className="font-mono-plex text-xs">#{u.employee_number}</span> · {u.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </form>

        <div className="flex items-center justify-between mb-3">
          <h4 className="font-display font-semibold">History</h4>
          <Button variant="ghost" size="sm" onClick={load} className="rounded-full" data-testid="emergency-refresh">
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>

        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="py-4">Date</TableHead>
                <TableHead>Meal</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Affected</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground" data-testid="emergency-loading"><Loader2 className="inline h-4 w-4 animate-spin mr-2" />Loading…</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground" data-testid="emergency-empty">No emergency cancellations yet.</TableCell></TableRow>
              ) : items.map((e) => (
                <TableRow key={e.id} data-testid={`emergency-row-${e.id}`}>
                  <TableCell className="py-4 font-mono-plex">{e.date}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="rounded-full">{e.meal_type}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {e.applies_to === "all" ? "All employees" : `${e.employee_ids?.length || 0} selected`}
                  </TableCell>
                  <TableCell className="max-w-[280px] truncate" title={e.reason}>{e.reason}</TableCell>
                  <TableCell className="text-right font-mono-plex">{e.affected_count}</TableCell>
                  <TableCell>
                    {e.active ? (
                      <Badge className="bg-destructive text-destructive-foreground rounded-full">Blocking</Badge>
                    ) : (
                      <Badge variant="outline" className="rounded-full">Reopened</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {e.active && (
                      <Button size="sm" variant="outline" onClick={() => reopen(e.id)}
                        data-testid={`emergency-reopen-${e.id}`} className="rounded-full gap-1.5">
                        <Plus className="h-3.5 w-3.5" /> Reopen
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
