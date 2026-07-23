import { useEffect, useMemo, useState } from "react";
import client, { formatApiError, API } from "@/lib/api";
import TopBar from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Download, Users, UserPlus, Sunrise, Moon, Loader2, Trash2, ShieldCheck, User as UserIcon,
  Calendar as CalendarIcon, ChefHat, PartyPopper, Plus, ClipboardList, Mail, ScrollText,
} from "lucide-react";

function todayISO() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}
function firstOfMonthISO() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-01`;
}
function fmtDT(iso) {
  try { return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); }
  catch { return iso; }
}

export default function AdminDashboard() {
  const [today, setToday] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [fromDate, setFromDate] = useState(firstOfMonthISO());
  const [toDate, setToDate] = useState(todayISO());
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [reportEmail, setReportEmail] = useState("");

  // Employee dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newEmp, setNewEmp] = useState({ employee_number: "", name: "", email: "", password: "", role: "employee" });
  const [creating, setCreating] = useState(false);

  // Holidays
  const [holidays, setHolidays] = useState([]);
  const [newHoliday, setNewHoliday] = useState({ date: "", name: "", applies_to: "both" });
  const [holidayBusy, setHolidayBusy] = useState(false);

  // Menu
  const [menuEntries, setMenuEntries] = useState([]);
  const [newMenu, setNewMenu] = useState({ date: todayISO(), meal_type: "breakfast", items: "" });
  const [menuBusy, setMenuBusy] = useState(false);

  // Audit logs
  const [audit, setAudit] = useState([]);

  const loadTop = async () => {
    try {
      const [t, e] = await Promise.all([
        client.get("/admin/today"),
        client.get("/admin/employees"),
      ]);
      setToday(t.data);
      setEmployees(e.data);
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const loadSummary = async () => {
    if (!fromDate || !toDate) return;
    setLoadingSummary(true);
    try {
      const { data } = await client.get(`/admin/summary?from=${fromDate}&to=${toDate}`);
      setSummary(data);
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setLoadingSummary(false); }
  };

  const loadHolidays = async () => {
    try {
      const { data } = await client.get("/admin/holidays");
      setHolidays(data);
    } catch (err) { toast.error(formatApiError(err)); }
  };
  const loadMenu = async () => {
    try {
      const { data } = await client.get("/admin/menu");
      setMenuEntries(data);
    } catch (err) { toast.error(formatApiError(err)); }
  };
  const loadAudit = async () => {
    try {
      const { data } = await client.get("/admin/audit-logs?limit=200");
      setAudit(data);
    } catch (err) { toast.error(formatApiError(err)); }
  };

  useEffect(() => { loadTop(); loadSummary(); loadHolidays(); loadMenu(); /* eslint-disable-next-line */ }, []);

  // Report actions
  const doExport = async () => {
    if (!fromDate || !toDate) { toast.error("Choose date range"); return; }
    setExportBusy(true);
    try {
      const token = localStorage.getItem("mess_token");
      const url = `${API}/admin/export?from=${fromDate}&to=${toDate}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.detail || "Export failed"); }
      const blob = await res.blob();
      const a = document.createElement("a");
      const dl = URL.createObjectURL(blob);
      a.href = dl; a.download = `mess_bookings_${fromDate}_to_${toDate}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(dl);
      toast.success("Excel downloaded");
    } catch (err) { toast.error(err.message || "Export failed"); }
    finally { setExportBusy(false); }
  };

  const emailReport = async () => {
    if (!reportEmail) { toast.error("Enter an email"); return; }
    setEmailBusy(true);
    try {
      await client.post("/admin/email-report", { email: reportEmail, from_date: fromDate, to_date: toDate });
      toast.success(`Report queued for ${reportEmail}`);
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setEmailBusy(false); }
  };

  // Employees
  const createEmployee = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const payload = { ...newEmp, email: newEmp.email.trim() || null };
      await client.post("/admin/employees", payload);
      toast.success(`Employee ${newEmp.employee_number} added`);
      setCreateOpen(false);
      setNewEmp({ employee_number: "", name: "", email: "", password: "", role: "employee" });
      await loadTop();
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setCreating(false); }
  };
  const deleteEmployee = async (id, empNum) => {
    if (!window.confirm(`Delete employee ${empNum}? Their bookings will also be removed.`)) return;
    try {
      await client.delete(`/admin/employees/${id}`);
      toast.success("Employee removed");
      await loadTop();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  // Holidays
  const addHoliday = async (e) => {
    e.preventDefault();
    setHolidayBusy(true);
    try {
      await client.post("/admin/holidays", newHoliday);
      toast.success("Holiday added");
      setNewHoliday({ date: "", name: "", applies_to: "both" });
      await loadHolidays();
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setHolidayBusy(false); }
  };
  const removeHoliday = async (id) => {
    try {
      await client.delete(`/admin/holidays/${id}`);
      toast.success("Holiday removed");
      await loadHolidays();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  // Menu
  const saveMenu = async (e) => {
    e.preventDefault();
    setMenuBusy(true);
    try {
      const items = newMenu.items.split(",").map((s) => s.trim()).filter(Boolean);
      await client.put("/admin/menu", { date: newMenu.date, meal_type: newMenu.meal_type, items });
      toast.success("Menu saved");
      setNewMenu({ ...newMenu, items: "" });
      await loadMenu();
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setMenuBusy(false); }
  };

  const totalMeals = useMemo(() => (summary?.total_breakfast || 0) + (summary?.total_dinner || 0), [summary]);

  return (
    <div className="min-h-screen bg-background warm-grain">
      <TopBar />
      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-10 lg:py-14" data-testid="admin-dashboard">
        <div className="mb-10">
          <p className="overline text-muted-foreground mb-3 flex items-center gap-1.5"><ShieldCheck className="h-3 w-3" /> Admin Console</p>
          <h1 className="font-display text-4xl lg:text-5xl font-extrabold tracking-tight">Kitchen operations</h1>
          <p className="text-muted-foreground mt-3 leading-relaxed max-w-xl">
            Manage employees, plan menus, mark holidays, and export attendance for any date range.
          </p>
        </div>

        {/* KPI */}
        {today && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12" data-testid="today-kpis">
            <Card className="border-border card-lift"><CardContent className="p-6">
              <div className="overline text-muted-foreground mb-2 flex items-center gap-1.5"><Sunrise className="h-3 w-3" /> Breakfast today</div>
              <div className="font-display font-extrabold text-4xl tracking-tight" data-testid="kpi-breakfast-today">{today.breakfast_today}</div>
            </CardContent></Card>
            <Card className="border-border card-lift"><CardContent className="p-6">
              <div className="overline text-muted-foreground mb-2 flex items-center gap-1.5"><Moon className="h-3 w-3" /> Dinner today</div>
              <div className="font-display font-extrabold text-4xl tracking-tight" data-testid="kpi-dinner-today">{today.dinner_today}</div>
            </CardContent></Card>
            <Card className="border-border card-lift"><CardContent className="p-6">
              <div className="overline text-muted-foreground mb-2 flex items-center gap-1.5"><Sunrise className="h-3 w-3" /> Breakfast tomorrow</div>
              <div className="font-display font-extrabold text-4xl tracking-tight" data-testid="kpi-breakfast-tomorrow">{today.breakfast_tomorrow}</div>
            </CardContent></Card>
            <Card className="border-border card-lift bg-accent"><CardContent className="p-6">
              <div className="overline text-muted-foreground mb-2 flex items-center gap-1.5"><Users className="h-3 w-3" /> Employees</div>
              <div className="font-display font-extrabold text-4xl tracking-tight text-primary" data-testid="kpi-employees-count">{today.total_employees}</div>
            </CardContent></Card>
          </div>
        )}

        <Tabs defaultValue="report" className="w-full" onValueChange={(v) => { if (v === "audit") loadAudit(); }}>
          <TabsList data-testid="admin-tabs" className="flex-wrap h-auto">
            <TabsTrigger value="report" data-testid="tab-report" className="gap-1.5"><ClipboardList className="h-3.5 w-3.5" /> Report</TabsTrigger>
            <TabsTrigger value="employees" data-testid="tab-employees" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Employees</TabsTrigger>
            <TabsTrigger value="holidays" data-testid="tab-holidays" className="gap-1.5"><PartyPopper className="h-3.5 w-3.5" /> Holidays</TabsTrigger>
            <TabsTrigger value="menu" data-testid="tab-menu" className="gap-1.5"><ChefHat className="h-3.5 w-3.5" /> Menu</TabsTrigger>
            <TabsTrigger value="audit" data-testid="tab-audit" className="gap-1.5"><ScrollText className="h-3.5 w-3.5" /> Audit</TabsTrigger>
          </TabsList>

          {/* Report */}
          <TabsContent value="report" className="pt-6">
            <Card className="border-border">
              <CardContent className="p-6 lg:p-8">
                <div className="flex items-end flex-wrap gap-4 mb-6">
                  <div className="space-y-2">
                    <Label htmlFor="from" className="overline">From</Label>
                    <Input id="from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                      data-testid="from-date-input" className="h-11 w-[180px]" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="to" className="overline">To</Label>
                    <Input id="to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                      data-testid="to-date-input" className="h-11 w-[180px]" />
                  </div>
                  <Button onClick={loadSummary} disabled={loadingSummary} variant="outline"
                    data-testid="apply-range-button" className="h-11 rounded-full">
                    {loadingSummary ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><CalendarIcon className="h-4 w-4 mr-2" /> Apply</>)}
                  </Button>
                  <Button onClick={doExport} disabled={exportBusy} data-testid="export-excel-button"
                    className="h-11 rounded-full ml-auto gap-2">
                    {exportBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><Download className="h-4 w-4" /> Export Excel</>)}
                  </Button>
                </div>

                <div className="mb-6 rounded-xl border border-border p-4 bg-accent/40">
                  <div className="flex items-end gap-3 flex-wrap">
                    <div className="space-y-2">
                      <Label className="overline flex items-center gap-1.5"><Mail className="h-3 w-3" /> Email this report</Label>
                      <Input type="email" placeholder="admin@company.com" value={reportEmail}
                        onChange={(e) => setReportEmail(e.target.value)}
                        className="h-11 w-[280px]" data-testid="report-email-input" />
                    </div>
                    <Button variant="outline" onClick={emailReport} disabled={emailBusy || !reportEmail}
                      data-testid="email-report-button" className="h-11 rounded-full gap-2">
                      {emailBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><Mail className="h-4 w-4" /> Send</>)}
                    </Button>
                  </div>
                </div>

                {summary && (
                  <>
                    <div className="grid md:grid-cols-3 gap-4 mb-8">
                      <div className="rounded-xl border border-border p-5">
                        <div className="overline text-muted-foreground mb-1">Range Breakfast</div>
                        <div className="font-display font-extrabold text-3xl tracking-tight" data-testid="summary-total-breakfast">{summary.total_breakfast}</div>
                      </div>
                      <div className="rounded-xl border border-border p-5">
                        <div className="overline text-muted-foreground mb-1">Range Dinner</div>
                        <div className="font-display font-extrabold text-3xl tracking-tight" data-testid="summary-total-dinner">{summary.total_dinner}</div>
                      </div>
                      <div className="rounded-xl border border-border p-5 bg-accent">
                        <div className="overline text-muted-foreground mb-1">Total meals</div>
                        <div className="font-display font-extrabold text-3xl tracking-tight text-primary" data-testid="summary-total-meals">{totalMeals}</div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40">
                            <TableHead className="py-4">Employee #</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead className="text-right">Breakfast</TableHead>
                            <TableHead className="text-right">Dinner</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {summary.employees.length === 0 ? (
                            <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground" data-testid="summary-empty">No bookings in this range.</TableCell></TableRow>
                          ) : summary.employees.map((r) => (
                            <TableRow key={r.employee_number} data-testid={`summary-row-${r.employee_number}`}>
                              <TableCell className="py-4 font-mono-plex">{r.employee_number}</TableCell>
                              <TableCell>{r.name}</TableCell>
                              <TableCell className="text-right font-mono-plex">{r.breakfast}</TableCell>
                              <TableCell className="text-right font-mono-plex">{r.dinner}</TableCell>
                              <TableCell className="text-right font-mono-plex font-semibold">{r.total}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Employees */}
          <TabsContent value="employees" className="pt-6">
            <Card className="border-border">
              <CardContent className="p-6 lg:p-8">
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                  <div>
                    <h3 className="font-display text-2xl font-bold">Employees</h3>
                    <p className="text-sm text-muted-foreground mt-1">{employees.length} total accounts</p>
                  </div>
                  <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                      <Button data-testid="add-employee-button" className="rounded-full gap-2">
                        <UserPlus className="h-4 w-4" /> Add employee
                      </Button>
                    </DialogTrigger>
                    <DialogContent data-testid="add-employee-dialog">
                      <DialogHeader>
                        <DialogTitle>Add employee</DialogTitle>
                        <DialogDescription>Create a new mess account. They can change the password later.</DialogDescription>
                      </DialogHeader>
                      <form onSubmit={createEmployee} className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="overline">Employee number</Label>
                            <Input value={newEmp.employee_number} onChange={(e) => setNewEmp({ ...newEmp, employee_number: e.target.value })}
                              required data-testid="new-emp-number-input" />
                          </div>
                          <div className="space-y-2">
                            <Label className="overline">Role</Label>
                            <Select value={newEmp.role} onValueChange={(v) => setNewEmp({ ...newEmp, role: v })}>
                              <SelectTrigger data-testid="new-emp-role-select"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="employee">Employee</SelectItem>
                                <SelectItem value="chef">Chef</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="overline">Full name</Label>
                          <Input value={newEmp.name} onChange={(e) => setNewEmp({ ...newEmp, name: e.target.value })} required data-testid="new-emp-name-input" />
                        </div>
                        <div className="space-y-2">
                          <Label className="overline">Email (optional)</Label>
                          <Input type="email" value={newEmp.email} onChange={(e) => setNewEmp({ ...newEmp, email: e.target.value })} data-testid="new-emp-email-input" />
                        </div>
                        <div className="space-y-2">
                          <Label className="overline">Temporary password</Label>
                          <Input type="text" value={newEmp.password} onChange={(e) => setNewEmp({ ...newEmp, password: e.target.value })}
                            required minLength={4} data-testid="new-emp-password-input" />
                        </div>
                        <DialogFooter>
                          <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
                          <Button type="submit" disabled={creating} data-testid="new-emp-submit-button">
                            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="rounded-xl border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="py-4">Employee #</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employees.map((u) => (
                        <TableRow key={u.id} data-testid={`employee-row-${u.employee_number}`}>
                          <TableCell className="py-4 font-mono-plex">{u.employee_number}</TableCell>
                          <TableCell>{u.name}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{u.email || "—"}</TableCell>
                          <TableCell>
                            {u.role === "admin" ? (
                              <Badge className="rounded-full bg-primary text-primary-foreground gap-1"><ShieldCheck className="h-3 w-3" /> Admin</Badge>
                            ) : u.role === "chef" ? (
                              <Badge className="rounded-full bg-secondary text-secondary-foreground gap-1"><ChefHat className="h-3 w-3" /> Chef</Badge>
                            ) : (
                              <Badge variant="outline" className="rounded-full gap-1"><UserIcon className="h-3 w-3" /> Employee</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {u.role === "admin" ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : (
                              <Button variant="ghost" size="sm" onClick={() => deleteEmployee(u.id, u.employee_number)}
                                data-testid={`delete-employee-${u.employee_number}`} className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
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
          </TabsContent>

          {/* Holidays */}
          <TabsContent value="holidays" className="pt-6">
            <Card className="border-border">
              <CardContent className="p-6 lg:p-8">
                <div className="mb-6">
                  <h3 className="font-display text-2xl font-bold">Holidays</h3>
                  <p className="text-sm text-muted-foreground mt-1">Mark dates when the mess is closed. Bookings on these dates are blocked.</p>
                </div>
                <form onSubmit={addHoliday} className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6 items-end">
                  <div className="space-y-2">
                    <Label className="overline">Date</Label>
                    <Input type="date" value={newHoliday.date} onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                      required className="h-11" data-testid="new-holiday-date" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="overline">Occasion / Name</Label>
                    <Input value={newHoliday.name} onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                      placeholder="e.g., Diwali, Independence Day" required className="h-11" data-testid="new-holiday-name" />
                  </div>
                  <div className="space-y-2">
                    <Label className="overline">Applies to</Label>
                    <Select value={newHoliday.applies_to} onValueChange={(v) => setNewHoliday({ ...newHoliday, applies_to: v })}>
                      <SelectTrigger className="h-11" data-testid="new-holiday-applies-to"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="both">Both meals</SelectItem>
                        <SelectItem value="breakfast">Breakfast only</SelectItem>
                        <SelectItem value="dinner">Dinner only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" disabled={holidayBusy} data-testid="add-holiday-button" className="rounded-full h-11 gap-2 md:col-span-4 md:justify-self-start">
                    {holidayBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> Add holiday</>}
                  </Button>
                </form>

                <div className="rounded-xl border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="py-4">Date</TableHead>
                        <TableHead>Occasion</TableHead>
                        <TableHead>Applies to</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {holidays.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground" data-testid="holidays-empty">No holidays yet.</TableCell></TableRow>
                      ) : holidays.map((h) => (
                        <TableRow key={h.id} data-testid={`holiday-row-${h.id}`}>
                          <TableCell className="py-4 font-mono-plex">{h.date}</TableCell>
                          <TableCell>{h.name}</TableCell>
                          <TableCell><Badge variant="outline" className="rounded-full">{h.applies_to === "both" ? "Both" : h.applies_to}</Badge></TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => removeHoliday(h.id)}
                              data-testid={`delete-holiday-${h.id}`} className="text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Menu */}
          <TabsContent value="menu" className="pt-6">
            <Card className="border-border">
              <CardContent className="p-6 lg:p-8">
                <div className="mb-6">
                  <h3 className="font-display text-2xl font-bold">Menu planner</h3>
                  <p className="text-sm text-muted-foreground mt-1">Set what&apos;s on the menu for each meal. Items are shown to employees on the booking cards.</p>
                </div>
                <form onSubmit={saveMenu} className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-6 items-end">
                  <div className="space-y-2 md:col-span-2">
                    <Label className="overline">Date</Label>
                    <Input type="date" value={newMenu.date} onChange={(e) => setNewMenu({ ...newMenu, date: e.target.value })}
                      required className="h-11" data-testid="new-menu-date" />
                  </div>
                  <div className="space-y-2">
                    <Label className="overline">Meal</Label>
                    <Select value={newMenu.meal_type} onValueChange={(v) => setNewMenu({ ...newMenu, meal_type: v })}>
                      <SelectTrigger className="h-11" data-testid="new-menu-meal-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="breakfast">Breakfast</SelectItem>
                        <SelectItem value="dinner">Dinner</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-3">
                    <Label className="overline">Items (comma-separated)</Label>
                    <Input value={newMenu.items} onChange={(e) => setNewMenu({ ...newMenu, items: e.target.value })}
                      placeholder="Idli, Sambar, Filter Coffee" className="h-11" data-testid="new-menu-items" />
                  </div>
                  <Button type="submit" disabled={menuBusy} data-testid="save-menu-button" className="rounded-full h-11 gap-2 md:col-span-6 md:justify-self-start">
                    {menuBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> Save menu</>}
                  </Button>
                </form>

                <div className="rounded-xl border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="py-4">Date</TableHead>
                        <TableHead>Meal</TableHead>
                        <TableHead>Items</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {menuEntries.length === 0 ? (
                        <TableRow><TableCell colSpan={3} className="text-center py-10 text-muted-foreground" data-testid="menu-empty">No menu entries in the next 2 weeks.</TableCell></TableRow>
                      ) : menuEntries.map((m) => (
                        <TableRow key={m.id} data-testid={`menu-row-${m.id}`}>
                          <TableCell className="py-4 font-mono-plex">{m.date}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`rounded-full ${m.meal_type === "breakfast" ? "border-secondary text-secondary" : "border-primary text-primary"}`}>
                              {m.meal_type === "breakfast" ? <Sunrise className="h-3 w-3 mr-1" /> : <Moon className="h-3 w-3 mr-1" />}
                              {m.meal_type[0].toUpperCase() + m.meal_type.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{(m.items || []).join(" · ") || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit */}
          <TabsContent value="audit" className="pt-6">
            <Card className="border-border">
              <CardContent className="p-6 lg:p-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-display text-2xl font-bold">Audit trail</h3>
                    <p className="text-sm text-muted-foreground mt-1">Most recent 200 activities across the system.</p>
                  </div>
                  <Button variant="outline" onClick={loadAudit} data-testid="refresh-audit-button" className="rounded-full h-10">
                    Refresh
                  </Button>
                </div>
                <div className="rounded-xl border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="py-4">When</TableHead>
                        <TableHead>Actor</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Target</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {audit.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground" data-testid="audit-empty">No audit events yet.</TableCell></TableRow>
                      ) : audit.map((a) => (
                        <TableRow key={a.id} data-testid={`audit-row-${a.id}`}>
                          <TableCell className="py-4 text-muted-foreground text-sm">{fmtDT(a.timestamp)}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <span className="font-mono-plex">#{a.actor_employee_number || "—"}</span>
                              <span className="text-muted-foreground ml-2">({a.actor_role || "system"})</span>
                            </div>
                          </TableCell>
                          <TableCell><Badge variant="outline" className="rounded-full font-mono-plex text-xs">{a.action}</Badge></TableCell>
                          <TableCell className="font-mono-plex text-xs text-muted-foreground">{a.target || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
