import { useEffect, useState } from "react";
import client from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Confetti } from "@/components/BirthdayModal";
import ScratchCard, { ScratchResult } from "@/components/ScratchCard";
import { toast } from "sonner";
import { Gift, Lock, Trophy } from "lucide-react";

const fmt = (d) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

function WinnerPopup({ win, onClose }) {
  return (
    <Dialog open={!!win} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-0" data-testid="scratch-winner-popup">
        <div className="relative p-8 text-center" style={{ background: "linear-gradient(135deg,#fef3c7 0%,#fde68a 45%,#fecdd3 100%)" }}>
          <Confetti />
          <DialogHeader className="sr-only"><DialogTitle>Winner</DialogTitle></DialogHeader>
          <Trophy className="relative h-20 w-20 mx-auto mb-3" style={{ color: "#d97706" }} />
          <p className="relative overline mb-2" style={{ color: "#e11d48" }}>Scratch &amp; Win · {win && fmt(win.dinner_date)} dinner</p>
          <h2 className="relative font-display text-5xl font-extrabold tracking-tight mb-2" style={{ color: "#7f1d1d" }}
            data-testid="scratch-winner-title">WINNER</h2>
          {win?.reward && win.reward !== "WINNER" && (
            <p className="relative text-base font-semibold" style={{ color: "#7f1d1d" }} data-testid="scratch-winner-reward">{win.reward}</p>
          )}
          <Button onClick={onClose} className="relative mt-6 rounded-full text-white" style={{ backgroundColor: "#e11d48" }}
            data-testid="scratch-winner-close">Awesome!</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CardBody({ card, onRevealed }) {
  if (card.result) {
    return (
      <div className="rounded-2xl border bg-muted/30 flex items-center justify-center py-8" data-testid={`scratch-done-${card.dinner_date}`}>
        <ScratchResult result={card.result} reward={card.reward} />
      </div>
    );
  }
  if (card.can_scratch) return <ScratchCard card={card} onRevealed={onRevealed} />;
  const pct = Math.min(100, Math.round((card.bookings / card.target) * 100));
  return (
    <div className="space-y-3" data-testid={`scratch-locked-${card.dinner_date}`}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Lock className="h-4 w-4" />
        {!card.unlocked
          ? `Unlocks when ${card.target} dinners are booked`
          : "Book this dinner to get your scratch card"}
      </div>
      <Progress value={pct} className="h-2" />
      <div className="text-xs font-mono-plex text-muted-foreground" data-testid={`scratch-progress-${card.dinner_date}`}>
        {card.bookings} / {card.target} booked
      </div>
    </div>
  );
}

export default function ScratchWinSection({ refreshKey }) {
  const [data, setData] = useState(null);
  const [win, setWin] = useState(null);

  const load = async () => {
    try {
      const { data: d } = await client.get("/scratch/status");
      setData(d);
      d.cards.filter((c) => c.can_scratch).forEach((c) => {
        const key = `scratch_unlock_${c.dinner_date}`;
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "1");
        toast(`Scratch & Win unlocked for ${c.day_label.toLowerCase()}'s dinner!`, { icon: "🎁", duration: 6000 });
      });
    } catch { /* silent */ }
  };

  useEffect(() => { load(); }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const onRevealed = (outcome) => {
    if (outcome.result === "won") setWin(outcome);
    setTimeout(load, 1200);
  };

  if (!data?.enabled || !data.cards.length) return null;

  return (
    <section className="mb-10" data-testid="scratch-win-section">
      <div className="flex items-center gap-2 mb-4">
        <Gift className="h-5 w-5 text-primary" />
        <h2 className="font-display text-2xl font-bold">Daily Scratch &amp; Win</h2>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        {data.cards.map((c) => (
          <Card key={c.dinner_date} className="border-border" data-testid={`scratch-panel-${c.dinner_date}`}>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <p className="overline text-muted-foreground">{c.day_label}&apos;s dinner</p>
                  <p className="font-display font-bold text-lg">{fmt(c.dinner_date)}</p>
                </div>
                <Badge variant="outline" className="rounded-full" data-testid={`scratch-winners-left-${c.dinner_date}`}>
                  {c.winners_left} of {c.max_winners} prizes left
                </Badge>
              </div>
              <CardBody card={c} onRevealed={onRevealed} />
              {c.winners.length > 0 && (
                <div className="text-xs text-muted-foreground" data-testid={`scratch-winner-names-${c.dinner_date}`}>
                  <Trophy className="h-3 w-3 inline mr-1 text-amber-500" />
                  Winners: {c.winners.map((w) => w.name).join(", ")}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      <WinnerPopup win={win} onClose={() => setWin(null)} />
    </section>
  );
}
