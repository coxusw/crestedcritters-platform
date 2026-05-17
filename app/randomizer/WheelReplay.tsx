"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type WheelSpin = {
  spinNumber: number;
  name: string;
  entryIndex: number;
  prize?: string | null;
  isWinner: boolean;
};

export type WheelWinner = {
  name: string;
  entryIndex: number;
  spinNumber: number;
  prize?: string | null;
};

type Props = {
  mode?: string;
  entries: string[];
  spinHistory: WheelSpin[];
  winners: WheelWinner[];
  autoPlay?: boolean;
  manualAdvance?: boolean;
  redirectUrl?: string;
};

const colors = [
  "#34d399",
  "#facc15",
  "#60a5fa",
  "#fb7185",
  "#a78bfa",
  "#f97316",
  "#2dd4bf",
  "#e879f9",
];

const confettiColors = ["#34d399", "#facc15", "#60a5fa", "#fb7185", "#a78bfa", "#f97316"];

type WheelEntry = {
  name: string;
  entryIndex: number;
};

export default function WheelReplay({
  mode = "spin-count",
  entries,
  spinHistory,
  winners,
  autoPlay = false,
  manualAdvance = false,
  redirectUrl,
}: Props) {
  const initialWheelEntries = useMemo(
    () => entries.map((name, entryIndex) => ({ name, entryIndex })),
    [entries]
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSpinIndex, setCurrentSpinIndex] = useState(-1);
  const [landedSpinIndex, setLandedSpinIndex] = useState(-1);
  const [awaitingAdvance, setAwaitingAdvance] = useState<"spin" | "result" | null>(null);
  const [wheelEntries, setWheelEntries] = useState(initialWheelEntries);
  const [rotation, setRotation] = useState(0);
  const [finished, setFinished] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const advanceResolverRef = useRef<(() => void) | null>(null);
  const currentSpin = currentSpinIndex >= 0 ? spinHistory[currentSpinIndex] : null;
  const landedSpin = landedSpinIndex >= 0 ? spinHistory[landedSpinIndex] : null;
  const showConfetti = Boolean(landedSpin?.isWinner);
  const visibleEntries = wheelEntries.slice(0, 12);

  useEffect(() => {
    setWheelEntries(initialWheelEntries);
  }, [initialWheelEntries]);

  function waitForAdvance(kind: "spin" | "result") {
    setAwaitingAdvance(kind);

    return new Promise<void>((resolve) => {
      advanceResolverRef.current = resolve;
    });
  }

  function continueReplay() {
    const resolver = advanceResolverRef.current;
    advanceResolverRef.current = null;
    setAwaitingAdvance(null);
    resolver?.();
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const size = 900;
    const center = size / 2;
    const radius = center - 18;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = size;
    canvas.height = size;
    ctx.clearRect(0, 0, size, size);

    if (!wheelEntries.length) {
      ctx.fillStyle = "#102016";
      ctx.beginPath();
      ctx.arc(center, center, radius, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    const segment = (Math.PI * 2) / wheelEntries.length;
    const fontSize = Math.max(2, Math.min(18, Math.floor((radius * segment) / 1.9)));
    const textRadius = radius * 0.62;

    wheelEntries.forEach((entry, index) => {
      const start = index * segment - Math.PI / 2;
      const end = start + segment;

      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, start, end);
      ctx.closePath();
      ctx.fillStyle = colors[index % colors.length];
      ctx.fill();
      ctx.strokeStyle = "rgba(7, 19, 12, 0.32)";
      ctx.lineWidth = Math.max(0.5, Math.min(3, 28 / wheelEntries.length));
      ctx.stroke();

      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(start + segment / 2);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#07130c";
      ctx.font = `900 ${fontSize}px Arial, Helvetica, sans-serif`;

      const maxWidth = radius * 0.52;
      let label = entry.name;

      while (label.length > 3 && ctx.measureText(label).width > maxWidth) {
        label = `${label.slice(0, -4)}...`;
      }

      ctx.fillText(label, textRadius, 0);
      ctx.restore();
    });

    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = 12;
    ctx.stroke();
  }, [wheelEntries]);

  async function play() {
    if (!spinHistory.length || isPlaying) return;

    setIsPlaying(true);
    setFinished(false);
    setCurrentSpinIndex(-1);
    setLandedSpinIndex(-1);
    setAwaitingAdvance(null);
    setWheelEntries(initialWheelEntries);
    setRotation(0);
    let activeEntries = [...initialWheelEntries];
    let rotationPosition = 0;

    for (let index = 0; index < spinHistory.length; index += 1) {
      const spin = spinHistory[index];
      const activeIndex = Math.max(
        0,
        activeEntries.findIndex((entry) => entry.entryIndex === spin.entryIndex)
      );
      const segment = 360 / Math.max(activeEntries.length, 1);
      const selectedCenter = -90 + activeIndex * segment + segment / 2;
      const pointerAngle = 0;
      const currentNormalizedRotation = ((rotationPosition % 360) + 360) % 360;
      const desiredRotation = pointerAngle - selectedCenter;
      const deltaToTarget =
        ((desiredRotation - currentNormalizedRotation + 540) % 360) - 180;
      const extraTurns = 360 * 5;
      const target = extraTurns + deltaToTarget;
      rotationPosition += target;

      await new Promise((resolve) => requestAnimationFrame(resolve));
      setCurrentSpinIndex(index);
      setLandedSpinIndex(-1);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      setRotation((previous) => previous + target);

      await new Promise((resolve) => setTimeout(resolve, 3900));
      setLandedSpinIndex(index);

      if (mode === "last-name-spun" && !spin.isWinner) {
        if (manualAdvance && index < spinHistory.length - 1) {
          await waitForAdvance("spin");
        } else {
          await new Promise((resolve) => setTimeout(resolve, 2250));
        }

        activeEntries = activeEntries.filter((entry) => entry.entryIndex !== spin.entryIndex);
        setWheelEntries(activeEntries);
        await new Promise((resolve) => setTimeout(resolve, 1350));
      } else if (index < spinHistory.length - 1) {
        if (manualAdvance) {
          await waitForAdvance("spin");
        } else {
          await new Promise((resolve) => setTimeout(resolve, 2250));
        }
      }
    }

    setFinished(true);
    setIsPlaying(false);

    if (redirectUrl) {
      if (manualAdvance) {
        await waitForAdvance("result");
        window.location.href = redirectUrl;
      } else {
        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 1800);
      }
    }
  }

  useEffect(() => {
    if (autoPlay) {
      void play();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay]);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/20">
      <style jsx>{`
        @keyframes randomizer-confetti-fall {
          0% {
            transform: translate3d(0, -20vh, 0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translate3d(var(--x-drift), 110vh, 0) rotate(720deg);
            opacity: 0;
          }
        }

        @keyframes randomizer-pop {
          0% {
            transform: translate(-50%, -50%) scale(0.9);
            opacity: 0;
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
        }
      `}</style>

      {landedSpin && (
        <div className={`${awaitingAdvance ? "pointer-events-auto" : "pointer-events-none"} fixed inset-0 z-50 overflow-hidden`}>
          {showConfetti &&
            Array.from({ length: 90 }, (_, index) => {
              const left = (index * 37) % 100;
              const delay = (index % 18) * 0.08;
              const duration = 2.4 + (index % 7) * 0.18;
              const drift = `${((index % 11) - 5) * 18}px`;

              return (
                <span
                  key={index}
                  className="absolute top-0 h-3 w-2 rounded-sm"
                  style={{
                    left: `${left}%`,
                    backgroundColor: confettiColors[index % confettiColors.length],
                    animation: `randomizer-confetti-fall ${duration}s linear ${delay}s forwards`,
                    "--x-drift": drift,
                  } as React.CSSProperties}
                />
              );
            })}

          <div
            className={`absolute left-1/2 top-1/2 w-[min(92vw,560px)] rounded-3xl border p-6 text-center shadow-2xl shadow-black/50 ${
              showConfetti
                ? "border-yellow-300/50 bg-yellow-300 text-slate-950"
                : "border-emerald-300/40 bg-[#102016] text-white"
            }`}
            style={{ animation: "randomizer-pop 180ms ease-out forwards" }}
          >
            <p className="text-sm font-black uppercase tracking-[0.25em]">
              {showConfetti ? "Winner" : `Spin ${landedSpin.spinNumber}`}
            </p>
            <h2 className="mt-2 text-4xl font-black">{landedSpin.name}</h2>
            {showConfetti && (
              <p className="mt-2 text-lg font-black">
                Official winning spin
              </p>
            )}
            {awaitingAdvance && (
              <button
                type="button"
                onClick={continueReplay}
                className={`mt-5 rounded-xl px-6 py-3 font-black shadow-lg transition ${
                  showConfetti
                    ? "bg-slate-950 text-yellow-100 hover:bg-slate-800"
                    : "bg-emerald-300 text-slate-950 hover:bg-emerald-200"
                }`}
              >
                {awaitingAdvance === "result" ? "View Result" : "Spin"}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(260px,420px)_1fr] lg:items-center">
        <div className="relative mx-auto aspect-square w-full max-w-[420px]">
          <div className="absolute -right-2 top-1/2 z-10 h-0 w-0 -translate-y-1/2 border-y-[16px] border-r-[28px] border-y-transparent border-r-white drop-shadow-lg" />
          <canvas
            ref={canvasRef}
            className="h-full w-full rounded-full shadow-2xl shadow-black/40 transition-transform duration-[3900ms] ease-out will-change-transform"
            style={{
              transform: `rotate(${rotation}deg)`,
            }}
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full">
            <div className="flex h-[38%] w-[38%] items-center justify-center rounded-full border border-white/20 bg-[#07130c] p-4 text-center shadow-xl">
              <span className="text-sm font-black text-emerald-100">
                {landedSpin?.name || (currentSpin ? "Spinning..." : "Ready")}
              </span>
            </div>
          </div>
        </div>

        <div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-300">
              {finished ? "Final Result" : currentSpin ? `Spin ${currentSpin.spinNumber}` : "Wheel Replay"}
            </p>
            <h2 className="mt-2 text-3xl font-black">
              {finished
                ? winners.map((winner) => winner.name).join(", ")
                : landedSpin?.name || (currentSpin ? "Spinning..." : "Replay the official saved spin")}
            </h2>
            {landedSpin?.prize && (
              <p className="mt-2 font-bold text-yellow-100">{landedSpin.prize}</p>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={play}
              disabled={isPlaying}
              className="rounded-xl bg-emerald-300 px-5 py-3 font-black text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPlaying ? "Spinning..." : finished ? "Replay Wheel" : "Play Wheel"}
            </button>
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="text-sm font-black text-emerald-100">Entries on wheel</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-950">
              {visibleEntries.map((entry, index) => (
                <span
                  key={`${entry.entryIndex}-${index}`}
                  className="rounded-full px-3 py-1"
                  style={{ backgroundColor: colors[index % colors.length] }}
                >
                  {entry.name}
                </span>
              ))}
              {wheelEntries.length > visibleEntries.length && (
                <span className="rounded-full bg-white/15 px-3 py-1 text-white">
                  +{wheelEntries.length - visibleEntries.length} more
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
