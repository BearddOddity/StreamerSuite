import { useEffect, useState } from "react";
import { PlatformIcon } from "@/components/common/PlatformIcon";
import { fetchConfig } from "@statusforge/hooks/useTauriApi";
import type { AppConfig } from "@statusforge/types";
import { streamerBotUpdateKick } from "@/lib/streamerbot";
import { useTwitchChannelInfo, useKickChannelInfo } from "./useChannelInfo";
import { useChecklist } from "./useChecklist";
import { openJoystickDashboard, JOYSTICK_DASHBOARD_URL } from "./joystickDashboard";
import "../../design-system/styles.css";
import { Badge, Button, Card, SectionHead } from "../../design-system/components/core";

/** Shown in place of the category input whenever StatusForge's own
 * game-detection push is switched on (Settings → General → Platform Push)
 * — that engine is already deciding the live category, so a manual value
 * typed here would just get overwritten the next time it fires. */
function CategoryManagedNotice() {
  return (
    <div className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[11px] text-white/40">
      Category is managed automatically by StatusForge's game detection (Settings → General → Platform
      Push). Turn that off to set it manually here.
    </div>
  );
}

function TwitchPanel({ categoryManagedByStatusForge }: { categoryManagedByStatusForge: boolean }) {
  const { twitch, twitchError, twitchSaving, twitchSaved, updateTwitch } = useTwitchChannelInfo();
  const [title, setTitle] = useState("");
  const [game, setGame] = useState("");
  const [tags, setTags] = useState("");

  useEffect(() => {
    if (twitch) {
      setTitle(twitch.title);
      setGame(twitch.game_name);
      setTags(twitch.tags.join(", "));
    }
  }, [twitch]);

  return (
    <Card padding={20} className="mb-4">
      <div className="flex items-center gap-2 mb-3">
        <PlatformIcon platform="twitch" size="sm" />
        <h3 className="text-[13px] font-semibold text-white/80">Twitch</h3>
        {twitchSaved && <Badge variant="green" className="ml-auto">Saved ✓</Badge>}
      </div>
      {twitchError ? (
        <Card padding={10}>
          <p className="text-[11px]" style={{ color: "var(--bd-red-text)" }}>{twitchError}</p>
        </Card>
      ) : (
        <div className="space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Stream title"
            className="w-full input-glass text-[12px]"
          />
          {categoryManagedByStatusForge ? (
            <CategoryManagedNotice />
          ) : (
            <input
              value={game}
              onChange={(e) => setGame(e.target.value)}
              placeholder="Category / game"
              className="w-full input-glass text-[12px]"
            />
          )}
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Tags, comma separated (max 10)"
            className="w-full input-glass text-[12px]"
          />
          <Button
            variant="cta"
            disabled={twitchSaving || !twitch}
            onClick={() =>
              updateTwitch({
                title: title !== twitch?.title ? title : undefined,
                game_name:
                  !categoryManagedByStatusForge && game !== twitch?.game_name ? game : undefined,
                tags: tags !== (twitch?.tags.join(", ") ?? "") ? tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
              })
            }
          >
            {twitchSaving ? "Saving…" : "Save to Twitch"}
          </Button>
        </div>
      )}
    </Card>
  );
}

function KickPanel({
  categoryManagedByStatusForge,
  streamerbotHost,
  streamerbotPort,
  streamerbotKickAction,
}: {
  categoryManagedByStatusForge: boolean;
  streamerbotHost: string;
  streamerbotPort: string;
  streamerbotKickAction: string;
}) {
  const { kick, kickError, kickSaving, kickSaved, updateKick } = useKickChannelInfo();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [sbBusy, setSbBusy] = useState(false);
  const [sbResult, setSbResult] = useState<string | null>(null);

  useEffect(() => {
    if (kick) {
      setTitle(kick.stream_title || "");
      setCategory(kick.category?.name || "");
    }
  }, [kick]);

  const updateViaStreamerBot = async () => {
    setSbBusy(true);
    setSbResult(null);
    try {
      await streamerBotUpdateKick(streamerbotHost, streamerbotPort, streamerbotKickAction, {
        title: title !== (kick?.stream_title || "") ? title : undefined,
        category: !categoryManagedByStatusForge && category !== (kick?.category?.name || "") ? category : undefined,
      });
      setSbResult("Sent to Streamer.bot ✓");
    } catch (e) {
      setSbResult(String(e));
    } finally {
      setSbBusy(false);
    }
  };

  return (
    <Card padding={20} className="mb-4">
      <div className="flex items-center gap-2 mb-3">
        <PlatformIcon platform="kick" size="sm" />
        <h3 className="text-[13px] font-semibold text-white/80">Kick</h3>
        {kickSaved && <Badge variant="green" className="ml-auto">Saved ✓</Badge>}
      </div>
      {kickError && (
        <Card padding={10} className="mb-2">
          <p className="text-[11px]" style={{ color: "var(--bd-red-text)" }}>
            {kickError} — direct Kick connections sometimes hit a Cloudflare block; try "Update via
            Streamer.bot" below instead.
          </p>
        </Card>
      )}
      <div className="space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Stream title"
          className="w-full input-glass text-[12px]"
        />
        {categoryManagedByStatusForge ? (
          <CategoryManagedNotice />
        ) : (
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Category"
            className="w-full input-glass text-[12px]"
          />
        )}
        <div className="flex gap-2">
          <Button
            variant="success"
            disabled={kickSaving || !kick}
            onClick={() =>
              updateKick({
                title: title !== (kick?.stream_title || "") ? title : undefined,
                category_name:
                  !categoryManagedByStatusForge && category !== (kick?.category?.name || "")
                    ? category
                    : undefined,
              })
            }
          >
            {kickSaving ? "Saving…" : "Save to Kick"}
          </Button>
          <Button variant="ghost" disabled={sbBusy || !streamerbotKickAction} onClick={updateViaStreamerBot}>
            {sbBusy ? "Sending…" : "🤖 Update via Streamer.bot"}
          </Button>
        </div>
        {!streamerbotKickAction && (
          <p className="text-[10px] text-white/20">
            Set up a Kick update Action in Settings → Connections & Keys → Streamer.bot to enable this.
          </p>
        )}
        {sbResult && <p className="text-[11px] text-white/50">{sbResult}</p>}
      </div>
    </Card>
  );
}

function JoystickPanel() {
  return (
    <Card padding={20} className="mb-4">
      <div className="flex items-center gap-2 mb-3">
        <PlatformIcon platform="joystick" size="sm" />
        <h3 className="text-[13px] font-semibold text-white/80">Joystick.tv</h3>
      </div>
      <p className="text-[11px] text-white/40 leading-relaxed mb-3">
        No verified public API exists for updating title/category on Joystick.tv. This opens{" "}
        <code className="text-white/50">{JOYSTICK_DASHBOARD_URL}</code> — a best-guess URL for their settings dashboard; let me know if
        it's wrong.
      </p>
      <Button variant="ghost" onClick={openJoystickDashboard}>
        Open Joystick.tv Dashboard
      </Button>
    </Card>
  );
}

function ChecklistPanel() {
  const { items, toggle, addItem, removeItem, resetForNewStream, checkedCount } = useChecklist();
  const [draft, setDraft] = useState("");

  return (
    <Card padding={20}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-semibold text-white/80">Pre-Stream Checklist</h3>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-white/30">
            {checkedCount}/{items.length}
          </span>
          <Button variant="ghost" size="sm" onClick={resetForNewStream}>
            Reset for new stream
          </Button>
        </div>
      </div>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2 group">
            <button
              onClick={() => toggle(item.id)}
              className={`w-4 h-4 rounded border flex items-center justify-center text-[9px] shrink-0 transition-all ${
                item.checked ? "bg-green-500/30 border-green-500/50 text-green-300" : "border-white/20 text-transparent"
              }`}
            >
              ✓
            </button>
            <span className={`text-[12px] flex-1 ${item.checked ? "text-white/30 line-through" : "text-white/70"}`}>{item.label}</span>
            {item.custom && (
              <button onClick={() => removeItem(item.id)} className="text-[10px] text-white/20 opacity-0 group-hover:opacity-100 hover:text-red-400">
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              addItem(draft);
              setDraft("");
            }
          }}
          placeholder="Add a checklist item…"
          className="flex-1 input-glass text-[12px]"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            addItem(draft);
            setDraft("");
          }}
        >
          Add
        </Button>
      </div>
    </Card>
  );
}

export default function StreamManagerApp() {
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    fetchConfig().then(setAppConfig);
  }, []);

  const categoryManagedByStatusForge = appConfig?.engine_settings.platform_push_enabled ?? false;
  const bc = appConfig?.broadcaster;

  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full">
        <div className="mb-6">
          <SectionHead
            icon="🎬"
            title="Stream Manager"
            desc="Update your title and category, and run through your pre-stream checklist"
          />
        </div>

        <TwitchPanel categoryManagedByStatusForge={categoryManagedByStatusForge} />
        <KickPanel
          categoryManagedByStatusForge={categoryManagedByStatusForge}
          streamerbotHost={bc?.streamerbot_host || ""}
          streamerbotPort={bc?.streamerbot_port || ""}
          streamerbotKickAction={bc?.streamerbot_kick_action || ""}
        />
        <JoystickPanel />
        <ChecklistPanel />
      </div>
    </div>
  );
}
