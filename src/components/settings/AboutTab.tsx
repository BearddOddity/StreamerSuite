interface Props {
  version: string;
}

export default function AboutTab({ version }: Props) {
  return (
    <div className="space-y-4">
      {/* App info */}
      <div className="surface-card rounded-2xl p-6 mb-5 text-center">
        <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl">⚡</span>
        </div>
        <h3 className="text-[16px] font-bold text-white/90">StreamerSuite</h3>
        <p className="text-[11px] text-white/30 mt-1">Ultimate Streaming Companion</p>
        <div className="inline-block mt-3 badge badge-ghost">
          <span className="text-[10px] font-mono">v{version}</span>
        </div>
      </div>

      {/* Description */}
      <div className="surface-card rounded-2xl p-6 mb-5">
        <div className="section-head mb-3">
          <span className="section-head-icon">ℹ️</span>
          <h4 className="section-head-title">About</h4>
        </div>
        <p className="text-[11px] text-white/35 leading-relaxed">
          StreamerSuite is an all-in-one streaming toolkit. Unifying StatusForge game detection,
          Multi-Chat multi-platform chat, and StreamerSuite core — manage API keys, route
          channels, configure overlays, detect games, and monitor your stream from a single interface.
        </p>
      </div>

      {/* Apps */}
      <div className="surface-card rounded-2xl p-6 mb-5">
        <div className="section-head mb-3">
          <span className="section-head-icon">📦</span>
          <h4 className="section-head-title">Included Apps</h4>
        </div>
        <div className="space-y-2">
          {[
            { name: "StatusForge", desc: "Game detection engine — auto-detects what you're playing and updates your stream info.", version: "v1.0.8" },
            { name: "Multi-Chat", desc: "Unified multi-platform chat — Twitch, Kick, Joystick in one view.", version: "v0.2.0" },
          ].map((app) => (
            <div key={app.name} className="flex items-center gap-3 py-2">
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium text-white/70">{app.name}</div>
                <div className="text-[10px] text-white/30">{app.desc}</div>
              </div>
              <span className="badge badge-ghost text-[9px] font-mono shrink-0">{app.version}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tech stack */}
      <div className="surface-card rounded-2xl p-6 mb-5">
        <div className="section-head mb-3">
          <span className="section-head-icon">🛠</span>
          <h4 className="section-head-title">Tech Stack</h4>
        </div>
        <div className="space-y-2">
          {[
            { label: "Framework", value: "React 19 + TypeScript" },
            { label: "Styling", value: "Tailwind CSS 4" },
            { label: "Desktop", value: "Tauri 2" },
            { label: "Build", value: "Vite 8" },
          ].map((item) => (
            <div key={item.label} className="data-row">
              <span className="data-row-label">{item.label}</span>
              <span className="data-row-value">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Platform support */}
      <div className="surface-card rounded-2xl p-6 mb-5">
        <div className="section-head mb-3">
          <span className="section-head-icon">📡</span>
          <h4 className="section-head-title">Platform Support</h4>
        </div>
        <div className="space-y-2">
          {[
            { icon: "🟣", name: "Twitch", status: "IRC WebSocket + API", badge: "badge-purple" },
            { icon: "🟢", name: "Kick", status: "REST API + Pusher", badge: "badge-green" },
            { icon: "🟠", name: "JoystickTV", status: "WebSocket", badge: "badge-amber" },
          ].map((p) => (
            <div key={p.name} className="flex items-center gap-3 py-1.5">
              <span className="text-sm">{p.icon}</span>
              <span className={`badge ${p.badge}`}>{p.name}</span>
              <span className="text-[10px] text-white/20 ml-auto">{p.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
