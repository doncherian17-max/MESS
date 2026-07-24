import { useEffect, useMemo, useState } from "react";
import client, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import TopBar from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Sunrise, Moon, Clock, CheckCircle2, XCircle, Loader2, CalendarCheck2, TrendingUp,
  UtensilsCrossed, ShoppingBag, Plus, Minus, PartyPopper, ChefHat, Package, Lock,
  AlertOctagon, ShieldAlert,
} from "lucide-react";

function fmtDate(iso) {
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  } catch { return iso; }
}
function fmtDateTime(iso) {
  try { return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); }
  catch { return iso; }
}

function MealCard({ item, menu, onBook, onUpdate, onCancel, busy }) {
  const isBreakfast = item.meal_type === "breakfast";
  const Icon = isBreakfast ? Sunrise : Moon;
  const colorClass = isBreakfast ? "meal-breakfast" : "meal-dinner";
  const label = isBreakfast ? "Breakfast" : "Dinner";
  const targetLabel = isBreakfast ? "Tomorrow" : "Today";

  const [qty, setQty] = useState(item.quantity || 1);
  const [type, setType] = useState(item.booking_type || "dine_in");

  useEffect(() => {
    setQty(item.quantity || 1);
    setType(item.booking_type || "dine_in");
  }, [item.booking_id, item.booked, item.quantity, item.booking_type]);

  const holiday = item.holiday;
  const notYetOpen = !!item.not_yet_open;
  const disabled = item.cutoff_passed || !!holiday || notYetOpen;

  return (
    <Card className={`${colorClass} card-lift border-border overflow-hidden`} data-testid={`meal-card-${item.meal_type}`}>
      <div className="h-1.5" style={{ backgroundColor: `hsl(var(--meal-color))` }} />
      <CardContent className="p-6 lg:p-8">
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="overline text-muted-foreground mb-2">{targetLabel}&apos;s meal</p>
            <h3 className="font-display text-3xl font-extrabold tracking-tight flex items-center gap-3">
              <Icon className="h-7 w-7" style={{ color: `hsl(var(--meal-color))` }} />
              {label}
            </h3>
            <p className="text-muted-foreground text-sm mt-2 font-mono-plex">{fmtDate(item.meal_date)}</p>
          </div>
          {holiday ? (
            <Badge variant="outline" className="rounded-full border-destructive text-destructive" data-testid={`badge-holiday-${item.meal_type}`}>
              <PartyPopper className="h-3 w-3 mr-1" /> {holiday.name}
            </Badge>
          ) : item.booked ? (
            <Badge className="bg-secondary text-secondary-foreground rounded-full" data-testid={`badge-booked-${item.meal_type}`}>
              <CheckCircle2 className="h-3 w-3 mr-1" /> Booked
            </Badge>
          ) : item.cutoff_passed ? (
            <Badge variant="outline" className="rounded-full border-destructive text-destructive" data-testid={`badge-closed-${item.meal_type}`}>
              <XCircle className="h-3 w-3 mr-1" /> Closed
            </Badge>
          ) : (
            <Badge variant="outline" className="rounded-full" data-testid={`badge-open-${item.meal_type}`}>Open</Badge>
          )}
        </div>

        {menu && menu.items && menu.items.length > 0 && (
          <div className="mb-5 rounded-lg bg-accent/60 p-3 text-sm" data-testid={`menu-${item.meal_type}`}>
            <div className="overline text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <ChefHat className="h-3 w-3" /> On the menu
            </div>
            <div className="text-foreground leading-relaxed">{menu.items.join(" · ")}</div>
          </div>
        )}

        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-5">
          <Clock className="h-4 w-4" />
          <span>
            {item.opens_at ? (
              <>Window: <span className="font-mono-plex text-foreground">{fmtDateTime(item.opens_at)}</span> → <span className="font-mono-plex text-foreground">{fmtDateTime(item.cutoff)}</span></>
            ) : (
              <>Cutoff: <span className="font-mono-plex text-foreground">{fmtDateTime(item.cutoff)}</span></>
            )}
          </span>
        </div>

        {!disabled && (
          <div className="mb-5 space-y-3">
            <div>
              <div className="overline text-muted-foreground mb-1.5">Serving style</div>
              <ToggleGroup type="single" value={type} onValueChange={(v) => v && setType(v)}
                className="justify-start" data-testid={`type-toggle-${item.meal_type}`}>
                <ToggleGroupItem value="dine_in" className="rounded-full px-4 gap-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground" data-testid={`type-dine-in-${item.meal_type}`}>
                  <UtensilsCrossed className="h-3.5 w-3.5" /> Dine-in
                </ToggleGroupItem>
                <ToggleGroupItem value="parcel" className="rounded-full px-4 gap-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground" data-testid={`type-parcel-${item.meal_type}`}>
                  <ShoppingBag className="h-3.5 w-3.5" /> Parcel
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div>
              <div className="overline text-muted-foreground mb-1.5">Quantity</div>
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" size="icon"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  data-testid={`qty-minus-${item.meal_type}`}
                  className="h-10 w-10 rounded-full">
                  <Minus className="h-4 w-4" />
                </Button>
                <div className="font-display font-extrabold text-3xl w-12 text-center tabular-nums" data-testid={`qty-value-${item.meal_type}`}>{qty}</div>
                <Button type="button" variant="outline" size="icon"
                  onClick={() => setQty((q) => Math.min(5, q + 1))}
                  data-testid={`qty-plus-${item.meal_type}`}
                  className="h-10 w-10 rounded-full">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {item.booked ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onCancel(item)} disabled={busy || item.cutoff_passed}
              data-testid={`cancel-${item.meal_type}-button`} className="flex-1 h-11 rounded-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (item.cutoff_passed ? "Locked in" : "Cancel")}
            </Button>
            {!item.cutoff_passed && (qty !== item.quantity || type !== item.booking_type) && (
              <Button onClick={() => onUpdate(item, { quantity: qty, booking_type: type })}
                disabled={busy} data-testid={`update-${item.meal_type}-button`}
                className="flex-1 h-11 rounded-full font-semibold">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
              </Button>
            )}
          </div>
        ) : (
          <Button onClick={() => onBook(item, { quantity: qty, booking_type: type })}
            disabled={busy || disabled} data-testid={`book-${item.meal_type}-button`}
            className="w-full h-11 rounded-full font-semibold"
            style={{ backgroundColor: `hsl(var(--meal-color))`, color: "white" }}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              holiday ? "Holiday — closed"
                : notYetOpen ? `Opens ${fmtDateTime(item.opens_at)}`
                : item.cutoff_passed ? "Cutoff passed"
                : `Book ${label} (${qty})`
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [status, setStatus] = useState(null);
  const [menuMap, setMenuMap] = useState({});
  const [summary, setSummary] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [cancellations, setCancellations] = useState([]);
  const [busyKey, setBusyKey] = useState(null);
  const [loading, setLoading] = useState(true);

  const month = useMemo(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [s, m, h, c] = await Promise.all([
        client.get("/bookings/status"),
        client.get(`/bookings/mine?month=${month}`),
        client.get("/holidays"),
        client.get(`/bookings/cancellations?month=${month}`),
      ]);
      setStatus(s.data);
      setSummary(m.data);
      setHolidays(h.data);
      setCancellations(c.data.items || []);
      // Load menu for each meal card date
      const map = {};
      await Promise.all(s.data.items.map(async (it) => {
        try {
          const r = await client.get(`/menu?date=${it.meal_date}&meal_type=${it.meal_type}`);
          map[`${it.meal_date}:${it.meal_type}`] = r.data[0] || null;
        } catch { /* ignore */ }
      }));
      setMenuMap(map);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const book = async (item, extra) => {
    setBusyKey(item.meal_type);
    try {
      await client.post("/bookings", { meal_type: item.meal_type, meal_date: item.meal_date, ...extra });
      toast.success(`${item.meal_type === "breakfast" ? "Breakfast" : "Dinner"} booked for ${fmtDate(item.meal_date)}`);
      await load();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setBusyKey(null); }
  };

  const update = async (item, patch) => {
    setBusyKey(item.meal_type);
    try {
      await client.patch(`/bookings/${item.booking_id}`, patch);
      toast.success("Booking updated");
      await load();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setBusyKey(null); }
  };

  const cancel = async (item) => {
    setBusyKey(item.meal_type);
    try {
      await client.delete(`/bookings/${item.booking_id}`);
      toast.success("Booking cancelled");
      await load();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setBusyKey(null); }
  };

  const monthLabel = useMemo(() => {
    const [y, mm] = month.split("-");
    return new Date(Number(y), Number(mm) - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }, [month]);

  const upcomingHolidays = holidays.slice(0, 3);

  return (
    <div className="min-h-screen bg-background warm-grain">
      <TopBar />
      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-10 lg:py-14" data-testid="employee-dashboard">
        <div className="mb-10">
          <p className="overline text-muted-foreground mb-3">Hello, {user?.name?.split(" ")[0] || "there"}</p>
          <h1 className="font-display text-4xl lg:text-5xl font-extrabold tracking-tight">
            What&apos;s on the menu today?
          </h1>
          <p className="text-muted-foreground mt-3 max-w-xl leading-relaxed">
            Book tomorrow&apos;s breakfast between 10:00 AM and 11:30 PM. Today&apos;s dinner closes at 2:30 PM. Simple.
          </p>
        </div>

        {upcomingHolidays.length > 0 && (
          <div className="mb-8 flex flex-wrap gap-2" data-testid="upcoming-holidays">
            <span className="overline text-muted-foreground mr-2 self-center">Upcoming holidays:</span>
            {upcomingHolidays.map((h) => (
              <Badge key={h.id} variant="outline" className="rounded-full gap-1.5 border-primary/40 text-primary">
                <PartyPopper className="h-3 w-3" /> {h.name} · <span className="font-mono-plex">{h.date}</span>
              </Badge>
            ))}
          </div>
        )}

        {loading || !status ? (
          <div className="flex items-center gap-2 text-muted-foreground" data-testid="dashboard-loading">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your dashboard…
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 gap-6 mb-12" data-testid="meal-cards-grid">
              {status.items.map((it) => (
                <MealCard
                  key={it.meal_type}
                  item={it}
                  menu={menuMap[`${it.meal_date}:${it.meal_type}`]}
                  onBook={book}
                  onUpdate={update}
                  onCancel={cancel}
                  busy={busyKey === it.meal_type}
                />
              ))}
            </div>

            <section className="mb-10" data-testid="monthly-stats-section">
              <div className="flex items-baseline justify-between mb-4">
                <div>
                  <p className="overline text-muted-foreground mb-1">Your month at a glance</p>
                  <h2 className="font-display text-2xl font-bold">{monthLabel}</h2>
                </div>
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-border">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 overline text-muted-foreground mb-2"><Sunrise className="h-3.5 w-3.5" /> Breakfast</div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-display font-extrabold text-5xl tracking-tight" data-testid="stat-breakfast-count">{summary?.breakfast_count ?? 0}</span>
                      <span className="text-muted-foreground text-sm">meals</span>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 overline text-muted-foreground mb-2"><Moon className="h-3.5 w-3.5" /> Dinner</div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-display font-extrabold text-5xl tracking-tight" data-testid="stat-dinner-count">{summary?.dinner_count ?? 0}</span>
                      <span className="text-muted-foreground text-sm">meals</span>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border bg-accent">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 overline text-muted-foreground mb-2"><CalendarCheck2 className="h-3.5 w-3.5" /> Total</div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-display font-extrabold text-5xl tracking-tight text-primary" data-testid="stat-total-count">{summary?.total ?? 0}</span>
                      <span className="text-muted-foreground text-sm">meals</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>

            {cancellations.length > 0 && (
              <section className="mb-10" data-testid="cancellations-section">
                <div className="flex items-baseline justify-between mb-4">
                  <div>
                    <p className="overline text-muted-foreground mb-1 flex items-center gap-1.5">
                      <ShieldAlert className="h-3 w-3 text-destructive" /> Recent cancellations
                    </p>
                    <h2 className="font-display text-2xl font-bold">Meals that didn&apos;t happen</h2>
                  </div>
                </div>
                <div className="space-y-3">
                  {cancellations.slice(0, 5).map((c) => (
                    <div key={c.id} className="rounded-xl border border-border p-4 bg-card" data-testid={`cancellation-${c.id}`}>
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`rounded-full ${c.meal_type === "breakfast" ? "border-secondary text-secondary" : "border-primary text-primary"}`}>
                              {c.meal_type === "breakfast" ? <Sunrise className="h-3 w-3 mr-1" /> : <Moon className="h-3 w-3 mr-1" />}
                              {c.meal_type[0].toUpperCase() + c.meal_type.slice(1)}
                            </Badge>
                            <span className="text-sm font-mono-plex">{fmtDate(c.meal_date)}</span>
                            <span className="text-xs text-muted-foreground">× {c.quantity} · {c.booking_type === "parcel" ? "Parcel" : "Dine-in"}</span>
                          </div>
                          {c.reason && (
                            <div className="mt-2 text-sm text-muted-foreground italic">
                              &ldquo;{c.reason}&rdquo;
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground text-right">
                          <div>Cancelled by <span className="font-medium">{c.actor_role === "admin" ? "admin" : "you"}</span></div>
                          <div className="font-mono-plex">{fmtDateTime(c.cancelled_at)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {cancellations.length > 5 && (
                    <div className="text-xs text-muted-foreground text-center">+{cancellations.length - 5} more this month</div>
                  )}
                </div>
              </section>
            )}

            <section data-testid="history-section">
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="font-display text-2xl font-bold">Booking history</h2>
                <span className="text-sm text-muted-foreground">{summary?.items?.length ?? 0} entries</span>
              </div>
              <Card className="border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="py-4">Date</TableHead>
                      <TableHead>Meal</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Booked on</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(summary?.items || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-10 text-muted-foreground" data-testid="history-empty">
                          No bookings yet this month.
                        </TableCell>
                      </TableRow>
                    ) : (
                      summary.items.slice().reverse().map((b) => (
                        <TableRow key={b.id} data-testid={`history-row-${b.id}`}>
                          <TableCell className="py-4 font-mono-plex">{fmtDate(b.meal_date)}</TableCell>
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
                          <TableCell className="text-right font-mono-plex">{b.quantity}</TableCell>
                          <TableCell className="text-muted-foreground">{fmtDateTime(b.created_at)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
