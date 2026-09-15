"""Ek gida tarif kartlari icin duz (flat) illustrasyon ureticisi.

Kullanim:  python tools/generate-recipe-illustrations.py
Ciktilar:  assets/recipes/<slug>.jpg  (1200x900, JPEG)

Her tarif icin bir palet tanimlanir; gorseller tamamen kod ile uretilir,
disaridan telifli bir gorsel indirilmez.
"""

from __future__ import annotations

import math
import os
import random
from dataclasses import dataclass

from PIL import Image, ImageDraw, ImageFilter

WIDTH, HEIGHT = 1200, 900
SS = 3  # supersampling faktoru


def hex_to_rgb(value):
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def mix(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def shade(color, amount):
    """amount < 0 koyulastirir, > 0 acar."""
    target = (255, 255, 255) if amount > 0 else (26, 20, 24)
    return mix(color, target, abs(amount))


@dataclass
class Recipe:
    slug: str
    bg_top: str
    bg_bottom: str
    food: str
    chunks: list
    garnish: list
    vessel: str = "bowl"  # bowl | plate
    speckle: bool = True
    garnish_shape: str = "leaf"  # leaf | round | grain
    bowl_color: str = "#FFFFFF"
    seed: int = 7
    chunk_count: int = 16
    garnish_count: int = 9


def gradient_background(draw, top, bottom):
    for y in range(HEIGHT * SS):
        t = y / (HEIGHT * SS - 1)
        draw.line([(0, y), (WIDTH * SS, y)], fill=mix(top, bottom, t))


def soft_circle(base, cx, cy, r, color, blur=0.0, alpha=255):
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(color[0], color[1], color[2], alpha))
    if blur:
        layer = layer.filter(ImageFilter.GaussianBlur(blur))
    base.alpha_composite(layer)


def blob(draw, cx, cy, r, color, rng, wobble=0.18):
    points = []
    steps = 22
    offsets = [1 + rng.uniform(-wobble, wobble) for _ in range(steps)]
    for i in range(steps):
        angle = 2 * math.pi * i / steps
        rr = r * (offsets[i] * 0.6 + offsets[i - 1] * 0.2 + offsets[(i + 1) % steps] * 0.2)
        points.append((cx + math.cos(angle) * rr, cy + math.sin(angle) * rr))
    draw.polygon(points, fill=color)


def leaf(draw, cx, cy, size, angle, color):
    points = []
    for i in range(24):
        t = i / 23
        points.append(((t - 0.5) * 2 * size, math.sin(t * math.pi) * size * 0.46))
    for i in range(23, -1, -1):
        t = i / 23
        points.append(((t - 0.5) * 2 * size, -math.sin(t * math.pi) * size * 0.46))
    ca, sa = math.cos(angle), math.sin(angle)
    draw.polygon([(cx + x * ca - y * sa, cy + x * sa + y * ca) for x, y in points], fill=color)


def render(recipe, out_path):
    rng = random.Random(recipe.seed)
    canvas = Image.new("RGBA", (WIDTH * SS, HEIGHT * SS), (255, 255, 255, 255))
    draw = ImageDraw.Draw(canvas)
    gradient_background(draw, hex_to_rgb(recipe.bg_top), hex_to_rgb(recipe.bg_bottom))

    cx, cy = WIDTH * SS * 0.5, HEIGHT * SS * 0.52
    bg_bottom = hex_to_rgb(recipe.bg_bottom)

    for _ in range(3):
        soft_circle(
            canvas,
            rng.uniform(0, WIDTH * SS),
            rng.uniform(0, HEIGHT * SS),
            rng.uniform(150, 280) * SS,
            shade(bg_bottom, 0.45),
            blur=70 * SS,
            alpha=70,
        )

    mat_r = 340 * SS
    soft_circle(canvas, cx, cy, mat_r, shade(bg_bottom, -0.10), blur=2 * SS, alpha=70)
    soft_circle(canvas, cx, cy, mat_r * 0.995, shade(bg_bottom, 0.12), blur=2 * SS, alpha=120)

    bowl_r = (255 if recipe.vessel == "bowl" else 285) * SS
    soft_circle(canvas, cx, cy + 14 * SS, bowl_r * 1.02, shade(bg_bottom, -0.16), blur=20 * SS, alpha=120)

    bowl_color = hex_to_rgb(recipe.bowl_color)
    soft_circle(canvas, cx, cy, bowl_r, bowl_color)
    soft_circle(canvas, cx, cy, bowl_r * 0.93, shade(bowl_color, -0.06))
    soft_circle(canvas, cx, cy, bowl_r * 0.90, shade(bowl_color, 0.02))

    food = hex_to_rgb(recipe.food)
    food_r = bowl_r * (0.80 if recipe.vessel == "bowl" else 0.74)
    soft_circle(canvas, cx, cy, food_r, food)
    soft_circle(canvas, cx - food_r * 0.22, cy - food_r * 0.24, food_r * 0.72, shade(food, 0.10), blur=30 * SS, alpha=150)
    soft_circle(canvas, cx + food_r * 0.26, cy + food_r * 0.28, food_r * 0.62, shade(food, -0.12), blur=34 * SS, alpha=120)

    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ldraw = ImageDraw.Draw(layer)
    chunks = [hex_to_rgb(c) for c in recipe.chunks]
    for i in range(recipe.chunk_count):
        angle = rng.uniform(0, 2 * math.pi)
        dist = food_r * math.sqrt(rng.uniform(0.02, 0.80))
        px, py = cx + math.cos(angle) * dist, cy + math.sin(angle) * dist
        color = chunks[i % len(chunks)]
        size = food_r * rng.uniform(0.07, 0.13)
        blob(ldraw, px, py, size, shade(color, -0.10) + (255,), rng)
        blob(ldraw, px - size * 0.12, py - size * 0.14, size * 0.78, color + (255,), rng)
    canvas.alpha_composite(layer)

    if recipe.speckle:
        spec = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        sdraw = ImageDraw.Draw(spec)
        for _ in range(130):
            angle = rng.uniform(0, 2 * math.pi)
            dist = food_r * math.sqrt(rng.uniform(0, 0.93))
            px, py = cx + math.cos(angle) * dist, cy + math.sin(angle) * dist
            r = rng.uniform(2.0, 5.0) * SS
            tone = shade(food, rng.choice([-0.16, 0.16]))
            sdraw.ellipse([px - r, py - r, px + r, py + r], fill=tone + (120,))
        canvas.alpha_composite(spec)

    ring = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    rdraw = ImageDraw.Draw(ring)
    rdraw.arc(
        [cx - bowl_r * 0.965, cy - bowl_r * 0.965, cx + bowl_r * 0.965, cy + bowl_r * 0.965],
        start=185,
        end=305,
        fill=(255, 255, 255, 190),
        width=int(7 * SS),
    )
    canvas.alpha_composite(ring.filter(ImageFilter.GaussianBlur(3 * SS)))

    gdraw = ImageDraw.Draw(canvas)
    garnish = [hex_to_rgb(g) for g in recipe.garnish]
    for i in range(recipe.garnish_count):
        angle = (2 * math.pi * i / recipe.garnish_count) + rng.uniform(-0.28, 0.28)
        dist = bowl_r * rng.uniform(1.16, 1.38)
        px, py = cx + math.cos(angle) * dist, cy + math.sin(angle) * dist * 0.88
        if not (60 * SS < px < (WIDTH - 60) * SS and 60 * SS < py < (HEIGHT - 60) * SS):
            continue
        color = garnish[i % len(garnish)]
        size = rng.uniform(38, 58) * SS
        rot = rng.uniform(0, math.pi)
        if recipe.garnish_shape == "leaf":
            leaf(gdraw, px, py, size, rot, color)
            leaf(gdraw, px, py, size * 0.55, rot, shade(color, -0.12))
        elif recipe.garnish_shape == "grain":
            leaf(gdraw, px, py, size * 0.56, rot, color)
        else:
            gdraw.ellipse([px - size * 0.6, py - size * 0.6, px + size * 0.6, py + size * 0.6], fill=color)
            gdraw.ellipse(
                [px - size * 0.24, py - size * 0.34, px + size * 0.06, py - size * 0.04],
                fill=shade(color, 0.28),
            )


    out = canvas.convert("RGB").resize((WIDTH, HEIGHT), Image.LANCZOS)
    out = out.filter(ImageFilter.SMOOTH)
    out.save(out_path, "JPEG", quality=88, optimize=True, progressive=True)


RECIPES = [
    Recipe("havuclu-patates-puresi", "#FFF6EC", "#FFE3C7", "#F2A455", ["#F6BE72", "#FFD9A3"], ["#F2A455", "#7FB77E"], seed=11),
    Recipe("firinda-elma-puresi", "#FFF7F2", "#FCE0D6", "#E8B58A", ["#F2CBA4", "#D99A6C"], ["#D96A6A", "#7FB77E"], garnish_shape="round", seed=12),
    Recipe("tahinli-muz-ezmesi", "#FFFCF0", "#F6EBCF", "#EFD9A3", ["#F7E9C2", "#D9B87A"], ["#E9D08A", "#C99B5B"], garnish_shape="grain", seed=13),
    Recipe("ispanakli-patates-ezmesi", "#F4FAF2", "#DCEEDA", "#8FB98A", ["#6E9E6B", "#C7DBBF"], ["#5F9257", "#8FB98A"], seed=14),
    Recipe("yesil-fasulyeli-pirinc-puresi", "#F6FAF4", "#E2EEDD", "#CFD9B4", ["#8FAE63", "#EDEAD6"], ["#7FA04F", "#B9CE96"], seed=15),
    Recipe("tavuklu-bulgur-ezmesi", "#FBF5EC", "#EFE0CB", "#D8B98B", ["#B98E5E", "#E7D2AE", "#C4703F"], ["#C4703F", "#7FB77E"], garnish_shape="grain", seed=16),
    Recipe("bebek-yayla-corbasi", "#F8FBF7", "#E6EFE6", "#F3F1E6", ["#E9E6D5", "#CFE0C4"], ["#6F9E63", "#CFE0C4"], seed=17),
    Recipe("firinda-somon-sebze", "#FFF6F3", "#FBDCD2", "#EFAE8C", ["#E98B63", "#F7CDB3", "#8FB98A"], ["#E98B63", "#7FB77E"], seed=18),
    Recipe("sebzeli-omlet-muffin", "#FFFBF0", "#F7E9C8", "#F4CE6A", ["#F0B93F", "#7FB77E", "#E4744F"], ["#7FB77E", "#F0B93F"], vessel="plate", seed=19),
    Recipe("bebek-humusu", "#FBF8F0", "#EFE6D2", "#E5D4A8", ["#D8C08A", "#F1E7CB"], ["#C08A4A", "#7FB77E"], garnish_shape="round", seed=20),
    Recipe("somonlu-bezelyeli-risotto", "#FDF7F4", "#F2E3DB", "#F0E7D6", ["#E98B63", "#7FB05F", "#EFE3C9"], ["#7FB05F", "#E98B63"], garnish_shape="round", seed=21),
    Recipe("firinda-sebzeli-kofte", "#FCF5EE", "#EEDFCD", "#C98A5E", ["#A9663D", "#E0B98C", "#8FB98A"], ["#8FB98A", "#C4703F"], vessel="plate", seed=22),
    Recipe("mercimekli-sebze-soslu-makarna", "#FFF7F0", "#F7DFCE", "#EBDCC0", ["#D9603F", "#E8A15C", "#7FB05F"], ["#D9603F", "#7FB05F"], garnish_shape="round", seed=23),
    Recipe("aile-sofrasi-tavuklu-guvec", "#FDF6EE", "#F0DFC9", "#DDA765", ["#BE7B44", "#EBCB9C", "#8FB98A"], ["#8FB98A", "#C4703F"], seed=24),
    Recipe("ispanakli-peynirli-krep", "#F7FAF4", "#E4EDDC", "#E9D9A8", ["#6F9E63", "#F5EBD2"], ["#6F9E63", "#D9C58A"], vessel="plate", seed=25),
    Recipe("meyveli-yulaf-kahvalti-kasesi", "#FFF8FA", "#F6E2E9", "#EEE3D2", ["#C95B7A", "#6E86C4", "#E2C89A"], ["#C95B7A", "#6E86C4"], garnish_shape="round", seed=26),
    Recipe("ev-yapimi-tarhana-corbasi", "#FFF6F1", "#F6DDD0", "#C96A4A", ["#A94F36", "#E09A74"], ["#C96A4A", "#7FB77E"], garnish_shape="grain", seed=27),
]


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out_dir = os.path.join(root, "assets", "recipes")
    os.makedirs(out_dir, exist_ok=True)
    for recipe in RECIPES:
        path = os.path.join(out_dir, recipe.slug + ".jpg")
        render(recipe, path)
        print("yazildi:", os.path.relpath(path, root))


if __name__ == "__main__":
    main()
