"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Play, Pause, RotateCcw, Menu as MenuIcon } from "lucide-react";
import "./chrono.css";

type Direction = "up" | "down";

interface Preset {
  label: string;
  hours?: number;
  minutes?: number;
  seconds?: number;
  direction?: Direction;
}

const PRESETS: Preset[] = [
  { label: "Choix de corporations", minutes: 5 },
  { label: "Round 1", hours: 2 },
  { label: "Round 2", hours: 2 },
  { label: "Round 3", hours: 2 },
  { label: "Quart de finale", hours: 2 },
  { label: "Demi-finale", hours: 2, minutes: 30 },
  { label: "Finale", direction: "up" },
];

const DIGIT_HEIGHT = 250;
const HOURS_DIGITS = Array.from({ length: 11 }, (_, i) => (i === 0 ? 0 : 10 - i));
const MINUTES_TENS_DIGITS = [0, 5, 4, 3, 2, 1, 0];
const SECONDS_TENS_DIGITS = [0, 5, 4, 3, 2, 1, 0];
const ONES_DIGITS = [0, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];

function DigitColumn({ values, offset }: { values: number[]; offset: number }) {
  return (
    <div className="chrono-time-part">
      <div
        className="chrono-digit-wrapper"
        style={{ transform: `translateY(-${offset}px)` }}
      >
        {values.map((v, i) => (
          <span key={i} className="chrono-digit">
            {v}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ChronoPage() {
  const [title, setTitle] = useState("Choix de corporations");
  const [isAnimated, setIsAnimated] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [direction, setDirection] = useState<Direction>("down");

  // Initial duration in seconds (used for replay)
  const [durationSeconds, setDurationSeconds] = useState(5 * 60);
  // Current remaining/elapsed time in seconds
  const [totalSeconds, setTotalSeconds] = useState(5 * 60);

  // Wall-clock anchor for drift-free timing. When running, we remember the
  // seconds value at start (base) and the real timestamp it started (startedAt),
  // then derive the displayed time from Date.now() on every tick. This keeps the
  // chrono accurate even when the browser throttles setInterval in a background
  // tab (the classic cause of a timer falling behind real time).
  const anchorRef = useRef<{ base: number; startedAt: number } | null>(null);
  const directionRef = useRef<Direction>(direction);

  useEffect(() => {
    directionRef.current = direction;
  }, [direction]);

  useEffect(() => {
    const tick = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const elapsed = Math.floor((Date.now() - anchor.startedAt) / 1000);
      if (directionRef.current === "down") {
        const next = anchor.base - elapsed;
        if (next <= 0) {
          anchorRef.current = null;
          setTotalSeconds(0);
          setIsAnimated(false);
          setIsEnded(true);
        } else {
          setTotalSeconds(next);
        }
      } else {
        setTotalSeconds(anchor.base + elapsed);
      }
    };
    const interval = setInterval(tick, 250);
    // Re-sync immediately when the tab regains focus/visibility.
    const onVisible = () => tick();
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const setTimer = (hours: number, minutes: number, seconds: number) => {
    const h = Math.min(hours, 9);
    const m = Math.min(minutes, 59);
    const sec = Math.min(seconds, 59);
    const total = h * 3600 + m * 60 + sec;

    anchorRef.current = null;
    setDurationSeconds(total);
    setTotalSeconds(total);
    setIsEnded(false);
  };

  const handlePreset = (preset: Preset) => {
    const dir = preset.direction || "down";
    setDirection(dir);
    setTitle(preset.label);
    setIsAnimated(false);
    setTimer(preset.hours || 0, preset.minutes || 0, preset.seconds || 0);
    setMenuOpen(false);
  };

  const handlePlay = () => {
    if (isAnimated) {
      // Pause: freeze on the currently displayed value.
      anchorRef.current = null;
      setIsAnimated(false);
      return;
    }
    if (direction === "up" || totalSeconds > 0) {
      anchorRef.current = { base: totalSeconds, startedAt: Date.now() };
      setIsAnimated(true);
    }
  };

  const handleReplay = () => {
    anchorRef.current = null;
    setIsAnimated(false);
    setTotalSeconds(durationSeconds);
    setIsEnded(false);
  };

  // Derive the individual digit values from the single source of truth.
  const clamped = Math.max(0, totalSeconds);
  const currentHours = Math.min(Math.floor(clamped / 3600), 9);
  const dispMinutes = Math.floor((clamped % 3600) / 60);
  const dispSeconds = clamped % 60;
  const currentMinuteTens = Math.floor(dispMinutes / 10);
  const currentMinutesOnes = dispMinutes % 10;
  const currentSecondsTens = Math.floor(dispSeconds / 10);
  const currentSecondsOnes = dispSeconds % 10;

  // Offsets for digit-wrapper translateY
  const hoursOffset = (10 - currentHours) * DIGIT_HEIGHT;
  const minutesTensOffset = (6 - currentMinuteTens) * DIGIT_HEIGHT;
  const minutesOnesOffset = (10 - currentMinutesOnes) * DIGIT_HEIGHT;
  const secondsTensOffset = (6 - currentSecondsTens) * DIGIT_HEIGHT;
  const secondsOnesOffset = (10 - currentSecondsOnes) * DIGIT_HEIGHT;

  return (
    <div
      className={`chrono-root ${isAnimated ? "is-animated" : ""} ${
        isEnded ? "is-ended" : ""
      }`}
    >
      <main className="chrono-main">
        <Image
          src="/chrono-logo.png"
          alt="Logo"
          width={200}
          height={200}
          className="chrono-logo"
        />
        <h1 className={`chrono-title ${isEnded ? "is-hidden" : ""}`}>{title}</h1>
        <h1 className={`chrono-title ${isEnded ? "" : "is-hidden"}`}>
          Fin du temps imparti
        </h1>
        <div className="chrono-wrapper">
          <div className="chrono-time-part-wrapper">
            <DigitColumn values={HOURS_DIGITS} offset={DIGIT_HEIGHT * 10} />
            <DigitColumn values={ONES_DIGITS} offset={hoursOffset} />
          </div>
          <div className="chrono-time-part-wrapper">
            <DigitColumn values={MINUTES_TENS_DIGITS} offset={minutesTensOffset} />
            <DigitColumn values={ONES_DIGITS} offset={minutesOnesOffset} />
          </div>
          <div className="chrono-time-part-wrapper">
            <DigitColumn values={SECONDS_TENS_DIGITS} offset={secondsTensOffset} />
            <DigitColumn values={ONES_DIGITS} offset={secondsOnesOffset} />
          </div>
        </div>
      </main>

      <div className={`chrono-menu-wrapper ${menuOpen ? "" : "is-hidden"}`}>
        <ul>
          {PRESETS.map((preset, i) => (
            <li key={i} onClick={() => handlePreset(preset)} className="chrono-preset">
              {preset.label}{" "}
              <strong>
                (
                {preset.direction === "up"
                  ? "illimité"
                  : [
                      preset.hours ? `${preset.hours}h` : "",
                      preset.minutes ? `${preset.minutes}min` : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                )
              </strong>
            </li>
          ))}
        </ul>
        <div className="chrono-boutons">
          <button onClick={handlePlay} className="chrono-action-btn" aria-label="play">
            {isAnimated ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>
          <button onClick={handleReplay} className="chrono-action-btn" aria-label="replay">
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      </div>

      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="chrono-menu-btn"
        aria-label="menu"
      >
        <MenuIcon className="w-5 h-5" />
      </button>
    </div>
  );
}
