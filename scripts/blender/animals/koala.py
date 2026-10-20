"""Blue-grey baby koala with big fluffy ears (art/reference/koala drawing.jpeg)."""

import math

from common import (Frame, blob, curve_on_face, ellipse, empty, export_glb, material, mix, render_previews,
                    reset_scene, rgb, smoothstep, stats, stud, tube)

FUR = rgb("#a2aec0")
DARKER = rgb("#9aa6b9")
LIGHT = rgb("#dcdde1")
BLUSH = rgb("#eea5b0")
EYE = "#121216"
NOSE = "#4f5664"

reset_scene()
gloss = material("gloss", roughness=0.12, specular=0.6)
satin = material("satin", roughness=0.35, specular=0.5)
root = empty("koala")

# ------------------------------------------------------------------ head
HEAD = Frame((0, -0.07, 0.73), (0.355, 0.32, 0.31))


def head_shape(p):
    x, y, z = p
    x *= 1 + 0.06 * max(0.0, -z) - 0.03 * max(0.0, z)
    return (x, y, z * (0.95 if z < 0 else 1.0))


def head_color(co, n):
    u, v, w = HEAD.uvw(co)
    c = FUR
    c = mix(c, LIGHT, ellipse(u, v, 0, -0.7, 0.3, 0.3, 0.2) * smoothstep(0.2, 0.5, w))  # pale chin
    c = mix(c, BLUSH, 0.75 * ellipse(abs(u), v, 0.62, -0.32, 0.15, 0.1, 0.6) * smoothstep(0.2, 0.5, w))
    return c


head = empty("head", (0, -0.06, 0.46), root)
skull = blob("head_mesh", HEAD.r, HEAD.c, head, cuts=26, shape=head_shape, color=head_color)


def fluffy(depth):
    """A flat disc whose rim is a ring of soft tufts."""
    def shape(p):
        x, y, z = p
        a = math.atan2(z, x)
        rim = math.sqrt(x * x + z * z)
        k = 1 + 0.055 * math.cos(7 * a) * smoothstep(0.5, 1.0, rim)
        return (x * k, y * depth, z * k)
    return shape


for side in (-1, 1):
    centre = (side * 0.36, -0.02, 0.87)
    blob(f"ear_{'l' if side > 0 else 'r'}", (0.17, 0.1, 0.16), centre, head, cuts=14, shape=fluffy(0.6),
         rot=(0, side * 0.15, 0), color=lambda co, n: FUR)
    blob(f"ear_fluff_{'l' if side > 0 else 'r'}", (0.11, 0.05, 0.105), (centre[0] * 1.02, -0.075, 0.86), head, cuts=12,
         shape=fluffy(0.7), rot=(0, side * 0.15, 0), color="#f3f3f4")

eyes = empty("eyes", (0, -0.38, 0.72), head)
for side in (-1, 1):
    eye = stud(f"eye_{side}", skull, side * 0.17, 0.72, (0.045, 0.052, 0.034), eyes, sink=0.35, color=EYE, mat=gloss)
    stud(f"shine_{side}", eye, side * 0.17 + 0.014, 0.736, (0.013, 0.013, 0.007), eyes, sink=0.2, color="#ffffff", mat=gloss)
nose = stud("nose", skull, 0, 0.665, (0.068, 0.095, 0.06), head, sink=0.4, color=NOSE, mat=satin, cuts=10,
            shape=lambda p: (p[0] * (1 + 0.18 * max(0.0, -p[1])), p[1], p[2]))
curve_on_face("mouth", skull, [(-0.035, 0.55), (-0.017, 0.54), (0, 0.548), (0.017, 0.54), (0.035, 0.55)], 0.005, head,
              color="#59606c")

# ------------------------------------------------------------------ body
BODY = Frame((0, 0.11, 0.29), (0.22, 0.3, 0.215))


def body_color(co, n):
    u, v, w = BODY.uvw(co)
    belly = ellipse(u, v, 0, -0.2, 0.62, 1.0, 0.15) * smoothstep(0.3, 0.6, w)
    return mix(mix(FUR, LIGHT, belly), LIGHT, smoothstep(-0.55, -0.85, v) * 0.85)


body = empty("body", BODY.c, root)
blob("body_mesh", BODY.r, BODY.c, body, cuts=20, color=body_color,
     shape=lambda p: (p[0] * (1 + 0.07 * max(0.0, -p[2])), p[1], p[2]))

# ------------------------------------------------------------------ legs
HIPS = [(0.115, -0.04, 0.2), (-0.115, -0.04, 0.2), (0.115, 0.27, 0.2), (-0.115, 0.27, 0.2)]
for i, (x, y, z) in enumerate(HIPS):
    leg = empty(f"leg{i}", (x, y, z), root)
    tube(f"leg{i}_mesh", [(x, y, z + 0.03), (x, y, 0.12), (x, y - 0.02, 0.078)], [0.08, 0.077, 0.082], leg,
         color=lambda co, n: FUR)
    # Little toe grooves suggested by three bumps at the front of each paw.
    for t, dx in enumerate((-0.03, 0.0, 0.03)):
        blob(f"toe{i}_{t}", (0.024, 0.026, 0.022), (x + dx, y - 0.085, 0.024), leg, cuts=4, color=lambda co, n: FUR)

# ------------------------------------------------------------------ scarf
scarf = empty("scarf", (0, -0.03, 0.47), root)
scarf.scale = (0.2, 0.18, 0.19)
scarf.rotation_euler = (math.radians(6), 0, 0)

preview = render_previews("koala")
result = {"preview": preview, **stats(root)}
if globals().get("EXPORT", True):
    result["glb"] = export_glb(root, "koala")
