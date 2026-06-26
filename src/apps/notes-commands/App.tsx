import { useState } from "react";

interface Note {
  id: string;
  content: string;
  timestamp: number;
}

interface Command {
  trigger: string;
  response: string;
  enabled: boolean;
}

const defaultCommands: Command[] = [
  { trigger: "!socials", response: "Follow me on Twitter @streamer and Instagram @streamer", enabled: true },
  { trigger: "!discord", response: "Join our Discord: discord.gg/yourserver", enabled: true },
  { trigger: "!specs", response: "CPU: Ryzen 7 7800X3D | GPU: RTX 4080 | RAM: 32GB DDR5", enabled: true },
  { trigger: "!schedule", response: "Streaming Mon/Wed/Fri at 7PM EST!", enabled: true },
  { trigger: "!donate", response: "Support the stream: streamelements.com/yourchannel/tip", enabled: false },
];

export default function NotesCommandsApp() {
  const [activeTab, setActiveTab] = useState<"notes" | "commands">("notes");
  const [notes, setNotes] = useState<Note[]>([
    { id: "1", content: "Remember to check audio levels before going live", timestamp: Date.now() - 3600000 },
    { id: "2", content: "New overlay design — test with chat tonight", timestamp: Date.now() - 7200000 },
  ]);
  const [newNote, setNewNote] = useState("");
  const [commands, setCommands] = useState<Command[]>(defaultCommands);

  const addNote = () => {
    if (!newNote.trim()) return;
    setNotes((prev) => [{ id: `${Date.now()}`, content: newNote.trim(), timestamp: Date.now() }, ...prev]);
    setNewNote("");
  };

  const deleteNote = (id: string) => setNotes((prev) => prev.filter((n) => n.id !== id));

  const toggleCommand = (trigger: string) => {
    setCommands((prev) => prev.map((c) => c.trigger === trigger ? { ...c, enabled: !c.enabled } : c));
  };

  return (
    <div className="h-full flex flex-col p-6 bg-[#050505] overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-[18px] font-bold text-white/90">Notes & Commands</h2>
            <p className="text-[11px] text-white/30 mt-0.5">Stream notes and chat command reference</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(["notes", "commands"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${
                activeTab === tab
                  ? "toggle-active"
                  : "bg-white/[0.03] text-white/30 border-white/[0.06] hover:text-white/50"
              }`}>
              {tab === "notes" ? "📝 Stream Notes" : "⌨️ Chat Commands"}
            </button>
          ))}
        </div>

        {activeTab === "notes" ? (
          <>
            {/* Add note */}
            <div className="flex gap-2 mb-4">
              <input type="text" value={newNote} onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addNote()}
                placeholder="Add a stream note..."
                className="flex-1 input-glass" />
              <button onClick={addNote}
                className="btn-cta">
                + Add
              </button>
            </div>

            {/* Notes list */}
            <div className="space-y-2">
              {notes.length === 0 ? (
                <div className="text-center py-8 text-white/20 text-sm">No notes yet</div>
              ) : (
                notes.map((note) => (
                  <div key={note.id} className="flex items-start gap-3 surface-glass p-3 group">
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-white/60">{note.content}</p>
                      <p className="text-[9px] text-white/15 mt-1">{new Date(note.timestamp).toLocaleString()}</p>
                    </div>
                    <button onClick={() => deleteNote(note.id)}
                      className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded text-red-400/40 hover:text-red-400/80 text-xs transition-all shrink-0">
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            {/* Commands list */}
            <div className="space-y-2">
              {commands.map((cmd) => (
                <div key={cmd.trigger} className={`surface-glass p-4 transition-all ${
                  cmd.enabled ? "" : "opacity-50"
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <code className="text-[12px] font-mono font-semibold text-[var(--accent-system)]">{cmd.trigger}</code>
                    <button onClick={() => toggleCommand(cmd.trigger)}
                      className={`text-[10px] px-2 py-0.5 rounded-md font-semibold transition-all ${
                        cmd.enabled ? "bg-green-500/10 text-green-400/60" : "bg-white/[0.04] text-white/20"
                      }`}>
                      {cmd.enabled ? "ON" : "OFF"}
                    </button>
                  </div>
                  <p className="text-[11px] text-white/35">{cmd.response}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
