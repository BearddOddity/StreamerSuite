import { useState } from "react";
import { PlatformIcon } from "@/components/common/PlatformIcon";
import { useStreamStats } from "./useStreamStats";
import { openJoystickReporting } from "./joystickReporting";
import "../../design-system/styles.css";
import { Button, Card, SectionHead } from "../../design-system/components/core";
import { Tooltip } from "../../design-system/components/overlay";

function formatUptime(startedAt: string | undefined): string {
  if (!startedAt) return "—";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

// The design system's StatCard renders label/value/delta only (no leading icon,
// and its "delta" is a signed trend, not the neutral caption these tiles need)
// — so this stays a bespoke tile built on the shared Card shell rather than that.
function StatCard({ icon, label, value, sub }: { icon: string; label: string; value: string; sub?: string }) {
  return (
    <Card padding={16}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">{icon}</span>
        <span className="text-[10px] text-white/25 uppercase tracking-wider font-semibold">{label}</span>
      </div>
      <div className="text-[22px] font-bold text-white/90">{value}</div>
      {sub && <div className="text-[10px] mt-1 text-white/30">{sub}</div>}
    </Card>
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
    twitch ? { platform: "twitch" as const, viewers: twitchViewers, live: twitch.is_live, color: "#9146ff" } : null,
    kick ? { platform: "kick" as const, viewers: kickViewers, live: kick.is_live, color: "#53fc18" } : null,
  ].filter((p): p is NonNullable<typeof p> => p !== null && p.live);

  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto">
      <div className="max-w-3xl mx-auto w-full">
        {/* Header */}
        <div className="mb-6">
          <SectionHead
            icon="📊"
            title="Stream Stats"
            desc="Real-time viewers, followers, and uptime"
            right={
              <button
                onClick={refresh}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all border ${
                  anyLive ? "bg-red-500/10 text-red-400 border-red-500/25" : "btn-ghost"
                }`}
              >
                {anyLive ? "🔴 Live" : "⚪ Offline"}
              </button>
            }
          />
        </div>

        {/* Connection hints */}
        {!twitchConnected && (
          <Card padding={12} className="mb-3">
            <p className="text-[11px] text-amber-400/70">⚠️ Connect Twitch in StreamerSuite Settings → Connections & Keys to see Twitch stats.</p>
          </Card>
        )}
        {twitchError && (
          <Card padding={12} className="mb-3">
            <p className="text-[11px]" style={{ color: "var(--bd-red-text)" }}>{twitchError}</p>
          </Card>
        )}
        {kickError && (
          <Card padding={12} className="mb-3">
            <p className="text-[11px]" style={{ color: "var(--bd-red-text)" }}>{kickError}</p>
          </Card>
        )}

        <Card padding={12} className="mb-6 flex items-center gap-2">
          <PlatformIcon platform="kick" size="sm" />
          {editingSlug ? (
            <>
              <input
                value={slugDraft}
                onChange={(e) => setSlugDraft(e.target.value)}
                placeholder="Kick channel slug"
                className="flex-1 input-glass text-[11px]"
                style={{ padding: "6px 10px" }}
              />
              <Button
                variant="success"
                size="sm"
                onClick={() => {
                  setKickSlug(slugDraft.trim());
                  setEditingSlug(false);
                }}
              >
                Save
              </Button>
            </>
          ) : (
            <>
              <span className="text-[11px] text-white/50 flex-1">
                {kickSlug ? `Tracking Kick: ${kickSlug}` : "No Kick channel set — connect Kick in StreamerSuite Settings → Connections & Keys, or set a channel slug here."}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setEditingSlug(true)}>
                {kickSlug ? "Change" : "Set"}
              </Button>
            </>
          )}
        </Card>

        <Card padding={12} className="mb-6 flex items-center gap-2">
          <PlatformIcon platform="joystick" size="sm" />
          <span className="text-[11px] text-white/50 flex-1">
            Joystick.tv has no public stats API — open your real dashboard to see viewers, followers, and tips.
          </span>
          <Button variant="ghost" size="sm" onClick={openJoystickReporting}>
            Open Reporting
          </Button>
        </Card>

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
        <Card padding={20}>
          <h4 className="text-[12px] font-semibold text-white/70 mb-4">Viewer History (this session)</h4>
          {history.length < 2 ? (
            <div className="text-center py-10 text-white/20 text-sm">Collecting data — checks every 20s while a platform is connected.</div>
          ) : (
            <>
              <div className="flex items-end gap-1 h-32">
                {history.map((sample) => {
                  const height = peak > 0 ? Math.max(4, (sample.total / peak) * 100) : 4;
                  return (
                    <Tooltip key={sample.timestamp} label={`${sample.total} viewers at ${new Date(sample.timestamp).toLocaleTimeString()}`} className="flex-1 self-stretch items-end">
                      <div
                        className="w-full rounded-t-sm bg-[var(--accent-system)]/30 hover:bg-[var(--accent-system)]/60 transition-colors cursor-pointer"
                        style={{ height: `${height}%` }}
                      />
                    </Tooltip>
                  );
                })}
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-[9px] text-white/15">{new Date(history[0]!.timestamp).toLocaleTimeString()}</span>
                <span className="text-[9px] text-white/15">Now</span>
              </div>
            </>
          )}
        </Card>

        {/* Platform breakdown */}
        {platforms.length > 0 && (
          <Card padding={20} className="mt-4">
            <h4 className="text-[12px] font-semibold text-white/70 mb-3">Platform Breakdown</h4>
            <div className="space-y-3">
              {platforms.map((p) => {
                const pct = totalViewers > 0 ? Math.round((p.viewers / totalViewers) * 100) : 0;
                return (
                  <div key={p.platform} className="flex items-center gap-3">
                    <PlatformIcon platform={p.platform} size="sm" />
                    <span className="text-[11px] text-white/50 w-16 capitalize">{p.platform}</span>
                    <div className="bd-progress-track flex-1">
                      {Array.from({ length: 20 }, (_, i) => {
                        const on = i < Math.round((pct / 100) * 20);
                        return (
                          <div
                            key={i}
                            className={`bd-progress-seg ${on ? "on" : ""}`.trim()}
                            style={on ? { background: p.color, boxShadow: `0 0 8px color-mix(in srgb, ${p.color} 40%, transparent)` } : undefined}
                          />
                        );
                      })}
                    </div>
                    <span className="text-[11px] text-white/40 w-12 text-right">{p.viewers}</span>
                    <span className="text-[10px] text-white/20 w-8 text-right">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
