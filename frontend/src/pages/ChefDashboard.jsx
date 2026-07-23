import { useEffect, useMemo, useState } from "react";
import client, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import TopBar from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Sunrise, Moon, Loader2, Search, ChefHat, UtensilsCrossed, ShoppingBag,
  CheckCircle2, Circle, RefreshCw, Package, Users, ClipboardList, Radio,
} from "lucide-react";

function todayISO() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function StatTile({ icon: Icon, label, value, testId, accent }) {
  return (
    <div className={`rounded-xl border border-border p-4 ${accent ? "bg-accent" : ""}`}>
      <div className="overline text-muted-foreground mb-2 flex items-center gap-1.5">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className={`font-display font-extrabold text-3xl tracking-tight ${accent ? "text-primary" : ""}`} data-testid={testId}>
        {value}
      </div>
    </div>
  );
}

export default function ChefDashboard() {
  const { user } = useAuth();
  const [date, setDate] = useState(todayISO());
  const [mealFilter, setMealFilter] = useState("all"); // all|breakfast|dinner
  const [search, setSearch] = useState("");
  const [summary, setSummary] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [knownBookingIds, setKnownBookingIds] = useState(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [s, b] = await Promise.all([
        client.get(`/chef/summary?date=${date}`),
        client.get(`/chef/bookings?date=${date}${mealFilter !== "all" ? `&meal_type=${mealFilter}` : ""}${search ? `&q=${encodeURIComponent(search)}` : ""}`),
      ]);
      setSummary(s.data);
      // Detect newly-arrived bookings during silent auto-refresh
      if (silent && knownBookingIds && date === todayISO()) {
        const fresh = b.data.filter((x) => !knownBookingIds.has(x.id));
        fresh.forEach((n) => {
          const mealLabel = n.meal_type === "breakfast" ? "Breakfast" : "Dinner";
          const typeLabel = n.booking_type === "parcel" ? "Parcel" : "Dine-in";
          toast.success(
            `New ${mealLabel} order · ${typeLabel} × ${n.quantity}`,
            { description: `${n.employee_name || "Someone"} (#${n.employee_number})`, duration: 6000 }
          );
        });
      }
      setKnownBookingIds(new Set(b.data.map((x) => x.id)));
      setBookings(b.data);
      setLastRefreshed(new Date());
    } catch (e) { if (!silent) toast.error(formatApiError(e)); }
    finally { if (!silent) setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [date, mealFilter]);

  // Auto-refresh every 30 seconds when viewing today and the toggle is on
  useEffect(() => {
    if (!autoRefresh) return;
    if (date !== todayISO()) return;
    const id = setInterval(() => { load(true); }, 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line
  }, [autoRefresh, date, mealFilter, search, knownBookingIds]);

  const onSearch = (e) => {
    e.preventDefault();
    load();
  };

  const toggleServe = async (b) => {
    setBusyId(b.id);
    try {
      if (b.served) {
        await client.post(`/chef/unserve/${b.id}`);
        toast.success("Marked pending");
      } else {
        await client.post(`/chef/serve/${b.id}`);
        toast.success("Marked served");
      }
      await load();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setBusyId(null); }
  };

  const filtered = useMemo(() => bookings, [bookings]);
  const totalPending = (summary?.breakfast?.pending || 0) + (summary?.dinner?.pending || 0);

  return (
    <div className="min-h-screen bg-background warm-grain">
      <TopBar />
      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-10 lg:py-14" data-testid="chef-dashboard">
        <div className="mb-10 flex items-end justify-between flex-wrap gap-6">
          <div>
            <p className="overline text-muted-foreground mb-3 flex items-center gap-1.5">
              <ChefHat className="h-3 w-3" /> Chef&apos;s kitchen
            </p>
            <h1 className="font-display text-4xl lg:text-5xl font-extrabold tracking-tight">Today&apos;s service</h1>
            <p className="text-muted-foreground mt-3 leading-relaxed max-w-xl">
              Track orders live, search employees, and mark meals as served as they arrive.
            </p>
          </div>
          <div className="flex items-end gap-3 flex-wrap">
            <div className="space-y-2">
              <Label className="overline">Service date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 w-[180px]" data-testid="chef-date-input" />
            </div>
            <div className="flex items-center gap-3 rounded-full border border-border h-11 px-4" data-testid="chef-auto-refresh-wrap">
              <Radio className={`h-3.5 w-3.5 ${autoRefresh && date === todayISO() ? "text-secondary animate-pulse" : "text-muted-foreground"}`} />
              <Label htmlFor="auto-refresh-switch" className="text-sm cursor-pointer m-0">Live · 30s</Label>
              <Switch
                id="auto-refresh-switch"
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
                data-testid="chef-auto-refresh-toggle"
              />
            </div>
            <Button variant="outline" onClick={() => load()} className="h-11 rounded-full gap-2" data-testid="chef-refresh-button">
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          </div>
        </div>
        {lastRefreshed && (
          <div className="text-xs text-muted-foreground mb-6 font-mono-plex" data-testid="chef-last-refreshed">
            Last updated {lastRefreshed.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" })}
          </div>
        )}

        {/* Summary grid */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10" data-testid="chef-summary">
            {/* Breakfast */}
            <Card className="border-border card-lift meal-breakfast">
              <div className="h-1.5" style={{ backgroundColor: "hsl(var(--meal-color))" }} />
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Sunrise className="h-5 w-5" style={{ color: "hsl(var(--meal-color))" }} />
                    <h3 className="font-display font-bold text-xl">Breakfast</h3>
                  </div>
                  <Badge variant="outline" className="rounded-full font-mono-plex" data-testid="breakfast-orders-count">
                    {summary.breakfast.orders} orders
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <StatTile icon={UtensilsCrossed} label="Dine-in" value={summary.breakfast.dine_in} testId="breakfast-dine-in" />
                  <StatTile icon={ShoppingBag} label="Parcel" value={summary.breakfast.parcel} testId="breakfast-parcel" />
                  <StatTile icon={CheckCircle2} label="Served" value={summary.breakfast.served} testId="breakfast-served" />
                  <StatTile icon={Circle} label="Pending" value={summary.breakfast.pending} testId="breakfast-pending" accent />
                </div>
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-baseline gap-2">
                    <span className="overline text-muted-foreground">Total meals</span>
                    <span className="font-display font-extrabold text-3xl ml-auto" data-testid="breakfast-total">{summary.breakfast.total}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            {/* Dinner */}
            <Card className="border-border card-lift meal-dinner">
              <div className="h-1.5" style={{ backgroundColor: "hsl(var(--meal-color))" }} />
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Moon className="h-5 w-5" style={{ color: "hsl(var(--meal-color))" }} />
                    <h3 className="font-display font-bold text-xl">Dinner</h3>
                  </div>
                  <Badge variant="outline" className="rounded-full font-mono-plex" data-testid="dinner-orders-count">
                    {summary.dinner.orders} orders
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <StatTile icon={UtensilsCrossed} label="Dine-in" value={summary.dinner.dine_in} testId="dinner-dine-in" />
                  <StatTile icon={ShoppingBag} label="Parcel" value={summary.dinner.parcel} testId="dinner-parcel" />
                  <StatTile icon={CheckCircle2} label="Served" value={summary.dinner.served} testId="dinner-served" />
                  <StatTile icon={Circle} label="Pending" value={summary.dinner.pending} testId="dinner-pending" accent />
                </div>
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-baseline gap-2">
                    <span className="overline text-muted-foreground">Total meals</span>
                    <span className="font-display font-extrabold text-3xl ml-auto" data-testid="dinner-total">{summary.dinner.total}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Bookings table */}
        <Card className="border-border">
          <CardContent className="p-6 lg:p-8">
            <div className="flex flex-wrap items-end gap-3 mb-6">
              <div>
                <h3 className="font-display text-2xl font-bold flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" /> Live orders
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {totalPending} pending · {filtered.length} shown
                </p>
              </div>
              <div className="ml-auto flex items-end gap-3 flex-wrap">
                <div className="space-y-2">
                  <Label className="overline">Meal</Label>
                  <Select value={mealFilter} onValueChange={setMealFilter}>
                    <SelectTrigger className="h-11 w-[140px]" data-testid="chef-meal-filter"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All meals</SelectItem>
                      <SelectItem value="breakfast">Breakfast</SelectItem>
                      <SelectItem value="dinner">Dinner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <form onSubmit={onSearch} className="space-y-2">
                  <Label className="overline">Search employee</Label>
                  <div className="flex gap-2">
                    <Input value={search} onChange={(e) => setSearch(e.target.value)}
                      placeholder="name or emp #" className="h-11 w-[220px]" data-testid="chef-search-input" />
                    <Button type="submit" variant="outline" className="h-11 rounded-full" data-testid="chef-search-button">
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                </form>
              </div>
            </div>

            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="py-4">Employee</TableHead>
                    <TableHead>Meal</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground" data-testid="chef-loading"><Loader2 className="inline h-4 w-4 animate-spin mr-2" />Loading…</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground" data-testid="chef-empty">No orders for these filters.</TableCell></TableRow>
                  ) : filtered.map((b) => (
                    <TableRow key={b.id} data-testid={`chef-row-${b.id}`}>
                      <TableCell className="py-4">
                        <div className="font-medium">{b.employee_name || "—"}</div>
                        <div className="text-xs text-muted-foreground font-mono-plex">#{b.employee_number}</div>
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
                          <Badge className="bg-secondary text-secondary-foreground rounded-full">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Served
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="rounded-full">
                            <Circle className="h-3 w-3 mr-1" /> Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant={b.served ? "outline" : "default"}
                          onClick={() => toggleServe(b)} disabled={busyId === b.id}
                          data-testid={`chef-serve-toggle-${b.id}`}
                          className="rounded-full h-9">
                          {busyId === b.id ? <Loader2 className="h-4 w-4 animate-spin" /> : (b.served ? "Undo" : "Mark served")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
