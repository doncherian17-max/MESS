import { useEffect, useMemo, useState } from "react";
import client from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X, Sparkles } from "lucide-react";

const RED = "#e11d48";

// Themed gradients for a few well-known days (fallback = warm sunrise)
const THEMES = {
  "Independence Day":       "linear-gradient(135deg,#fff7ed 0%,#fed7aa 40%,#bbf7d0 100%)",
  "Republic Day":           "linear-gradient(135deg,#fff7ed 0%,#fed7aa 40%,#bbf7d0 100%)",
  "Gandhi Jayanti":         "linear-gradient(135deg,#fefce8 0%,#fef3c7 60%,#fff 100%)",
  "New Year":               "linear-gradient(135deg,#fef9c3 0%,#fde68a 50%,#fecaca 100%)",
  "Christmas":              "linear-gradient(135deg,#dcfce7 0%,#fecaca 60%,#fff 100%)",
  "Makar Sankranti / Pongal":"linear-gradient(135deg,#fef3c7 0%,#fed7aa 60%,#fee2e2 100%)",
  "Labour Day":             "linear-gradient(135deg,#fff7ed 0%,#fee2e2 60%,#e0e7ff 100%)",
};

function FestiveDots({ emoji }) {
  const pieces = useMemo(() => Array.from({ length: 24 }).map((_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 3,
    duration: 3 + Math.random() * 3,
    size: 14 + Math.random() * 14,
    rotate: Math.random() * 360,
  })), []);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" data-testid="greeting-festive-dots">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute select-none"
          style={{
            left: `${p.left}%`,
            top: "-40px",
            fontSize: `${p.size}px`,
            animation: `greeting-float ${p.duration}s linear ${p.delay}s infinite`,
            transform: `rotate(${p.rotate}deg)`,
            opacity: 0.85,
          }}
        >{emoji}</span>
      ))}
      <style>{`
        @keyframes greeting-float {
          0%   { transform: translateY(0) rotate(0deg);   opacity: 0; }
          15%  { opacity: 1; }
          100% { transform: translateY(120vh) rotate(540deg); opacity: 0; }
        }
        @keyframes greeting-pop {
          0%   { transform: scale(0.6); opacity: 0; }
          60%  { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default function GreetingModal() {
  const [greeting, setGreeting] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const key = `greeting_seen_${today}`;
        if (sessionStorage.getItem(key)) return;
        const { data } = await client.get("/greetings/today");
        if (cancelled) return;
        if (data?.greeting) {
          setGreeting(data.greeting);
          setOpen(true);
          sessionStorage.setItem(key, "1");
        }
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!greeting) return null;

  const bg = THEMES[greeting.name] || "linear-gradient(135deg,#fff7ed 0%,#fee2e2 50%,#ede9fe 100%)";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="max-w-md p-0 overflow-hidden border-0 bg-transparent shadow-none"
        data-testid="greeting-modal"
      >
        <div className="relative rounded-3xl overflow-hidden" style={{
          background: bg,
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
        }}>
          <FestiveDots emoji={greeting.emoji || "🎉"} />

          <button
            onClick={() => setOpen(false)}
            className="absolute top-3 right-3 z-20 h-8 w-8 rounded-full flex items-center justify-center bg-white/80 hover:bg-white transition"
            data-testid="greeting-close"
            aria-label="Close"
          >
            <X className="h-4 w-4" style={{ color: RED }} />
          </button>

          <DialogHeader className="sr-only">
            <DialogTitle>{greeting.name}</DialogTitle>
          </DialogHeader>

          <div className="relative z-10 p-8 text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Sparkles className="h-4 w-4" style={{ color: RED }} />
              <p className="text-xs font-bold tracking-widest uppercase" style={{ color: RED }}>
                Special day
              </p>
              <Sparkles className="h-4 w-4" style={{ color: RED }} />
            </div>

            <div
              className="mx-auto mb-4"
              style={{ fontSize: "88px", lineHeight: 1, animation: "greeting-pop 0.8s ease-out" }}
              data-testid="greeting-modal-emoji"
            >
              {greeting.emoji}
            </div>

            <h2
              className="font-display text-3xl font-extrabold tracking-tight mb-3"
              style={{ color: "#7f1d1d" }}
              data-testid="greeting-modal-name"
            >
              {greeting.name}
            </h2>

            <p className="text-sm leading-relaxed" style={{ color: "#7f1d1d" }}
              data-testid="greeting-modal-message">
              {greeting.message}
            </p>

            <Button
              onClick={() => setOpen(false)}
              data-testid="greeting-modal-close-btn"
              className="mt-6 rounded-full text-white gap-2" style={{ backgroundColor: RED }}>
              Thank you! ✨
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
