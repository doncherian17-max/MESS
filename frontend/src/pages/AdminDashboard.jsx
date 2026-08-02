import { useEffect, useMemo, useState } from "react";
import client, { formatApiError, API } from "@/lib/api";
import TopBar from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import AdminBookingsTab from "@/components/AdminBookingsTab";
import EmergencyCancellationsTab from "@/components/EmergencyCancellationsTab";
import PasswordInput from "@/components/PasswordInput";
import { toast } from "sonner";
import {
  Download, Users, UserPlus, Sunrise, Moon, Loader2, Trash2, ShieldCheck, User as UserIcon,
  Calendar as CalendarIcon, ChefHat, PartyPopper, Plus, ClipboardList, Mail, ScrollText,
  BarChart3, Upload, FileDown, Trophy, Settings2, Pencil, AlertTriangle,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  LineChart, Line,
} from "recharts";

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
  const [newHoliday, setNewHoliday] = useState({ date: "", end_date: "", name: "", applies_to: "both" });
  const [holidayBusy, setHolidayBusy] = useState(false);

  // Menu
  const [menuEntries, setMenuEntries] = useState([]);
  const [newMenu, setNewMenu] = useState({ date: todayISO(), meal_type: "breakfast", items: "" });
  const [menuBusy, setMenuBusy] = useState(false);
  const [menuDeleteBusy, setMenuDeleteBusy] = useState(null);

  // Weekly menu (Mon-Sun × breakfast/dinner)
  const [weeklyMenu, setWeeklyMenu] = useState([]);
  const [weeklyDrafts, setWeeklyDrafts] = useState({}); // {"monday:breakfast": "text"}
  const [weeklyBusy, setWeeklyBusy] = useState({}); // per-slot save flag
  const [weeklyClearBusy, setWeeklyClearBusy] = useState({});

  // Audit logs
  const [audit, setAudit] = useState([]);

  // Insights (trend + top eaters)
  const [insightsDays, setInsightsDays] = useState(14);
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  // Bulk import
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkResult, setBulkResult] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  // Meal prices (₹)
  const [prices, setPrices] = useState({ breakfast: 0, dinner: 0 });
  const [priceDraft, setPriceDraft] = useState({ breakfast: "", dinner: "" });
  const [pricesBusy, setPricesBusy] = useState(false);

  // Monthly deductions
  const [deductions, setDeductions] = useState(null);
  const [deductionsLoading, setDeductionsLoading] = useState(false);

  // Delete bookings by date range
  const [delRange, setDelRange] = useState({ from_date: todayISO(), to_date: todayISO(), meal_type: "" });
  const [delRangeBusy, setDelRangeBusy] = useState(false);

  // Edit employee (email/name/password)
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({ email: "", name: "", password: "" });
  const [editBusy, setEditBusy] = useState(false);

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
  const loadWeeklyMenu = async () => {
    try {
      const { data } = await client.get("/admin/weekly-menu");
      setWeeklyMenu(data);
      const drafts = {};
      for (const row of data) {
        drafts[`${row.day_of_week}:${row.meal_type}`] = (row.items || []).join("\n");
      }
      setWeeklyDrafts(drafts);
    } catch (err) { toast.error(formatApiError(err)); }
  };
  const loadAudit = async () => {
    try {
      const { data } = await client.get("/admin/audit-logs?limit=200");
      setAudit(data);
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const loadInsights = async (days = insightsDays) => {
    setInsightsLoading(true);
    try {
      const { data } = await client.get(`/admin/insights?days=${days}`);
      setInsights(data);
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setInsightsLoading(false); }
  };

  const submitBulk = async (e) => {
    e.preventDefault();
    if (!bulkFile) { toast.error("Choose a CSV file"); return; }
    setBulkBusy(true);
    setBulkResult(null);
    try {
      const fd = new FormData();
      fd.append("file", bulkFile);
      const { data } = await client.post("/admin/employees/bulk", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setBulkResult(data);
      toast.success(`${data.created} added · ${data.updated || 0} updated`);
      await loadTop();
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setBulkBusy(false); }
  };

  const downloadCsvTemplate = () => {
    // Generate a minimal Excel-style CSV so users can save as .xlsx and re-upload
    const rows = [
      ["Employee ID", "Name", "Password"],
      ["EMP001", "Priya Sharma", "welcome123"],
      ["EMP002", "Ravi Kumar", "welcome123"],
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "employees_template.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  useEffect(() => { loadTop(); loadSummary(); loadHolidays(); loadMenu(); loadWeeklyMenu(); loadPrices(); loadDeductions(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadPrices = async () => {
    try {
      const { data } = await client.get("/settings/prices");
      setPrices(data);
      setPriceDraft({ breakfast: String(data.breakfast), dinner: String(data.dinner) });
    } catch (err) { /* silent */ }
  };
  const savePrices = async (e) => {
    e.preventDefault();
    const b = parseFloat(priceDraft.breakfast);
    const d = parseFloat(priceDraft.dinner);
    if (Number.isNaN(b) || Number.isNaN(d) || b < 0 || d < 0) { toast.error("Enter valid non-negative amounts"); return; }
    setPricesBusy(true);
    try {
      await client.put("/admin/settings/prices", { breakfast: b, dinner: d });
      toast.success("Meal prices updated");
      await loadPrices();
      await loadDeductions();
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setPricesBusy(false); }
  };
  const loadDeductions = async () => {
    setDeductionsLoading(true);
    try {
      const { data } = await client.get("/admin/deductions");
      setDeductions(data);
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setDeductionsLoading(false); }
  };
  const deleteBookingsRange = async () => {
    if (!delRange.from_date || !delRange.to_date) { toast.error("Pick both dates"); return; }
    if (!window.confirm(`Delete ALL ${delRange.meal_type || "meal"} bookings from ${delRange.from_date} to ${delRange.to_date}? Employee accounts stay intact. This cannot be undone.`)) return;
    setDelRangeBusy(true);
    try {
      const body = { from_date: delRange.from_date, to_date: delRange.to_date };
      if (delRange.meal_type) body.meal_type = delRange.meal_type;
      const { data } = await client.post("/admin/bookings/range-delete", body);
      toast.success(`Deleted ${data.deleted} booking(s)`);
      await loadTop(); await loadDeductions();
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setDelRangeBusy(false); }
  };

  // Poll KPIs every 15s for near-real-time meal counts
  useEffect(() => {
    const id = setInterval(() => { loadTop(); }, 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line
  }, []);

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

  const [payrollMonth, setPayrollMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  });
  const [payrollBusy, setPayrollBusy] = useState(false);
  const doPayrollExport = async () => {
    setPayrollBusy(true);
    try {
      const token = localStorage.getItem("mess_token");
      const url = `${API}/admin/payroll-export?month=${payrollMonth}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.detail || "Payroll export failed"); }
      const blob = await res.blob();
      const a = document.createElement("a");
      const dl = URL.createObjectURL(blob);
      a.href = dl; a.download = `payroll_ledger_${payrollMonth}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(dl);
      toast.success("Payroll ledger downloaded");
    } catch (err) { toast.error(err.message || "Payroll export failed"); }
    finally { setPayrollBusy(false); }
  };

  const emailReport = async () => {
    toast.error("Email report is disabled. Please use the Download Excel option instead.");
  };

  // Employees
  const createEmployee = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await client.post("/admin/employees", newEmp);
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

  const sendResetEmail = async () => {
    if (!editUser) return;
    if (!editUser.email && !editForm.email.trim()) {
      toast.error("This user has no email — set one first."); return;
    }
    if (!window.confirm(`Email a password-reset link to ${editUser.email || editForm.email}?`)) return;
    setEditBusy(true);
    try {
      const { data } = await client.post(`/admin/employees/${editUser.id}/send-reset-email`);
      toast.success(`Reset link sent to ${data.sent_to}`);
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setEditBusy(false); }
  };

  const openEdit = (u) => {
    setEditUser(u);
    setEditForm({ email: u.email || "", name: u.name || "", password: "" });
  };
  const submitEdit = async (e) => {
    e.preventDefault();
    if (!editUser) return;
    setEditBusy(true);
    try {
      const payload = {};
      if (editForm.email.trim() && editForm.email.trim().toLowerCase() !== (editUser.email || "").toLowerCase()) {
        payload.email = editForm.email.trim();
      }
      if (editForm.name.trim() && editForm.name.trim() !== editUser.name) {
        payload.name = editForm.name.trim();
      }
      if (editForm.password.trim()) {
        if (editForm.password.trim().length < 4) {
          toast.error("Password must be at least 4 characters");
          setEditBusy(false);
          return;
        }
        payload.password = editForm.password.trim();
      }
      if (Object.keys(payload).length === 0) {
        toast.info("Nothing changed");
        setEditUser(null);
        return;
      }
      await client.patch(`/admin/employees/${editUser.id}`, payload);
      toast.success(payload.password
        ? `Password reset for #${editUser.employee_number}`
        : `Updated ${editUser.employee_number}`);
      setEditUser(null);
      await loadTop();
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setEditBusy(false); }
  };

  // Holidays
  const addHoliday = async (e) => {
    e.preventDefault();
    setHolidayBusy(true);
    try {
      await client.post("/admin/holidays", {
        date: newHoliday.date,
        end_date: newHoliday.end_date || newHoliday.date,
        name: newHoliday.name,
        applies_to: newHoliday.applies_to,
      });
      toast.success("Holiday added");
      setNewHoliday({ date: "", end_date: "", name: "", applies_to: "both" });
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

  const deleteMenu = async (m) => {
    if (!window.confirm("Are you sure you want to delete this menu item?")) return;
    setMenuDeleteBusy(m.id);
    try {
      const { data } = await client.delete(`/admin/menu/${m.id}`);
      toast.success(data.message || "Menu item deleted successfully.");
      await loadMenu();
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setMenuDeleteBusy(null); }
  };

  // Weekly menu
  const saveWeeklySlot = async (dow, meal_type) => {
    const key = `${dow}:${meal_type}`;
    const raw = weeklyDrafts[key] || "";
    const items = raw.split("\n").map((s) => s.trim()).filter(Boolean);
    setWeeklyBusy((b) => ({ ...b, [key]: true }));
    try {
      await client.put("/admin/weekly-menu", { day_of_week: dow, meal_type, items });
      toast.success("Weekly menu updated");
      await loadWeeklyMenu();
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setWeeklyBusy((b) => ({ ...b, [key]: false })); }
  };

  const clearWeeklySlot = async (dow, meal_type) => {
    if (!window.confirm(`Clear the ${meal_type} menu for ${dow}?`)) return;
    const key = `${dow}:${meal_type}`;
    setWeeklyClearBusy((b) => ({ ...b, [key]: true }));
    try {
      const { data } = await client.delete(`/admin/weekly-menu?day_of_week=${dow}&meal_type=${meal_type}`);
      toast.success(data.message || "Cleared");
      await loadWeeklyMenu();
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setWeeklyClearBusy((b) => ({ ...b, [key]: false })); }
  };

  const totalMeals = useMemo(() => (summary?.total_breakfast || 0) + (summary?.total_dinner || 0), [summary]);

  return (
    <div className="min-h-screen bg-background warm-grain">
      <TopBar />
      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-10 lg:py-14" data-testid="admin-dashboard">
        <div className="mb-10">
          <p className="overline text-muted-foreground mb-3 flex items-center gap-1.5"><ShieldCheck className="h-3 w-3" /> Admin Console</p>
          <h1 className="font-display text-4xl lg:text-5xl font-extrabold tracking-tight" style={{ color: "#e11d48" }}>SUPER MILER</h1>
          <p className="text-muted-foreground mt-3 leading-relaxed max-w-xl">
            Manage employees, plan menus, set meal prices, mark holidays, and export attendance for any date range.
          </p>
        </div>

        {/* Meal prices card */}
        <Card className="border-border mb-8" data-testid="meal-prices-card">
          <CardContent className="p-6 lg:p-8">
            <div className="flex items-baseline justify-between mb-4 flex-wrap gap-3">
              <div>
                <p className="overline text-muted-foreground mb-1">Meal prices (₹)</p>
                <h3 className="font-display text-2xl font-bold">Current rates</h3>
                <p className="text-xs text-muted-foreground mt-1">These prices are applied when computing each employee&apos;s monthly meal deduction.</p>
              </div>
              <div className="flex items-baseline gap-6">
                <div>
                  <div className="overline text-muted-foreground">Breakfast</div>
                  <div className="font-display font-extrabold text-3xl" data-testid="price-breakfast-current">₹{prices.breakfast}</div>
                </div>
                <div>
                  <div className="overline text-muted-foreground">Dinner</div>
                  <div className="font-display font-extrabold text-3xl" data-testid="price-dinner-current">₹{prices.dinner}</div>
                </div>
              </div>
            </div>
            <form onSubmit={savePrices} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div className="space-y-2">
                <Label className="overline">Breakfast (₹)</Label>
                <Input type="number" min="0" step="0.01" value={priceDraft.breakfast}
                  onChange={(e) => setPriceDraft({ ...priceDraft, breakfast: e.target.value })}
                  className="h-11" data-testid="price-breakfast-input" required />
              </div>
              <div className="space-y-2">
                <Label className="overline">Dinner (₹)</Label>
                <Input type="number" min="0" step="0.01" value={priceDraft.dinner}
                  onChange={(e) => setPriceDraft({ ...priceDraft, dinner: e.target.value })}
                  className="h-11" data-testid="price-dinner-input" required />
              </div>
              <Button type="submit" disabled={pricesBusy} data-testid="save-prices-button"
                className="h-11 rounded-full gap-2" style={{ backgroundColor: "#e11d48", color: "white" }}>
                {pricesBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save prices"}
              </Button>
            </form>
          </CardContent>
        </Card>

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

        <Tabs defaultValue="report" className="w-full" onValueChange={(v) => {
          if (v === "audit") loadAudit();
          if (v === "insights" && !insights) loadInsights();
        }}>
          <TabsList data-testid="admin-tabs" className="flex-wrap h-auto">
            <TabsTrigger value="report" data-testid="tab-report" className="gap-1.5"><ClipboardList className="h-3.5 w-3.5" /> Report</TabsTrigger>
            <TabsTrigger value="insights" data-testid="tab-insights" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Insights</TabsTrigger>
            <TabsTrigger value="bookings" data-testid="tab-bookings" className="gap-1.5"><Settings2 className="h-3.5 w-3.5" /> Bookings</TabsTrigger>
            <TabsTrigger value="emergency" data-testid="tab-emergency" className="gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Emergency</TabsTrigger>
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

                <div className="mb-6 rounded-xl border-2 p-4" style={{ borderColor: "#e11d48", backgroundColor: "#fef2f2" }}>
                  <div className="flex items-end gap-3 flex-wrap">
                    <div className="space-y-2">
                      <Label className="overline flex items-center gap-1.5" style={{ color: "#e11d48" }}>
                        <Download className="h-3 w-3" /> Payroll ledger (₹)
                      </Label>
                      <p className="text-xs text-muted-foreground max-w-md">
                        One-click monthly payroll export: each employee&apos;s meals × current price = total ₹, ready for finance.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="overline">Month</Label>
                      <Input type="month" value={payrollMonth} onChange={(e) => setPayrollMonth(e.target.value)}
                        className="h-11 w-[180px]" data-testid="payroll-month-input" />
                    </div>
                    <Button onClick={doPayrollExport} disabled={payrollBusy}
                      data-testid="payroll-export-button"
                      className="h-11 rounded-full gap-2 ml-auto text-white"
                      style={{ backgroundColor: "#e11d48" }}>
                      {payrollBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><Download className="h-4 w-4" /> Download payroll</>)}
                    </Button>
                  </div>
                </div>

                <div className="mb-6 rounded-xl border border-border p-4 bg-accent/40" style={{ display: "none" }}>
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
                        <div className="text-xs text-muted-foreground mt-1 font-mono-plex">
                          Dine-in {summary.total_breakfast_dine_in} · Parcel {summary.total_breakfast_parcel}
                        </div>
                      </div>
                      <div className="rounded-xl border border-border p-5">
                        <div className="overline text-muted-foreground mb-1">Range Dinner</div>
                        <div className="font-display font-extrabold text-3xl tracking-tight" data-testid="summary-total-dinner">{summary.total_dinner}</div>
                        <div className="text-xs text-muted-foreground mt-1 font-mono-plex">
                          Dine-in {summary.total_dinner_dine_in} · Parcel {summary.total_dinner_parcel}
                        </div>
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
                            <TableHead className="text-right">B · Dine-in</TableHead>
                            <TableHead className="text-right">B · Parcel</TableHead>
                            <TableHead className="text-right">D · Dine-in</TableHead>
                            <TableHead className="text-right">D · Parcel</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {summary.employees.length === 0 ? (
                            <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground" data-testid="summary-empty">No bookings in this range.</TableCell></TableRow>
                          ) : summary.employees.map((r) => (
                            <TableRow key={r.employee_number} data-testid={`summary-row-${r.employee_number}`}>
                              <TableCell className="py-4 font-mono-plex">{r.employee_number}</TableCell>
                              <TableCell>{r.name}</TableCell>
                              <TableCell className="text-right font-mono-plex" data-testid={`summary-b-dine-${r.employee_number}`}>{r.breakfast_dine_in}</TableCell>
                              <TableCell className="text-right font-mono-plex" data-testid={`summary-b-parcel-${r.employee_number}`}>{r.breakfast_parcel}</TableCell>
                              <TableCell className="text-right font-mono-plex" data-testid={`summary-d-dine-${r.employee_number}`}>{r.dinner_dine_in}</TableCell>
                              <TableCell className="text-right font-mono-plex" data-testid={`summary-d-parcel-${r.employee_number}`}>{r.dinner_parcel}</TableCell>
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

          {/* Insights */}
          <TabsContent value="insights" className="pt-6">
            <Card className="border-border">
              <CardContent className="p-6 lg:p-8">
                <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
                  <div>
                    <h3 className="font-display text-2xl font-bold">Trends &amp; top eaters</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Last {insights?.days || insightsDays} days · {insights ? `${insights.from} → ${insights.to}` : ""}
                    </p>
                  </div>
                  <div className="flex items-end gap-3">
                    <div className="space-y-2">
                      <Label className="overline">Range</Label>
                      <Select value={String(insightsDays)} onValueChange={(v) => { setInsightsDays(Number(v)); loadInsights(Number(v)); }}>
                        <SelectTrigger className="h-11 w-[150px]" data-testid="insights-days-select"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7">Last 7 days</SelectItem>
                          <SelectItem value="14">Last 14 days</SelectItem>
                          <SelectItem value="30">Last 30 days</SelectItem>
                          <SelectItem value="60">Last 60 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button variant="outline" onClick={() => loadInsights()} disabled={insightsLoading}
                      data-testid="insights-refresh-button" className="h-11 rounded-full">
                      {insightsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
                    </Button>
                  </div>
                </div>

                {!insights ? (
                  <div className="text-muted-foreground py-16 text-center" data-testid="insights-empty">
                    <BarChart3 className="h-8 w-8 mx-auto mb-3 opacity-50" />
                    Loading insights…
                  </div>
                ) : (
                  <>
                    {/* Bar chart: daily breakdown */}
                    <div className="mb-8">
                      <div className="overline text-muted-foreground mb-3">Daily meals · breakfast vs dinner</div>
                      <div className="rounded-xl border border-border p-4 bg-card" data-testid="insights-bar-chart">
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={insights.trend} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                              tickFormatter={(v) => v.slice(5)} />
                            <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                            <Tooltip
                              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                              cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                            />
                            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" />
                            <Bar dataKey="breakfast" fill="hsl(101 20% 45%)" name="Breakfast" radius={[4,4,0,0]} />
                            <Bar dataKey="dinner" fill="hsl(14 55% 55%)" name="Dinner" radius={[4,4,0,0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Line chart: total trend */}
                    <div className="mb-8">
                      <div className="overline text-muted-foreground mb-3">Total meals per day</div>
                      <div className="rounded-xl border border-border p-4 bg-card" data-testid="insights-line-chart">
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart data={insights.trend} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                              tickFormatter={(v) => v.slice(5)} />
                            <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                            <Tooltip
                              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                            />
                            <Line type="monotone" dataKey="total" stroke="hsl(14 55% 51%)" strokeWidth={2.5}
                              dot={{ r: 3, fill: "hsl(14 55% 51%)" }} activeDot={{ r: 5 }} name="Total meals" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Top eaters */}
                    <div>
                      <div className="flex items-baseline justify-between mb-3">
                        <div className="overline text-muted-foreground flex items-center gap-2">
                          <Trophy className="h-3.5 w-3.5" /> Top eaters this range
                        </div>
                        <span className="text-xs text-muted-foreground">Top {insights.top_eaters.length}</span>
                      </div>
                      <div className="rounded-xl border border-border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/40">
                              <TableHead className="py-4 w-12">#</TableHead>
                              <TableHead>Employee</TableHead>
                              <TableHead className="text-right">Breakfast</TableHead>
                              <TableHead className="text-right">Dinner</TableHead>
                              <TableHead className="text-right">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {insights.top_eaters.length === 0 ? (
                              <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground" data-testid="top-eaters-empty">No bookings in this range.</TableCell></TableRow>
                            ) : insights.top_eaters.map((r, idx) => (
                              <TableRow key={r.employee_number} data-testid={`top-eater-row-${r.employee_number}`}>
                                <TableCell className="py-4 font-display font-extrabold text-lg text-primary">{idx + 1}</TableCell>
                                <TableCell>
                                  <div className="font-medium">{r.name || "—"}</div>
                                  <div className="text-xs text-muted-foreground font-mono-plex">#{r.employee_number}</div>
                                </TableCell>
                                <TableCell className="text-right font-mono-plex">{r.breakfast}</TableCell>
                                <TableCell className="text-right font-mono-plex">{r.dinner}</TableCell>
                                <TableCell className="text-right font-mono-plex font-semibold text-base">{r.total}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bookings" className="pt-6">
            <AdminBookingsTab employees={employees} />
          </TabsContent>

          <TabsContent value="emergency" className="pt-6">
            <EmergencyCancellationsTab employees={employees} />
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <Dialog open={bulkOpen} onOpenChange={(v) => { setBulkOpen(v); if (!v) { setBulkResult(null); setBulkFile(null); } }}>
                      <DialogTrigger asChild>
                        <Button variant="outline" data-testid="bulk-import-button" className="rounded-full gap-2">
                          <Upload className="h-4 w-4" /> Bulk import
                        </Button>
                      </DialogTrigger>
                      <DialogContent data-testid="bulk-import-dialog" className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Bulk import employees</DialogTitle>
                          <DialogDescription>
                            Upload an Excel (<span className="font-mono-plex text-xs">.xlsx</span>) with columns: <span className="font-mono-plex text-xs">Employee ID, Name, Password</span>. Re-uploading an existing Employee ID updates the name and resets the password.
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={submitBulk} className="space-y-4">
                          <div className="space-y-2">
                            <Label className="overline">Excel file</Label>
                            <Input type="file" accept=".xlsx"
                              onChange={(e) => { setBulkFile(e.target.files?.[0] || null); setBulkResult(null); }}
                              data-testid="bulk-file-input" className="h-11" />
                          </div>
                          <Button type="button" variant="ghost" size="sm" onClick={downloadCsvTemplate}
                            data-testid="download-csv-template" className="gap-2 text-primary">
                            <FileDown className="h-3.5 w-3.5" /> Download template
                          </Button>
                          {bulkResult && (
                            <div className="rounded-lg border border-border p-3 bg-muted/40 text-sm" data-testid="bulk-result">
                              <div className="font-semibold text-secondary flex items-center gap-1.5">
                                <Users className="h-3.5 w-3.5" /> Created: <span className="font-mono-plex">{bulkResult.created}</span>
                              </div>
                              {bulkResult.skipped?.length > 0 && (
                                <div className="text-muted-foreground mt-1.5">
                                  Skipped {bulkResult.skipped.length} (already exist): {bulkResult.skipped.map((s) => s.employee_number).join(", ")}
                                </div>
                              )}
                              {bulkResult.errors?.length > 0 && (
                                <div className="text-destructive mt-1.5">
                                  <div className="font-semibold">Errors ({bulkResult.errors.length}):</div>
                                  <ul className="list-disc list-inside">
                                    {bulkResult.errors.map((e, i) => (<li key={i}>Line {e.line}: {e.error}</li>))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                          <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setBulkOpen(false)}>Close</Button>
                            <Button type="submit" disabled={bulkBusy || !bulkFile} data-testid="bulk-submit-button">
                              {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Import"}
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
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
                          <Label className="overline">Email</Label>
                          <Input type="email" value={newEmp.email} onChange={(e) => setNewEmp({ ...newEmp, email: e.target.value })} required data-testid="new-emp-email-input" />
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
                            <div className="inline-flex items-center gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openEdit(u)}
                                data-testid={`edit-employee-${u.employee_number}`} className="rounded-full">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => deleteEmployee(u.id, u.employee_number)}
                                data-testid={`delete-employee-${u.employee_number}`} className="text-destructive hover:text-destructive rounded-full">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
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
                <form onSubmit={addHoliday} className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6 items-end">
                  <div className="space-y-2">
                    <Label className="overline">From date</Label>
                    <Input type="date" value={newHoliday.date} onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                      required className="h-11" data-testid="new-holiday-date" />
                  </div>
                  <div className="space-y-2">
                    <Label className="overline">To date</Label>
                    <Input type="date" value={newHoliday.end_date} onChange={(e) => setNewHoliday({ ...newHoliday, end_date: e.target.value })}
                      min={newHoliday.date || undefined}
                      className="h-11" data-testid="new-holiday-end-date"
                      placeholder="(same as From)" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="overline">Occasion / Name</Label>
                    <Input value={newHoliday.name} onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                      placeholder="e.g., Diwali, Vacation" required className="h-11" data-testid="new-holiday-name" />
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
                  <Button type="submit" disabled={holidayBusy} data-testid="add-holiday-button" className="rounded-full h-11 gap-2 md:col-span-5 md:justify-self-start">
                    {holidayBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> Add holiday</>}
                  </Button>
                </form>

                <div className="rounded-xl border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="py-4">From</TableHead>
                        <TableHead>To</TableHead>
                        <TableHead>Occasion</TableHead>
                        <TableHead>Applies to</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {holidays.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground" data-testid="holidays-empty">No holidays yet.</TableCell></TableRow>
                      ) : holidays.map((h) => (
                        <TableRow key={h.id} data-testid={`holiday-row-${h.id}`}>
                          <TableCell className="py-4 font-mono-plex">{h.date}</TableCell>
                          <TableCell className="font-mono-plex">{h.end_date || h.date}</TableCell>
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
            <Card className="border-border mb-6" data-testid="weekly-menu-card">
              <CardContent className="p-6 lg:p-8">
                <div className="mb-6">
                  <h3 className="font-display text-2xl font-bold">Weekly menu</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Plan a recurring Monday–Sunday menu for breakfast and dinner. This is the default menu employees and the kitchen see each day. Enter one item per line. Date-specific menus below override this template for that date.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {["monday","tuesday","wednesday","thursday","friday","saturday","sunday"].map((dow) => (
                    <div key={dow} className="rounded-xl border border-border p-4 bg-card/50" data-testid={`weekly-day-${dow}`}>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold capitalize text-lg">{dow}</h4>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {["breakfast","dinner"].map((mt) => {
                          const key = `${dow}:${mt}`;
                          const busy = !!weeklyBusy[key];
                          const clearBusy = !!weeklyClearBusy[key];
                          const draft = weeklyDrafts[key] || "";
                          const saved = weeklyMenu.find((r) => r.day_of_week === dow && r.meal_type === mt);
                          const savedItems = saved?.items || [];
                          return (
                            <div key={mt} className="space-y-2" data-testid={`weekly-slot-${dow}-${mt}`}>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className={`rounded-full ${mt === "breakfast" ? "border-secondary text-secondary" : "border-primary text-primary"}`}>
                                  {mt === "breakfast" ? <Sunrise className="h-3 w-3 mr-1" /> : <Moon className="h-3 w-3 mr-1" />}
                                  {mt[0].toUpperCase() + mt.slice(1)}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {savedItems.length > 0 ? `${savedItems.length} item${savedItems.length === 1 ? "" : "s"}` : "empty"}
                                </span>
                              </div>
                              <Textarea
                                value={draft}
                                onChange={(e) => setWeeklyDrafts((d) => ({ ...d, [key]: e.target.value }))}
                                placeholder={mt === "breakfast" ? "Idli\nSambar\nFilter Coffee" : "Chapati\nDal\nRice"}
                                rows={4}
                                className="font-mono text-sm"
                                data-testid={`weekly-textarea-${dow}-${mt}`}
                              />
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => saveWeeklySlot(dow, mt)}
                                  disabled={busy}
                                  data-testid={`weekly-save-${dow}-${mt}`}
                                  className="rounded-full gap-1.5"
                                >
                                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                                  Save
                                </Button>
                                {savedItems.length > 0 && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => clearWeeklySlot(dow, mt)}
                                    disabled={clearBusy}
                                    data-testid={`weekly-clear-${dow}-${mt}`}
                                    className="rounded-full text-destructive hover:text-destructive"
                                  >
                                    {clearBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-6 lg:p-8">
                <div className="mb-6">
                  <h3 className="font-display text-2xl font-bold">Date-specific menu overrides</h3>
                  <p className="text-sm text-muted-foreground mt-1">Override the weekly template for specific dates (e.g., festivals or special events). If a date has no override, the weekly menu shown above is used.</p>
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
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {menuEntries.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground" data-testid="menu-empty">No menu entries in the next 2 weeks.</TableCell></TableRow>
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
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => deleteMenu(m)}
                              disabled={menuDeleteBusy === m.id}
                              data-testid={`delete-menu-${m.id}`} className="text-destructive hover:text-destructive rounded-full">
                              {menuDeleteBusy === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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

        {/* Edit employee dialog (email / name) */}
        <Dialog open={!!editUser} onOpenChange={(v) => { if (!v) setEditUser(null); }}>
          <DialogContent data-testid="edit-employee-dialog">
            <DialogHeader>
              <DialogTitle>Edit employee</DialogTitle>
              <DialogDescription>
                Update contact details for <span className="font-mono-plex">#{editUser?.employee_number}</span>. Employees receive cancellation notices and password-reset links at their email on file.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submitEdit} className="space-y-4">
              <div className="space-y-2">
                <Label className="overline">Full name</Label>
                <Input value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  data-testid="edit-employee-name-input" className="h-11" />
              </div>
              <div className="space-y-2">
                <Label className="overline">Email</Label>
                <Input type="email" value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  placeholder="user@company.com"
                  data-testid="edit-employee-email-input" className="h-11" />
              </div>
              <DialogFooter className="gap-2 sm:justify-between">
                <Button type="button" variant="outline" onClick={sendResetEmail}
                  disabled={editBusy || !editUser?.email}
                  data-testid="edit-employee-send-reset-email" className="gap-2 rounded-full">
                  <Mail className="h-3.5 w-3.5" /> Send reset link
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={() => setEditUser(null)}>Cancel</Button>
                  <Button type="submit" disabled={editBusy} data-testid="edit-employee-submit">
                    {editBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
