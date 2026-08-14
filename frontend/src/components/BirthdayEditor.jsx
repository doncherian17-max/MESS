import { useEffect, useMemo, useRef, useState } from "react";
import client, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle,
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
  Cake, Pencil, Trash2, Plus, Search, Upload, X, Loader2, ImageIcon, PartyPopper,
} from "lucide-react";

const RED = "#e11d48";

const MONTHS = [
  { v: "01", n: "Jan" }, { v: "02", n: "Feb" }, { v: "03", n: "Mar" }, { v: "04", n: "Apr" },
  { v: "05", n: "May" }, { v: "06", n: "Jun" }, { v: "07", n: "Jul" }, { v: "08", n: "Aug" },
  { v: "09", n: "Sep" }, { v: "10", n: "Oct" }, { v: "11", n: "Nov" }, { v: "12", n: "Dec" },
];

function daysInMonth(mm) {
  const m = parseInt(mm, 10);
  if (!m) return 31;
  return new Date(2024, m, 0).getDate(); // 2024 is a leap year so Feb=29
}

function defaultAvatar(name) {
  const letter = (name || "?").trim().charAt(0).toUpperCase();
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'>` +
    `<rect width='160' height='160' fill='${RED}'/>` +
    `<text x='50%' y='55%' font-size='72' text-anchor='middle' fill='white' font-family='Arial' font-weight='bold'>${letter}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function todayMMDD() {
  const n = new Date();
  return `${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function BirthdayPreviewCard({ name, photo, comment, mmdd }) {
  return (
    <div
      className="relative rounded-3xl overflow-hidden p-6 text-center"
      style={{
        background: "linear-gradient(135deg, #fff7ed 0%, #fee2e2 50%, #ede9fe 100%)",
      }}
      data-testid="birthday-preview-card"
    >
      <div className="flex items-center justify-center gap-2 mb-3">
        <PartyPopper className="h-4 w-4" style={{ color: RED }} />
        <p className="text-xs font-bold tracking-widest uppercase" style={{ color: RED }}>
          Preview {mmdd ? `· ${mmdd}` : ""}
        </p>
        <PartyPopper className="h-4 w-4" style={{ color: RED }} />
      </div>
      <div
        className="mx-auto w-24 h-24 rounded-full overflow-hidden mb-3"
        style={{ border: `4px solid ${RED}` }}
      >
        <img
          src={photo || defaultAvatar(name)}
          alt={name || "preview"}
          className="w-full h-full object-cover"
          onError={(e) => { e.target.src = defaultAvatar(name); }}
        />
      </div>
      <h4 className="font-display text-xl font-extrabold" style={{ color: "#7f1d1d" }}>
        🎂 {name || "Employee Name"}
      </h4>
      {comment && (
        <div
          className="mt-3 rounded-xl px-3 py-2 bg-white/70 border text-xs italic"
          style={{ borderColor: RED, color: "#7f1d1d" }}
        >
          💬 {comment}
        </div>
      )}
    </div>
  );
}

export default function BirthdayEditor({ employees = [] }) {
  const [birthdays, setBirthdays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState("all");
  const [showTodayOnly, setShowTodayOnly] = useState(false);

  // Dialog state
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null); // birthday record or null (add)
  const [form, setForm] = useState({
    user_id: "", month: "", day: "", comment: "", photo: "",
  });
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [empSearch, setEmpSearch] = useState("");
  const fileRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await client.get("/admin/birthdays");
      setBirthdays(data);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally { setLoading(false); }
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

  const openAdd = () => {
    setEditing(null);
    setForm({ user_id: "", month: "", day: "", comment: "", photo: "" });
    setEmpSearch("");
    setOpen(true);
  };

  const openEdit = (b) => {
    setEditing(b);
    const [m, d] = (b.mmdd || "").split("-");
    setForm({
      user_id: b.user_id || "",
      month: m || "",
      day: d || "",
      comment: b.comment || "",
      photo: b.photo || "",
    });
    setEmpSearch("");
    setOpen(true);
  };

  const onFilePick = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/^image\//.test(f.type)) { toast.error("Please choose an image file"); return; }
    if (f.size > 8 * 1024 * 1024) { toast.error("Image too large (max 8 MB)"); return; }
    setPhotoBusy(true);
    try {
      const dataUrl = await readFileAsDataURL(f);
      setForm((p) => ({ ...p, photo: dataUrl }));
    } catch {
      toast.error("Could not read file");
    } finally {
      setPhotoBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const clearPhoto = () => setForm((p) => ({ ...p, photo: "" }));

  const submit = async (e) => {
    e.preventDefault();
    const mmdd = `${form.month}-${form.day}`;
    if (!/^\d{2}-\d{2}$/.test(mmdd)) { toast.error("Pick a valid date"); return; }
    if (!editing && !form.user_id) { toast.error("Choose an employee"); return; }
    setBusy(true);
    try {
      if (editing) {
        const payload = { mmdd, comment: form.comment || "" };
        if (form.photo && form.photo !== editing.photo) {
          payload.photo = form.photo;
        } else if (!form.photo && editing.photo) {
          payload.clear_photo = true;
        }
        await client.patch(`/admin/birthdays/${editing.id}`, payload);
        toast.success("Birthday updated");
      } else {
        await client.post("/admin/birthdays", {
          user_id: form.user_id, mmdd,
          comment: form.comment || null,
          photo: form.photo || null,
        });
        toast.success("Birthday added");
      }
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally { setBusy(false); }
  };

  const removeBirthday = async (b) => {
    if (!window.confirm(`Remove birthday entry for ${b.name}?`)) return;
    try {
      await client.delete(`/admin/birthdays/${b.id}`);
      toast.success("Birthday removed");
      await load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  // Employees not yet in birthdays list (only for Add flow)
  const availableEmployees = useMemo(() => {
    const used = new Set(birthdays.map((b) => b.user_id));
    const q = empSearch.trim().toLowerCase();
    return employees
      .filter((e) => !used.has(e.id))
      .filter((e) => !q || e.name?.toLowerCase().includes(q) || e.employee_number?.toLowerCase().includes(q))
      .slice(0, 100);
  }, [employees, birthdays, empSearch]);

  const previewName = editing?.name
    || employees.find((e) => e.id === form.user_id)?.name
    || "";

  return (
    <div data-testid="birthday-editor" className="mt-8">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Cake className="h-5 w-5" style={{ color: RED }} />
          <h4 className="font-display text-xl font-bold">Birthdays</h4>
          <Badge variant="outline" className="rounded-full ml-1" data-testid="birthdays-total">
            {birthdays.length}
          </Badge>
          {todaysCount > 0 && (
            <Badge className="rounded-full gap-1" style={{ backgroundColor: RED, color: "white" }} data-testid="birthdays-today-count">
              🎂 {todaysCount} today
            </Badge>
          )}
        </div>
        <Button onClick={openAdd} className="rounded-full gap-2" data-testid="add-birthday-button">
          <Plus className="h-4 w-4" /> Add birthday
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or employee #"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 rounded-full"
            data-testid="birthday-search-input"
          />
        </div>
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-36 h-10 rounded-full" data-testid="birthday-month-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All months</SelectItem>
            {MONTHS.map((m) => (
              <SelectItem key={m.v} value={m.v}>{m.n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={showTodayOnly ? "default" : "outline"}
          onClick={() => setShowTodayOnly((v) => !v)}
          className="rounded-full gap-2"
          data-testid="birthday-today-toggle"
        >
          🎂 Today only
        </Button>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="py-3 w-16">Photo</TableHead>
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
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground" data-testid="birthdays-empty">
                No birthdays match your filter.
              </TableCell></TableRow>
            ) : filtered.map((b) => (
              <TableRow key={b.id} data-testid={`birthday-row-${b.employee_number}`}>
                <TableCell className="py-3">
                  <img
                    src={b.photo || defaultAvatar(b.name)}
                    alt={b.name}
                    className="w-10 h-10 rounded-full object-cover"
                    style={{ border: `2px solid ${RED}` }}
                    onError={(e) => { e.target.src = defaultAvatar(b.name); }}
                    data-testid={`birthday-photo-${b.employee_number}`}
                  />
                </TableCell>
                <TableCell>
                  <div className="font-medium">{b.name}</div>
                  <div className="text-xs text-muted-foreground font-mono-plex">{b.employee_number}</div>
                </TableCell>
                <TableCell className="font-mono-plex text-sm">{b.mmdd}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                  {b.comment || <span className="italic opacity-60">—</span>}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl" data-testid="birthday-editor-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cake className="h-5 w-5" style={{ color: RED }} />
              {editing ? `Edit birthday · ${editing.name}` : "Add birthday"}
            </DialogTitle>
            <DialogDescription>
              Manage the DOB, wish message, and celebration photo. Preview shows how it will appear.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              {!editing && (
                <div className="space-y-2">
                  <Label className="overline">Employee</Label>
                  <Input
                    placeholder="Search employee..."
                    value={empSearch}
                    onChange={(e) => setEmpSearch(e.target.value)}
                    className="h-10"
                    data-testid="birthday-employee-search"
                  />
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-border">
                    {availableEmployees.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground">
                        {employees.length === 0 ? "No employees" : "No matches / all have birthdays set"}
                      </div>
                    ) : availableEmployees.map((e) => (
                      <button
                        type="button"
                        key={e.id}
                        onClick={() => setForm((p) => ({ ...p, user_id: e.id }))}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition ${form.user_id === e.id ? "bg-primary/10 font-semibold" : ""}`}
                        data-testid={`birthday-emp-option-${e.employee_number}`}
                      >
                        <span className="font-mono-plex text-xs mr-2 opacity-70">{e.employee_number}</span>
                        {e.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="overline">Month</Label>
                  <Select value={form.month} onValueChange={(v) => setForm((p) => ({ ...p, month: v, day: p.day && parseInt(p.day) > daysInMonth(v) ? "" : p.day }))}>
                    <SelectTrigger className="h-10" data-testid="birthday-month-select"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m) => <SelectItem key={m.v} value={m.v}>{m.n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="overline">Day</Label>
                  <Select value={form.day} onValueChange={(v) => setForm((p) => ({ ...p, day: v }))} disabled={!form.month}>
                    <SelectTrigger className="h-10" data-testid="birthday-day-select"><SelectValue placeholder="—" /></SelectTrigger>
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
                <Label className="overline">Admin comment / wish (optional)</Label>
                <Textarea
                  rows={3}
                  placeholder="Write a personal note that will appear on the celebration card…"
                  value={form.comment}
                  onChange={(e) => setForm((p) => ({ ...p, comment: e.target.value }))}
                  maxLength={280}
                  data-testid="birthday-comment-input"
                />
                <div className="text-xs text-muted-foreground text-right">{form.comment.length}/280</div>
              </div>

              <div className="space-y-2">
                <Label className="overline">Photo (optional)</Label>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    onChange={onFilePick}
                    className="hidden"
                    data-testid="birthday-photo-input"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileRef.current?.click()}
                    disabled={photoBusy}
                    className="rounded-full gap-2"
                    data-testid="birthday-photo-upload-button"
                  >
                    {photoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {form.photo ? "Replace photo" : "Upload photo"}
                  </Button>
                  {form.photo && (
                    <Button type="button" variant="ghost" onClick={clearPhoto} className="rounded-full text-destructive gap-1" data-testid="birthday-photo-clear-button">
                      <X className="h-4 w-4" /> Remove
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Auto-cropped to a 512×512 square. Max 8 MB.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="overline flex items-center gap-1.5">
                <ImageIcon className="h-3 w-3" /> Live preview
              </Label>
              <BirthdayPreviewCard
                name={previewName}
                photo={form.photo}
                comment={form.comment}
                mmdd={form.month && form.day ? `${form.month}-${form.day}` : ""}
              />
            </div>

            <DialogFooter className="md:col-span-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                type="submit"
                disabled={busy || (!editing && !form.user_id) || !form.month || !form.day}
                data-testid="birthday-submit-button"
                className="rounded-full"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (editing ? "Save changes" : "Add birthday")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
