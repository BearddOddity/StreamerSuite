import { useEffect, useState } from "react";
import { PlatformIcon } from "@/components/common/PlatformIcon";
import { useTwitchChannelInfo, useKickChannelInfo } from "./useChannelInfo";
import { useChecklist } from "./useChecklist";
import { openJoystickDashboard, JOYSTICK_DASHBOARD_URL } from "./joystickDashboard";

function TwitchPanel() {
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
    <section className="card-glass p-5 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <PlatformIcon platform="twitch" size="sm" />
        <h3 className="text-[13px] font-semibold text-white/80">Twitch</h3>
        {twitchSaved && <span className="text-[10px] text-green-400 ml-auto">Saved ✓</span>}
      </div>
      {twitchError ? (
        <p className="text-[11px] text-red-400/70">{twitchError}</p>
      ) : (
        <div className="space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Stream title"
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white/80 placeholder:text-white/25"
          />
          <input
            value={game}
            onChange={(e) => setGame(e.target.value)}
            placeholder="Category / game"
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white/80 placeholder:text-white/25"
          />
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Tags, comma separated (max 10)"
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white/80 placeholder:text-white/25"
          />
          <button
            onClick={() =>
              updateTwitch({
                title: title !== twitch?.title ? title : undefined,
                game_name: game !== twitch?.game_name ? game : undefined,
                tags: tags !== (twitch?.tags.join(", ") ?? "") ? tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
              })
            }
            disabled={twitchSaving || !twitch}
            className="px-4 py-2 rounded-lg text-[12px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/25 hover:bg-purple-500/25 transition-all disabled:opacity-40"
          >
            {twitchSaving ? "Saving…" : "Save to Twitch"}
          </button>
        </div>
      )}
    </section>
  );
}

function KickPanel() {
  const { kick, kickError, kickSaving, kickSaved, updateKick } = useKickChannelInfo();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");

  useEffect(() => {
    if (kick) {
      setTitle(kick.stream_title || "");
      setCategory(kick.category?.name || "");
    }
  }, [kick]);

  return (
    <section className="card-glass p-5 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <PlatformIcon platform="kick" size="sm" />
        <h3 className="text-[13px] font-semibold text-white/80">Kick</h3>
        {kickSaved && <span className="text-[10px] text-green-400 ml-auto">Saved ✓</span>}
      </div>
      {kickError ? (
        <p className="text-[11px] text-red-400/70">{kickError}</p>
      ) : (
        <div className="space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Stream title"
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white/80 placeholder:text-white/25"
          />
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Category"
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white/80 placeholder:text-white/25"
          />
          <button
            onClick={() =>
              updateKick({
                title: title !== (kick?.stream_title || "") ? title : undefined,
                category_name: category !== (kick?.category?.name || "") ? category : undefined,
              })
            }
            disabled={kickSaving || !kick}
            className="px-4 py-2 rounded-lg text-[12px] font-semibold bg-green-500/15 text-green-300 border border-green-500/25 hover:bg-green-500/25 transition-all disabled:opacity-40"
          >
            {kickSaving ? "Saving…" : "Save to Kick"}
          </button>
        </div>
      )}
    </section>
  );
}

function JoystickPanel() {
  return (
    <section className="card-glass p-5 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <PlatformIcon platform="joystick" size="sm" />
        <h3 className="text-[13px] font-semibold text-white/80">Joystick.tv</h3>
      </div>
      <p className="text-[11px] text-white/40 leading-relaxed mb-3">
        No verified public API exists for updating title/category on Joystick.tv. This opens{" "}
        <code className="text-white/50">{JOYSTICK_DASHBOARD_URL}</code> — a best-guess URL for their settings dashboard; let me know if
        it's wrong.
      </p>
      <button onClick={openJoystickDashboard} className="px-4 py-2 rounded-lg text-[12px] font-semibold btn-ghost">
        Open Joystick.tv Dashboard
      </button>
    </section>
  );
}

function ChecklistPanel() {
  const { items, toggle, addItem, removeItem, resetForNewStream, checkedCount } = useChecklist();
  const [draft, setDraft] = useState("");

  return (
    <section className="card-glass p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-semibold text-white/80">Pre-Stream Checklist</h3>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-white/30">
            {checkedCount}/{items.length}
          </span>
          <button onClick={resetForNewStream} className="text-[11px] text-white/40 hover:text-white/70">
            Reset for new stream
          </button>
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
          className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-1.5 text-[12px] text-white/80 placeholder:text-white/25"
        />
        <button
          onClick={() => {
            addItem(draft);
            setDraft("");
          }}
          className="px-3 py-1.5 rounded-lg text-[11px] btn-ghost"
        >
          Add
        </button>
      </div>
    </section>
  );
}

export default function StreamManagerApp() {
  return (
    <div className="h-full flex flex-col p-6 bg-[#050505] overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full">
        <div className="mb-6">
          <h2 className="text-[18px] font-bold text-white/90">Stream Manager</h2>
          <p className="text-[11px] text-white/30 mt-0.5">Update your title and category, and run through your pre-stream checklist</p>
        </div>

        <TwitchPanel />
        <KickPanel />
        <JoystickPanel />
        <ChecklistPanel />
      </div>
    </div>
  );
}
