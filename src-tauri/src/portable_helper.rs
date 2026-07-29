//! The two "helper" scripts bundled into every portable overlay export —
//! see Documentation/09-portable-overlay-export.md and
//! `overlay_manager::overlay_export_standalone`. Kept as real files under
//! `resources/portable_helper/` (not Rust string literals) since both
//! scripts' own source contains `"#` sequences that would otherwise fight
//! a raw-string literal's own delimiter, and because they're much easier
//! to read/edit as real `.py`/`.ps1` files than as escaped Rust strings.

pub(crate) const HELPER_PY: &str = include_str!("../resources/portable_helper/helper.py");
pub(crate) const HELPER_PS1: &str = include_str!("../resources/portable_helper/helper.ps1");
