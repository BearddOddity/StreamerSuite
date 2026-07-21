import { useState, useEffect, useCallback } from "react";

interface Alert {
  id: string;
  type: "follow" | "sub" | "donation" | "raid" | "host";
  user: string;
  message: string;
  timestamp: number;
  icon: string;
  color: string;
}

const alertPool: Omit<Alert, "id" | "timestamp">[] = [
  { type: "follow", user: "StreamFan42", message: "just followed!", icon: "💜", color: "border-purple-500/25 bg-purple-500/10" },
  { type: "sub", user: "ProGamer99", message: "subscribed for 3 months!", icon: "⭐", color: "border-amber-500/25 bg-amber-500/10" },
  { type: "donation", user: "GenerousViewer", message: "donated $10 — 'Love the stream!'", icon: "💰", color: "border-green-500/25 bg-green-500/10" },
  { type: "raid", user: "AnotherStreamer", message: "is raiding with 45 viewers!", icon: "🚀", color: "border-cyan-500/25 bg-cyan-500/10" },
  { type: "sub", user: "LoyalSub", message: "gifted 5 subs to the community!", icon: "🎁", color: "border-pink-500/25 bg-pink-500/10" },
  { type: "follow", user: "NewFollower", message: "just followed!", icon: "💜", color: "border-purple-500/25 bg-purple-500/10" },
  { type: "host", user: "FriendlyStreamer", message: "is hosting you with 120 viewers!", icon: "📡", color: "border-blue-500/25 bg-blue-500/10" },
];

export default function AlertsHubApp() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const spawnAlert = useCallback(() => {
    const template = alertPool[Math.floor(Math.random() * alertPool.length)]!;
    const alert: Alert = {
      ...template,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
    };
    setAlerts((prev) => [alert, ...prev].slice(0, 50));
  }, []);

  useEffect(() => {
    if (!enabled) return;
    // Seed some initial alerts
    const seed = Array.from({ length: 5 }, (_, i) => {
      const template = alertPool[Math.floor(Math.random() * alertPool.length)]!;
      return { ...template, id: `seed-${i}`, timestamp: Date.now() - (5 - i) * 60000 };
    });
    setAlerts(seed);

    const interval = setInterval(() => {
      if (Math.random() > 0.4) spawnAlert();
    }, 8000);
    return () => clearInterval(interval);
  }, [enabled, spawnAlert]);

  return (
    <div className="h-full flex flex-col p-6 bg-[#050505] overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-[18px] font-bold text-white/90">Alerts & Events</h2>
            <p className="text-[11px] text-white/30 mt-0.5">Follows, subs, donations, raids, and more</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setSoundEnabled(!soundEnabled)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
                soundEnabled ? "bg-white/[0.04] text-white/50 border-white/[0.08]" : "bg-white/[0.02] text-white/20 border-white/[0.04]"
              }`}>
              {soundEnabled ? "🔊" : "🔇"}
            </button>
            <button onClick={() => setEnabled(!enabled)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${
                enabled ? "bg-green-500/10 text-green-400 border-green-500/25" : "btn-ghost"
              }`}>
              {enabled ? "🟢 Active" : "⏸ Paused"}
            </button>
          </div>
        </div>

        {/* Quick trigger */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {alertPool.map((a, i) => (
            <button key={i} onClick={() => {
              const alert: Alert = { ...a, id: `manual-${Date.now()}`, timestamp: Date.now() };
              setAlerts((prev) => [alert, ...prev].slice(0, 50));
            }}
              className={`px-3 py-2 rounded-xl text-[11px] font-medium border transition-all hover:-translate-y-0.5 ${a.color}`}>
              {a.icon} {a.type}
            </button>
          ))}
        </div>

        {/* Alert feed */}
        <div className="space-y-2">
          {alerts.length === 0 ? (
            <div className="text-center py-12 text-white/20 text-sm">
              No alerts yet. Waiting for events...
            </div>
          ) : (
            alerts.map((alert) => (
              <div key={alert.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${alert.color}`}>
                <span className="text-xl">{alert.icon}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-[12px] font-semibold text-white/80">{alert.user}</span>
                  <span className="text-[11px] text-white/40 ml-1">{alert.message}</span>
                </div>
                <span className="text-[9px] text-white/15 shrink-0">
                  {new Date(alert.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
