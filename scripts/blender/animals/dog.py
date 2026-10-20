"""Cream puppy with caramel ears and an eye patch (art/reference/dog drawing.jpeg)."""

import math

from common import (Frame, blob, curve_on_face, ellipse, empty, export_glb, material, mix, render_previews,
                    reset_scene, rgb, smoothstep, stats, stud, tube)

FUR = rgb("#f1e7dc")
WHITE = rgb("#fbfaf7")
CARAMEL = rgb("#dc9a5c")
BLUSH = rgb("#f3b4b4")
EYE = "#1e1416"
NOSE = "#5b3a32"
MOUTH = "#5b3a32"

reset_scene()
gloss = material("gloss", roughness=0.12, specular=0.6)
root = empty("dog")

# ------------------------------------------------------------------ head
HEAD = Frame((0, -0.05, 0.74), (0.335, 0.33, 0.315))


def head_shape(p):
    x, y, z = p
    x *= 1 + 0.05 * max(0.0, -z)
    z *= 0.95 if z < 0 else 1.0
    return (x, y, z)


def head_color(co, n):
    u, v, w = HEAD.uvw(co)
    c = FUR
    # Caramel patch round the left eye (on the right as you look at it).
    c = mix(c, CARAMEL, ellipse(u, v, 0.5, -0.02, 0.29, 0.36, 0.1, angle=0.25) * smoothstep(0.0, 0.3, w))
    c = mix(c, BLUSH, 0.75 * ellipse(abs(u), v, 0.6, -0.4, 0.16, 0.1, 0.6) * smoothstep(0.2, 0.5, w))
    return c


head = empty("head", (0, -0.05, 0.47), root)
skull = blob("head_mesh", HEAD.r, HEAD.c, head, cuts=26, shape=head_shape, color=head_color)

# White muzzle, sticking out a little.
muzzle = blob("muzzle", (0.155, 0.11, 0.12), (0, -0.315, 0.6), head, cuts=12, color="#fbfaf7",
              shape=lambda p: (p[0] * (1 + 0.12 * max(0.0, -p[2])), p[1], p[2]))

# Long floppy ears hanging beside the cheeks.
for side in (-1, 1):
    def ear_shape(p):
        x, y, z = p
        return (x * (1 + 0.18 * max(0.0, -z)), y, z)

    blob(f"ear_{'l' if side > 0 else 'r'}", (0.06, 0.135, 0.25), (side * 0.335, 0.0, 0.66), head, cuts=12,
         shape=ear_shape, rot=(0.0, -side * 0.3, 0), color="#dc9a5c")

eyes = empty("eyes", (0, -0.38, 0.705), head)
for side in (-1, 1):
    eye = stud(f"eye_{side}", skull, side * 0.165, 0.705, (0.05, 0.058, 0.038), eyes, sink=0.35, color=EYE, mat=gloss)
    stud(f"shine_{side}", eye, side * 0.165 + 0.015, 0.722, (0.014, 0.014, 0.008), eyes, sink=0.2, color="#ffffff", mat=gloss)
stud("nose", muzzle, 0, 0.655, (0.042, 0.03, 0.03), head, sink=0.35, color=NOSE, mat=gloss,
     shape=lambda p: (p[0] * (1 + 0.25 * p[2]), p[1], p[2]))
curve_on_face("mouth", muzzle, [(-0.065, 0.6), (-0.035, 0.582), (-0.008, 0.592), (0, 0.61), (0.008, 0.592), (0.035, 0.582), (0.065, 0.6)],
              0.0055, head, color=MOUTH)

# ------------------------------------------------------------------ body
BODY = Frame((0, 0.11, 0.28), (0.235, 0.31, 0.205))
body = empty("body", BODY.c, root)
blob("body_mesh", BODY.r, BODY.c, body, cuts=18, shape=lambda p: (p[0] * (1 + 0.06 * max(0.0, -p[2])), p[1], p[2]),
     color=lambda co, n: mix(FUR, WHITE, 0.5 * smoothstep(-0.4, -0.9, BODY.uvw(co)[1])))

# ------------------------------------------------------------------ legs
HIPS = [(0.11, -0.05, 0.2), (-0.11, -0.05, 0.2), (0.11, 0.28, 0.2), (-0.11, 0.28, 0.2)]
for i, (x, y, z) in enumerate(HIPS):
    leg = empty(f"leg{i}", (x, y, z), root)
    tube(f"leg{i}_mesh", [(x, y, z + 0.03), (x, y, 0.12), (x, y - 0.02, 0.075)], [0.075, 0.072, 0.08], leg,
         color=lambda co, n: FUR)

# ------------------------------------------------------------------ tail (short, curled up)
tail = empty("tail", (0, 0.4, 0.38), root)
tube("tail_mesh", [(0, 0.39, 0.38), (0, 0.47, 0.44), (0, 0.5, 0.53), (0, 0.46, 0.6)], [0.045, 0.048, 0.048, 0.044], tail,
     samples=24, color=lambda co, n: CARAMEL)

# ------------------------------------------------------------------ scarf
scarf = empty("scarf", (0, -0.02, 0.48), root)
scarf.scale = (0.2, 0.18, 0.19)
scarf.rotation_euler = (math.radians(6), 0, 0)

preview = render_previews("dog")
result = {"preview": preview, **stats(root)}
if globals().get("EXPORT", True):
    result["glb"] = export_glb(root, "dog")
