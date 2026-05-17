"use client";

import { useEffect, useMemo, useState } from "react";
import WheelReplay, { type WheelSpin, type WheelWinner } from "./WheelReplay";

type Status = {
  tone: "idle" | "good" | "bad";
  message: string;
};

type Template = {
  id: string;
  name: string;
  title: string;
  description: string;
  rules: string;
  logo_data_url: string | null;
};

function cleanName(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function parseNames(value: string) {
  return value
    .split(/\n+/)
    .map(cleanName)
    .filter(Boolean);
}

async function compressLogo(file: File | null) {
  if (!file) return "";

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read logo file."));
    reader.readAsDataURL(file);
  });

  return new Promise<string>((resolve) => {
    const img = new Image();

    img.onload = () => {
      const maxSize = 420;
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));

      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);

      const compressed = canvas.toDataURL("image/jpeg", 0.82);
      resolve(compressed.length <= 45000 ? compressed : "");
    };

    img.onerror = () => resolve("");
    img.src = dataUrl;
  });
}

export default function RandomizerClient() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const [names, setNames] = useState("");
  const [mode, setMode] = useState("spin-count");
  const [spinCount, setSpinCount] = useState(1);
  const [winnerCount, setWinnerCount] = useState(1);
  const [prizeList, setPrizeList] = useState("");
  const [preventDuplicateWinners, setPreventDuplicateWinners] = useState(true);
  const [dice, setDice] = useState<[number, number] | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replay, setReplay] = useState<{
    entries: string[];
    spinHistory: WheelSpin[];
    winners: WheelWinner[];
    redirectUrl: string;
  } | null>(null);
  const [status, setStatus] = useState<Status>({
    tone: "idle",
    message: "Waiting for randomizer details.",
  });

  const entries = useMemo(() => parseNames(names), [names]);
  const prizes = useMemo(() => parseNames(prizeList), [prizeList]);

  useEffect(() => {
    async function loadTemplates() {
      const response = await fetch("/api/randomizer/templates");

      if (!response.ok) return;

      const payload = (await response.json()) as { templates?: Template[] };
      setTemplates(payload.templates || []);
    }

    void loadTemplates();
  }, []);

  async function selectedLogoDataUrl() {
    if (logoFile) {
      const compressed = await compressLogo(logoFile);
      setLogoDataUrl(compressed);
      return compressed;
    }

    return logoDataUrl;
  }

  async function saveTemplate() {
    setIsSavingTemplate(true);
    setStatus({ tone: "idle", message: "Saving template..." });

    try {
      const savedLogoDataUrl = await selectedLogoDataUrl();
      const response = await fetch("/api/randomizer/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName || title || "Randomizer Template",
          title,
          description,
          rules,
          logoDataUrl: savedLogoDataUrl,
        }),
      });
      const payload = (await response.json()) as {
        template?: Template;
        error?: string;
      };

      if (!response.ok || !payload.template) {
        throw new Error(payload.error || "Could not save template.");
      }

      setTemplates((current) => [payload.template!, ...current]);
      setTemplateName("");
      setStatus({ tone: "good", message: "Template saved." });
    } catch (error) {
      setStatus({
        tone: "bad",
        message: error instanceof Error ? error.message : "Could not save template.",
      });
    } finally {
      setIsSavingTemplate(false);
    }
  }

  function loadTemplate(templateId: string) {
    const template = templates.find((item) => item.id === templateId);

    if (!template) return;

    setTitle(template.title);
    setDescription(template.description);
    setRules(template.rules);
    setLogoDataUrl(template.logo_data_url || "");
    setLogoFile(null);
    setStatus({ tone: "good", message: `Loaded template: ${template.name}` });
  }

  async function generateResult() {
    if (entries.length < 2) {
      setStatus({ tone: "bad", message: "Enter at least 2 names." });
      return;
    }

    if (mode === "multi-prize" && (prizes.length || winnerCount) > entries.length) {
      setStatus({
        tone: "bad",
        message: "You requested more winners/prizes than total entries.",
      });
      return;
    }

    setIsSubmitting(true);
    setStatus({ tone: "idle", message: "Generating and saving the official result..." });

    try {
      const savedLogoDataUrl = await selectedLogoDataUrl();
      const response = await fetch("/api/randomizer/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          rules,
          mode,
          entries,
          spinCount,
          prizeInterval: 0,
          winnerCount,
          prizeList: prizes,
          preventDuplicateWinners,
          logoDataUrl: savedLogoDataUrl,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        resultUrl?: string;
        publicCode?: string;
        billingUrl?: string;
        entries?: string[];
        spinHistory?: WheelSpin[];
        winners?: WheelWinner[];
      };

      if (!response.ok) {
        if (response.status === 402) {
          const isRandomizerHost = window.location.hostname
            .toLowerCase()
            .startsWith("randomizer.");
          window.location.href = isRandomizerHost ? "/billing" : payload.billingUrl || "/randomizer/billing";
          return;
        }

        throw new Error(payload.error || "Could not generate result.");
      }

      setStatus({
        tone: "good",
        message: `Official result saved. Code: ${payload.publicCode}`,
      });

      if (payload.publicCode) {
        const isRandomizerHost = window.location.hostname
          .toLowerCase()
          .startsWith("randomizer.");
        const redirectUrl = isRandomizerHost
          ? `/results/${payload.publicCode}`
          : payload.resultUrl || `/randomizer/results/${payload.publicCode}`;

        if (payload.entries && payload.spinHistory && payload.winners) {
          setReplay({
            entries: payload.entries,
            spinHistory: payload.spinHistory,
            winners: payload.winners,
            redirectUrl,
          });
          return;
        }

        window.location.href = redirectUrl;
      }
    } catch (error) {
      setStatus({
        tone: "bad",
        message: error instanceof Error ? error.message : "Something went wrong.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function loadDemo() {
    setTitle("Demo Giveaway");
    setDescription("This is a demo wheel.");
    setRules("Demo rules: must be eligible according to the giveaway post.");
    setPrizeList("Sticker Pack\n10-count Isopod Culture\nGrand Prize");
    setWinnerCount(3);
    setNames(["Name 6", "Name 5", "Name 4", "Name 3", "Name 2", "Name 1"].join("\n"));
    setStatus({ tone: "idle", message: "Demo names loaded." });
  }

  function rollSpinDice() {
    const first = Math.floor(Math.random() * 6) + 1;
    const second = Math.floor(Math.random() * 6) + 1;
    setDice([first, second]);
    setSpinCount(first + second);
  }

  const statusClass =
    status.tone === "good"
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
      : status.tone === "bad"
        ? "border-red-400/30 bg-red-400/10 text-red-100"
        : "border-white/10 bg-white/5 text-emerald-50/70";

  return (
    <>
    {replay && (
      <div className="fixed inset-0 z-50 overflow-auto bg-[#07130c]/95 p-4 backdrop-blur">
        <div className="mx-auto max-w-5xl">
          <div className="mb-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-emerald-50">
            <p className="font-black">Official result saved. The wheel is replaying the server-generated result.</p>
          </div>
          <WheelReplay
            entries={replay.entries}
            spinHistory={replay.spinHistory}
            winners={replay.winners}
            autoPlay
            redirectUrl={replay.redirectUrl}
          />
        </div>
      </div>
    )}

    <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/20">
        <div className="grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-black text-emerald-100">Wheel Title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:ring-4 focus:ring-emerald-400/20"
              placeholder="Example: Crested Critters Giveaway"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-black text-emerald-100">Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-24 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:ring-4 focus:ring-emerald-400/20"
              placeholder="Example: Winner receives one free isopod culture."
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-black text-emerald-100">Rules</span>
            <textarea
              value={rules}
              onChange={(event) => setRules(event.target.value)}
              className="min-h-24 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:ring-4 focus:ring-emerald-400/20"
              placeholder="Example: Must follow the page, like the post, and comment to qualify."
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-black text-emerald-100">Logo</span>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setLogoFile(event.target.files?.[0] || null)}
              className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-300 file:px-3 file:py-2 file:font-black file:text-slate-950"
            />
            {logoDataUrl && !logoFile && (
              <span className="text-sm text-emerald-50/60">
                Template logo loaded.
              </span>
            )}
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-black text-emerald-100">Name List</span>
            <textarea
              value={names}
              onChange={(event) => setNames(event.target.value)}
              className="min-h-72 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:ring-4 focus:ring-emerald-400/20"
              placeholder="Paste names here, one per line."
            />
            <span className="text-sm text-emerald-50/60">
              {entries.length} entries. Duplicate names count as separate entries.
            </span>
          </label>
        </div>
      </section>

      <aside className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/20">
        <div className="grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-black text-emerald-100">Wheel Type</span>
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value)}
              className="rounded-xl border border-white/10 bg-[#08150e] px-4 py-3 text-white outline-none focus:ring-4 focus:ring-emerald-400/20"
            >
              <option value="spin-count">Spin Count - final winner is the last spin</option>
              <option value="last-name-spun">Last Name Spun - remove names until one remains</option>
              <option value="multi-prize">Multiple Winners / Prize List</option>
            </select>
          </label>

          {mode === "spin-count" && (
            <>
              <label className="grid gap-2">
                <span className="text-sm font-black text-emerald-100">Number of Spins</span>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={spinCount}
                  onChange={(event) => setSpinCount(Number(event.target.value || 1))}
                  className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:ring-4 focus:ring-emerald-400/20"
                />
              </label>

              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-emerald-100">Random Spin Count</p>
                    <p className="mt-1 text-sm text-emerald-50/60">
                      Roll two six-sided dice. The sum becomes the number of spins.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={rollSpinDice}
                    className="rounded-xl border border-yellow-300/30 bg-yellow-300/15 px-5 py-3 font-black text-yellow-100 transition hover:bg-yellow-300/20"
                  >
                    Roll Dice
                  </button>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  {(dice || [1, 1]).map((value, index) => (
                    <div
                      key={index}
                      className="flex h-14 w-14 items-center justify-center rounded-xl border border-white/20 bg-white text-2xl font-black text-slate-950 shadow-lg"
                    >
                      {dice ? value : "?"}
                    </div>
                  ))}
                  <div className="font-black text-emerald-100">
                    {dice ? `Total: ${spinCount} spins` : "Roll to randomize"}
                  </div>
                </div>
              </div>
            </>
          )}

          {mode === "multi-prize" && (
            <>
              <label className="grid gap-2">
                <span className="text-sm font-black text-emerald-100">Number of Winners</span>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={winnerCount}
                  onChange={(event) => setWinnerCount(Number(event.target.value || 1))}
                  className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:ring-4 focus:ring-emerald-400/20"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-black text-emerald-100">Prize List</span>
                <textarea
                  value={prizeList}
                  onChange={(event) => setPrizeList(event.target.value)}
                  className="min-h-32 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:ring-4 focus:ring-emerald-400/20"
                  placeholder={"One prize per line.\nSticker Pack\nGrand Prize"}
                />
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-4 text-sm font-bold text-emerald-50">
                <input
                  type="checkbox"
                  checked={preventDuplicateWinners}
                  onChange={(event) => setPreventDuplicateWinners(event.target.checked)}
                  className="h-5 w-5"
                />
                Prevent the same name from winning multiple prizes
              </label>
            </>
          )}

          <div className={`rounded-xl border p-4 text-sm leading-6 ${statusClass}`}>
            {status.message}
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <h2 className="font-black text-emerald-100">Templates</h2>

            <label className="mt-3 grid gap-2">
              <span className="text-sm font-bold text-emerald-50/70">Load Template</span>
              <select
                defaultValue=""
                onChange={(event) => loadTemplate(event.target.value)}
                className="rounded-xl border border-white/10 bg-[#08150e] px-4 py-3 text-white outline-none focus:ring-4 focus:ring-emerald-400/20"
              >
                <option value="">Choose a template</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-3 grid gap-2">
              <span className="text-sm font-bold text-emerald-50/70">Template Name</span>
              <input
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                placeholder="Example: Weekly Giveaway"
                className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:ring-4 focus:ring-emerald-400/20"
              />
            </label>

            <button
              type="button"
              onClick={saveTemplate}
              disabled={isSavingTemplate}
              className="mt-3 w-full rounded-xl border border-white/10 bg-white/10 px-5 py-3 font-black text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingTemplate ? "Saving..." : "Save Current Setup"}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={generateResult}
              disabled={isSubmitting}
              className="rounded-xl bg-emerald-300 px-5 py-3 font-black text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2"
            >
              {isSubmitting ? "Generating..." : "Generate Official Result"}
            </button>

            <button
              type="button"
              onClick={loadDemo}
              className="rounded-xl border border-white/10 bg-white/10 px-5 py-3 font-black text-white transition hover:bg-white/15"
            >
              Load Demo
            </button>

          </div>
        </div>
      </aside>
    </div>
    </>
  );
}
