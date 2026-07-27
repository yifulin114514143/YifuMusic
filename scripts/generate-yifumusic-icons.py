#!/usr/bin/python3
"""Generate the YifuMusic icon assets from the checked-in character artwork.

The macOS system Python includes Pillow in this development environment. The
script uses ``iconutil`` for ICNS creation and Pillow for every PNG and ICO.
It intentionally has no network access or external-image inputs.
"""

from __future__ import annotations

from pathlib import Path
import subprocess
import tempfile

from PIL import Image, ImageDraw


REPOSITORY_ROOT = Path(__file__).resolve().parent.parent
SOURCE_IMAGE = (
    REPOSITORY_ROOT
    / "src/assets/branding/yifumusic-character-icon-source.jpeg"
)
SOURCE_SIZE = (1980, 1980)

# This square keeps the character's head and upper shoulders prominent while
# placing the eye line a little above the icon's visual center.
SOURCE_CROP = (160, 50, 1820, 1710)
MASTER_SIZE = 1024
CONTAINER_INSET = 64
CONTAINER_RADIUS = 232
RENDER_SCALE = 4
ICO_SIZES = (16, 24, 32, 48, 64, 96, 128, 256)
ICNS_SIZES = (16, 32, 128, 256, 512)

PNG_OUTPUTS = {
    Path("src-tauri/icons/32x32.png"): 32,
    Path("src-tauri/icons/128x128.png"): 128,
    Path("src-tauri/icons/128x128@2x.png"): 256,
    Path("src-tauri/icons/Square30x30Logo.png"): 30,
    Path("src-tauri/icons/Square44x44Logo.png"): 44,
    Path("src-tauri/icons/Square71x71Logo.png"): 71,
    Path("src-tauri/icons/Square89x89Logo.png"): 89,
    Path("src-tauri/icons/Square107x107Logo.png"): 107,
    Path("src-tauri/icons/Square142x142Logo.png"): 142,
    Path("src-tauri/icons/Square150x150Logo.png"): 150,
    Path("src-tauri/icons/Square284x284Logo.png"): 284,
    Path("src-tauri/icons/Square310x310Logo.png"): 310,
    Path("src-tauri/icons/StoreLogo.png"): 50,
    Path("src-tauri/icons/app-icon.png"): 1024,
    Path("src-tauri/icons/app-icon-with-margins.png"): 1024,
    Path("src-tauri/icons/icon.png"): 512,
    Path("src/assets/logos/yifumusic-32.png"): 32,
    Path("src/assets/logos/yifumusic-32@2x.png"): 64,
    Path("src/assets/logos/yifumusic-48.png"): 48,
    Path("src/assets/logos/yifumusic-48@2x.png"): 96,
    Path("src/assets/logos/yifumusic-64.png"): 64,
    Path("src/assets/logos/yifumusic-64@2x.png"): 128,
    Path("src/assets/logos/yifumusic-128.png"): 128,
    Path("src/assets/logos/yifumusic-128@2x.png"): 256,
    Path("src/assets/logos/yifumusic.png"): 256,
    Path("src/assets/logos/yifumusic-tray.png"): 96,
    Path("src/assets/logos/yifumusic-tray-dark.png"): 24,
    Path("src/assets/logos/yifumusic-tray-dark@2x.png"): 48,
}

ICO_OUTPUTS = (
    Path("src-tauri/icons/icon.ico"),
    Path("src/assets/logos/yifumusic.ico"),
    Path("src/assets/logos/yifumusic-tray.ico"),
)

ICNS_OUTPUTS = (
    Path("src-tauri/icons/icon.icns"),
    Path("src/assets/logos/yifumusic.icns"),
)

CORE_PNGS = (
    Path("src-tauri/icons/icon.png"),
    Path("src-tauri/icons/app-icon.png"),
    Path("src/assets/logos/yifumusic.png"),
)


def render_size(master: Image.Image, size: int) -> Image.Image:
    return master.resize((size, size), Image.Resampling.LANCZOS)


def build_master() -> Image.Image:
    with Image.open(SOURCE_IMAGE) as image:
        if image.size != SOURCE_SIZE:
            raise ValueError(
                f"Expected {SOURCE_IMAGE} to be {SOURCE_SIZE}, got {image.size}."
            )
        crop = image.convert("RGB").crop(SOURCE_CROP)

    working_size = MASTER_SIZE * RENDER_SCALE
    inset = CONTAINER_INSET * RENDER_SCALE
    container_size = working_size - (inset * 2)
    radius = CONTAINER_RADIUS * RENDER_SCALE

    content = crop.resize(
        (container_size, container_size), Image.Resampling.LANCZOS
    )
    canvas = Image.new("RGBA", (working_size, working_size), (0, 0, 0, 0))
    canvas.paste(content, (inset, inset))

    mask = Image.new("L", (working_size, working_size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (inset, inset, inset + container_size, inset + container_size),
        radius=radius,
        fill=255,
    )
    canvas.putalpha(mask)
    return canvas.resize((MASTER_SIZE, MASTER_SIZE), Image.Resampling.LANCZOS)


def save_png(master: Image.Image, relative_path: Path, size: int) -> None:
    output = REPOSITORY_ROOT / relative_path
    output.parent.mkdir(parents=True, exist_ok=True)
    render_size(master, size).save(output, format="PNG")


def save_ico(master: Image.Image, relative_path: Path) -> None:
    output = REPOSITORY_ROOT / relative_path
    output.parent.mkdir(parents=True, exist_ok=True)
    master.save(
        output,
        format="ICO",
        sizes=[(size, size) for size in ICO_SIZES],
    )


def save_icns(master: Image.Image, relative_path: Path) -> None:
    output = REPOSITORY_ROOT / relative_path
    output.parent.mkdir(parents=True, exist_ok=True)
    output.unlink(missing_ok=True)

    with tempfile.TemporaryDirectory(prefix="yifumusic-icon-") as temporary_dir:
        iconset = Path(temporary_dir) / "YifuMusic.iconset"
        iconset.mkdir()
        for size in ICNS_SIZES:
            render_size(master, size).save(
                iconset / f"icon_{size}x{size}.png", format="PNG"
            )
            render_size(master, size * 2).save(
                iconset / f"icon_{size}x{size}@2x.png", format="PNG"
            )

        subprocess.run(
            ["/usr/bin/iconutil", "-c", "icns", "-o", str(output), str(iconset)],
            check=True,
        )


def verify_core_pngs() -> None:
    for relative_path in CORE_PNGS:
        output = REPOSITORY_ROOT / relative_path
        with Image.open(output) as image:
            rgba = image.convert("RGBA")
            width, height = rgba.size
            corners = (
                rgba.getpixel((0, 0)),
                rgba.getpixel((width - 1, 0)),
                rgba.getpixel((0, height - 1)),
                rgba.getpixel((width - 1, height - 1)),
            )
            has_alpha = "A" in image.getbands()

        print(
            f"{relative_path}: {width}x{height}; hasAlpha={has_alpha}; "
            f"cornerRGBA={corners}"
        )
        if not has_alpha or any(corner[3] != 0 for corner in corners):
            raise RuntimeError(f"Transparent-corner verification failed for {relative_path}.")


def main() -> None:
    if not SOURCE_IMAGE.is_file():
        raise FileNotFoundError(f"Missing icon source image: {SOURCE_IMAGE}")

    master = build_master()
    for relative_path, size in PNG_OUTPUTS.items():
        save_png(master, relative_path, size)
    for relative_path in ICO_OUTPUTS:
        save_ico(master, relative_path)
    for relative_path in ICNS_OUTPUTS:
        save_icns(master, relative_path)
    verify_core_pngs()


if __name__ == "__main__":
    main()
