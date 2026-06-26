import { registerApp } from "../registry";
import NotesCommandsApp from "./App";

registerApp({
  id: "notes-commands",
  name: "Notes & Commands",
  icon: "📝",
  description: "Quick stream notes and chat command reference. Keep your !socials, !discord, and reminders handy.",
  category: "utilities",
  component: NotesCommandsApp,
});
