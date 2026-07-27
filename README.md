# YifuMusic

YifuMusic is an independent, cross-platform, local-first music player with a
priority on macOS.

## Product principles

- Local-first operation
- Offline availability
- Stable playback
- Clear permission boundaries
- A deeply customizable visual experience

## Technology

YifuMusic is built with React, TypeScript, Tauri v2, Rust, and SQLite.

## Development

Run the following commands from the repository root unless noted otherwise:

```bash
vp env use
vp install
vp check
vp run tauri dev
cd src-tauri && cargo test
cd ..
vp run tauri build
```

The current baseline covers the local desktop player. Online services, lyrics,
MV playback, PWA support, plugins, character themes, and a MoeKoeMusic-style
layout are not part of the current implementation.

## License and upstream acknowledgement

YifuMusic is a modification of [Museeks](https://github.com/martpie/museeks).
It retains the MIT license, the root [LICENSE](LICENSE), and the upstream
acknowledgement in [NOTICE.md](NOTICE.md).
