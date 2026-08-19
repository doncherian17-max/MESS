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
import { Sparkles, Pencil, Trash2, Plus, Loader2, PartyPopper } from "lucide-react";

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

const EMOJI_SUGGESTIONS = [
  "🎉", "🎊", "🇮🇳", "🪔", "🎄", "🌺", "🕊️", "🌾", "🛠️", "🎂", "❤️", "🌟", "🌈", "🕎", "☪️", "☸️",
];

function PreviewCard({ name, message, emoji, mmdd }) {
  return (
    <div
      className="relative rounded-3xl overflow-hidden p-6 text-center"
      style={{ background: "linear-gradient(135deg,#fff7ed 0%,#fee2e2 50%,#ede9fe 100%)" }}
      data-testid="special-day-preview"
    >
      <div className="flex items-center justify-center gap-2 mb-3">
        <Sparkles className="h-4 w-4" style={{ color: RED }} />
        <p className="text-xs font-bold tracking-widest uppercase" style={{ color: RED }}>
          Preview {mmdd ? `· ${mmdd}` : ""}
        </p>
        <Sparkles className="h-4 w-4" style={{ color: RED }} />
      </div>
      <div className="text-6xl mb-2">{emoji || "🎊"}</div>
      <h4 className="font-display text-xl font-extrabold" style={{ color: "#7f1d1d" }}>
        {name || "Special day name"}
      </h4>
      {message && (
        <p className="mt-2 text-xs italic" style={{ color: "#7f1d1d" }}>{message}</p>
      )}
    </div>
  );
}

export default function SpecialDaysEditor() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ month: "", day: "", name: "", message: "", emoji: "🎊" });
  const [busy, setBusy] = useState(false);
  const emojiInput = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await client.get("/admin/special-days");
      setRows(data);
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ month: "", day: "", name: "", message: "", emoji: "🎊" });
    setOpen(true);
  };
  const openEdit = (r) => {
    setEditing(r);
    const [m, d] = (r.mmdd || "").split("-");
    setForm({ month: m || "", day: d || "", name: r.name || "", message: r.message || "", emoji: r.emoji || "🎊" });
    setOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    const mmdd = `${form.month}-${form.day}`;
    if (!/^\d{2}-\d{2}$/.test(mmdd)) { toast.error("Pick a valid date"); return; }
    if (!form.name.trim() || !form.message.trim()) { toast.error("Name and message are required"); return; }
    setBusy(true);
    try {
      if (editing) {
        await client.patch(`/admin/special-days/${editing.id}`, {
          mmdd, name: form.name.trim(), message: form.message.trim(), emoji: form.emoji || "🎊",
        });
        toast.success("Special day updated");
      } else {
        await client.post("/admin/special-days", {
          mmdd, name: form.name.trim(), message: form.message.trim(), emoji: form.emoji || "🎊",
        });
        toast.success("Special day added");
      }
      setOpen(false);
      await load();
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setBusy(false); }
  };

  const remove = async (r) => {
    if (!window.confirm(`Delete "${r.name}" (${r.mmdd})?`)) return;
    try {
      await client.delete(`/admin/special-days/${r.id}`);
      toast.success("Removed");
      await load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const previewMmdd = form.month && form.day ? `${form.month}-${form.day}` : "";
  const todayMmdd = useMemo(() => {
    const n = new Date();
    return `${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  }, []);

  return (
    <div data-testid="special-days-editor">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2">
          <PartyPopper className="h-5 w-5" style={{ color: RED }} />
          <h3 className="font-display text-2xl font-bold">Special days</h3>
          <Badge variant="outline" className="rounded-full ml-1" data-testid="special-days-count">{rows.length}</Badge>
        </div>
        <Button onClick={openAdd} className="rounded-full gap-2" data-testid="add-special-day-button">
          <Plus className="h-4 w-4" /> Add special day
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Employees see a festive popup on the day, plus a banner on their dashboard. Add festivals like Diwali, Onam,
        Founders&apos; Day, or any workplace milestone without a redeploy.
      </p>

      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="py-3 w-16">Emoji</TableHead>
              <TableHead className="w-28">Date</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Message</TableHead>
              <TableHead className="text-right w-32">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading…
              </TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground" data-testid="special-days-empty">
                No special days yet — add one above.
              </TableCell></TableRow>
            ) : rows.map((r) => (
              <TableRow key={r.id} data-testid={`special-day-row-${r.mmdd}`}
                className={r.mmdd === todayMmdd ? "bg-primary/5" : ""}>
                <TableCell className="text-2xl py-3">{r.emoji || "🎊"}</TableCell>
                <TableCell className="font-mono-plex text-sm">
                  {r.mmdd}
                  {r.mmdd === todayMmdd && (
                    <Badge className="ml-2 rounded-full text-[10px]" style={{ backgroundColor: RED, color: "white" }}>Today</Badge>
                  )}
                </TableCell>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-md truncate">{r.message}</TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(r)}
                      data-testid={`edit-special-day-${r.mmdd}`} className="rounded-full">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(r)}
                      data-testid={`delete-special-day-${r.mmdd}`}
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
        <DialogContent className="max-w-2xl" data-testid="special-day-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PartyPopper className="h-5 w-5" style={{ color: RED }} />
              {editing ? `Edit · ${editing.name}` : "Add special day"}
            </DialogTitle>
            <DialogDescription>
              These greetings appear as a festive popup + banner on the employee dashboard for the matching date.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="overline">Month</Label>
                  <Select value={form.month} onValueChange={(v) => setForm((p) => ({
                    ...p, month: v, day: p.day && parseInt(p.day) > daysInMonth(v) ? "" : p.day
                  }))}>
                    <SelectTrigger className="h-10" data-testid="special-day-month"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m) => <SelectItem key={m.v} value={m.v}>{m.n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="overline">Day</Label>
                  <Select value={form.day} onValueChange={(v) => setForm((p) => ({ ...p, day: v }))} disabled={!form.month}>
                    <SelectTrigger className="h-10" data-testid="special-day-day"><SelectValue placeholder="—" /></SelectTrigger>
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
                <Label className="overline">Name</Label>
                <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Diwali, Founders' Day" maxLength={100}
                  data-testid="special-day-name" className="h-10" />
              </div>

              <div className="space-y-2">
                <Label className="overline">Message</Label>
                <Textarea rows={3} value={form.message}
                  onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                  placeholder="Wishing you a joyful day…" maxLength={500}
                  data-testid="special-day-message" />
                <div className="text-xs text-muted-foreground text-right">{form.message.length}/500</div>
              </div>

              <div className="space-y-2">
                <Label className="overline">Emoji</Label>
                <div className="flex items-center gap-2">
                  <Input ref={emojiInput} value={form.emoji}
                    onChange={(e) => setForm((p) => ({ ...p, emoji: e.target.value.slice(0, 4) }))}
                    className="h-10 w-20 text-center text-2xl"
                    data-testid="special-day-emoji-input" />
                  <div className="flex flex-wrap gap-1.5">
                    {EMOJI_SUGGESTIONS.map((e) => (
                      <button type="button" key={e} onClick={() => setForm((p) => ({ ...p, emoji: e }))}
                        className={`text-xl h-9 w-9 rounded-full border transition ${form.emoji === e ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}
                        data-testid={`special-day-emoji-${e}`}>{e}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="overline flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" /> Live preview
              </Label>
              <PreviewCard name={form.name} message={form.message} emoji={form.emoji} mmdd={previewMmdd} />
            </div>

            <DialogFooter className="md:col-span-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={busy || !form.month || !form.day || !form.name.trim() || !form.message.trim()}
                data-testid="special-day-submit" className="rounded-full">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (editing ? "Save changes" : "Add special day")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
