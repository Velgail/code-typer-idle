# Java compiler assets and corresponding source

These self-hosted tools compile Java source with OpenJDK javac, then translate its bytecode using TeaVM to Wasm GC. They are not a full JVM.

- TeaVM-javac revision **208d4c97a602ba0df055f16e6882059fb69d0122**.
- TeaVM **0.16.0**.
- OpenJDK javac source revision **6c48f4ed707bf0b15f9b6098de30db8aae6fa40f** from `openjdk/jdk25u`.
- Build host: OpenJDK **25.0.4.1**, Gradle **9.1.0**.

The compiler Wasm, Java SDK archive, and TeaVM class library are unchanged build outputs, compressed with gzip. The runtime JS is unchanged. `manifest.json` records packed and decoded hashes. The game loads only these local files and uses `strictMode:false` through the existing public API; no external compile server or CDN is used.

Corresponding source is included in `sources/`:

- `teavm-javac-source.tar.gz`: upstream source, actual build configuration, and generated compiler resources.
- `openjdk-javac-corresponding-source.tar.gz`: all OpenJDK source modules/resources used by this build, compiler build tools, and original GPL/Classpath/assembly/license information.
- `dependencies/`: exact published source JARs for the TeaVM, ASM, JZlib, and other build dependencies for which source artifacts were resolved. Their source copyright/license headers are also preserved as readable notices.

The OpenJDK compiler portions remain GPL-2.0-only WITH Classpath-exception-2.0. TeaVM/compiler adapter portions and other dependencies retain their own licenses; dependency notices and exact artifact hashes are in `runtime-assets/licenses/java/`. This separately loaded compiler is not relicensed under the game's Boost-1.0 license.

Build-only adjustments from upstream were necessary in the restricted build environment: remove the unavailable teavm.org Maven repository in favor of the already declared Maven Central/Plugin Portal, and add the missing Checkstyle catalog version `12.0.1`. Neither changes compiler logic. The adjusted files are in the source archive. To rebuild, extract the TeaVM-javac source, use JDK 25 and Gradle 9.1, and run `./gradlew :compiler:createDist`. The ordinary upstream build downloads the pinned full OpenJDK source. To use only the supplied corresponding-source archive instead, put its `openjdk-javac-sources/` contents at `javac/build/jdk/jdk25u-6c48f4ed707bf0b15f9b6098de30db8aae6fa40f/` and invoke `./gradlew :compiler:createDist -x :javac:downloadJDK -x :javac:unpackJDK`. All compiler modules, build-tool sources, and resource inputs used by those tasks are included. Maven dependencies are listed by version/hash in the license inventory. Then repack locally with `node scripts/vendor-cpp-java.mjs`; source-cache paths are recorded in the script.

Primary source locations:

- https://github.com/konsoletyper/teavm-javac/tree/208d4c97a602ba0df055f16e6882059fb69d0122
- https://github.com/openjdk/jdk25u/tree/6c48f4ed707bf0b15f9b6098de30db8aae6fa40f
- https://repo.maven.apache.org/maven2/org/teavm/

Known limits: TeaVM 0.16's strict bound-check insertion crashes while compiling an unreachable constant division by zero. The public `strictMode:false` option avoids that compiler pass and passes the tested arithmetic lesson subset. Java array-bound/exception behavior is still not equivalent to a JVM (the tested `ArrayIndexOutOfBoundsException` catch traps in both modes). Exercises requiring unsupported runtime semantics must not be presented as faithfully evaluated Java. Modern Wasm GC support is required; no SharedArrayBuffer or COOP/COEP headers are needed.
