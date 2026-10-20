"""Baby panda, walks on all fours and sits up with bamboo (art/reference/panda drawing.jpeg)."""

import math

from mathutils import Vector

from common import (Frame, blob, curve_on_face, ellipse, empty, export_glb, material, mix, render_previews,
                    reset_scene, rgb, smoothstep, stats, stud, tube)

WHITE = rgb("#f6f5f2")
BLACK = rgb("#232326")
PAD = rgb("#4a4a4f")
BLUSH = rgb("#f5b0b4")
EYE = "#0c0c0e"
BAMBOO = rgb("#86c45a")
BAMBOO_DARK = rgb("#5e9a3c")
LEAF = rgb("#8fd06a")

reset_scene()
gloss = material("gloss", roughness=0.12, specular=0.6)
root = empty("panda")

# ------------------------------------------------------------------ head
HEAD = Frame((0, -0.12, 0.72), (0.37, 0.33, 0.315))


def head_shape(p):
    x, y, z = p
    x *= 1 + 0.06 * max(0.0, -z) - 0.03 * max(0.0, z)
    return (x, y, z * (0.95 if z < 0 else 1.0))


def head_color(co, n):
    u, v, w = HEAD.uvw(co)
    c = WHITE
    c = mix(c, BLUSH, 0.75 * ellipse(abs(u), v, 0.68, -0.42, 0.14, 0.09, 0.6) * smoothstep(0.2, 0.5, w))
    return c


head = empty("head", (0, -0.1, 0.45), root)
skull = blob("head_mesh", HEAD.r, HEAD.c, head, cuts=26, shape=head_shape, color=head_color)
muzzle = blob("muzzle", (0.13, 0.08, 0.085), (0, -0.4, 0.59), head, cuts=10, color="#f6f5f2")

for side in (-1, 1):
    blob(f"ear_{'l' if side > 0 else 'r'}", (0.115, 0.075, 0.105), (side * 0.27, -0.06, 0.97), head, cuts=10,
         rot=(0, -side * 0.35, 0), color="#232326")

# Eye patches: soft rounded ovals that droop down and outwards, a little
# fuller at the bottom (separate pieces, for crisp edges). Pointed or
# upswept patches read as eyeliner and make the panda look sassy.
PATCH_SPIN = 0.32
patches = {}
for side in (-1, 1):
    patches[side] = stud(f"patch_{side}", skull, side * 0.162, 0.67, (0.088, 0.104, 0.03), head, sink=0.55,
                         color="#232326", spin=side * PATCH_SPIN, cuts=12,
                         shape=lambda p: (p[0] * (1 - 0.1 * p[1]), p[1], p[2]))

# Big round eyes. A thin pale ring keeps them from melting into the black
# patches (the app's lighting has no reflections to pick out a glossy rim),
# plus a big and a small sparkle.
eyes = empty("eyes", (0, -0.42, 0.69), head)
for side in (-1, 1):
    ex, ez = side * 0.153, 0.683
    ring = stud(f"eye_ring_{side}", patches[side], ex, ez, (0.06, 0.06, 0.03), eyes, sink=0.75, color="#a9a9b2", cuts=10)
    eye = stud(f"eye_{side}", ring, ex, ez, (0.052, 0.052, 0.03), eyes, sink=0.72, color=EYE, mat=gloss, cuts=10)
    stud(f"shine_{side}", eye, ex + 0.017, ez + 0.019, (0.017, 0.017, 0.008), eyes, sink=0.2, color="#ffffff", mat=gloss)
    stud(f"shine_small_{side}", eye, ex - 0.016, ez - 0.018, (0.008, 0.008, 0.005), eyes, sink=0.2, color="#ffffff", mat=gloss)
stud("nose", muzzle, 0, 0.628, (0.036, 0.024, 0.024), head, sink=0.25, color="#141416", mat=gloss,
     shape=lambda p: (p[0] * (1 + 0.25 * p[2]), p[1], p[2]))
curve_on_face("mouth", muzzle, [(-0.06, 0.595), (-0.032, 0.577), (-0.006, 0.588), (0, 0.598), (0.006, 0.588), (0.032, 0.577), (0.06, 0.595)],
              0.0055, head, color="#2a2a2e")

# ------------------------------------------------------------------ body
BODY = Frame((0, 0.11, 0.33), (0.255, 0.35, 0.215))


def body_color(co, n):
    u, v, w = BODY.uvw(co)
    # Black from the shoulders forward (a band over the back that runs down
    # into the chest and front legs); white back half and rump; a rounded
    # white tummy low on the front, between the front legs, which faces
    # forward when it sits up.
    black = smoothstep(0.0, 0.08, w)
    tummy = ellipse(u, v, 0, -0.62, 0.45, 0.52, 0.12) * smoothstep(0.2, 0.4, w)
    return mix(WHITE, BLACK, black * (1 - tummy))


body = empty("body", BODY.c, root)
blob("body_mesh", BODY.r, BODY.c, body, cuts=32, color=body_color,
     shape=lambda p: (p[0] * (1 + 0.06 * max(0.0, -p[2])), p[1], p[2]))

# ------------------------------------------------------------------ legs (black), pads under the hind feet
HIPS = [(0.13, -0.06, 0.22), (-0.13, -0.06, 0.22), (0.13, 0.3, 0.22), (-0.13, 0.3, 0.22)]
for i, (x, y, z) in enumerate(HIPS):
    leg = empty(f"leg{i}", (x, y, z), root)
    tube(f"leg{i}_mesh", [(x, y, z + 0.04), (x, y, 0.13), (x, y - 0.02, 0.085)], [0.088, 0.085, 0.088], leg,
         color=lambda co, n: BLACK)
    if i >= 2:
        # Sole and toe beans (they face forward when it sits up).
        blob(f"pad{i}", (0.055, 0.05, 0.012), (x, y - 0.02, 0.013), leg, cuts=5, color="#4a4a4f")
        for t, dx in enumerate((-0.04, 0.0, 0.04)):
            blob(f"bean{i}_{t}", (0.016, 0.016, 0.008), (x + dx, y - 0.075, 0.012), leg, cuts=4, color="#4a4a4f")

# ------------------------------------------------------------------ tail (a little white bobble)
tail = empty("tail", (0, 0.45, 0.42), root)
blob("tail_mesh", (0.055, 0.05, 0.055), (0, 0.46, 0.42), tail, cuts=6, color="#f6f5f2")

# ------------------------------------------------------------------ bamboo
# Held upright between the front paws, in front of the tummy. It's placed
# where the paws are once the panda has sat up (the app keeps it out of the
# sitting tilt), shown only while sitting, and lifted to the mouth to munch.
BASE = Vector((0.0, -0.1, 0.1))
TOP = Vector((-0.05, -0.15, 0.51))
bamboo = empty("bamboo", BASE, root)
axis = (TOP - BASE).normalized()
length = (TOP - BASE).length
for i in range(3):
    a0 = BASE + axis * (i * length / 3 + 0.006)
    a1 = BASE + axis * ((i + 1) * length / 3 - 0.006)
    tube(f"bamboo_{i}", [a0, a1], [0.026, 0.026], bamboo, ring=12, samples=4, color=lambda co, n: BAMBOO,
         caps=(False, False))
    if i:
        blob(f"bamboo_node_{i}", (0.031, 0.031, 0.013), BASE + axis * (i * length / 3), bamboo, cuts=5,
             rot=(axis.to_track_quat("Z", "Y").to_euler()), color="#5e9a3c")
for end in (BASE, TOP):
    blob(f"bamboo_cap_{'top' if end is TOP else 'base'}", (0.027, 0.027, 0.012), end, bamboo, cuts=5,
         rot=(axis.to_track_quat("Z", "Y").to_euler()), color="#7ab84f")
for s, tilt in ((-1, 0.9), (1, 1.1)):
    leaf_at = TOP - axis * 0.06 + Vector((s * 0.045, 0, 0))
    blob(f"leaf_{s}", (0.03, 0.009, 0.08), leaf_at, bamboo, cuts=5, rot=(0, -s * tilt, 0), color="#8fd06a")

# ------------------------------------------------------------------ scarf
scarf = empty("scarf", (0, -0.08, 0.47), root)
scarf.scale = (0.22, 0.2, 0.19)
scarf.rotation_euler = (math.radians(6), 0, 0)

# The previews show it standing, so leave the bamboo out of them.
for ob in bamboo.children:
    ob.hide_render = True
preview = render_previews("panda", views=("front", "side", "three_quarter", "face"), face_z=0.7)
for ob in bamboo.children:
    ob.hide_render = False
result = {"preview": preview, **stats(root)}
if globals().get("EXPORT", True):
    result["glb"] = export_glb(root, "panda")
