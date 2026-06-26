# Plugin/App Registry Pattern — Research Notes

## Current Implementation

StreamerSuite uses a simple but effective **app registry pattern** for its sub-applications:

```typescript
// src/apps/registry.ts
export interface AppDefinition {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: "chat" | "tools" | "alerts" | "media" | "utilities";
  component: ComponentType;
  featured?: boolean;
}
```

Apps register themselves via `registerApp()` and are retrieved via `getApps()`, `getApp(id)`, `getFeaturedApps()`, and `getAppsByCategory()`.

## Current Sub-Apps

| App | ID | Category | Purpose |
|-----|----|----------|---------|
| Alerts Hub | `alerts-hub` | alerts | Real-time follower/sub/raid notifications |
| Chat Confluence | `chat-confluence` | chat | Multi-platform chat aggregation |
| Notes & Commands | `notes-commands` | utilities | Stream notes, chat commands |
| Scene Switcher | `scene-switcher` | tools | OBS scene control |
| Sound Board | `sound-board` | media | Audio clip playback |
| Status Forge | `statusforge` | utilities | Stream title/game/status management |
| Stream Stats | `stream-stats` | utilities | Viewer count, uptime, etc. |
| Stream Timer | `stream-timer` | utilities | Countdown/stopwatch overlays |

## Registry Pattern Evolution

### Phase 1: Static Registry (Current)
- Apps are hardcoded in the registry
- Simple, no dynamic loading
- All apps bundled together

### Phase 2: Dynamic Registration
- Apps register at import time via side effects
- Each app folder has an `index.ts` that calls `registerApp()`
- Vite/Rollup tree-shaking removes unused apps

```typescript
// src/apps/chat-confluence/index.ts
import { registerApp } from '../registry';
import ChatConfluence from './ChatConfluence';

registerApp({
  id: 'chat-confluence',
  name: 'Chat Confluence',
  icon: 'MessageSquare',
  description: 'Unified multi-platform chat',
  category: 'chat',
  component: ChatConfluence,
  featured: true,
});
```

### Phase 3: Plugin System (Future)
- External plugins loaded at runtime
- Plugin manifest (JSON) describing the plugin
- Sandboxed execution (iframe or WebWorker)
- Plugin API surface for controlled access

## App Shell Architecture

The shell (`src/shell/`) manages:
- **AppShell.tsx**: Main layout with sidebar + content area
- **Launcher.tsx**: App launcher/grid view
- **TopBar.tsx**: Global controls (settings, minimize, etc.)

### State Management Options

| Approach | Pros | Cons |
|----------|------|------|
| React Context | Simple, built-in | Re-renders on every change |
| Zustand | Lightweight, performant | Additional dependency |
| Jotai | Atomic, composable | Learning curve |
| Tauri State (Rust) | Survives frontend crashes | More complex IPC |

### Recommended: Zustand + Tauri Commands
- Zustand for UI state (active app, sidebar collapsed, etc.)
- Tauri commands for persistent state (settings, auth tokens, app configs)
- Each sub-app manages its own internal state

## App Communication

### Inter-App Communication Patterns

1. **Event Bus**: Apps publish/subscribe to events
   ```typescript
   // alerts-hub publishes
   eventBus.emit('new-follower', { user: 'name', platform: 'twitch' });
   
   // stream-stats subscribes
   eventBus.on('new-follower', (data) => updateFollowerCount());
   ```

2. **Shared State**: Zustand store with slices per app
   ```typescript
   const useStore = create((set) => ({
     chat: { messages: [], connected: false },
     stats: { viewers: 0, followers: 0 },
     alerts: { queue: [] },
   }));
   ```

3. **Tauri Commands**: For backend-mediated communication
   ```rust
   #[tauri::command]
   async fn broadcast_event(event: AppEvent) {
       // Forward to all listening apps
   }
   ```

## Settings & Configuration

### Per-App Settings Pattern
```typescript
interface AppSettings {
  [appId: string]: Record<string, unknown>;
}

// Example: chat-confluence settings
{
  "chat-confluence": {
    "channels": ["oddtower"],
    "platforms": ["twitch", "discord"],
    "showTimestamps": true,
    "fontSize": 14,
    "theme": "dark"
  }
}
```

### Settings Storage
- **Tauri**: Use `tauri-plugin-store` or `tauri-plugin-fs`
- Store as JSON in app config directory:
  - Windows: `%APPDATA%/com.streamersuite.app/`
  - macOS: `~/Library/Application Support/com.streamersuite.app/`
  - Linux: `~/.config/com.streamersuite.app/`

## App Lifecycle

```
┌─────────────┐
│  Registered  │  ← App calls registerApp()
└──────┬──────┘
       │
┌──────▼──────┐
│   Loaded     │  ← Component imported (lazy or eager)
└──────┬──────┘
       │
┌──────▼──────┐
│   Mounted    │  ← User navigates to app, React mounts component
└──────┬──────┘
       │
┌──────▼──────┐
│   Active     │  ← App is visible and receiving updates
└──────┬──────┘
       │
┌──────▼──────┐
│   Unmounted  │  ← User navigates away, cleanup subscriptions
└─────────────┘
```

### Lazy Loading with React
```typescript
const ChatConfluence = lazy(() => import('@/apps/chat-confluence'));
const SceneSwitcher = lazy(() => import('@/apps/scene-switcher'));

// In shell:
<Suspense fallback={<Loading />}>
  <ActiveApp />
</Suspense>
```

## Category System

Current categories:
- **chat**: Chat-related apps
- **tools**: Streaming production tools
- **alerts**: Notification/alert systems
- **media**: Audio/video tools
- **utilities**: General utilities

### Future Categories
- **overlays**: Browser-source overlays
- **integrations**: Third-party service integrations
- **analytics**: Statistics and analytics

## References
- React Lazy/Suspense: https://react.dev/reference/react/lazy
- Zustand: https://zustand-demo.pmnd.rs/
- Tauri Plugin Store: https://v2.tauri.app/plugin/store/
- Micro-frontends pattern: https://micro-frontends.org/
- Electron plugin architecture (reference): https://www.electronjs.org/docs/latest/tutorial/plans
