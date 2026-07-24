#!/usr/bin/env python3
"""Pull each vendored tool's streamersuite-integration branch into this repo.

See VENDORING.md for the pattern this implements: every tool under
src/apps/ (aside from the launcher/settings shell itself) is developed as
its own standalone Tauri app in its own repo. This script fetches each
repo's `streamersuite-integration` branch (never `main` — see VENDORING.md's
branch policy) and copies the listed files into place here.

Usage:
    python3 scripts/sync-vendored-tools.py                 # sync everything
    python3 scripts/sync-vendored-tools.py notes-commands   # sync one tool
    python3 scripts/sync-vendored-tools.py --check          # dry run, report diffs only

Requires `git` on PATH. Clones each repo shallow (--depth 1, single branch)
into a temp directory and cleans up after itself.
"""
import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
BRANCH = "streamersuite-integration"
GITHUB_OWNER = "BearddOddity"

# Files present in a tool repo's streamersuite-integration branch that only
# make sense for that repo's own standalone build (app entry points, test
# files) and must never be copied into StreamerSuite's src/apps/ tree.
DIR_EXCLUDES = {"main.tsx", "preview.html", "vite-env.d.ts"}

# Files that live in StreamerSuite's src/apps/<tool>/ tree but are never
# sourced from the vendored repo (e.g. the app-registry entry point) — a
# directory sync must never delete these, even though they won't exist in
# the freshly-cloned source and so would otherwise look "extra" in a diff.
DIR_PRESERVE = {"index.ts"}


def _is_excluded(path: Path) -> bool:
    return path.name in DIR_EXCLUDES or path.name.endswith((".test.ts", ".test.tsx"))


# Each entry: repo name -> list of (path in the tool repo, path in StreamerSuite)
# relative to each repo's root.
MANIFEST: dict[str, list[tuple[str, str]]] = {
    "StatusForge.io": [
        ("src", "src/apps/statusforge"),
    ],
    "multichat": [
        ("ui/index.html", "public/multichat/index.html"),
        ("ui/multichat.js", "public/multichat/multichat.js"),
        ("src-tauri/src/lib.rs", "src-tauri/src/multichat.rs"),
    ],
    "notes-commands": [
        ("src/App.tsx", "src/apps/notes-commands/App.tsx"),
        ("src/index.ts", "src/apps/notes-commands/index.ts"),
    ],
    "stream-timer": [
        ("src/App.tsx", "src/apps/stream-timer/App.tsx"),
        ("src/index.ts", "src/apps/stream-timer/index.ts"),
    ],
    "sound-board": [
        ("src/App.tsx", "src/apps/sound-board/App.tsx"),
        ("src/index.ts", "src/apps/sound-board/index.ts"),
        ("src/types.ts", "src/apps/sound-board/types.ts"),
        ("src/useSoundBoard.ts", "src/apps/sound-board/useSoundBoard.ts"),
    ],
    "scene-switcher": [
        ("src/App.tsx", "src/apps/scene-switcher/App.tsx"),
        ("src/index.ts", "src/apps/scene-switcher/index.ts"),
        ("src/meldClient.ts", "src/apps/scene-switcher/meldClient.ts"),
        ("src/useMeldConnection.ts", "src/apps/scene-switcher/useMeldConnection.ts"),
        ("src/types.ts", "src/apps/scene-switcher/types.ts"),
    ],
    "stream-manager": [
        ("src/App.tsx", "src/apps/stream-manager/App.tsx"),
        ("src/index.ts", "src/apps/stream-manager/index.ts"),
        ("src/types.ts", "src/apps/stream-manager/types.ts"),
        ("src/useChannelInfo.ts", "src/apps/stream-manager/useChannelInfo.ts"),
        ("src/useChecklist.ts", "src/apps/stream-manager/useChecklist.ts"),
        ("src/joystickDashboard.ts", "src/apps/stream-manager/joystickDashboard.ts"),
        ("src-tauri/src/stream_manager.rs", "src-tauri/src/stream_manager.rs"),
    ],
    "stream-stats": [
        ("src/App.tsx", "src/apps/stream-stats/App.tsx"),
        ("src/index.ts", "src/apps/stream-stats/index.ts"),
        ("src/types.ts", "src/apps/stream-stats/types.ts"),
        ("src/useStreamStats.ts", "src/apps/stream-stats/useStreamStats.ts"),
        ("src/joystickReporting.ts", "src/apps/stream-stats/joystickReporting.ts"),
    ],
    "alerts-hub": [
        ("src/App.tsx", "src/apps/alerts-hub/App.tsx"),
        ("src/SettingsPanel.tsx", "src/apps/alerts-hub/SettingsPanel.tsx"),
        ("src/index.ts", "src/apps/alerts-hub/index.ts"),
        ("src/types.ts", "src/apps/alerts-hub/types.ts"),
        ("src/useAlertsFeed.ts", "src/apps/alerts-hub/useAlertsFeed.ts"),
        ("src/useAlertsSettings.ts", "src/apps/alerts-hub/useAlertsSettings.ts"),
        ("src-tauri/src/alerts.rs", "src-tauri/src/alerts.rs"),
    ],
    "overlay-library": [
        ("src/App.tsx", "src/apps/overlay-library/App.tsx"),
        ("src/OverlayMaker.tsx", "src/apps/overlay-library/OverlayMaker.tsx"),
        ("src/index.ts", "src/apps/overlay-library/index.ts"),
        ("src/types.ts", "src/apps/overlay-library/types.ts"),
        ("src/useLiveSources.ts", "src/apps/overlay-library/useLiveSources.ts"),
        ("src/useOverlays.ts", "src/apps/overlay-library/useOverlays.ts"),
        ("src-tauri/src/overlay_manager.rs", "src-tauri/src/overlay_manager.rs"),
    ],
}


def clone(repo: str, dest: Path) -> None:
    url = f"https://github.com/{GITHUB_OWNER}/{repo}"
    subprocess.run(
        ["git", "clone", "--depth", "1", "--branch", BRANCH, "--single-branch", url, str(dest)],
        check=True,
    )


def sync_one(repo: str, entries: list[tuple[str, str]], check: bool) -> bool:
    changed = False
    with tempfile.TemporaryDirectory(prefix=f"sync-{repo}-") as tmp:
        tmp_path = Path(tmp)
        try:
            clone(repo, tmp_path)
        except subprocess.CalledProcessError:
            print(f"  ! failed to clone {repo}@{BRANCH} — skipping", file=sys.stderr)
            return False

        for src_rel, dst_rel in entries:
            src = tmp_path / src_rel
            dst = REPO_ROOT / dst_rel
            if not src.exists():
                print(f"  ! {repo}: {src_rel} not found in {BRANCH} branch", file=sys.stderr)
                continue

            if src.is_dir():
                # Copy into a filtered staging dir first so both --check's
                # diff and the real copy see the same excluded-file view.
                with tempfile.TemporaryDirectory(prefix="sync-staging-") as staging:
                    staged_src = Path(staging) / "src"
                    shutil.copytree(
                        src, staged_src,
                        ignore=lambda d, names: [n for n in names if _is_excluded(Path(d) / n)],
                    )
                    if check:
                        result = subprocess.run(
                            ["diff", "-rq", str(staged_src), str(dst)]
                            + [arg for name in DIR_PRESERVE for arg in ("-x", name)],
                            capture_output=True, text=True,
                        )
                        if result.stdout.strip():
                            changed = True
                            print(f"  ~ {dst_rel}/ differs:")
                            for line in result.stdout.strip().splitlines():
                                print(f"      {line}")
                    else:
                        # Merge rather than replace: dst may hold files that
                        # are never sourced from the repo (see DIR_PRESERVE)
                        # and must survive a sync.
                        dst.mkdir(parents=True, exist_ok=True)
                        shutil.copytree(staged_src, dst, dirs_exist_ok=True)
                        print(f"  synced {dst_rel}/")
            else:
                if check:
                    if not dst.exists() or src.read_bytes() != dst.read_bytes():
                        changed = True
                        print(f"  ~ {dst_rel} differs")
                else:
                    dst.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(src, dst)
                    print(f"  synced {dst_rel}")
    return changed


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("tools", nargs="*", help="Specific repo name(s) to sync (default: all)")
    parser.add_argument("--check", action="store_true", help="Report differences without writing anything")
    args = parser.parse_args()

    targets = args.tools or list(MANIFEST.keys())
    unknown = [t for t in targets if t not in MANIFEST]
    if unknown:
        print(f"Unknown tool(s): {', '.join(unknown)}", file=sys.stderr)
        print(f"Known: {', '.join(MANIFEST.keys())}", file=sys.stderr)
        return 1

    any_changed = False
    for repo in targets:
        print(f"{repo} ({BRANCH}):")
        changed = sync_one(repo, MANIFEST[repo], args.check)
        any_changed = any_changed or changed

    if args.check:
        if any_changed:
            print("\nDifferences found — run without --check to apply.")
            return 1
        print("\nEverything in sync.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
