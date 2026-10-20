"""Mint baby turtle with a domed hexagon shell (art/reference/turtle drawing.jpeg)."""

import math

from common import (Frame, blob, curve_on_face, ellipse, empty, export_glb, material, mix, render_previews,
                    reset_scene, rgb, smoothstep, stats, stud, tube)
from mathutils import Vector

SKIN = rgb("#a8dcc5")
SHELL = rgb("#4c8f48")
PLATE = rgb("#68a85c")
CREAM = rgb("#f1e8cc")
BLUSH = rgb("#f2a9b4")
EYE = "#121216"

reset_scene()
gloss = material("gloss", roughness=0.12, specular=0.6)
root = empty("turtle")

# ------------------------------------------------------------------ shell (the "body": breathes)
SHELL_C = (0, 0.18, 0.24)
body = empty("body", SHELL_C, root)

# Plate centres on the dome (unit sphere): one on top, a ring of five, a ring of ten.
PLATES = [Vector((0, 0, 1))]
for k in range(5):
    a = k / 5 * 2 * math.pi + math.pi / 5
    PLATES.append(Vector((math.sin(a) * 0.72, math.cos(a) * 0.72, 0.69)).normalized())
for k in range(10):
    a = k / 10 * 2 * math.pi
    PLATES.append(Vector((math.sin(a), math.cos(a), 0.3)).normalized())


def shell_color(p, n):
    if p.z < 0.02:
        return SHELL
    d = sorted((p - c).length for c in PLATES)
    gap = d[1] - d[0]
    return mix(SHELL, PLATE, smoothstep(0.07, 0.13, gap) * smoothstep(0.02, 0.15, p.z))


blob("shell", (0.37, 0.4, 0.52), SHELL_C, body, cuts=30, ucolor=shell_color,
     shape=lambda p: (p[0], p[1], p[2] if p[2] > 0 else p[2] * 0.2))
# Cream rim round the bottom, and the belly plate under it.
blob("rim", (0.405, 0.435, 0.085), (0, 0.18, 0.22), body, cuts=18, color="#f1e8cc")

# ------------------------------------------------------------------ head on a neck
HEAD = Frame((0, -0.31, 0.67), (0.3, 0.27, 0.27))


def head_color(co, n):
    u, v, w = HEAD.uvw(co)
    return mix(SKIN, BLUSH, 0.75 * ellipse(abs(u), v, 0.58, -0.3, 0.15, 0.1, 0.6) * smoothstep(0.2, 0.5, w))


head = empty("head", (0, -0.2, 0.44), root)
tube("neck", [(0, 0.02, 0.32), (0, -0.14, 0.4), (0, -0.25, 0.52)], [0.11, 0.115, 0.12], head, ring=22, color=lambda co, n: SKIN)
skull = blob("head_mesh", HEAD.r, HEAD.c, head, cuts=24, color=head_color,
             shape=lambda p: (p[0] * (1 + 0.05 * max(0.0, -p[2])), p[1], p[2] * (0.94 if p[2] < 0 else 1.04)))

eyes = empty("eyes", (0, -0.55, 0.66), head)
for side in (-1, 1):
    eye = stud(f"eye_{side}", skull, side * 0.165, 0.66, (0.048, 0.055, 0.036), eyes, sink=0.35, color=EYE, mat=gloss)
    stud(f"shine_{side}", eye, side * 0.165 + 0.014, 0.676, (0.014, 0.014, 0.007), eyes, sink=0.2, color="#ffffff", mat=gloss)
for side in (-1, 1):
    stud(f"nostril_{side}", skull, side * 0.022, 0.615, (0.008, 0.006, 0.004), head, sink=0.5, color="#7fb9a1")
curve_on_face("mouth", skull, [(-0.045, 0.575), (-0.02, 0.562), (0, 0.56), (0.02, 0.562), (0.045, 0.575)], 0.005, head,
              color="#b4767c")

# ------------------------------------------------------------------ flipper legs, splayed a little
HIPS = [(0.25, -0.05, 0.17), (-0.25, -0.05, 0.17), (0.25, 0.4, 0.17), (-0.25, 0.4, 0.17)]
for i, (x, y, z) in enumerate(HIPS):
    leg = empty(f"leg{i}", (x, y, z), root)
    s = 1 if x > 0 else -1
    blob(f"leg{i}_mesh", (0.075, 0.095, 0.12), (x + s * 0.02, y - 0.02, 0.1), leg, cuts=10, rot=(0.25, s * 0.25, 0),
         color=lambda co, n: SKIN, shape=lambda p: (p[0], p[1] * (1 + 0.15 * max(0.0, -p[2])), p[2]))

# ------------------------------------------------------------------ tail (a little point)
tail = empty("tail", (0, 0.58, 0.2), root)
tube("tail_mesh", [(0, 0.56, 0.2), (0, 0.64, 0.19), (0, 0.7, 0.2)], [0.045, 0.03, 0.012], tail, samples=12,
     color=lambda co, n: SKIN)

# ------------------------------------------------------------------ scarf, round the neck
scarf = empty("scarf", (0, -0.15, 0.43), root)
scarf.scale = (0.15, 0.14, 0.19)
scarf.rotation_euler = (math.radians(-35), 0, 0)

preview = render_previews("turtle")
result = {"preview": preview, **stats(root)}
if globals().get("EXPORT", True):
    result["glb"] = export_glb(root, "turtle")
