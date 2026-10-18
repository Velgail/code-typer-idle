# C++ compiler assets

These are self-hosted source-compilation tools, not precompiled lesson answers.

- `browsercc` npm **0.1.1**, git revision `86168bacf0fe7c662e3e65a2e3006ceb159cd0dc`.
- Clang/LLD **20.1.2**, WASI SDK sysroot **25.0**.
- WASI SDK revision `ccdf52e17eec09577e7e25acef96c4d630bfb8d7`; its wasi-libc submodule is `574b88da481569b65a237cb80daf9a2d5aeaf82d`.
- `@bjorn3/browser_wasi_shim` **0.4.2**, git revision `4a55f2a519d0ddfa7e4609c42e0c9769c37c9ae8`.
- The optional 19 MB precompiled header is omitted.

`manifest.json` records packed and decoded SHA-256 values. npm integrity is verified by `scripts/vendor-cpp-java.mjs`. Vendor JS files and toolchain contents are unchanged; `.wasm` and `.tar` are deterministically gzip-compressed for static delivery. The game adapter uses the exported compiler/linker factories, caches compiled modules, and derives driver arguments once, avoiding the upstream convenience API's duplicate compiler fetches. No CDN is used at runtime.

Upstream compiler build source and instructions:

- https://github.com/BertalanD/browsercc/tree/86168bacf0fe7c662e3e65a2e3006ceb159cd0dc
- https://registry.npmjs.org/browsercc/-/browsercc-0.1.1.tgz
- https://github.com/WebAssembly/wasi-sdk/releases/tag/wasi-sdk-25
- https://github.com/bjorn3/browser_wasi_shim/tree/4a55f2a519d0ddfa7e4609c42e0c9769c37c9ae8

For a fresh upstream build, check out that browsercc revision and run its `npm run build` using Docker. Its build script pins LLVM and WASI SDK, but upstream's Dockerfile uses `emsdk latest`; the original npm build does not record that Emscripten version. The verified npm tarball is therefore the exact-byte source for these assets; a new toolchain rebuild is not claimed to be byte-identical.

Repack the verified research downloads using `node scripts/vendor-cpp-java.mjs`. This deliberately runs separately from the normal game build and fails if pinned npm integrity is different. Source cache locations are documented in that script.

Licenses are in `../../licenses/cpp/` relative to runtime-assets root (`runtime-assets/licenses/cpp/` in the repository). browsercc's MIT license applies to its wrapper. Compiler/linker/libc++/compiler-rt and WASI libc retain their original licenses, including Apache-2.0 WITH LLVM-exception and applicable MIT/BSD/CC0 notices. Emscripten and the WASI shim notices are also supplied. The game's Boost-1.0 license does not replace these third-party terms.

The WASI target does not provide C++ exceptions, threads, or arbitrary native OS APIs. The runner uses C++20 with exceptions disabled. Compilation and execution occur in a dedicated Worker; the game host enforces its deadline by terminating the Worker.
