"""
Shared tools for building the Togethr animals in Blender.

Every animal script (scripts/blender/animals/<animal>.py) builds its model
from smooth parts with these helpers, paints its markings as vertex colours,
renders previews and exports a GLB. Run one with:

    python3 scripts/blender/run.py scripts/blender/animals/cat.py

Conventions (the app relies on these node names, see src/island/AnimalModel.tsx):
- Blender units = app units. The animal stands on z = 0 and faces -Y
  (which is +z in the app once exported), about 1 unit tall.
- Nodes the app animates (empties, placed at their pivot):
    head    the whole head, pivots at the neck
    eyes    inside head; scaled on its vertical axis to blink
    body    breathes (scale), pivots at its centre
    leg0..3 front-left, front-right, back-left, back-right (a duck has leg0..1),
            pivot at the hip, swing forward and back
    tail    wags, pivots at its base
    scarf   where the player-coloured scarf goes (a unit torus scaled by it)
    bamboo  panda only; shown while sitting up
"""

import math
from pathlib import Path

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parent.parent.parent
PREVIEWS = ROOT / "art" / "previews"
MODELS = ROOT / "public" / "models" / "animals"


# ---------------------------------------------------------------- colours


def _lin(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def rgb(hex_: str) -> tuple:
    """'#f2a65a' → linear RGBA (vertex colours are linear)."""
    h = hex_.lstrip("#")
    return tuple(_lin(int(h[i : i + 2], 16) / 255) for i in (0, 2, 4)) + (1.0,)


def mix(a, b, t: float) -> tuple:
    t = max(0.0, min(1.0, t))
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def smoothstep(e0: float, e1: float, x: float) -> float:
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def ellipse(u: float, v: float, cu: float, cv: float, ru: float, rv: float, soft: float = 0.15, angle: float = 0.0) -> float:
    """1 inside an ellipse in (u, v), 0 outside, with a soft edge `soft` wide."""
    du, dv = u - cu, v - cv
    if angle:
        c, s = math.cos(angle), math.sin(angle)
        du, dv = du * c + dv * s, -du * s + dv * c
    d = math.sqrt((du / ru) ** 2 + (dv / rv) ** 2)
    return 1 - smoothstep(1 - soft, 1 + soft, d)


class Frame:
    """Normalised coordinates on an ellipsoid-ish part: (u, v, w) ≈ (x, z, -y) / radii.

    u: -1 right .. 1 left (character's own left is +x), v: -1 bottom .. 1 top,
    w: 1 at the front (the face side) .. -1 at the back.
    """

    def __init__(self, center, radii):
        self.c = Vector(center)
        self.r = Vector(radii)

    def uvw(self, co: Vector):
        d = co - self.c
        return d.x / self.r.x, d.z / self.r.z, -d.y / self.r.y


# ---------------------------------------------------------------- scene


def reset_scene():
    bpy.ops.object.mode_set(mode="OBJECT") if bpy.context.object and bpy.context.object.mode != "OBJECT" else None
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights, bpy.data.curves, bpy.data.images):
        for block in list(coll):
            if block.users == 0:
                coll.remove(block)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0


def material(name: str, roughness: float = 0.6, specular: float = 0.35) -> bpy.types.Material:
    """A material that takes its colour from the 'Color' vertex colours."""
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    attr = nt.nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "Color"
    nt.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = roughness
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = specular
    return mat


def empty(name: str, loc=(0, 0, 0), parent=None) -> bpy.types.Object:
    ob = bpy.data.objects.new(name, None)
    ob.empty_display_type = "PLAIN_AXES"
    ob.empty_display_size = 0.05
    bpy.context.scene.collection.objects.link(ob)
    ob.location = loc
    if parent:
        attach(ob, parent)
    return ob


def attach(child, parent):
    """Parent `child` to `parent` without moving it."""
    bpy.context.view_layer.update()
    mw = child.matrix_world.copy()
    child.parent = parent
    child.matrix_parent_inverse.identity()
    child.matrix_world = mw


def _mesh_object(name: str, bm: bmesh.types.BMesh, loc, parent, mat) -> bpy.types.Object:
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for poly in me.polygons:
        poly.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = loc
    ob.data.materials.append(mat or material("toy"))
    if parent:
        attach(ob, parent)
    return ob


# ---------------------------------------------------------------- shapes


def _unit_quad_sphere(cuts: int) -> bmesh.types.BMesh:
    """A sphere made of quads (a subdivided cube pushed out): even, no poles."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=2.0)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=cuts, use_grid_fill=True)
    for v in bm.verts:
        # Spherified cube mapping (more even than normalising).
        x, y, z = v.co
        x2, y2, z2 = x * x, y * y, z * z
        v.co = Vector((
            x * math.sqrt(max(0.0, 1 - y2 / 2 - z2 / 2 + y2 * z2 / 3)),
            y * math.sqrt(max(0.0, 1 - z2 / 2 - x2 / 2 + z2 * x2 / 3)),
            z * math.sqrt(max(0.0, 1 - x2 / 2 - y2 / 2 + x2 * y2 / 3)),
        ))
    return bm


def blob(name, radii, loc, parent=None, cuts=10, shape=None, rot=(0, 0, 0), color="#ffffff", mat=None, ucolor=None):
    """A smooth ellipsoid. `shape(p)` reshapes the unit sphere first (p is a
    Vector on it, return the new point); `rot` is an Euler in radians;
    `color` is a hex string or `fn(world_co, world_normal) -> rgba`;
    `ucolor(p, world_normal)` instead colours by the point on the unit sphere."""
    bm = _unit_quad_sphere(cuts)
    rx, ry, rz = radii
    rmat = Euler(rot).to_matrix()
    unit = []
    for v in bm.verts:
        p = Vector(v.co)
        unit.append(p.copy())
        if shape:
            p = Vector(shape(p))
        v.co = rmat @ Vector((p.x * rx, p.y * ry, p.z * rz))
    ob = _mesh_object(name, bm, loc, parent, mat)
    if ucolor:
        paint(ob, "#ffffff")
        nm = ob.matrix_world.to_3x3().inverted().transposed()
        for v, d, p in zip(ob.data.vertices, ob.data.color_attributes["Color"].data, unit):
            d.color = ucolor(p, (nm @ v.normal).normalized())
    else:
        paint(ob, color)
    return ob


def tube(name, points, radii, parent=None, ring=14, samples=24, color="#ffffff", mat=None, caps=(True, True)):
    """A smooth tube through `points` (world), radius interpolated along
    `radii` (one per point), with rounded ends."""
    pts = [Vector(p) for p in points]
    rs = list(radii)

    def catmull(i, t):
        p0 = pts[max(i - 1, 0)]
        p1, p2 = pts[i], pts[i + 1]
        p3 = pts[min(i + 2, len(pts) - 1)]
        t2, t3 = t * t, t * t * t
        return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)

    segs = len(pts) - 1
    centres, rads = [], []
    for k in range(samples + 1):
        f = k / samples * segs
        i = min(int(f), segs - 1)
        t = f - i
        centres.append(catmull(i, t))
        rads.append(rs[i] + (rs[i + 1] - rs[i]) * t)

    # Tangents and parallel-transported frames.
    tangents = []
    for k in range(len(centres)):
        a = centres[max(k - 1, 0)]
        b = centres[min(k + 1, len(centres) - 1)]
        tangents.append((b - a).normalized())
    up = Vector((0, 0, 1)) if abs(tangents[0].z) < 0.9 else Vector((1, 0, 0))
    normal = tangents[0].cross(up).normalized()
    frames = []
    for k, t in enumerate(tangents):
        if k:
            normal = (normal - t * normal.dot(t)).normalized()
        frames.append((normal.copy(), t.cross(normal).normalized()))

    # Rounded caps: extra rings shrinking along a quarter circle.
    rings = []  # (centre, radius, frame)
    cap_steps = 5
    if caps[0]:
        for j in range(cap_steps, 0, -1):
            a = j / cap_steps * (math.pi / 2)
            rings.append((centres[0] - tangents[0] * rads[0] * math.sin(a) * 0.9, rads[0] * math.cos(a), frames[0]))
    for k in range(len(centres)):
        rings.append((centres[k], rads[k], frames[k]))
    if caps[1]:
        for j in range(1, cap_steps + 1):
            a = j / cap_steps * (math.pi / 2)
            rings.append((centres[-1] + tangents[-1] * rads[-1] * math.sin(a) * 0.9, rads[-1] * math.cos(a), frames[-1]))

    origin = centres[0]
    bm = bmesh.new()
    loops = []
    for c, r, (n, b) in rings:
        if r < 1e-4:
            loops.append([bm.verts.new(c - origin)])
            continue
        loops.append([
            bm.verts.new(c - origin + (n * math.cos(2 * math.pi * q / ring) + b * math.sin(2 * math.pi * q / ring)) * r)
            for q in range(ring)
        ])
    for la, lb in zip(loops, loops[1:]):
        if len(la) == 1 or len(lb) == 1:
            pole, other = (la[0], lb) if len(la) == 1 else (lb[0], la)
            for q in range(ring):
                f = [pole, other[q], other[(q + 1) % ring]]
                bm.faces.new(f if len(la) == 1 else f[::-1])
        else:
            for q in range(ring):
                bm.faces.new([la[q], la[(q + 1) % ring], lb[(q + 1) % ring], lb[q]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    ob = _mesh_object(name, bm, origin, parent, mat)
    paint(ob, color)
    return ob


# ---------------------------------------------------------------- surface


def paint(ob, color):
    """Vertex-colour a mesh: a hex string, or fn(world_co, world_normal) -> rgba."""
    me = ob.data
    attr = me.color_attributes.get("Color") or me.color_attributes.new("Color", "FLOAT_COLOR", "POINT")
    if isinstance(color, str):
        c = rgb(color)
        for d in attr.data:
            d.color = c
        return
    bpy.context.view_layer.update()
    mw = ob.matrix_world
    nm = mw.to_3x3().inverted().transposed()
    me.calc_normals_split() if hasattr(me, "calc_normals_split") else None
    for v, d in zip(me.vertices, attr.data):
        d.color = color(mw @ v.co, (nm @ v.normal).normalized())


def repaint(ob, fn):
    """Change existing colours: fn(world_co, world_normal, rgba) -> rgba."""
    me = ob.data
    attr = me.color_attributes["Color"]
    bpy.context.view_layer.update()
    mw = ob.matrix_world
    nm = mw.to_3x3().inverted().transposed()
    for v, d in zip(me.vertices, attr.data):
        d.color = fn(mw @ v.co, (nm @ v.normal).normalized(), tuple(d.color))


def hit(ob, origin, direction):
    """Where a ray (world) first meets `ob`'s surface: (location, normal) in world."""
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    tree = BVHTree.FromObject(ob, deps)
    inv = ob.matrix_world.inverted()
    o = inv @ Vector(origin)
    d = (inv.to_3x3() @ Vector(direction)).normalized()
    loc, nrm, _, _ = tree.ray_cast(o, d)
    if loc is None:
        raise ValueError(f"ray from {origin} missed {ob.name}")
    mw = ob.matrix_world
    return mw @ loc, (mw.to_3x3().inverted().transposed() @ nrm).normalized()


def on_face(ob, x, z, front_y=-5.0):
    """Point on `ob`'s front surface at world (x, z), looking from the front (-Y)."""
    return hit(ob, (x, front_y, z), (0, 1, 0))


def stud(name, ob, x, z, radii, parent=None, sink=0.4, color="#000000", mat=None, cuts=6, shape=None, spin=0.0):
    """A small blob stuck onto `ob`'s front at world (x, z), aligned to its
    surface: eyes, noses, pads. radii = (across, up, out); `sink` is how much
    of its depth is buried."""
    loc, n = on_face(ob, x, z)
    rot = n.to_track_quat("Z", "Y").to_matrix()
    if spin:
        rot = rot @ Matrix.Rotation(spin, 3, "Z")
    bm = _unit_quad_sphere(cuts)
    for v in bm.verts:
        p = Vector(v.co)
        if shape:
            p = Vector(shape(p))
        v.co = rot @ Vector((p.x * radii[0], p.y * radii[1], p.z * radii[2]))
    centre = loc + n * radii[2] * (1 - 2 * sink)
    obj = _mesh_object(name, bm, centre, parent, mat)
    paint(obj, color)
    return obj


def curve_on_face(name, ob, pts2d, radius, parent=None, color="#000000", mat=None, lift=0.3):
    """A thin tube following 2D (x, z) points drawn on `ob`'s front: mouths."""
    pts = []
    for x, z in pts2d:
        loc, n = on_face(ob, x, z)
        pts.append(loc + n * radius * lift)
    return tube(name, pts, [radius] * len(pts), parent=parent, ring=8, samples=max(12, 6 * len(pts)), color=color, mat=mat)


# ---------------------------------------------------------------- previews


def _studio():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.render.film_transparent = False
    world = scene.world or bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (0.92, 0.9, 0.88, 1)
    bg.inputs["Strength"].default_value = 0.9

    for name, rot, energy in (("KeyLight", (math.radians(50), 0, math.radians(-35)), 3.2), ("FillLight", (math.radians(60), 0, math.radians(140)), 1.0)):
        light = bpy.data.objects.get(name)
        if not light:
            data = bpy.data.lights.new(name, "SUN")
            light = bpy.data.objects.new(name, data)
            scene.collection.objects.link(light)
        light.data.energy = energy
        light.data.angle = math.radians(12)
        light.rotation_euler = rot

    cam = bpy.data.objects.get("PreviewCam")
    if not cam:
        cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
        scene.collection.objects.link(cam)
    scene.camera = cam
    return cam


def _look(cam, loc, target):
    cam.location = loc
    direction = Vector(target) - Vector(loc)
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def render_previews(animal: str, height: float = 1.25, views=("front", "side", "three_quarter"), face_z: float = 0.72) -> str:
    """Render front / side / three-quarter views (and "face", a close-up of the
    face at height `face_z`) and stitch them into art/previews/<animal>/<animal>.png
    (plus the single views)."""
    import numpy as np

    scene = bpy.context.scene
    out = PREVIEWS / animal
    out.mkdir(parents=True, exist_ok=True)
    cam = _studio()
    saved = (scene.render.resolution_x, scene.render.resolution_y, scene.render.filepath, scene.render.image_settings.file_format)
    scene.render.resolution_x = scene.render.resolution_y = 700
    scene.render.image_settings.file_format = "PNG"
    if hasattr(scene, "eevee"):
        scene.eevee.taa_render_samples = 32
    mid = height / 2
    setups = {
        "front": ((0, -6, mid), "ORTHO"),
        "side": ((6, 0, mid), "ORTHO"),
        "three_quarter": ((1.75, -2.1, mid + 0.95), "PERSP"),
        "back": ((-1.6, 2.2, mid + 0.8), "PERSP"),
        "face": ((0, -6, face_z), "ORTHO"),
    }
    paths = []
    for view in views:
        loc, kind = setups[view]
        cam.data.type = kind
        cam.data.ortho_scale = 0.5 if view == "face" else height * 1.25
        cam.data.lens = 50
        _look(cam, loc, (0, 0, face_z if view == "face" else mid * (0.75 if kind == "PERSP" else 1)))
        path = out / f"{view}.png"
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        paths.append(path)

    imgs = []
    for p in paths:
        img = bpy.data.images.load(str(p), check_existing=False)
        w, h = img.size
        imgs.append(np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4))
        bpy.data.images.remove(img)
    strip = np.concatenate(imgs, axis=1)
    sheet = bpy.data.images.new(f"{animal}_sheet", strip.shape[1], strip.shape[0], alpha=True)
    sheet.pixels = strip.ravel()
    sheet.filepath_raw = str(out / f"{animal}.png")
    sheet.file_format = "PNG"
    sheet.save()
    bpy.data.images.remove(sheet)

    scene.render.resolution_x, scene.render.resolution_y, scene.render.filepath, scene.render.image_settings.file_format = saved
    return str(out / f"{animal}.png")


# ---------------------------------------------------------------- export


def export_glb(root, animal: str) -> str:
    """Export `root` and everything under it to public/models/animals/<animal>.raw.glb
    (scripts/blender/compress.sh turns it into the final <animal>.glb)."""
    MODELS.mkdir(parents=True, exist_ok=True)
    path = MODELS / f"{animal}.raw.glb"
    bpy.ops.object.select_all(action="DESELECT")
    for ob in [root, *root.children_recursive]:
        ob.hide_set(False)
        ob.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_animations=False,
        export_vertex_color="MATERIAL",
        export_normals=True,
        export_extras=False,
    )
    return str(path)


def stats(root) -> dict:
    meshes = [o for o in root.children_recursive if o.type == "MESH"]
    bpy.context.view_layer.update()
    zs = [(o.matrix_world @ Vector(c)).z for o in meshes for c in o.bound_box]
    return {
        "objects": len(meshes),
        "verts": sum(len(o.data.vertices) for o in meshes),
        "height": round(max(zs), 3),
    }
