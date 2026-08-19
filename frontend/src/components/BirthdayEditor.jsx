import { useEffect, useMemo, useRef, useState } from "react";
import client, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Cake, Pencil, Trash2, Plus, Search, Upload, Loader2, PartyPopper, MessageSquare, UserPlus, UserCheck,
} from "lucide-react";

const RED = "#e11d48";
const MONTHS = [
  { v: "01", n: "Jan" }, { v: "02", n: "Feb" }, { v: "03", n: "Mar" }, { v: "04", n: "Apr" },
  { v: "05", n: "May" }, { v: "06", n: "Jun" }, { v: "07", n: "Jul" }, { v: "08", n: "Aug" },
  { v: "09", n: "Sep" }, { v: "10", n: "Oct" }, { v: "11", n: "Nov" }, { v: "12", n: "Dec" },
];
const daysInMonth = (mm) => {
  const m = parseInt(mm, 10);
  if (!m) return 31;
  return new Date(2024, m, 0).getDate();
};
const todayMMDD = () => {
  const n = new Date();
  return `${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};

function InitialAvatar({ name, size = 40 }) {
  const letter = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <div className="rounded-full flex items-center justify-center font-bold text-white select-none"
      style={{ width: size, height: size, backgroundColor: RED, fontSize: size * 0.4 }}>
      {letter}
    </div>
  );
}

export default function BirthdayEditor({ employees = [], onEmployeeCreated }) {
  const [birthdays, setBirthdays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState("all");
  const [showTodayOnly, setShowTodayOnly] = useState(false);

  // Add/Edit dialog
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [mode, setMode] = useState("existing"); // "existing" | "new"
  const [form, setForm] = useState({
    user_id: "", month: "", day: "", comment: "",
    new_emp_number: "", new_emp_name: "",
  });
  const [busy, setBusy] = useState(false);
  const [empSearch, setEmpSearch] = useState("");

  // Bulk import dialog
  const [importOpen, setImportOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await client.get("/admin/birthdays");
      setBirthdays(data);
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const today = todayMMDD();
    return birthdays.filter((b) => {
      if (showTodayOnly && b.mmdd !== today) return false;
      if (monthFilter !== "all" && !b.mmdd?.startsWith(monthFilter)) return false;
      if (q && !(
        b.name?.toLowerCase().includes(q) ||
        b.employee_number?.toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [birthdays, search, monthFilter, showTodayOnly]);

  const todaysCount = useMemo(
    () => birthdays.filter((b) => b.mmdd === todayMMDD()).length,
    [birthdays]
  );

  const resetForm = () => setForm({
    user_id: "", month: "", day: "", comment: "",
    new_emp_number: "", new_emp_name: "",
  });

  const openAdd = () => {
    setEditing(null);
    setMode("existing");
    resetForm();
    setEmpSearch("");
    setOpen(true);
  };
  const openEdit = (b) => {
    setEditing(b);
    setMode("existing");
    const [m, d] = (b.mmdd || "").split("-");
    setForm({
      user_id: b.user_id || "", month: m || "", day: d || "",
      comment: b.comment || "",
      new_emp_number: "", new_emp_name: "",
    });
    setEmpSearch("");
    setOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    const mmdd = `${form.month}-${form.day}`;
    if (!/^\d{2}-\d{2}$/.test(mmdd)) { toast.error("Pick a valid date"); return; }
    setBusy(true);
    try {
      if (editing) {
        await client.patch(`/admin/birthdays/${editing.id}`, { mmdd, comment: form.comment });
        toast.success("Birthday updated");
      } else if (mode === "new") {
        const emp = form.new_emp_number.trim();
        const name = form.new_emp_name.trim();
        if (!emp || !name) { toast.error("Employee ID and Name are required"); setBusy(false); return; }
        // Create employee (password = employee number by default)
        const { data: user } = await client.post("/admin/employees", {
          employee_number: emp, name, password: emp, role: "employee",
        });
        await client.post("/admin/birthdays", { user_id: user.id, mmdd, comment: form.comment || null });
        toast.success(`Created ${name} and added birthday`);
        if (onEmployeeCreated) onEmployeeCreated();
      } else {
        if (!form.user_id) { toast.error("Choose an employee"); setBusy(false); return; }
        await client.post("/admin/birthdays", { user_id: form.user_id, mmdd, comment: form.comment || null });
        toast.success("Birthday added");
      }
      setOpen(false);
      await load();
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setBusy(false); }
  };

  const removeBirthday = async (b) => {
    if (!window.confirm(`Remove birthday entry for ${b.name}?`)) return;
    try {
      await client.delete(`/admin/birthdays/${b.id}`);
      toast.success("Birthday removed");
      await load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const onImportFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Please choose an .xlsx file");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setImportBusy(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const { data } = await client.post("/admin/birthdays/bulk-import", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setImportResult(data);
      toast.success(`Imported: ${data.birthdays_added} added, ${data.birthdays_updated} updated`);
      if (onEmployeeCreated && data.created_users > 0) onEmployeeCreated();
      await load();
    } catch (err) { toast.error(formatApiError(err)); }
    finally {
      setImportBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // Show ALL employees (with a "has birthday" hint) so admin can re-target any employee.
  const employeeChoices = useMemo(() => {
    const used = new Set(birthdays.map((b) => b.user_id));
    const q = empSearch.trim().toLowerCase();
    return employees
      .filter((e) => !q || e.name?.toLowerCase().includes(q) || e.employee_number?.toLowerCase().includes(q))
      .slice(0, 150)
      .map((e) => ({ ...e, hasBirthday: used.has(e.id) }));
  }, [employees, birthdays, empSearch]);

  return (
    <div data-testid="birthday-editor">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Cake className="h-5 w-5" style={{ color: RED }} />
          <h3 className="font-display text-2xl font-bold">Birthdays</h3>
          <Badge variant="outline" className="rounded-full ml-1" data-testid="birthdays-total">
            {birthdays.length}
          </Badge>
          {todaysCount > 0 && (
            <Badge className="rounded-full gap-1" style={{ backgroundColor: RED, color: "white" }}
              data-testid="birthdays-today-count">
              🎂 {todaysCount} today
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={() => { setImportResult(null); setImportOpen(true); }}
            className="rounded-full gap-2" data-testid="birthday-import-button">
            <Upload className="h-4 w-4" /> Bulk import
          </Button>
          <Button onClick={openAdd} className="rounded-full gap-2" data-testid="add-birthday-button">
            <Plus className="h-4 w-4" /> Add birthday
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Import from Excel (<span className="font-mono-plex">Employee ID, Name, Birthday</span>) or add manually.
        You can also register a brand-new employee right from the Add dialog.
      </p>

      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or employee #" value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 rounded-full" data-testid="birthday-search-input" />
        </div>
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-36 h-10 rounded-full" data-testid="birthday-month-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All months</SelectItem>
            {MONTHS.map((m) => <SelectItem key={m.v} value={m.v}>{m.n}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant={showTodayOnly ? "default" : "outline"}
          onClick={() => setShowTodayOnly((v) => !v)}
          className="rounded-full gap-2" data-testid="birthday-today-toggle">
          🎂 Today only
        </Button>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="py-3 w-16"></TableHead>
              <TableHead>Employee</TableHead>
              <TableHead className="w-28">Birthday</TableHead>
              <TableHead>Comment</TableHead>
              <TableHead className="text-right w-32">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading…
              </TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground"
                data-testid="birthdays-empty">
                No birthdays match your filter.
              </TableCell></TableRow>
            ) : filtered.map((b) => (
              <TableRow key={b.id} data-testid={`birthday-row-${b.employee_number}`}
                className={b.mmdd === todayMMDD() ? "bg-primary/5" : ""}>
                <TableCell className="py-3">
                  <InitialAvatar name={b.name} />
                </TableCell>
                <TableCell>
                  <div className="font-medium">{b.name}</div>
                  <div className="text-xs text-muted-foreground font-mono-plex">{b.employee_number}</div>
                </TableCell>
                <TableCell className="font-mono-plex text-sm">
                  {b.mmdd}
                  {b.mmdd === todayMMDD() && (
                    <Badge className="ml-2 rounded-full text-[10px]"
                      style={{ backgroundColor: RED, color: "white" }}>Today</Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-xs truncate"
                  data-testid={`birthday-comment-${b.employee_number}`}>
                  {b.comment || <span className="italic opacity-50">—</span>}
                </TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(b)}
                      data-testid={`edit-birthday-${b.employee_number}`} className="rounded-full">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => removeBirthday(b)}
                      data-testid={`delete-birthday-${b.employee_number}`}
                      className="text-destructive hover:text-destructive rounded-full">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg" data-testid="birthday-editor-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cake className="h-5 w-5" style={{ color: RED }} />
              {editing ? `Edit birthday · ${editing.name}` : "Add birthday"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the date of birth and admin comment."
                : "Pick an existing employee, or register a new one on the fly."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-4">
            {!editing && (
              <div className="flex items-center gap-2 rounded-full border border-border p-1 bg-muted/40 w-fit">
                <button type="button" onClick={() => setMode("existing")}
                  className={`h-8 rounded-full px-4 text-sm gap-2 inline-flex items-center transition ${mode === "existing" ? "bg-white shadow font-semibold" : "text-muted-foreground"}`}
                  data-testid="birthday-mode-existing">
                  <UserCheck className="h-4 w-4" /> Existing employee
                </button>
                <button type="button" onClick={() => setMode("new")}
                  className={`h-8 rounded-full px-4 text-sm gap-2 inline-flex items-center transition ${mode === "new" ? "bg-white shadow font-semibold" : "text-muted-foreground"}`}
                  data-testid="birthday-mode-new">
                  <UserPlus className="h-4 w-4" /> New employee
                </button>
              </div>
            )}

            {!editing && mode === "existing" && (
              <div className="space-y-2">
                <Label className="overline">Employee</Label>
                <Input placeholder="Search employee..." value={empSearch}
                  onChange={(e) => setEmpSearch(e.target.value)}
                  className="h-10" data-testid="birthday-employee-search" />
                <div className="max-h-40 overflow-y-auto rounded-lg border border-border">
                  {employeeChoices.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground">
                      {employees.length === 0 ? "No employees" : "No matches"}
                    </div>
                  ) : employeeChoices.map((e) => (
                    <button type="button" key={e.id}
                      onClick={() => setForm((p) => ({ ...p, user_id: e.id }))}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition flex items-center justify-between ${form.user_id === e.id ? "bg-primary/10 font-semibold" : ""}`}
                      data-testid={`birthday-emp-option-${e.employee_number}`}>
                      <span>
                        <span className="font-mono-plex text-xs mr-2 opacity-70">{e.employee_number}</span>
                        {e.name}
                      </span>
                      {e.hasBirthday && (
                        <Badge variant="outline" className="rounded-full text-[10px] ml-2">has DOB</Badge>
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Selecting an employee who already has a DOB will overwrite it.
                </p>
              </div>
            )}

            {!editing && mode === "new" && (
              <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="overline">Employee ID</Label>
                    <Input value={form.new_emp_number}
                      onChange={(e) => setForm((p) => ({ ...p, new_emp_number: e.target.value }))}
                      placeholder="e.g. 655555" className="h-10 font-mono-plex"
                      data-testid="birthday-new-emp-id" />
                  </div>
                  <div className="space-y-2">
                    <Label className="overline">Name</Label>
                    <Input value={form.new_emp_name}
                      onChange={(e) => setForm((p) => ({ ...p, new_emp_name: e.target.value }))}
                      placeholder="Full name" className="h-10" data-testid="birthday-new-emp-name" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  A new employee account will be created. Default password = Employee ID.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="overline">Month</Label>
                <Select value={form.month} onValueChange={(v) => setForm((p) => ({
                  ...p, month: v, day: p.day && parseInt(p.day) > daysInMonth(v) ? "" : p.day
                }))}>
                  <SelectTrigger className="h-10" data-testid="birthday-month-select">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => <SelectItem key={m.v} value={m.v}>{m.n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="overline">Day</Label>
                <Select value={form.day} onValueChange={(v) => setForm((p) => ({ ...p, day: v }))}
                  disabled={!form.month}>
                  <SelectTrigger className="h-10" data-testid="birthday-day-select">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: daysInMonth(form.month) }).map((_, i) => {
                      const d = String(i + 1).padStart(2, "0");
                      return <SelectItem key={d} value={d}>{d}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="overline flex items-center gap-1.5">
                <MessageSquare className="h-3 w-3" /> Admin comment (optional)
              </Label>
              <Textarea rows={3} value={form.comment}
                onChange={(e) => setForm((p) => ({ ...p, comment: e.target.value }))}
                placeholder="Personal note that will appear on the celebration card…"
                maxLength={280}
                data-testid="birthday-comment-input" />
              <div className="text-xs text-muted-foreground text-right">{form.comment.length}/280</div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit"
                disabled={busy || !form.month || !form.day
                  || (!editing && mode === "existing" && !form.user_id)
                  || (!editing && mode === "new" && (!form.new_emp_number.trim() || !form.new_emp_name.trim()))}
                data-testid="birthday-submit-button" className="rounded-full">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (editing ? "Save changes" : (mode === "new" ? "Create & add" : "Add birthday"))}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk import dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-lg" data-testid="birthday-import-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" style={{ color: RED }} />
              Import birthdays from Excel
            </DialogTitle>
            <DialogDescription>
              Upload a .xlsx with columns <span className="font-mono-plex">Employee ID</span>,
              <span className="font-mono-plex"> Name</span>, and <span className="font-mono-plex">Birthday</span>.
              Missing employees are created automatically (password = Employee ID).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <input ref={fileRef} type="file" accept=".xlsx" onChange={onImportFile} className="hidden"
              data-testid="birthday-import-input" />
            <div className="rounded-xl border-2 border-dashed p-6 text-center" style={{ borderColor: RED }}>
              <PartyPopper className="h-8 w-8 mx-auto mb-2" style={{ color: RED }} />
              <p className="text-sm text-muted-foreground mb-3">
                Any common date format works (DD/MM/YYYY, YYYY-MM-DD, etc.)
              </p>
              <Button onClick={() => fileRef.current?.click()} disabled={importBusy}
                data-testid="birthday-import-pick-file" className="rounded-full gap-2">
                {importBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {importBusy ? "Importing…" : "Choose Excel file"}
              </Button>
            </div>

            {importResult && (
              <div className="rounded-lg border border-border p-4 text-sm space-y-1"
                data-testid="birthday-import-result">
                <div className="flex justify-between"><span>New employees created</span>
                  <span className="font-mono-plex font-bold">{importResult.created_users}</span></div>
                <div className="flex justify-between"><span>Birthdays added</span>
                  <span className="font-mono-plex font-bold">{importResult.birthdays_added}</span></div>
                <div className="flex justify-between"><span>Birthdays updated</span>
                  <span className="font-mono-plex font-bold">{importResult.birthdays_updated}</span></div>
                {importResult.errors?.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <div className="text-destructive font-semibold mb-1">
                      {importResult.errors.length} error{importResult.errors.length > 1 ? "s" : ""}:
                    </div>
                    <ul className="text-xs text-destructive/80 max-h-32 overflow-y-auto space-y-0.5">
                      {importResult.errors.slice(0, 10).map((e, i) => (
                        <li key={i}>Row {e.line}: {e.error}</li>
                      ))}
                      {importResult.errors.length > 10 && (
                        <li>… and {importResult.errors.length - 10} more</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setImportOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
