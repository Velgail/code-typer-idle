# Go browser interpreter

The game adapter and `runtime-assets/go/source/main.go` are original Code Typer
Idle code under Boost Software License 1.0. They do not copy the unlicensed Go
playground samples used during feasibility research.

The interpreter is Traefik Yaegi **v0.16.1**, distributed under Apache License
2.0. Source: https://github.com/traefik/yaegi/tree/v0.16.1 . Its unmodified license
is preserved in `go-yaegi-Apache-2.0.txt`. The module checksum is recorded in
`go/source/go.sum`.

The WASM binary is rebuilt from that module and the original adapter using the
official Go **1.25.5** toolchain. The Go runtime and `wasm_exec.js` retain the Go
Authors' BSD license, preserved in `go-BSD-3-Clause.txt`.

Reproduction: `node scripts/vendor-rust-go.mjs --go-only`; integrity check:
`node scripts/vendor-rust-go.mjs --verify`. `CTI_GO` may select an installed Go
1.25.5 executable. The automatic toolchain download targets Linux amd64 and is
verified against its fixed SHA-256. All caches are below `work/`.

The student interpreter exposes only selected memory-only functions from fmt,
math, strings, sort, strconv, errors and unicode/utf8. It does not register net,
os, syscall, unsafe, reflect or syscall/js. The wrapper's own syscall/js bridge
is compiled into the host program and is not exported to student Go imports.
Source package imports use an empty filesystem. Input is empty. Execution time
is controlled by terminating the enclosing Web Worker. Output is capped at
64 KiB per stream and reports truncation.

The source is interpreted using real Go parsing/type checks; this is not the
official Go compiler. cgo, arbitrary modules, OS APIs and complete compatibility
with the latest Go specification are outside this runner's supported scope.
Third-party components retain their own licenses; they are not relicensed under
the game's Boost license.
