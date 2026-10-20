"""Buttery-yellow duckling (art/reference/duck drawing.jpeg)."""

import math

from common import (Frame, blob, ellipse, empty, export_glb, material, mix, render_previews, reset_scene, rgb,
                    smoothstep, stats, stud, tube)

FEATHER = rgb("#fbd56f")
PALE = rgb("#fbe6a6")
ORANGE = rgb("#f4a25a")
ORANGE_DARK = rgb("#ec8f45")
BLUSH = rgb("#f4abb0")
EYE = "#121216"

reset_scene()
gloss = material("gloss", roughness=0.12, specular=0.6)
satin = material("satin", roughness=0.35, specular=0.5)
root = empty("duck")

# ------------------------------------------------------------------ head
HEAD = Frame((0, -0.01, 0.81), (0.335, 0.31, 0.3))


def head_shape(p):
    # Egg-ish: a touch narrower at the crown, fuller at the cheeks.
    x, y, z = p
    k = 1 + 0.05 * max(0.0, -z) - 0.06 * max(0.0, z)
    return (x * k, y * k, z * (1.06 if z > 0 else 0.95))


def head_color(co, n):
    u, v, w = HEAD.uvw(co)
    return mix(FEATHER, BLUSH, 0.75 * ellipse(abs(u), v, 0.6, -0.33, 0.15, 0.1, 0.6) * smoothstep(0.2, 0.5, w))


head = empty("head", (0, 0.0, 0.53), root)
skull = blob("head_mesh", HEAD.r, HEAD.c, head, cuts=26, shape=head_shape, color=head_color)

eyes = empty("eyes", (0, -0.29, 0.77), head)
for side in (-1, 1):
    eye = stud(f"eye_{side}", skull, side * 0.172, 0.77, (0.042, 0.05, 0.032), eyes, sink=0.35, color=EYE, mat=gloss)
    stud(f"shine_{side}", eye, side * 0.172 + 0.013, 0.785, (0.013, 0.013, 0.007), eyes, sink=0.2, color="#ffffff", mat=gloss)

# Bill: a broad upper half with a gentle upturn, and a lower half for the smile.
blob("bill_top", (0.16, 0.13, 0.05), (0, -0.36, 0.685), head, cuts=12, mat=satin, rot=(-0.12, 0, 0),
     color=lambda co, n: mix(ORANGE, ORANGE_DARK, smoothstep(0.3, -0.6, n.z)),
     shape=lambda p: (p[0] * (1 + 0.12 * p[1] * 0 + 0.1 * max(0.0, -p[1])), p[1], p[2] + 0.25 * p[0] * p[0] * (1 if p[2] > 0 else 0.5)))
blob("bill_bottom", (0.13, 0.11, 0.04), (0, -0.345, 0.65), head, cuts=10, mat=satin, rot=(0.08, 0, 0), color="#ec8f45")

# ------------------------------------------------------------------ body (egg-shaped, paler belly)
BODY = Frame((0, 0.03, 0.33), (0.23, 0.25, 0.215))


def body_color(co, n):
    u, v, w = BODY.uvw(co)
    return mix(FEATHER, PALE, ellipse(u, v, 0, -0.25, 0.68, 0.85, 0.3) * smoothstep(0.2, 0.6, w))


body = empty("body", BODY.c, root)
blob("body_mesh", BODY.r, BODY.c, body, cuts=20, color=body_color,
     shape=lambda p: (p[0] * (1 + 0.08 * max(0.0, -p[2])), p[1] * (1 + 0.06 * max(0.0, -p[2])), p[2]))

# Little wings held against the sides, with a scalloped trailing edge.
for side in (-1, 1):
    def wing_shape(p):
        x, y, z = p
        scallop = 1 + 0.06 * math.cos(8 * math.atan2(z, y)) * smoothstep(0.3, 1.0, y)
        return (x, y * scallop, z * scallop)

    blob(f"wing_{'l' if side > 0 else 'r'}", (0.05, 0.13, 0.12), (side * 0.205, 0.04, 0.37), body, cuts=10,
         rot=(0.5, side * -0.15, 0), shape=wing_shape, color=lambda co, n: FEATHER)

# ------------------------------------------------------------------ tail tuft, flicked up
tail = empty("tail", (0, 0.25, 0.4), root)
blob("tail_mesh", (0.07, 0.11, 0.06), (0, 0.32, 0.45), tail, cuts=8, rot=(0.7, 0, 0), color=lambda co, n: FEATHER,
     shape=lambda p: (p[0] * (1 - 0.6 * max(0.0, p[1])), p[1], p[2] * (1 - 0.5 * max(0.0, p[1]))))

# ------------------------------------------------------------------ legs and webbed feet
HIPS = [(0.085, 0.0, 0.15), (-0.085, 0.0, 0.15)]
for i, (x, y, z) in enumerate(HIPS):
    leg = empty(f"leg{i}", (x, y, z), root)
    tube(f"leg{i}_mesh", [(x, y, z), (x, y, 0.03)], [0.026, 0.024], leg, ring=10, color=lambda co, n: ORANGE)
    blob(f"foot{i}", (0.075, 0.1, 0.02), (x + (0.01 if x > 0 else -0.01), y - 0.05, 0.02), leg, cuts=8, mat=satin,
         color=lambda co, n: ORANGE,
         shape=lambda p: (p[0] * (1 + 0.35 * max(0.0, -p[1])) * (1 + 0.08 * math.cos(3 * math.pi * p[0]) * max(0.0, -p[1])), p[1], p[2]))

# ------------------------------------------------------------------ scarf
scarf = empty("scarf", (0, 0.0, 0.53), root)
scarf.scale = (0.19, 0.18, 0.19)
scarf.rotation_euler = (math.radians(4), 0, 0)

preview = render_previews("duck")
result = {"preview": preview, **stats(root)}
if globals().get("EXPORT", True):
    result["glb"] = export_glb(root, "duck")
