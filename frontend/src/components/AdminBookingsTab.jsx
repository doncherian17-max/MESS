import { useEffect, useMemo, useState } from "react";
import client, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Sunrise, Moon, Loader2, Search, UtensilsCrossed, Package, Plus, Trash2,
  ShieldAlert, X, User as UserIcon, Mail,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

function todayISO() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

export default function AdminBookingsTab({ employees }) {
  const [date, setDate] = useState(todayISO());
  const [mealFilter, setMealFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // Force-book dialog
  const [addOpen, setAddOpen] = useState(false);
  const [add, setAdd] = useState({ user_id: "", meal_type: "breakfast", meal_date: todayISO(), quantity: 1, booking_type: "dine_in", reason: "" });
  const [addBusy, setAddBusy] = useState(false);

  // Cancel single-booking dialog
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelForm, setCancelForm] = useState({ reason: "", notify: true });
  const [cancelBusy, setCancelBusy] = useState(false);

  // Cancel-day dialog
  const [dayOpen, setDayOpen] = useState(false);
  const [dayForm, setDayForm] = useState({ date: todayISO(), meal_type: "both", reason: "" });
  const [dayBusy, setDayBusy] = useState(false);
  const [dayResult, setDayResult] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date });
      if (mealFilter !== "all") params.append("meal_type", mealFilter);
      if (search) params.append("q", search);
      const { data } = await client.get(`/admin/bookings?${params.toString()}`);
      setRows(data);
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [date, mealFilter]);

  const forceBook = async (e) => {
    e.preventDefault();
    if (!add.reason.trim()) { toast.error("Reason is mandatory for admin override"); return; }
    setAddBusy(true);
    try {
      await client.post("/admin/bookings", add);
      toast.success("Admin override booking saved");
      setAddOpen(false);
      setAdd({ user_id: "", meal_type: "breakfast", meal_date: date, quantity: 1, booking_type: "dine_in", reason: "" });
      await load();
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setAddBusy(false); }
  };

  const openCancel = (b) => {
    setCancelTarget(b);
    setCancelForm({ reason: "", notify: true });
  };

  const submitCancel = async (e) => {
    e.preventDefault();
    if (!cancelTarget) return;
    setCancelBusy(true);
    try {
      const params = new URLSearchParams({
        reason: cancelForm.reason.trim() || "Cancelled by admin",
        notify: cancelForm.notify ? "true" : "false",
      });
      const { data } = await client.delete(`/admin/bookings/${cancelTarget.id}?${params.toString()}`);
      toast.success(data.emailed ? "Booking cancelled · employee notified" : "Booking cancelled");
      setCancelTarget(null);
      await load();
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setCancelBusy(false); }
  };

  const cancelDay = async (e) => {
    e.preventDefault();
    if (!dayForm.reason.trim()) { toast.error("Please provide a reason"); return; }
    setDayBusy(true);
    setDayResult(null);
    try {
      const { data } = await client.post("/admin/cancel-day", dayForm);
      setDayResult(data);
      toast.success(`Cancelled ${data.deleted} bookings · notified ${data.affected_users} employees`);
      await load();
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setDayBusy(false); }
  };

  const filteredEmployees = useMemo(() => (employees || []).filter((u) => u.role !== "admin"), [employees]);

  return (
    <Card className="border-border">
      <CardContent className="p-6 lg:p-8">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
          <div>
            <h3 className="font-display text-2xl font-bold">Manage bookings</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Admin override — add, cancel, or bulk-cancel any booking at any time. Changes flow into the employee&apos;s monthly totals automatically.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Dialog open={dayOpen} onOpenChange={(v) => { setDayOpen(v); if (!v) setDayResult(null); }}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="cancel-day-button" className="rounded-full gap-2 border-destructive text-destructive hover:text-destructive">
                  <ShieldAlert className="h-4 w-4" /> Cancel whole day
                </Button>
              </DialogTrigger>
              <DialogContent data-testid="cancel-day-dialog" className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Cancel bookings for a day</DialogTitle>
                  <DialogDescription>
                    Cancels every affected booking and emails each impacted employee with the reason (subject starts with &quot;Sorry…&quot;). Their monthly counts update automatically.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={cancelDay} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="overline">Date</Label>
                      <Input type="date" value={dayForm.date} onChange={(e) => setDayForm({ ...dayForm, date: e.target.value })}
                        required data-testid="cancel-day-date" className="h-11" />
                    </div>
                    <div className="space-y-2">
                      <Label className="overline">Meal</Label>
                      <Select value={dayForm.meal_type} onValueChange={(v) => setDayForm({ ...dayForm, meal_type: v })}>
                        <SelectTrigger className="h-11" data-testid="cancel-day-meal"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="both">Both meals</SelectItem>
                          <SelectItem value="breakfast">Breakfast only</SelectItem>
                          <SelectItem value="dinner">Dinner only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="overline">Reason (sent to employees)</Label>
                    <Textarea value={dayForm.reason} onChange={(e) => setDayForm({ ...dayForm, reason: e.target.value })}
                      required placeholder="e.g., Kitchen equipment failure — power outage in the mess block."
                      className="min-h-[100px]" data-testid="cancel-day-reason" />
                  </div>
                  {dayResult && (
                    <div className="rounded-lg border border-border p-3 bg-muted/40 text-sm" data-testid="cancel-day-result">
                      <div className="font-semibold flex items-center gap-1.5">
                        <ShieldAlert className="h-3.5 w-3.5" /> Cancelled: <span className="font-mono-plex">{dayResult.deleted}</span> bookings · Affected: <span className="font-mono-plex">{dayResult.affected_users}</span> employees
                      </div>
                      {dayResult.affected?.length > 0 && (
                        <div className="text-muted-foreground mt-1.5">
                          {dayResult.affected.slice(0, 5).map((a) => `#${a.employee_number}`).join(", ")}
                          {dayResult.affected.length > 5 && ` +${dayResult.affected.length - 5} more`}
                        </div>
                      )}
                    </div>
                  )}
                  <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => setDayOpen(false)}>Close</Button>
                    <Button type="submit" disabled={dayBusy} data-testid="cancel-day-submit" className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                      {dayBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel &amp; notify"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={addOpen} onOpenChange={(v) => { setAddOpen(v); if (v) setAdd((a) => ({ ...a, meal_date: date })); }}>
              <DialogTrigger asChild>
                <Button data-testid="force-book-button" className="rounded-full gap-2">
                  <Plus className="h-4 w-4" /> Add booking
                </Button>
              </DialogTrigger>
              <DialogContent data-testid="force-book-dialog" className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add / update a booking</DialogTitle>
                  <DialogDescription>Emergency override — bypasses cutoff and holiday rules. If a booking already exists it will be updated.</DialogDescription>
                </DialogHeader>
                <form onSubmit={forceBook} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="overline">Employee</Label>
                    <Select value={add.user_id} onValueChange={(v) => setAdd({ ...add, user_id: v })}>
                      <SelectTrigger className="h-11" data-testid="force-book-employee"><SelectValue placeholder="Choose employee…" /></SelectTrigger>
                      <SelectContent className="max-h-[280px]">
                        {filteredEmployees.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            <span className="font-mono-plex text-xs">#{u.employee_number}</span> · {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="overline">Meal</Label>
                      <Select value={add.meal_type} onValueChange={(v) => setAdd({ ...add, meal_type: v })}>
                        <SelectTrigger className="h-11" data-testid="force-book-meal"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="breakfast">Breakfast</SelectItem>
                          <SelectItem value="dinner">Dinner</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="overline">Date</Label>
                      <Input type="date" value={add.meal_date} onChange={(e) => setAdd({ ...add, meal_date: e.target.value })}
                        required className="h-11" data-testid="force-book-date" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="overline">Type</Label>
                      <Select value={add.booking_type} onValueChange={(v) => setAdd({ ...add, booking_type: v })}>
                        <SelectTrigger className="h-11" data-testid="force-book-type"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dine_in">Dine-in</SelectItem>
                          <SelectItem value="parcel">Parcel</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="overline">Quantity</Label>
                      <Input type="number" min={1} max={5} value={add.quantity}
                        onChange={(e) => setAdd({ ...add, quantity: Math.max(1, Math.min(5, Number(e.target.value) || 1)) })}
                        className="h-11" data-testid="force-book-qty" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="overline">Override reason (mandatory)</Label>
                    <Textarea value={add.reason} onChange={(e) => setAdd({ ...add, reason: e.target.value })}
                      required placeholder="e.g., Employee was on emergency shift · called by phone"
                      className="min-h-[80px]" data-testid="force-book-reason" />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={addBusy || !add.user_id || !add.reason.trim()} data-testid="force-book-submit">
                      {addBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-end gap-3 flex-wrap mb-5">
          <div className="space-y-2">
            <Label className="overline">Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="h-11 w-[180px]" data-testid="admin-bookings-date" />
          </div>
          <div className="space-y-2">
            <Label className="overline">Meal</Label>
            <Select value={mealFilter} onValueChange={setMealFilter}>
              <SelectTrigger className="h-11 w-[140px]" data-testid="admin-bookings-meal"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All meals</SelectItem>
                <SelectItem value="breakfast">Breakfast</SelectItem>
                <SelectItem value="dinner">Dinner</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); load(); }} className="space-y-2">
            <Label className="overline">Search employee</Label>
            <div className="flex gap-2">
              <Input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="name or emp #" className="h-11 w-[240px]" data-testid="admin-bookings-search" />
              <Button type="submit" variant="outline" className="h-11 rounded-full">
                <Search className="h-4 w-4" />
              </Button>
              {search && (
                <Button type="button" variant="ghost" className="h-11 rounded-full"
                  onClick={() => { setSearch(""); setTimeout(load, 0); }}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </form>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border overflow-hidden">          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="py-4">Employee</TableHead>
                <TableHead>Meal</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Served</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground" data-testid="admin-bookings-loading"><Loader2 className="inline h-4 w-4 animate-spin mr-2" />Loading…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground" data-testid="admin-bookings-empty">No bookings match these filters.</TableCell></TableRow>
              ) : rows.map((b) => (
                <TableRow key={b.id} data-testid={`admin-booking-row-${b.id}`}>
                  <TableCell className="py-4">
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="font-medium">{b.employee_name || "—"}</div>
                        <div className="text-xs text-muted-foreground font-mono-plex">#{b.employee_number}</div>
                      </div>
                      {b.admin_override && (
                        <Badge className="bg-primary text-primary-foreground rounded-full gap-1 text-[10px]" data-testid={`override-badge-${b.id}`}>
                          <ShieldAlert className="h-2.5 w-2.5" /> Admin Override
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`rounded-full ${b.meal_type === "breakfast" ? "border-secondary text-secondary" : "border-primary text-primary"}`}>
                      {b.meal_type === "breakfast" ? <Sunrise className="h-3 w-3 mr-1" /> : <Moon className="h-3 w-3 mr-1" />}
                      {b.meal_type[0].toUpperCase() + b.meal_type.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-sm">
                      {b.booking_type === "parcel" ? <><Package className="h-3 w-3" /> Parcel</> : <><UtensilsCrossed className="h-3 w-3" /> Dine-in</>}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono-plex font-semibold">{b.quantity}</TableCell>
                  <TableCell>
                    {b.served ? (
                      <Badge className="bg-secondary text-secondary-foreground rounded-full">Yes</Badge>
                    ) : (
                      <Badge variant="outline" className="rounded-full text-muted-foreground">No</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openCancel(b)}
                      data-testid={`admin-cancel-booking-${b.id}`} className="text-destructive hover:text-destructive rounded-full">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Single-booking cancel dialog */}
      <Dialog open={!!cancelTarget} onOpenChange={(v) => { if (!v) setCancelTarget(null); }}>
        <DialogContent data-testid="cancel-booking-dialog">
          <DialogHeader>
            <DialogTitle>Cancel booking</DialogTitle>
            <DialogDescription>
              This will cancel <b>#{cancelTarget?.employee_number}</b>&apos;s {cancelTarget?.meal_type} on <span className="font-mono-plex">{cancelTarget?.meal_date}</span> ({cancelTarget?.booking_type?.replace("_", " ")} × {cancelTarget?.quantity}). Their monthly count will update automatically.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitCancel} className="space-y-4">
            <div className="space-y-2">
              <Label className="overline">Reason</Label>
              <Textarea
                value={cancelForm.reason}
                onChange={(e) => setCancelForm({ ...cancelForm, reason: e.target.value })}
                placeholder="e.g., Emergency shift change · Employee informed by phone"
                className="min-h-[80px]"
                data-testid="cancel-booking-reason"
              />
              <p className="text-xs text-muted-foreground">Left blank → &quot;Cancelled by admin&quot; is recorded.</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <Checkbox
                checked={cancelForm.notify}
                onCheckedChange={(v) => setCancelForm({ ...cancelForm, notify: !!v })}
                data-testid="cancel-booking-notify"
              />
              <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email a &quot;Sorry…&quot; note to the employee</span>
            </label>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCancelTarget(null)}>Keep</Button>
              <Button type="submit" disabled={cancelBusy} data-testid="cancel-booking-submit"
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                {cancelBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel booking"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
