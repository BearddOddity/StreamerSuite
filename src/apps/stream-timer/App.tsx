import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import "../../design-system/styles.css";
import { Button, Chip } from "../../design-system/components/core";

type TimerMode = "stopwatch" | "countdown";

export default function StreamTimerApp() {
  const [mode, setMode] = useState<TimerMode>("stopwatch");
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [countdownMinutes, setCountdownMinutes] = useState(60);
  const [countdownRemaining, setCountdownRemaining] = useState(0);
  const [countdownRunning, setCountdownRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stopwatch
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  // Countdown
  useEffect(() => {
    if (countdownRunning && countdownRemaining > 0) {
      intervalRef.current = setInterval(() => {
        setCountdownRemaining((r) => {
          if (r <= 1) {
            setCountdownRunning(false);
            return 0;
          }
          return r - 1;
        });
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [countdownRunning, countdownRemaining]);

  // Feeds the Overlay Maker's live-data-bound fields (see overlay_manager.rs's
  // /data-ws) — whichever mode is actually running is "the" timer value.
  useEffect(() => {
    const value = mode === "stopwatch" ? elapsed : countdownRemaining;
    invoke("overlay_publish_data", { key: "timer", value }).catch(() => {});
  }, [mode, elapsed, countdownRemaining]);

  const formatTime = useCallback((seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }, []);

  const startCountdown = () => {
    setCountdownRemaining(countdownMinutes * 60);
    setCountdownRunning(true);
  };

  const stopwatchProgress = countdownRunning || countdownRemaining > 0
    ? ((countdownMinutes * 60 - countdownRemaining) / (countdownMinutes * 60)) * 100
    : 0;

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 bg-[#050505]">
      <div className="w-full max-w-lg">
        {/* Mode toggle */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {(["stopwatch", "countdown"] as const).map((m) => (
            <Chip key={m} selected={mode === m} onClick={() => setMode(m)}>
              {m === "stopwatch" ? "⏱️ Stopwatch" : "⏳ Countdown"}
            </Chip>
          ))}
        </div>

        {mode === "stopwatch" ? (
          <>
            {/* Stopwatch display */}
            <div className="text-center mb-8">
              <div className="text-6xl font-mono font-bold text-white/90 tracking-wider mb-2">
                {formatTime(elapsed)}
              </div>
              <p className="text-[11px] text-white/25">Stream session time</p>
            </div>

            {/* Stopwatch controls */}
            <div className="flex items-center justify-center gap-3">
              {running ? (
                <button onClick={() => setRunning(false)}
                  className="px-6 py-3 rounded-xl text-sm font-semibold transition-all bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25">
                  ⏸ Pause
                </button>
              ) : (
                <Button variant="cta" onClick={() => setRunning(true)}>
                  ▶ Start
                </Button>
              )}
              <Button variant="ghost" onClick={() => { setRunning(false); setElapsed(0); }}>
                ↺ Reset
              </Button>
            </div>

            {/* Session presets */}
            <div className="mt-8">
              <p className="text-[10px] text-white/20 uppercase tracking-widest font-semibold mb-3 text-center">Quick Markers</p>
              <div className="flex justify-center gap-2 flex-wrap">
                {[
                  { label: "30m", seconds: 1800 },
                  { label: "1h", seconds: 3600 },
                  { label: "2h", seconds: 7200 },
                  { label: "3h", seconds: 10800 },
                  { label: "4h", seconds: 14400 },
                ].map((preset) => (
                  <div key={preset.label} className="text-center">
                    <div className={`text-[10px] font-mono ${elapsed >= preset.seconds ? "text-green-400/60" : "text-white/15"}`}>
                      {elapsed >= preset.seconds ? "✓" : "○"}
                    </div>
                    <div className="text-[10px] text-white/25">{preset.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Countdown display */}
            <div className="text-center mb-8">
              <div className={`text-6xl font-mono font-bold tracking-wider mb-2 ${
                countdownRemaining <= 300 && countdownRemaining > 0 ? "text-amber-400" :
                countdownRemaining === 0 ? "text-red-400" : "text-white/90"
              }`}>
                {formatTime(countdownRemaining)}
              </div>
              <p className="text-[11px] text-white/25">
                {countdownRunning ? "Countdown running..." : countdownRemaining === 0 && countdownMinutes > 0 ? "Time's up!" : "Set your countdown"}
              </p>
            </div>

            {/* Progress bar */}
            {countdownRunning || countdownRemaining > 0 ? (
              <div className="w-full progress-track mb-6">
                <div
                  className={`progress-fill ${countdownRemaining <= 300 ? "bg-amber-400" : "bg-[var(--accent-system)]"}`}
                  style={{ width: `${100 - stopwatchProgress}%` }}
                />
              </div>
            ) : null}

            {/* Countdown input */}
            {!countdownRunning && countdownRemaining === 0 && (
              <div className="flex items-center justify-center gap-3 mb-6">
                <label className="text-[11px] text-white/30">Minutes:</label>
                <input type="number" min={1} max={480} value={countdownMinutes}
                  onChange={(e) => setCountdownMinutes(Math.max(1, Math.min(480, Number(e.target.value))))}
                  className="w-20 input-glass text-center font-mono" />
              </div>
            )}

            {/* Countdown controls */}
            <div className="flex items-center justify-center gap-3">
              {!countdownRunning && countdownRemaining > 0 ? (
                <Button variant="cta" onClick={() => setCountdownRunning(true)}>
                  ▶ Resume
                </Button>
              ) : countdownRemaining === 0 && !countdownRunning ? (
                <Button variant="cta" onClick={startCountdown}>
                  ▶ Start Countdown
                </Button>
              ) : (
                <button onClick={() => setCountdownRunning(false)}
                  className="px-6 py-3 rounded-xl text-sm font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/25 hover:bg-amber-500/25 transition-all">
                  ⏸ Pause
                </button>
              )}
              <Button variant="ghost" onClick={() => { setCountdownRunning(false); setCountdownRemaining(0); }}>
                ↺ Reset
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
