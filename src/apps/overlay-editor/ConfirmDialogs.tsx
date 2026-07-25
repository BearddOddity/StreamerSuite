// Shared confirm/choice dialogs for Overlay Editor — same floating-card
// pattern (animate-float-backdrop/-card-in/-out) as General settings' adult-
// content confirm, reused here so a destructive delete or an ambiguous save
// always gets a deliberate choice instead of silently happening.

/** Saving over a pre-existing overlay is ambiguous — did you mean to change
 * it in place, or were you making a variant? Skipped entirely for a brand-
 * new overlay (nothing to overwrite yet), so it only ever interrupts the
 * one flow where silently picking wrong would be surprising. */
export function SaveChoiceDialog({
  onUpdate,
  onSaveAsNew,
  onCancel,
}: {
  onUpdate: () => void;
  onSaveAsNew: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 animate-float-backdrop"
      onClick={(e) => {
        e.stopPropagation();
        onCancel();
      }}
    >
      <div
        className="relative w-[440px] bg-black/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-6 animate-float-card-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">💾</span>
          <h3 className="text-white font-semibold text-sm">This overlay already exists</h3>
        </div>
        <p className="text-[12px] text-white/50 mb-5 leading-relaxed">
          Update it in place — the URL you've already pasted into OBS keeps working — or save these
          changes as a new variant instead, leaving the original untouched.
        </p>
        <div className="flex gap-2 justify-end flex-wrap">
          <button onClick={onCancel} className="btn-ghost text-[11px] px-3 py-1.5">
            Cancel
          </button>
          <button onClick={onSaveAsNew} className="btn-ghost text-[11px] px-3 py-1.5">
            ⎘ Save as New Variant
          </button>
          <button onClick={onUpdate} className="btn-cta text-[11px] px-3 py-1.5">
            Update Existing
          </button>
        </div>
      </div>
    </div>
  );
}

/** A filesystem delete has no undo (unlike in-canvas edits, which have a
 * real undo stack) — this is the one guard against a stray click losing
 * real work. */
export function DeleteConfirmDialog({
  name,
  onConfirm,
  onCancel,
}: {
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 animate-float-backdrop"
      onClick={(e) => {
        e.stopPropagation();
        onCancel();
      }}
    >
      <div
        className="relative w-[380px] bg-black/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-6 animate-float-card-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">🗑️</span>
          <h3 className="text-white font-semibold text-sm">Delete "{name}"?</h3>
        </div>
        <p className="text-[12px] text-white/50 mb-5 leading-relaxed">
          This removes the overlay file permanently — there's no undo. Any Browser Source URL pointing
          at it will stop working.
        </p>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="btn-ghost text-[11px] px-3 py-1.5">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="text-[11px] px-3 py-1.5 rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/10"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
