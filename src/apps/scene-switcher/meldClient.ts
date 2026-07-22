// Minimal client for Meld Studio's WebChannel API (a Qt QWebChannel server at
// ws://127.0.0.1:13376, unauthenticated, local-only). This is an original,
// from-scratch implementation of just the subset of the protocol Scene
// Switcher needs (init handshake, method invocation, property read + live
// updates) — written against Qt's protocol spec
// (qtwebchannel/src/webchannel/qwebchannel.js), not a copy of Qt's own
// (L)GPL-licensed client library.
//
// Wire protocol (QWebChannelMessageTypes): signal=1, propertyUpdate=2,
// init=3, idle=4, debug=5, invokeMethod=6, connectToSignal=7,
// disconnectFromSignal=8, setProperty=9, response=10.

const MSG = {
  signal: 1,
  propertyUpdate: 2,
  init: 3,
  idle: 4,
  invokeMethod: 6,
  connectToSignal: 7,
  setProperty: 9,
  response: 10,
} as const;

type MethodEntry = [string, number]; // [name, index]
type PropertyEntry = [number, string, [string, number] | 0 | undefined, unknown]; // [index, name, notifySignal, initialValue]
type SignalEntry = [string, number]; // [name, index]

interface ObjectMeta {
  methods: MethodEntry[];
  properties: PropertyEntry[];
  signals: SignalEntry[];
}

export class MeldClient {
  private ws: WebSocket | null = null;
  private nextId = 0;
  private callbacks = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private meta: ObjectMeta | null = null;
  private propertyValues = new Map<number, unknown>();
  private propertyNameToIndex = new Map<string, number>();
  private signalIndexToName = new Map<number, string>();
  private updateListeners = new Set<() => void>();

  connect(url = "ws://127.0.0.1:13376"): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;
      let settled = false;

      ws.onopen = async () => {
        try {
          const data = await this.exec<Record<string, ObjectMeta>>({ type: MSG.init });
          const meldMeta = data.meld;
          if (!meldMeta) throw new Error("Meld's WebChannel init response had no 'meld' object");
          this.meta = meldMeta;
          for (const [index, name, , initialValue] of meldMeta.properties) {
            this.propertyValues.set(index, initialValue);
            this.propertyNameToIndex.set(name, index);
          }
          for (const [name, index] of meldMeta.signals) {
            this.signalIndexToName.set(index, name);
          }
          this.send({ type: MSG.idle });
          settled = true;
          resolve();
        } catch (e) {
          settled = true;
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      };

      ws.onmessage = (ev) => {
        let msg: { type: number; id?: number; data?: unknown; object?: string; signal?: number; args?: unknown[] };
        try {
          msg = JSON.parse(ev.data as string);
        } catch {
          return;
        }
        if (msg.type === MSG.response && msg.id !== undefined) {
          const cb = this.callbacks.get(msg.id);
          if (cb) {
            this.callbacks.delete(msg.id);
            cb.resolve(msg.data);
          }
        } else if (msg.type === MSG.propertyUpdate) {
          const updates = msg.data as { object: string; properties: Record<number, unknown> }[];
          for (const u of updates) {
            for (const [idx, value] of Object.entries(u.properties)) {
              this.propertyValues.set(Number(idx), value);
            }
          }
          this.send({ type: MSG.idle });
          this.updateListeners.forEach((fn) => fn());
        } else if (msg.type === MSG.signal) {
          // Session/stream/record signals all ride in as propertyUpdate for
          // their paired property in practice, but notify listeners either way.
          this.updateListeners.forEach((fn) => fn());
        }
      };

      ws.onerror = () => {
        if (!settled) {
          settled = true;
          reject(new Error("couldn't connect to Meld Studio — is it running with the API enabled?"));
        }
      };

      ws.onclose = () => {
        this.callbacks.forEach((cb) => cb.reject(new Error("connection to Meld Studio closed")));
        this.callbacks.clear();
        if (!settled) {
          settled = true;
          reject(new Error("connection to Meld Studio closed before it was ready"));
        }
        this.updateListeners.forEach((fn) => fn());
      };
    });
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.meta !== null;
  }

  onUpdate(fn: () => void): () => void {
    this.updateListeners.add(fn);
    return () => this.updateListeners.delete(fn);
  }

  getProperty<T>(name: string): T | undefined {
    const idx = this.propertyNameToIndex.get(name);
    if (idx === undefined) return undefined;
    return this.propertyValues.get(idx) as T | undefined;
  }

  async invoke<T = unknown>(methodName: string, ...args: unknown[]): Promise<T> {
    if (!this.meta) throw new Error("not connected to Meld Studio");
    // Same resolution rule as Qt's qwebchannel.js: a fully-qualified overload
    // signature (ends in ')') is invoked by index; a plain name is invoked by
    // name and resolved server-side.
    const entry = this.meta.methods.find(([name]) => name === methodName || name.startsWith(`${methodName}(`));
    if (!entry) throw new Error(`Meld has no method "${methodName}"`);
    const [name, index] = entry;
    const method = name.endsWith(")") ? index : name;
    return this.exec<T>({ type: MSG.invokeMethod, object: "meld", method, args });
  }

  setProperty(name: string, value: unknown): void {
    const idx = this.propertyNameToIndex.get(name);
    if (idx === undefined) throw new Error(`Meld has no property "${name}"`);
    this.propertyValues.set(idx, value);
    this.send({ type: MSG.setProperty, object: "meld", property: idx, value });
  }

  connectSignal(signalName: string): void {
    const entry = this.meta?.signals.find(([name]) => name === signalName);
    if (!entry) return;
    this.send({ type: MSG.connectToSignal, object: "meld", signal: entry[1] });
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
    this.meta = null;
  }

  private send(data: Record<string, unknown>): void {
    this.ws?.send(JSON.stringify(data));
  }

  private exec<T>(data: Record<string, unknown>): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.callbacks.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.send({ ...data, id });
    });
  }
}
