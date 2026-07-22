import { useState } from "react";
import { PlatformIcon } from "@/components/common/PlatformIcon";
import { useStreamStats } from "./useStreamStats";
import { openJoystickReporting } from "./joystickReporting";

function formatUptime(startedAt: string | undefined): string {
  if (!startedAt) return "—";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function StatCard({ icon, label, value, sub }: { icon: string; label: string; value: string; sub?: string }) {
  return (
    <div className="card-glass p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">{icon}</span>
        <span className="text-[10px] text-white/25 uppercase tracking-wider font-semibold">{label}</span>
      </div>
      <div className="text-[22px] font-bold text-white/90">{value}</div>
      {sub && <div className="text-[10px] mt-1 text-white/30">{sub}</div>}
    </div>
  );
}

export default function StreamStatsApp() {
  const { twitchConnected, twitch, twitchError, kickSlug, setKickSlug, kick, kickError, history, peak, refresh } = useStreamStats();
  const [editingSlug, setEditingSlug] = useState(false);
  const [slugDraft, setSlugDraft] = useState(kickSlug);

  const twitchViewers = twitch?.is_live ? twitch.viewer_count ?? 0 : 0;
  const kickViewers = kick?.is_live ? kick.viewer_count ?? 0 : 0;
  const totalViewers = twitchViewers + kickViewers;
  const anyLive = !!twitch?.is_live || !!kick?.is_live;

  const platforms = [
    twitch ? { platform: "twitch" as const, viewers: twitchViewers, live: twitch.is_live, color: "bg-[#9146ff]" } : null,
    kick ? { platform: "kick" as const, viewers: kickViewers, live: kick.is_live, color: "bg-[#53fc18]" } : null,
  ].filter((p): p is NonNullable<typeof p> => p !== null && p.live);

  return (
    <div className="h-full flex flex-col p-6 bg-[#050505] overflow-y-auto">
      <div className="max-w-3xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-[18px] font-bold text-white/90">Stream Stats</h2>
            <p className="text-[11px] text-white/30 mt-0.5">Real-time viewers, followers, and uptime</p>
          </div>
          <button
            onClick={refresh}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${
              anyLive ? "bg-red-500/10 text-red-400 border-red-500/25" : "btn-ghost"
            }`}
          >
            {anyLive ? "🔴 Live" : "⚪ Offline"}
          </button>
        </div>

        {/* Connection hints */}
        {!twitchConnected && (
          <div className="surface-glass p-3 mb-3">
            <p className="text-[11px] text-amber-400/70">⚠️ Connect Twitch in Alerts Hub to see Twitch stats.</p>
          </div>
        )}
        {twitchError && <div className="surface-glass p-3 mb-3"><p className="text-[11px] text-red-400/70">{twitchError}</p></div>}
        {kickError && <div className="surface-glass p-3 mb-3"><p className="text-[11px] text-red-400/70">{kickError}</p></div>}

        <div className="surface-glass p-3 mb-6 flex items-center gap-2">
          <PlatformIcon platform="kick" size="sm" />
          {editingSlug ? (
            <>
              <input
                value={slugDraft}
                onChange={(e) => setSlugDraft(e.target.value)}
                placeholder="Kick channel slug"
                className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-lg px-2 py-1 text-[11px] text-white/80"
              />
              <button
                onClick={() => {
                  setKickSlug(slugDraft.trim());
                  setEditingSlug(false);
                }}
                className="text-[11px] text-green-400"
              >
                Save
              </button>
            </>
          ) : (
            <>
              <span className="text-[11px] text-white/50 flex-1">
                {kickSlug ? `Tracking Kick: ${kickSlug}` : "No Kick channel set — Kick stats need a connected account (Multi-Chat) and a channel slug."}
              </span>
              <button onClick={() => setEditingSlug(true)} className="text-[11px] text-white/40 hover:text-white/70">
                {kickSlug ? "Change" : "Set"}
              </button>
            </>
          )}
        </div>

        <div className="surface-glass p-3 mb-6 flex items-center gap-2">
          <PlatformIcon platform="joystick" size="sm" />
          <span className="text-[11px] text-white/50 flex-1">
            Joystick.tv has no public stats API — open your real dashboard to see viewers, followers, and tips.
          </span>
          <button onClick={openJoystickReporting} className="text-[11px] text-white/40 hover:text-white/70">
            Open Reporting
          </button>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <StatCard icon="👥" label="Current Viewers" value={anyLive ? totalViewers.toLocaleString() : "—"} sub={anyLive ? "across live platforms" : undefined} />
          <StatCard icon="📈" label="Peak Viewers" value={peak > 0 ? peak.toLocaleString() : "—"} sub="this session" />
          <StatCard icon="⏱️" label="Twitch Uptime" value={twitch?.is_live ? formatUptime(twitch.started_at) : "—"} />
          <StatCard icon="💜" label="Twitch Followers" value={twitch?.follower_total !== undefined ? twitch.follower_total.toLocaleString() : "—"} />
          <StatCard icon="⭐" label="Twitch Subscribers" value={twitch?.subscriber_total !== undefined ? twitch.subscriber_total.toLocaleString() : "—"} />
          <StatCard icon="🎮" label="Category" value={twitch?.game_name || kick?.category_name || "—"} />
        </div>

        {/* Viewer history — real polled samples, not synthesized */}
        <div className="card-glass p-5">
          <h4 className="text-[12px] font-semibold text-white/70 mb-4">Viewer History (this session)</h4>
          {history.length < 2 ? (
            <div className="text-center py-10 text-white/20 text-sm">Collecting data — checks every 20s while a platform is connected.</div>
          ) : (
            <>
              <div className="flex items-end gap-1 h-32">
                {history.map((sample) => {
                  const height = peak > 0 ? Math.max(4, (sample.total / peak) * 100) : 4;
                  return (
                    <div
                      key={sample.timestamp}
                      className="flex-1 rounded-t-sm bg-[var(--accent-system)]/30 hover:bg-[var(--accent-system)]/60 transition-colors cursor-pointer"
                      style={{ height: `${height}%` }}
                      title={`${sample.total} viewers at ${new Date(sample.timestamp).toLocaleTimeString()}`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-[9px] text-white/15">{new Date(history[0]!.timestamp).toLocaleTimeString()}</span>
                <span className="text-[9px] text-white/15">Now</span>
              </div>
            </>
          )}
        </div>

        {/* Platform breakdown */}
        {platforms.length > 0 && (
          <div className="mt-4 card-glass p-5">
            <h4 className="text-[12px] font-semibold text-white/70 mb-3">Platform Breakdown</h4>
            <div className="space-y-3">
              {platforms.map((p) => {
                const pct = totalViewers > 0 ? Math.round((p.viewers / totalViewers) * 100) : 0;
                return (
                  <div key={p.platform} className="flex items-center gap-3">
                    <PlatformIcon platform={p.platform} size="sm" />
                    <span className="text-[11px] text-white/50 w-16 capitalize">{p.platform}</span>
                    <div className="flex-1 h-2 rounded-full bg-white/[0.04] overflow-hidden">
                      <div className={`h-full rounded-full ${p.color}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[11px] text-white/40 w-12 text-right">{p.viewers}</span>
                    <span className="text-[10px] text-white/20 w-8 text-right">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
