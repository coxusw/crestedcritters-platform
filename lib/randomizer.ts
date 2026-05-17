import { randomInt } from "crypto";

export type RandomizerMode = "spin-count" | "last-name-spun" | "multi-prize";

export type RandomizerWinner = {
  name: string;
  entryIndex: number;
  spinNumber: number;
  prize?: string | null;
};

export type RandomizerSpin = {
  spinNumber: number;
  name: string;
  entryIndex: number;
  prize?: string | null;
  isWinner: boolean;
};

export type RandomizerResult = {
  spinHistory: RandomizerSpin[];
  winners: RandomizerWinner[];
};

export function cleanName(value: unknown) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseStringList(value: unknown) {
  if (Array.isArray(value)) return value.map(cleanName).filter(Boolean);

  return String(value || "")
    .split(/\n+/)
    .map(cleanName)
    .filter(Boolean);
}

export function normalizeMode(value: unknown): RandomizerMode {
  if (value === "last-name-spun" || value === "multi-prize") return value;
  return "spin-count";
}

export function boundedInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return fallback;

  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

export function makePublicCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let i = 0; i < 10; i += 1) {
    code += alphabet[randomInt(alphabet.length)];
  }

  return code;
}

function pickEntry(pool: { name: string; entryIndex: number }[]) {
  return pool[randomInt(pool.length)];
}

export function generateRandomizerResult(input: {
  mode: RandomizerMode;
  entries: string[];
  spinCount: number;
  prizeInterval: number;
  winnerCount: number;
  prizeList: string[];
  preventDuplicateWinners: boolean;
}): RandomizerResult {
  const entryPool = input.entries.map((name, entryIndex) => ({ name, entryIndex }));
  const spinHistory: RandomizerSpin[] = [];
  const winners: RandomizerWinner[] = [];

  if (input.mode === "last-name-spun") {
    const remaining = [...entryPool];
    let spinNumber = 0;

    while (remaining.length > 1) {
      spinNumber += 1;
      const picked = pickEntry(remaining);
      const pickedIndex = remaining.findIndex((entry) => entry.entryIndex === picked.entryIndex);

      spinHistory.push({
        spinNumber,
        name: picked.name,
        entryIndex: picked.entryIndex,
        isWinner: false,
      });

      remaining.splice(pickedIndex, 1);
    }

    const winner = remaining[0];
    spinNumber = spinHistory.length + 1;

    winners.push({
      name: winner.name,
      entryIndex: winner.entryIndex,
      spinNumber,
      prize: null,
    });

    spinHistory.push({
      spinNumber,
      name: winner.name,
      entryIndex: winner.entryIndex,
      isWinner: true,
    });

    return { spinHistory, winners };
  }

  if (input.mode === "multi-prize") {
    const prizes = input.prizeList.length
      ? input.prizeList
      : Array.from({ length: input.winnerCount }, (_, index) => `Winner ${index + 1}`);
    let remaining = [...entryPool];

    prizes.forEach((prize, index) => {
      const picked = pickEntry(remaining);
      const spinNumber = index + 1;

      winners.push({
        name: picked.name,
        entryIndex: picked.entryIndex,
        spinNumber,
        prize,
      });

      spinHistory.push({
        spinNumber,
        name: picked.name,
        entryIndex: picked.entryIndex,
        prize,
        isWinner: true,
      });

      remaining = input.preventDuplicateWinners
        ? remaining.filter((entry) => entry.name.toLowerCase() !== picked.name.toLowerCase())
        : remaining.filter((entry) => entry.entryIndex !== picked.entryIndex);

      if (!remaining.length && index < prizes.length - 1) {
        throw new Error("Not enough unique entries for the requested prizes.");
      }
    });

    return { spinHistory, winners };
  }

  for (let spinNumber = 1; spinNumber <= input.spinCount; spinNumber += 1) {
    const picked = pickEntry(entryPool);
    const isIntervalWinner = input.prizeInterval > 0 && spinNumber % input.prizeInterval === 0;
    const isFinalWinner = spinNumber === input.spinCount;
    const isWinner = isIntervalWinner || isFinalWinner;
    const prize = isFinalWinner ? "Final Winner" : isIntervalWinner ? `Prize spin ${spinNumber}` : null;

    spinHistory.push({
      spinNumber,
      name: picked.name,
      entryIndex: picked.entryIndex,
      prize,
      isWinner,
    });

    if (isWinner) {
      winners.push({
        name: picked.name,
        entryIndex: picked.entryIndex,
        spinNumber,
        prize,
      });
    }
  }

  return { spinHistory, winners };
}
