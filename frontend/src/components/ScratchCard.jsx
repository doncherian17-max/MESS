import { useEffect, useRef, useState } from "react";
import client, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Trophy, Loader2, Sparkles, Frown } from "lucide-react";

const W = 320;
const H = 180;

function paintCover(canvas) {
  const ctx = canvas.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#9ca3af");
  g.addColorStop(0.5, "#e5e7eb");
  g.addColorStop(1, "#6b7280");
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.25})`;
    ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  }
  ctx.fillStyle = "#374151";
  ctx.font = "bold 22px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("SCRATCH HERE", W / 2, H / 2 + 8);
}

export function ScratchResult({ result, reward }) {
  if (!result) {
    return <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />;
  }
  if (result === "won") {
    return (
      <div className="text-center" data-testid="scratch-result-won">
        <Trophy className="h-12 w-12 mx-auto mb-1" style={{ color: "#f59e0b" }} />
        <div className="font-display text-3xl font-extrabold tracking-tight" style={{ color: "#e11d48" }}>WINNER</div>
        {reward && reward !== "WINNER" && <div className="text-sm font-semibold mt-1">{reward}</div>}
      </div>
    );
  }
  return (
    <div className="text-center" data-testid="scratch-result-lost">
      <Frown className="h-10 w-10 mx-auto mb-1 text-muted-foreground" />
      <div className="font-display text-xl font-bold">Better luck next time</div>
    </div>
  );
}

export default function ScratchCard({ card, onRevealed }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const started = useRef(false);
  const [outcome, setOutcome] = useState(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (canvasRef.current) {
      paintCover(canvasRef.current);
    }
  }, []);

  const play = async () => {
    if (started.current) return;
    started.current = true;
    try {
      const { data } = await client.post("/scratch/play", { dinner_date: card.dinner_date });
      setOutcome(data);
    } catch (e) {
      toast.error(formatApiError(e));
      started.current = false;
      setRevealed(false);
      onRevealed?.(null);
      if (canvasRef.current) paintCover(canvasRef.current);
    }
  };

  const reveal = () => setRevealed(true);

  useEffect(() => {
    if (revealed && outcome) onRevealed?.(outcome);
  }, [revealed, outcome]); // eslint-disable-line react-hooks/exhaustive-deps

  const scratchAt = (e) => {
    const c = canvasRef.current;
    const rect = c.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;
    const ctx = c.getContext("2d");
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();
  };

  const clearedRatio = () => {
    const data = canvasRef.current.getContext("2d").getImageData(0, 0, W, H).data;
    let clear = 0;
    for (let i = 3; i < data.length; i += 64) if (data[i] === 0) clear++;
    return clear / (data.length / 64);
  };

  const onDown = (e) => {
    drawing.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    play();
    scratchAt(e);
  };
  const onMove = (e) => { if (drawing.current) scratchAt(e); };
  const onUp = () => {
    drawing.current = false;
    if (clearedRatio() > 0.45) reveal();
  };

  return (
    <div className="space-y-3" data-testid={`scratch-card-${card.dinner_date}`}>
      <div className="relative mx-auto rounded-2xl overflow-hidden border-2 border-dashed border-amber-400 bg-gradient-to-br from-amber-50 to-rose-50"
        style={{ width: "100%", maxWidth: W, aspectRatio: `${W} / ${H}` }}>
        <div className="absolute inset-0 flex items-center justify-center">
          {started.current || outcome ? <ScratchResult result={outcome?.result} reward={outcome?.reward} /> : <Sparkles className="h-8 w-8 text-amber-400" />}
        </div>
        {!revealed && (
          <canvas ref={canvasRef} width={W} height={H}
            className="absolute inset-0 w-full h-full cursor-pointer touch-none"
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
            data-testid={`scratch-canvas-${card.dinner_date}`} />
        )}
      </div>
      {!revealed && (
        <div className="text-center">
          <Button variant="ghost" size="sm" className="rounded-full text-xs"
            onClick={() => { play(); reveal(); }} data-testid={`scratch-reveal-btn-${card.dinner_date}`}>
            Reveal instantly
          </Button>
        </div>
      )}
    </div>
  );
}
