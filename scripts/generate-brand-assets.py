#!/usr/bin/env python3
"""Regenerate So, When? brand assets from Quicksand Bold.

The mark is a white "S" with a coral comma on teal ("S,"). The wordmark
("So, When?") appears only where there is room to read it: the feature
graphic. Requires Pillow: python3 -m pip install pillow
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / 'assets'
FONT_PATH = ROOT / 'node_modules/@expo-google-fonts/quicksand/700Bold/Quicksand_700Bold.ttf'
TEAL = (20, 122, 120, 255)
CORAL = (242, 140, 120, 255)
INK = (42, 44, 49, 255)
MUTED = (107, 114, 128, 255)
CANVAS = (250, 248, 245, 255)
WHITE = (255, 255, 255, 255)
CLEAR = (0, 0, 0, 0)


def load_font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_PATH), size=size)


def draw_mark(size: int, bg, s_color, comma_color, scale: float = 1.0) -> Image.Image:
    """The "S," mark centered on a square. scale=1.0 fills a full-bleed icon;
    smaller values keep it inside Android's adaptive-icon safe zone."""
    img = Image.new('RGBA', (size, size), bg)
    draw = ImageDraw.Draw(img)
    font = load_font(int(size * 0.6 * scale))
    gap = size * 0.03 * scale
    sb = draw.textbbox((0, 0), 'S', font=font)
    cb = draw.textbbox((0, 0), ',', font=font)
    s_w = sb[2] - sb[0]
    s_h = sb[3] - sb[1]
    total_w = s_w + gap + (cb[2] - cb[0])
    # Center the pair horizontally and the S vertically; the comma hangs
    # below the baseline the way it does in text.
    x = (size - total_w) / 2 - sb[0]
    y = (size - s_h) / 2 - sb[1] - size * 0.02 * scale
    draw.text((x, y), 'S', font=font, fill=s_color)
    draw.text((x + sb[0] + s_w + gap - cb[0], y), ',', font=font, fill=comma_color)
    return img


def rounded(img: Image.Image, radius_ratio: float = 0.22) -> Image.Image:
    mask = Image.new('L', img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, img.size[0] - 1, img.size[1] - 1),
        radius=int(img.size[0] * radius_ratio),
        fill=255,
    )
    out = Image.new('RGBA', img.size, CLEAR)
    out.paste(img, (0, 0), mask)
    return out


def on_canvas(img: Image.Image, size: int, tile: int) -> Image.Image:
    """Center a rounded tile of `tile` px on a CANVAS square of `size` px."""
    out = Image.new('RGBA', (size, size), CANVAS)
    small = rounded(img).resize((tile, tile), Image.Resampling.LANCZOS)
    offset = (size - tile) // 2
    out.paste(small, (offset, offset), small)
    return out


def save(img: Image.Image, name: str, size: int | None = None, rgb: bool = False):
    out = img.resize((size, size), Image.Resampling.LANCZOS) if size else img
    if rgb:
        out = out.convert('RGB')
    out.save(ASSETS / name, 'PNG')
    print(f'wrote assets/{name}')


def feature_graphic() -> Image.Image:
    feat = Image.new('RGBA', (1024, 500), CANVAS)
    draw = ImageDraw.Draw(feat)
    tile = rounded(draw_mark(1024, TEAL, WHITE, CORAL)).resize(
        (220, 220), Image.Resampling.LANCZOS
    )
    feat.paste(tile, (120, 140), tile)

    left = 120 + 220 + 64
    title = load_font(92)
    so_box = draw.textbbox((0, 0), 'So, ', font=title)
    draw.text((left, 150 - so_box[1]), 'So, ', font=title, fill=TEAL)
    draw.text((left + so_box[2] - so_box[0], 150 - so_box[1]), 'When?', font=title, fill=INK)

    body = load_font(30)
    for i, line in enumerate(['Turn “we should catch up”', 'into an actual plan.']):
        box = draw.textbbox((0, 0), line, font=body)
        draw.text((left, 268 + i * 42 - box[1]), line, font=body, fill=INK)

    footer = load_font(22)
    box = draw.textbbox((0, 0), 'Palari Labs, Inc.', font=footer)
    draw.text((left, 400 - box[1]), 'Palari Labs, Inc.', font=footer, fill=MUTED)
    return feat


def main():
    ASSETS.mkdir(exist_ok=True)
    full = draw_mark(1024, TEAL, WHITE, CORAL)

    # Launcher + store: full-bleed square; the OS / Play applies its own mask.
    save(full, 'icon.png', rgb=True)
    save(full, 'store-icon-512.png', size=512, rgb=True)

    # Android adaptive icon: mark inside the 66% safe zone over solid teal.
    save(draw_mark(1024, CLEAR, WHITE, CORAL, scale=0.78), 'android-icon-foreground.png')
    save(Image.new('RGBA', (1024, 1024), TEAL), 'android-icon-background.png')
    save(draw_mark(1024, CLEAR, (0, 0, 0, 255), (0, 0, 0, 255), scale=0.78), 'android-icon-monochrome.png')

    # Status-bar notification icon: Android uses alpha only, so white on clear.
    save(draw_mark(384, CLEAR, WHITE, WHITE, scale=1.1), 'notification-icon.png', size=96)

    # Splash (shown on the canvas background from app.json) and web favicon.
    save(on_canvas(full, 1024, 640), 'splash-icon.png')
    save(rounded(full), 'favicon.png', size=48)

    save(feature_graphic(), 'store-feature-graphic.png', rgb=True)
    print('done')


if __name__ == '__main__':
    main()
