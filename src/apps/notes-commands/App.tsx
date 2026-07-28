import { useState } from "react";
import "../../design-system/styles.css";
import { Badge, Button, Card, Chip, SectionHead } from "../../design-system/components/core";
import { EmptyState } from "../../design-system/components/feedback";

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
    <div className="h-full flex flex-col p-6 overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full">
        {/* Header */}
        <div className="mb-6">
          <SectionHead icon="📝" title="Notes & Commands" desc="Stream notes and chat command reference" />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(["notes", "commands"] as const).map((tab) => (
            <Chip key={tab} selected={activeTab === tab} onClick={() => setActiveTab(tab)}>
              {tab === "notes" ? "📝 Stream Notes" : "⌨️ Chat Commands"}
            </Chip>
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
              <Button variant="cta" onClick={addNote}>
                + Add
              </Button>
            </div>

            {/* Notes list */}
            <div className="space-y-2">
              {notes.length === 0 ? (
                <Card padding={0}>
                  <EmptyState icon="📝" title="No notes yet" description="Add a stream note above to keep track of things during your broadcast." />
                </Card>
              ) : (
                notes.map((note) => (
                  <Card key={note.id} padding={12} className="flex items-start gap-3 group">
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-white/60">{note.content}</p>
                      <p className="text-[9px] text-white/15 mt-1">{new Date(note.timestamp).toLocaleString()}</p>
                    </div>
                    <button onClick={() => deleteNote(note.id)}
                      className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded text-red-400/40 hover:text-red-400/80 text-xs transition-all shrink-0">
                      ✕
                    </button>
                  </Card>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            {/* Commands list */}
            <div className="space-y-2">
              {commands.map((cmd) => (
                <Card key={cmd.trigger} padding={16} className={`transition-all ${cmd.enabled ? "" : "opacity-50"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <code className="text-[12px] font-mono font-semibold text-[var(--accent-system)]">{cmd.trigger}</code>
                    <button onClick={() => toggleCommand(cmd.trigger)}>
                      <Badge variant={cmd.enabled ? "green" : "ghost"}>{cmd.enabled ? "ON" : "OFF"}</Badge>
                    </button>
                  </div>
                  <p className="text-[11px] text-white/35">{cmd.response}</p>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
