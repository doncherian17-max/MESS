import { useEffect, useMemo, useState } from "react";
import client from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X, PartyPopper } from "lucide-react";

const RED = "#e11d48";
const DEFAULT_AVATAR = (name) =>
  `data:image/svg+xml;utf8,` +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'>` +
    `<rect width='160' height='160' fill='${RED}'/>` +
    `<text x='50%' y='55%' font-size='72' text-anchor='middle' fill='white' font-family='Arial' font-weight='bold'>${(name || "?").trim().charAt(0).toUpperCase()}</text>` +
    `</svg>`
  );

function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 60 }).map((_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 2.5,
    color: ["#e11d48", "#f59e0b", "#10b981", "#3b82f6", "#a855f7"][i % 5],
    rotate: Math.random() * 360,
    duration: 3 + Math.random() * 2,
  })), []);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" data-testid="birthday-confetti">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute block w-2 h-3 rounded-sm"
          style={{
            left: `${p.left}%`,
            top: "-10px",
            backgroundColor: p.color,
            animation: `confetti-fall ${p.duration}s linear ${p.delay}s infinite`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(120vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default function BirthdayModal({ user }) {
  const [birthdays, setBirthdays] = useState([]);
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const key = `bday_seen_${new Date().toISOString().slice(0, 10)}_${user?.id || ""}`;
        if (sessionStorage.getItem(key)) return;
        const { data } = await client.get("/birthdays/today");
        if (cancelled) return;
        if (data?.birthdays?.length) {
          setBirthdays(data.birthdays);
          setOpen(true);
          sessionStorage.setItem(key, "1");
        }
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  if (!birthdays.length) return null;
  const b = birthdays[idx];
  const total = birthdays.length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="max-w-md p-0 overflow-hidden border-0 bg-transparent shadow-none"
        data-testid="birthday-modal"
      >
        <div className="relative rounded-3xl overflow-hidden" style={{
          background: "linear-gradient(135deg, #fff7ed 0%, #fee2e2 50%, #ede9fe 100%)",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
        }}>
          <Confetti />

          <button
            onClick={() => setOpen(false)}
            className="absolute top-3 right-3 z-20 h-8 w-8 rounded-full flex items-center justify-center bg-white/80 hover:bg-white transition"
            data-testid="birthday-close"
          >
            <X className="h-4 w-4" style={{ color: RED }} />
          </button>

          <DialogHeader className="sr-only">
            <DialogTitle>Birthday celebration for {b.name}</DialogTitle>
          </DialogHeader>

          <div className="relative z-10 p-8 text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <PartyPopper className="h-5 w-5" style={{ color: RED }} />
              <p className="overline font-bold" style={{ color: RED }}>
                Today&apos;s Birthday {total > 1 ? `${idx + 1}/${total}` : ""}
              </p>
              <PartyPopper className="h-5 w-5" style={{ color: RED }} />
            </div>

            <div
              className="mx-auto w-32 h-32 rounded-full overflow-hidden ring-4 mb-4"
              style={{ ringColor: RED, borderColor: RED, border: `4px solid ${RED}` }}
              data-testid="birthday-photo-wrap"
            >
              <img
                src={b.photo || DEFAULT_AVATAR(b.name)}
                alt={b.name}
                data-testid="birthday-photo"
                className="w-full h-full object-cover"
                onError={(e) => { e.target.src = DEFAULT_AVATAR(b.name); }}
              />
            </div>

            <h2
              className="font-display text-3xl font-extrabold tracking-tight mb-3"
              style={{ color: "#7f1d1d" }}
              data-testid="birthday-name"
            >
              🎂 {b.name}
            </h2>

            <p className="text-sm leading-relaxed mb-3" style={{ color: "#7f1d1d" }}
              data-testid="birthday-message">
              {b.message}
            </p>

            {b.comment && (
              <div
                className="mt-4 rounded-xl px-4 py-3 bg-white/70 border text-sm italic"
                style={{ borderColor: RED, color: "#7f1d1d" }}
                data-testid="birthday-comment"
              >
                💬 {b.comment}
              </div>
            )}

            {total > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <Button
                  variant="outline" size="sm" onClick={() => setIdx((i) => Math.max(0, i - 1))}
                  disabled={idx === 0} data-testid="birthday-prev" className="rounded-full">
                  ← Previous
                </Button>
                <Button
                  size="sm"
                  onClick={() => idx === total - 1 ? setOpen(false) : setIdx((i) => i + 1)}
                  data-testid="birthday-next"
                  className="rounded-full text-white" style={{ backgroundColor: RED }}>
                  {idx === total - 1 ? "Close" : "Next 🎉"}
                </Button>
              </div>
            )}

            {total === 1 && (
              <Button
                onClick={() => setOpen(false)}
                data-testid="birthday-close-single"
                className="mt-6 rounded-full text-white gap-2" style={{ backgroundColor: RED }}>
                Send love 💌
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
