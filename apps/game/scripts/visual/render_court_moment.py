# HM-ALPHA3-M01: procedural, regulation-accurate handball court for Moment
# heroes (promotion, title, season achievement). Builds the scene from
# scratch -- no .blend file, no external assets -- and renders WebP stills.
#
# Usage (headless, same pattern as the STARKVIS 3D lab scripts):
#   blender -b --factory-startup --python render_court_moment.py -- <out_dir> [preview]
#
# Geometry (IHF Rules of the Game, rule 1 / court diagram), in metres,
# origin at the court centre, x along the 40 m length, y across the 20 m:
# - playing area 40 x 20; lines 5 cm wide and part of the area they bound
# - goal 3 m wide x 2 m high (inside), posts 8 cm square, painted in two
#   contrasting colours in 20 cm bands
# - goal-area line: 6 m from the goal line -- a 3 m straight segment
#   parallel to the goal line joined by quarter circles (radius 6 m)
#   centred on the inner rear edge of each post
# - free-throw line (9 m): same construction at 9 m, dashed 15 cm / 15 cm,
#   clipped at the sidelines
# - 7 m line: 1 m long, 7 m from the goal line
# - goalkeeper restraining line (4 m): 15 cm long, 4 m from the goal line
# - centre line, and substitution lines 15 cm long, 4.5 m from it
import bpy, bmesh, math, os, sys
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = args[0] if args else os.path.join(os.getcwd(), "court-moment")
PREVIEW = len(args) > 1 and args[1] == "preview"
os.makedirs(OUT, exist_ok=True)

L, W = 40.0, 20.0          # playing area
LINE = 0.05                # line width
GOAL_W, GOAL_H, POST = 3.0, 2.0, 0.08
Z = 0.003                  # lines sit just above the floor

for block in (bpy.data.objects, bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras):
    for item in list(block):
        block.remove(item)

scene = bpy.context.scene

def material(name, color, rough=0.5, emission=0.0, metallic=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metallic
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*color, 1)
        bsdf.inputs["Emission Strength"].default_value = emission
    return m

def srgb(hexstr):
    h = hexstr.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c)

M_RUNOFF = material("runoff", srgb("#0d1826"), 0.42)
M_COURT = material("court", srgb("#1b3046"), 0.32)
M_AREA = material("goal_area", srgb("#22405c"), 0.32)
M_LINE = material("line", srgb("#e8ecef"), 0.4)
M_POST_A = material("post_red", srgb("#c74624"), 0.35)
M_POST_B = material("post_white", srgb("#f2f1eb"), 0.35)
M_NET = material("net", srgb("#9aa6b2"), 0.85)

def obj_from_bmesh(name, bm, mat):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    ob.data.materials.append(mat)
    scene.collection.objects.link(ob)
    return ob

def rect(bm, x0, y0, x1, y1, z):
    vs = [bm.verts.new((x0, y0, z)), bm.verts.new((x1, y0, z)), bm.verts.new((x1, y1, z)), bm.verts.new((x0, y1, z))]
    bm.faces.new(vs)

def strip(bm, pts, width, z):
    """A flat ribbon of constant width along a polyline."""
    left, right = [], []
    for i, p in enumerate(pts):
        a = pts[max(i - 1, 0)]
        b = pts[min(i + 1, len(pts) - 1)]
        d = Vector((b[0] - a[0], b[1] - a[1])).normalized()
        n = Vector((-d.y, d.x)) * (width / 2)
        left.append(bm.verts.new((p[0] + n.x, p[1] + n.y, z)))
        right.append(bm.verts.new((p[0] - n.x, p[1] - n.y, z)))
    for i in range(len(pts) - 1):
        bm.faces.new((left[i], right[i], right[i + 1], left[i + 1]))

# --- floor: run-off, court, goal areas --------------------------------------
bm = bmesh.new(); rect(bm, -L / 2 - 6, -W / 2 - 5, L / 2 + 6, W / 2 + 5, -0.001); obj_from_bmesh("runoff", bm, M_RUNOFF)
bm = bmesh.new(); rect(bm, -L / 2, -W / 2, L / 2, W / 2, 0.0); obj_from_bmesh("court", bm, M_COURT)

def area_outline(side, r, steps=48):
    """Points of the 6 m / 9 m line for the goal at x = side * L/2 (side = -1 or +1), clipped to the court."""
    gx = side * L / 2
    pts = []
    # quarter circle round the post at y = +1.5 (from the goal line out to the straight segment)
    for i in range(steps + 1):
        t = math.pi / 2 * i / steps
        pts.append((gx - side * r * math.sin(t), GOAL_W / 2 + r * math.cos(t)))
    for i in range(1, steps + 1):
        t = math.pi / 2 * i / steps
        pts.append((gx - side * r * math.cos(t), -GOAL_W / 2 - r * math.sin(t)))
    return [p for p in pts if abs(p[1]) <= W / 2 - LINE / 2]

def area_fill(side, r=6.0, steps=48):
    bm = bmesh.new()
    gx = side * L / 2
    outline = area_outline(side, r, steps)
    centre = bm.verts.new((gx, 0, 0.001))
    vs = [bm.verts.new((p[0], p[1], 0.001)) for p in outline]
    edge_top = bm.verts.new((gx, outline[0][1], 0.001))
    edge_bottom = bm.verts.new((gx, outline[-1][1], 0.001))
    ring = [edge_top] + vs + [edge_bottom]
    for i in range(len(ring) - 1):
        bm.faces.new((centre, ring[i], ring[i + 1]))
    obj_from_bmesh(f"goal_area_{side}", bm, M_AREA)

for side in (-1, 1):
    area_fill(side)

# --- lines -----------------------------------------------------------------------
bm = bmesh.new()
# boundary: sidelines and goal lines (lines belong to the area they bound, so they sit inside it)
for y in (W / 2 - LINE / 2, -W / 2 + LINE / 2):
    strip(bm, [(-L / 2, y), (L / 2, y)], LINE, Z)
for x in (L / 2 - LINE / 2, -L / 2 + LINE / 2):
    strip(bm, [(x, -W / 2), (x, W / 2)], LINE, Z)
strip(bm, [(0, -W / 2), (0, W / 2)], LINE, Z)                       # centre line
for sx in (-4.5, 4.5):                                               # substitution lines
    for y in (W / 2, -W / 2):
        strip(bm, [(sx, y - math.copysign(0.0, y)), (sx, y + math.copysign(0.15, y))], LINE, Z)
for side in (-1, 1):
    gx = side * L / 2
    strip(bm, area_outline(side, 6.0), LINE, Z)                     # 6 m goal-area line
    nine = area_outline(side, 9.0, 160)                              # 9 m dashed free-throw line
    acc, on, seg = 0.0, True, [nine[0]]
    for a, b in zip(nine, nine[1:]):
        d = math.dist(a, b)
        acc += d
        seg.append(b)
        if acc >= 0.15:
            if on and len(seg) > 1:
                strip(bm, seg, LINE, Z)
            on, acc, seg = not on, 0.0, [b]
    x7 = gx - side * (7.0 + LINE / 2)                                # 7 m line, 1 m long
    strip(bm, [(x7, -0.5), (x7, 0.5)], LINE, Z)
    x4 = gx - side * (4.0 + LINE / 2)                                # 4 m restraining line, 15 cm
    strip(bm, [(x4, -0.075), (x4, 0.075)], LINE, Z)
obj_from_bmesh("lines", bm, M_LINE)

# --- goals: banded posts and crossbar, light net -------------------------------------
def box(name, x0, y0, z0, x1, y1, z1, mat):
    bpy.ops.mesh.primitive_cube_add(location=((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = ((x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2)
    ob.data.materials.append(mat)
    return ob

for side in (-1, 1):
    gx = side * (L / 2 + POST / 2)   # posts stand on the goal line, rear edge flush with its outer edge
    for py in (GOAL_W / 2 + POST / 2, -GOAL_W / 2 - POST / 2):
        z = 0.0
        band = 0
        while z < GOAL_H + POST - 1e-6:
            top = min(z + 0.2, GOAL_H + POST)
            box(f"post_{side}_{py}_{band}", gx - POST / 2, py - POST / 2, z, gx + POST / 2, py + POST / 2, top, M_POST_A if band % 2 == 0 else M_POST_B)
            z, band = top, band + 1
    y = -GOAL_W / 2
    band = 0
    while y < GOAL_W / 2 - 1e-6:
        top = min(y + 0.2, GOAL_W / 2)
        box(f"bar_{side}_{band}", gx - POST / 2, y, GOAL_H, gx + POST / 2, top, GOAL_H + POST, M_POST_A if band % 2 else M_POST_B)
        y, band = top, band + 1
    # net: a shallow wire box behind the goal (1 m deep at the bottom, 0.8 m at the top)
    depth = side * 1.0
    bm = bmesh.new()
    pts = [(gx, -GOAL_W / 2, 0), (gx + depth, -GOAL_W / 2, 0), (gx + depth, GOAL_W / 2, 0), (gx, GOAL_W / 2, 0),
           (gx, -GOAL_W / 2, GOAL_H), (gx + depth * 0.8, -GOAL_W / 2, GOAL_H), (gx + depth * 0.8, GOAL_W / 2, GOAL_H), (gx, GOAL_W / 2, GOAL_H)]
    v = [bm.verts.new(p) for p in pts]
    for f in ((1, 2, 6, 5), (0, 1, 5, 4), (2, 3, 7, 6), (4, 5, 6, 7)):
        bm.faces.new([v[i] for i in f])
    net = obj_from_bmesh(f"net_{side}", bm, M_NET)
    wire = net.modifiers.new("wire", "WIREFRAME")
    wire.thickness = 0.006
    sub = net.modifiers.new("grid", "SUBSURF")
    sub.subdivision_type = "SIMPLE"
    sub.levels = sub.render_levels = 4
    net.modifiers.move(1, 0)

# --- light: a dark arena, the far goal area in a pool of light -------------------------
world = scene.world or bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (*srgb("#070d17"), 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.4

def spot(name, loc, target, energy, size_deg, blend=0.6, color=(1, 0.96, 0.9)):
    li = bpy.data.lights.new(name, "SPOT")
    li.energy, li.spot_size, li.spot_blend, li.color = energy, math.radians(size_deg), blend, color
    ob = bpy.data.objects.new(name, li)
    ob.location = loc
    scene.collection.objects.link(ob)
    d = Vector(target) - Vector(loc)
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()

spot("key", (14, -2, 16), (18.5, 0, 0), 9000, 48)
spot("fill", (4, 8, 14), (10, 0, 0), 2600, 70, 0.9, (0.75, 0.82, 1.0))
spot("rim", (24, 6, 6), (19, 0, 1), 1600, 40, 0.8, (1.0, 0.72, 0.55))

# --- camera: from midcourt toward the far goal; the goal lands right of centre, the left stays dark for text
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
scene.collection.objects.link(cam)
cam.location = (-2.0, 9.0, 5.6)
target = Vector((15.5, 3.4, 0.4))
cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
cam.data.lens = 30
scene.camera = cam

# --- render -------------------------------------------------------------------------------
engines = {e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items}
scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engines else ("BLENDER_EEVEE" if "BLENDER_EEVEE" in engines else "CYCLES")
if scene.render.engine == "CYCLES":
    scene.cycles.samples = 32 if PREVIEW else 160
    scene.cycles.use_denoising = True
scene.view_settings.view_transform = "AgX" if "AgX" in [v.identifier for v in bpy.types.ColorManagedViewSettings.bl_rna.properties["view_transform"].enum_items] else "Filmic"
scene.view_settings.look = "None"
scene.render.image_settings.file_format = "WEBP"
scene.render.image_settings.quality = 72
scene.render.image_settings.color_mode = "RGB"

for name, (rx, ry) in {"court-moment-1920": (1920, 800), "court-moment-960": (960, 720)}.items():
    scene.render.resolution_x, scene.render.resolution_y = rx, ry
    scene.render.resolution_percentage = 50 if PREVIEW else 100
    if name.endswith("960"):
        # narrow: frame the goal area centrally, a little higher
        cam.location = (2.0, 6.5, 7.0)
        cam.rotation_euler = (Vector((16.0, 0.0, 0.4)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = os.path.join(OUT, name + ".webp")
    bpy.ops.render.render(write_still=True)
    print("WROTE", scene.render.filepath, scene.render.engine)
