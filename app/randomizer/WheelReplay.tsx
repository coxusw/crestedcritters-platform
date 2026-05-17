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
  redirectUrl,
}: Props) {
  const initialWheelEntries = useMemo(
    () => entries.map((name, entryIndex) => ({ name, entryIndex })),
    [entries]
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSpinIndex, setCurrentSpinIndex] = useState(-1);
  const [wheelEntries, setWheelEntries] = useState(initialWheelEntries);
  const [rotation, setRotation] = useState(0);
  const [finished, setFinished] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentSpin = currentSpinIndex >= 0 ? spinHistory[currentSpinIndex] : null;
  const visibleEntries = wheelEntries.slice(0, 12);

  useEffect(() => {
    setWheelEntries(initialWheelEntries);
  }, [initialWheelEntries]);

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
    setWheelEntries(initialWheelEntries);
    setRotation(0);
    let activeEntries = [...initialWheelEntries];

    for (let index = 0; index < spinHistory.length; index += 1) {
      const spin = spinHistory[index];
      const activeIndex = Math.max(
        0,
        activeEntries.findIndex((entry) => entry.entryIndex === spin.entryIndex)
      );
      const segment = 360 / Math.max(activeEntries.length, 1);
      const target = 360 * (index + 4) + (360 - activeIndex * segment) + segment / 2;

      setCurrentSpinIndex(index);
      setRotation((previous) => previous + target);

      await new Promise((resolve) => setTimeout(resolve, index === spinHistory.length - 1 ? 1700 : 900));

      if (mode === "last-name-spun" && !spin.isWinner) {
        activeEntries = activeEntries.filter((entry) => entry.entryIndex !== spin.entryIndex);
        setWheelEntries(activeEntries);
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    setFinished(true);
    setIsPlaying(false);

    if (redirectUrl) {
      setTimeout(() => {
        window.location.href = redirectUrl;
      }, 1200);
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
      <div className="grid gap-6 lg:grid-cols-[minmax(260px,420px)_1fr] lg:items-center">
        <div className="relative mx-auto aspect-square w-full max-w-[420px]">
          <div className="absolute -right-2 top-1/2 z-10 h-0 w-0 -translate-y-1/2 border-y-[16px] border-r-[28px] border-y-transparent border-r-white drop-shadow-lg" />
          <canvas
            ref={canvasRef}
            className="h-full w-full rounded-full shadow-2xl shadow-black/40 transition-transform duration-1000 ease-out"
            style={{
              transform: `rotate(${rotation}deg)`,
            }}
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full">
            <div className="flex h-[38%] w-[38%] items-center justify-center rounded-full border border-white/20 bg-[#07130c] p-4 text-center shadow-xl">
              <span className="text-sm font-black text-emerald-100">
                {currentSpin?.name || "Ready"}
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
                : currentSpin?.name || "Replay the official saved spin"}
            </h2>
            {currentSpin?.prize && (
              <p className="mt-2 font-bold text-yellow-100">{currentSpin.prize}</p>
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
