#!/bin/bash
# Build a Flatpak with a unique name associated with the current arch of the machine used.

if [ ! -f ./package.json ]; then
    echo "You should run YifuMusic scripts from the project root directory, exiting..."
    exit 1
fi

arch=$(uname -m)

# Build
flatpak-builder --force-clean --user --disable-cache --repo release/flatpak-repo release/flatpak src-tauri/release/com.yifulin114514143.yifumusic.yaml

# Bundle
flatpak build-bundle release/flatpak-repo release/yifumusic.flatpak com.yifulin114514143.yifumusic

# Lint
flatpak run --command=flatpak-builder-lint org.flatpak.Builder manifest src-tauri/release/com.yifulin114514143.yifumusic.yaml && flatpak run --command=flatpak-builder-lint org.flatpak.Builder repo release/flatpak-repo --exceptions --user-exceptions src-tauri/release/flatpak.exceptions.json

# Rename binary so it has a unique name
mv release/yifumusic.flatpak release/yifumusic-${arch}.flatpak
