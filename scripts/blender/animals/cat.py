"""Orange tabby kitten (art/reference/cat drawing.jpeg)."""

import math

from common import (Frame, blob, curve_on_face, ellipse, empty, export_glb, material, mix, render_previews,
                    reset_scene, rgb, smoothstep, stats, stud, tube)

FUR = rgb("#f0a868")
STRIPE = rgb("#e08850")
CREAM = rgb("#f5e3c3")
PINK = rgb("#f0a0a8")
BLUSH = rgb("#f5a0a8")
EYE = "#1e1416"
NOSE = "#f2a0aa"
MOUTH = "#c26a6a"

reset_scene()
gloss = material("gloss", roughness=0.12, specular=0.6)
root = empty("cat")

# ------------------------------------------------------------------ head
HEAD = Frame((0, -0.06, 0.74), (0.38, 0.33, 0.315))


def head_shape(p):
    # Wider, fuller cheeks low down; flatter top and bottom (a mochi shape).
    x, y, z = p
    x *= 1 + 0.07 * max(0.0, -z) - 0.04 * max(0.0, z)
    z = z * (0.94 if z > 0 else 0.98)
    return (x, y, z)


def head_color(co, n):
    u, v, w = HEAD.uvw(co)
    c = FUR
    # Forehead stripes: three soft bands from the crown down.
    for su in (-0.3, 0.0, 0.3):
        width = 0.075 * (1.15 - 0.5 * max(0.0, 0.85 - v))
        band = 1 - smoothstep(width * 0.7, width * 1.3, abs(u - su))
        c = mix(c, STRIPE, band * smoothstep(0.38, 0.55, v) * smoothstep(-0.2, 0.3, w))
    # Cheek stripes at the sides of the face, and two on the side of the head.
    for sv in (-0.05, -0.32):
        c = mix(c, STRIPE, ellipse(abs(u), v, 0.98, sv, 0.12, 0.06, 0.4) * smoothstep(-0.3, 0.2, w))
    for sv in (0.08, -0.2):
        c = mix(c, STRIPE, ellipse(w, v, -0.15, sv, 0.4, 0.085, 0.3) * smoothstep(0.5, 0.7, abs(u)))
    # Cream muzzle and chin.
    muzzle = ellipse(u, v, 0, -0.62, 0.42, 0.66, 0.12) * smoothstep(-0.1, 0.35, w)
    c = mix(c, CREAM, muzzle)
    # Blush.
    c = mix(c, BLUSH, 0.8 * ellipse(abs(u), v, 0.6, -0.38, 0.17, 0.11, 0.6) * smoothstep(0.2, 0.5, w))
    return c


head = empty("head", (0, -0.06, 0.48), root)
skull = blob("head_mesh", HEAD.r, HEAD.c, head, cuts=26, shape=head_shape, color=head_color)

# Ears: rounded triangles, pink inside.
def ear_shape(p):
    # A rounded triangle: wide at the base, a soft point at the top, thin front to back.
    x, y, z = p
    t = (z + 1) / 2
    return (x * (1 - 0.72 * t ** 1.15), y * (0.68 - 0.3 * t), z)


def ear_color(p, n):
    x, y, z = p
    t = (z + 1) / 2
    inner = (1 - smoothstep(0.62, 0.78, abs(x) / max(0.05, 1 - 0.8 * t))) * smoothstep(0.12, 0.3, t) * smoothstep(0.85, 0.7, t)
    return mix(FUR, PINK, inner * smoothstep(-0.1, -0.45, y))


for side in (-1, 1):
    blob(f"ear_{'l' if side > 0 else 'r'}", (0.15, 0.12, 0.17), (side * 0.225, -0.05, 0.99), head, cuts=10,
         shape=ear_shape, rot=(0, side * -0.4, 0), ucolor=ear_color)

# Face.
eyes = empty("eyes", (0, -0.4, 0.69), head)
for side in (-1, 1):
    eye = stud(f"eye_{side}", skull, side * 0.172, 0.69, (0.056, 0.064, 0.04), eyes, sink=0.35, color=EYE, mat=gloss)
    stud(f"shine_{side}", eye, side * 0.172 + 0.016, 0.708, (0.015, 0.015, 0.008), eyes, sink=0.2, color="#ffffff", mat=gloss)
stud("nose", skull, 0, 0.648, (0.028, 0.019, 0.02), head, sink=0.3, color=NOSE, mat=gloss,
     shape=lambda p: (p[0] * (1 + 0.35 * p[1]), p[1], p[2]))
curve_on_face("mouth", skull, [(-0.06, 0.626), (-0.032, 0.608), (-0.004, 0.62), (0, 0.628), (0.004, 0.62), (0.032, 0.608), (0.06, 0.626)],
              0.0055, head, color=MOUTH)

# ------------------------------------------------------------------ body
BODY = Frame((0, 0.1, 0.29), (0.215, 0.3, 0.215))


def body_color(co, n):
    u, v, w = BODY.uvw(co)
    c = FUR
    c = mix(c, CREAM, ellipse(u, v, 0, -0.1, 0.55, 1.0, 0.15) * smoothstep(0.35, 0.6, w))
    c = mix(c, CREAM, smoothstep(-0.55, -0.8, v) * 0.85)  # paler belly underneath
    # Back stripes across the rump.
    for sw in (-0.15, -0.45):
        band = 1 - smoothstep(0.06, 0.09, abs(w - sw))
        c = mix(c, STRIPE, band * smoothstep(0.05, 0.45, v))
    return c


body = empty("body", BODY.c, root)
blob("body_mesh", BODY.r, BODY.c, body, cuts=18, shape=lambda p: (p[0] * (1 + 0.08 * max(0.0, -p[2])), p[1], p[2]),
     color=body_color)

# ------------------------------------------------------------------ legs (front-left, front-right, back-left, back-right)
HIPS = [(0.105, -0.04, 0.2), (-0.105, -0.04, 0.2), (0.105, 0.27, 0.2), (-0.105, 0.27, 0.2)]
for i, (x, y, z) in enumerate(HIPS):
    leg = empty(f"leg{i}", (x, y, z), root)
    tube(f"leg{i}_mesh", [(x, y, z + 0.03), (x, y, 0.12), (x, y - 0.015, 0.075)], [0.078, 0.075, 0.08], leg,
         color=lambda co, n: FUR)

# ------------------------------------------------------------------ tail (an S curving up and over)
tail = empty("tail", (0, 0.37, 0.4), root)
tube("tail_mesh", [(0, 0.36, 0.4), (0, 0.48, 0.48), (0, 0.5, 0.64), (0, 0.48, 0.78), (0, 0.56, 0.86), (0, 0.63, 0.86)],
     [0.042, 0.042, 0.043, 0.045, 0.047, 0.047], tail, samples=40, color=lambda co, n: FUR)

# ------------------------------------------------------------------ scarf (the app draws it in the player's colour)
scarf = empty("scarf", (0, -0.02, 0.5), root)
scarf.scale = (0.19, 0.17, 0.19)
scarf.rotation_euler = (math.radians(6), 0, 0)

preview = render_previews("cat")
result = {"preview": preview, **stats(root)}
if globals().get("EXPORT", True):
    result["glb"] = export_glb(root, "cat")
