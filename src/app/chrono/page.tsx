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
  { label: "Finale (illimité)", direction: "up" },
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

  // Initial duration (used for replay)
  const [durationHours, setDurationHours] = useState(0);
  const [durationMinutes, setDurationMinutes] = useState(5);
  const [durationSeconds, setDurationSeconds] = useState(0);

  // Current time
  const [currentHours, setCurrentHours] = useState(0);
  const [currentMinuteTens, setCurrentMinuteTens] = useState(0);
  const [currentMinutesOnes, setCurrentMinutesOnes] = useState(5);
  const [currentSecondsTens, setCurrentSecondsTens] = useState(0);
  const [currentSecondsOnes, setCurrentSecondsOnes] = useState(0);

  const stateRef = useRef({
    isAnimated,
    direction,
    currentHours,
    currentMinuteTens,
    currentMinutesOnes,
    currentSecondsTens,
    currentSecondsOnes,
  });

  useEffect(() => {
    stateRef.current = {
      isAnimated,
      direction,
      currentHours,
      currentMinuteTens,
      currentMinutesOnes,
      currentSecondsTens,
      currentSecondsOnes,
    };
  }, [
    isAnimated,
    direction,
    currentHours,
    currentMinuteTens,
    currentMinutesOnes,
    currentSecondsTens,
    currentSecondsOnes,
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      const s = stateRef.current;
      if (!s.isAnimated) return;

      let h = s.currentHours;
      let mt = s.currentMinuteTens;
      let mo = s.currentMinutesOnes;
      let st = s.currentSecondsTens;
      let so = s.currentSecondsOnes;

      if (s.direction === "down") {
        so--;
        if (so < 0) {
          so = 9;
          st--;
          if (st < 0) {
            so = 9;
            st = 5;
            mo--;
            if (mo < 0) {
              so = 9;
              st = 5;
              mo = 9;
              mt--;
              if (mt < 0) {
                so = 9;
                st = 5;
                mo = 9;
                mt = 5;
                h--;
                if (h < 0) h = 9;
              }
            }
          }
        }

        if (so <= 0 && st <= 0 && mo <= 0 && mt <= 0 && h <= 0) {
          setIsAnimated(false);
          setIsEnded(true);
        }
      } else {
        so++;
        if (so > 9) {
          so = 0;
          st++;
          if (st > 5) {
            so = 0;
            st = 0;
            mo++;
            if (mo > 9) {
              so = 0;
              st = 0;
              mo = 0;
              mt++;
              if (mt > 5) {
                so = 0;
                st = 0;
                mo = 0;
                mt = 0;
                h++;
              }
            }
          }
        }
      }

      setCurrentHours(h);
      setCurrentMinuteTens(mt);
      setCurrentMinutesOnes(mo);
      setCurrentSecondsTens(st);
      setCurrentSecondsOnes(so);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const setTimer = (hours: number, minutes: number, seconds: number) => {
    const h = Math.min(hours, 9);
    const m = Math.min(minutes, 59);
    const sec = Math.min(seconds, 59);

    setDurationHours(h);
    setDurationMinutes(m);
    setDurationSeconds(sec);

    setCurrentHours(h);
    setCurrentMinuteTens(Math.floor(m / 10));
    setCurrentMinutesOnes(m - Math.floor(m / 10) * 10);
    setCurrentSecondsTens(Math.floor(sec / 10));
    setCurrentSecondsOnes(sec - Math.floor(sec / 10) * 10);

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
    const hasTime =
      currentSecondsOnes > 0 ||
      currentSecondsTens > 0 ||
      currentMinutesOnes > 0 ||
      currentMinuteTens > 0 ||
      currentHours > 0;
    if (direction === "up" || hasTime) {
      setIsAnimated((v) => !v);
    }
  };

  const handleReplay = () => {
    setIsAnimated(false);
    setTimer(durationHours, durationMinutes, durationSeconds);
  };

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
