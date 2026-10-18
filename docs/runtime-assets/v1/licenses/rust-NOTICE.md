# Rust browser runner

The Code Typer Idle adapter and `rust/source/driver.js` are original code under
Boost Software License 1.0. The driver uses the MIT-licensed in-memory WASI shim
vendored from **Rubri**, commit
`00de75bcec3d8cf5156aef2382c738cbfe069986`:
https://github.com/LyonSyonII/rubri/tree/00de75bcec3d8cf5156aef2382c738cbfe069986 .
Its original license, including the upstream placeholder copyright text, is
preserved verbatim in `rust-rubri-MIT.txt`.

The Miri WASM binary and matching sysroot libraries come from that pinned
Rubri distribution's `example/public/wasm-rustc/`. The compiler identifies itself
as **rustc 1.78.0-dev**, host **wasm32-wasi**, **Cranelift 0.104.1**, with unknown
compiler commit hash/date. We preserve that provenance rather than claiming an
official release build. Raw and compressed checksums are listed in
`rust/source/UPSTREAM.json` and `rust/manifest.json`.

Rust and Miri use MIT OR Apache-2.0. Rust's MIT and Apache license texts and the
Rust 1.78 source distribution's third-party copyright notices are preserved in
`rust-MIT.txt`, `rust-Apache-2.0.txt` and `rust-COPYRIGHT.txt`. The Cranelift
backend's Apache-2.0-with-LLVM-exception text is preserved separately in
`rust-Cranelift-LICENSE.txt`.

Reproduction: `node scripts/vendor-rust-go.mjs --rust-only`; integrity check:
`node scripts/vendor-rust-go.mjs --verify`. The compiler/sysroot are downloaded
from the pinned source distribution and checked before compression. The WASI
shim's source and the original driver are bundled with pinned esbuild 0.25.5.
All build caches are below `work/`. The resulting runner, binary and libraries
are served by this application; no evaluation service or external CDN is used.

Rust source is parsed and type/borrow checked by the real rustc frontend, then
executed as MIR by Miri. It does not produce a native executable. The matching
sysroot is required. The driver accepts complete source including its test main
and does not wrap it inside another function. Each evaluation gets a fresh
in-memory source/temporary filesystem and new WASM instance. Library files are
read-only. No browser filesystem is mounted. A surrounding Worker supplies time
limits; stdout/stderr each have a 64 KiB limit and report truncation.

This is a fixed, older experimental toolchain: arbitrary Cargo dependencies,
procedural macro crates, native FFI/OS integration, Rust 2024 and newer language
features are outside the supported scope. Rubri's Miri configuration disables
additional dynamic UB checks; it must not be represented as a full unsafe-code
validator. Panics/unwinding have upstream limitations. Third-party components
retain their own licenses and are not relicensed under the game's Boost license.
