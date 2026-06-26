import { useState, useEffect } from "react";

interface StatCard {
  label: string;
  value: string;
  change: string;
  positive: boolean;
  icon: string;
}

export default function StreamStatsApp() {
  const [isLive, setIsLive] = useState(true);
  const [viewerCount, setViewerCount] = useState(1247);
  const [uptime, setUptime] = useState(7200);

  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      setViewerCount((v) => Math.max(0, v + Math.floor(Math.random() * 20 - 8)));
      setUptime((u) => u + 1);
    }, 3000);
    return () => clearInterval(interval);
  }, [isLive]);

  const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const stats: StatCard[] = [
    { label: "Current Viewers", value: viewerCount.toLocaleString(), change: "+12%", positive: true, icon: "👥" },
    { label: "Peak Viewers", value: "1,847", change: "Today", positive: true, icon: "📈" },
    { label: "Stream Uptime", value: formatUptime(uptime), change: "Live", positive: true, icon: "⏱️" },
    { label: "New Followers", value: "23", change: "+5", positive: true, icon: "💜" },
    { label: "Chat Messages", value: "4,382", change: "This stream", positive: true, icon: "💬" },
    { label: "Avg. Watch Time", value: "18m", change: "+2m", positive: true, icon: "⏰" },
  ];

  return (
    <div className="h-full flex flex-col p-6 bg-[#050505] overflow-y-auto">
      <div className="max-w-3xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-[18px] font-bold text-white/90">Stream Stats</h2>
            <p className="text-[11px] text-white/30 mt-0.5">Real-time stream analytics</p>
          </div>
          <button onClick={() => setIsLive(!isLive)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${
              isLive
                ? "bg-red-500/10 text-red-400 border-red-500/25"
                : "btn-ghost"
            }`}>
            {isLive ? "🔴 Live" : "⚪ Offline"}
          </button>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {stats.map((stat) => (
            <div key={stat.label} className="card-glass p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">{stat.icon}</span>
                <span className="text-[10px] text-white/25 uppercase tracking-wider font-semibold">{stat.label}</span>
              </div>
              <div className="text-[22px] font-bold text-white/90">{stat.value}</div>
              <div className={`text-[10px] mt-1 ${stat.positive ? "text-green-400/60" : "text-red-400/60"}`}>
                {stat.change}
              </div>
            </div>
          ))}
        </div>

        {/* Chart placeholder */}
        <div className="card-glass p-5">
          <h4 className="text-[12px] font-semibold text-white/70 mb-4">Viewer History</h4>
          <div className="flex items-end gap-1 h-32">
            {Array.from({ length: 48 }, (_, i) => {
              const height = 20 + Math.sin(i * 0.3) * 30 + Math.random() * 30;
              return (
                <div key={i} className="flex-1 rounded-t-sm bg-[var(--accent-system)]/30 hover:bg-[var(--accent-system)]/60 transition-colors cursor-pointer"
                  style={{ height: `${height}%` }}
                  title={`${Math.floor(height * 20)} viewers`}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[9px] text-white/15">2h ago</span>
            <span className="text-[9px] text-white/15">Now</span>
          </div>
        </div>

        {/* Platform breakdown */}
        <div className="mt-4 card-glass p-5">
          <h4 className="text-[12px] font-semibold text-white/70 mb-3">Platform Breakdown</h4>
          <div className="space-y-3">
            {[
              { platform: "Twitch", icon: "🟣", viewers: 892, pct: 71, color: "bg-[#9146ff]" },
              { platform: "Kick", icon: "🟢", viewers: 231, pct: 19, color: "bg-[#53fc18]" },
              { platform: "YouTube", icon: "🔴", viewers: 124, pct: 10, color: "bg-red-500" },
            ].map((p) => (
              <div key={p.platform} className="flex items-center gap-3">
                <span className="text-sm w-5">{p.icon}</span>
                <span className="text-[11px] text-white/50 w-16">{p.platform}</span>
                <div className="flex-1 h-2 rounded-full bg-white/[0.04] overflow-hidden">
                  <div className={`h-full rounded-full ${p.color}`} style={{ width: `${p.pct}%` }} />
                </div>
                <span className="text-[11px] text-white/40 w-12 text-right">{p.viewers}</span>
                <span className="text-[10px] text-white/20 w-8 text-right">{p.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
