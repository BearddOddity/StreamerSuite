interface Props {
  version: string;
}

export default function AboutTab({ version }: Props) {
  return (
    <div className="space-y-4">
      <div className="bg-black/30 border border-white/[0.06] rounded-2xl p-5 text-center">
        <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl">⚡</span>
        </div>
        <h3 className="text-[16px] font-bold text-white/90">ChatConfluence</h3>
        <p className="text-[11px] text-white/30 mt-1">Multi-platform chat hub</p>
        <div className="inline-block mt-3 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.06]">
          <span className="text-[10px] font-mono text-white/40">v{version}</span>
        </div>
      </div>
      <div className="bg-black/30 border border-white/[0.06] rounded-2xl p-4">
        <h4 className="text-[12px] font-semibold text-white/70 mb-2">About</h4>
        <p className="text-[11px] text-white/35 leading-relaxed">
          ChatConfluence connects to multiple streaming platforms — Twitch, Kick, and JoystickTV —
          and merges their chat feeds into a single unified view. Use Multi-Chat mode to interleave
          all platform chats, or focus on a single channel.
        </p>
      </div>
      <div className="bg-black/30 border border-white/[0.06] rounded-2xl p-4">
        <h4 className="text-[12px] font-semibold text-white/70 mb-3">Platform Support</h4>
        <div className="space-y-2">
          {[
            { icon: "🟣", name: "Twitch", status: "IRC WebSocket", color: "text-[#9146ff]" },
            { icon: "🟢", name: "Kick", status: "REST API + Pusher", color: "text-[#53fc18]" },
            { icon: "🟠", name: "JoystickTV", status: "WebSocket", color: "text-[#ff6b35]" },
          ].map((p) => (
            <div key={p.name} className="flex items-center gap-3">
              <span className="text-sm">{p.icon}</span>
              <span className={`text-[12px] font-medium ${p.color}`}>{p.name}</span>
              <span className="text-[10px] text-white/20 ml-auto">{p.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
