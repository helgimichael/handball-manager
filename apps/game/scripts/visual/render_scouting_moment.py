# HM-ALPHA3-M06: the Scouting Centre / discovery Moment backdrop -- the
# scout's view from high in an away arena's stand: tiers of empty seats in
# the dark, one seat with an open notebook, and below a regulation court
# (40 x 20 m, 6 m goal-area arcs, 9 m dashed lines, centre line) under the
# arena lights. Text sits on the dark stand on the left. Procedural and
# headless, no external assets, no text or logos; renders WebP stills.
#
# Usage:
#   blender -b --factory-startup --python render_scouting_moment.py -- <out_dir> [preview]
import bpy, bmesh, math, os, sys
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = args[0] if args else os.path.join(os.getcwd(), "scouting-moment")
PREVIEW = len(args) > 1 and args[1] == "preview"
os.makedirs(OUT, exist_ok=True)

for block in (bpy.data.objects, bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras):
    for item in list(block):
        block.remove(item)
scene = bpy.context.scene

def material(name, color, rough=0.5, metallic=0.0, emission=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metallic
    if emission:
        b.inputs["Emission Color"].default_value = (*color, 1)
        b.inputs["Emission Strength"].default_value = emission
    return m

COURT = material("court", (0.3, 0.16, 0.08), 0.4)
RUNOFF = material("runoff", (0.03, 0.05, 0.08), 0.5)
LINE = material("line", (0.93, 0.91, 0.85), 0.5)
STAND = material("stand", (0.03, 0.035, 0.045), 0.8)
SEAT = material("seat", (0.05, 0.1, 0.18), 0.5)
PAPER = material("paper", (0.92, 0.9, 0.84), 0.7)
COVER = material("cover", (0.55, 0.12, 0.07), 0.6)
GOAL_W = material("goal_w", (0.95, 0.95, 0.95), 0.4)
GOAL_R = material("goal_r", (0.75, 0.1, 0.08), 0.4)

def box(size, loc, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.scale = size
    o.data.materials.append(mat)
    return o

Z = 0.012  # above the court surface (top at z = 0.005)
# court: x along the 40 m length, y across 20 m, centred at the origin
box((52, 32, 0.02), (0, 0, -0.01), RUNOFF)
box((40, 20, 0.01), (0, 0, 0), COURT)
for sx in (-20, 20):
    box((0.05, 20, 0.004), (sx, 0, Z), LINE)        # goal lines
for sy in (-10, 10):
    box((40, 0.05, 0.004), (0, sy, Z), LINE)        # side lines
box((0.05, 20, 0.004), (0, 0, Z), LINE)             # centre line

def arc(cx, cy, r, a0, a1, dashed=False, steps=90):
    me = bpy.data.meshes.new("arc")
    bm = bmesh.new()
    w = 0.05
    for i in range(steps):
        if dashed and (i // 3) % 2:
            continue
        t0 = a0 + (a1 - a0) * i / steps
        t1 = a0 + (a1 - a0) * (i + 1) / steps
        pts = [(cx + (r - w / 2) * math.cos(t0), cy + (r - w / 2) * math.sin(t0)), (cx + (r + w / 2) * math.cos(t0), cy + (r + w / 2) * math.sin(t0)),
               (cx + (r + w / 2) * math.cos(t1), cy + (r + w / 2) * math.sin(t1)), (cx + (r - w / 2) * math.cos(t1), cy + (r - w / 2) * math.sin(t1))]
        verts = [bm.verts.new((x, y, Z)) for x, y in pts]
        bm.faces.new(verts)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("arc", me)
    o.data.materials.append(LINE)
    scene.collection.objects.link(o)

# goal areas (6 m) and free-throw lines (9 m, dashed): quarter circles around the posts (y = ±1.5) joined by straight 3 m segments
for side in (-1, 1):
    gx = 20 * side
    for r, dashed in ((6.0, False), (9.0, True)):
        # quarter circles around each post, opening toward centre court (+x for the left goal, -x for the right)
        if side == -1:
            arc(gx, 1.5, r, 0.0, math.pi / 2, dashed)
            arc(gx, -1.5, r, -math.pi / 2, 0.0, dashed)
        else:
            arc(gx, 1.5, r, math.pi / 2, math.pi, dashed)
            arc(gx, -1.5, r, math.pi, 3 * math.pi / 2, dashed)
        if not dashed:
            box((0.05, 3.0, 0.004), (gx - side * r, 0, Z), LINE)
    # goal: 3 m wide, 2 m high, posts in two colours
    for gy in (-1.5, 1.5):
        box((0.08, 0.08, 2.0), (gx + side * 0.04, gy, 1.0), GOAL_W)
    box((0.08, 3.08, 0.08), (gx + side * 0.04, 0, 2.0), GOAL_R)

# the stand: tiers rising from the side line y = -10 away from the court, seats on each tier
for tier in range(14):
    y = -12.0 - tier * 0.85
    zt = 0.6 + tier * 0.5
    box((46, 0.85, 0.5), (0, y, zt - 0.25), STAND)
    if tier >= 6:
        for k in range(-22, 23):
            box((0.42, 0.4, 0.38), (k * 0.95, y + 0.1, zt + 0.19), SEAT)

# the scout's seat: high up, a notebook open on the seat next to it
TIER = 12
sy, sz = -12.0 - TIER * 0.85, 0.6 + TIER * 0.5
NX = -14.25
box((0.33, 0.24, 0.012), (NX, sy + 0.1, sz + 0.39), PAPER, rot=(0, 0, math.radians(12)))
box((0.34, 0.25, 0.006), (NX, sy + 0.1, sz + 0.383), COVER, rot=(0, 0, math.radians(12)))
box((0.15, 0.008, 0.008), (NX + 0.05, sy + 0.12, sz + 0.4), STAND, rot=(0, 0, math.radians(40)))

world = scene.world or bpy.data.worlds.new("w")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.002, 0.003, 0.005, 1)

def light(name, kind, loc, target, energy, size=1.0, color=(1, 0.96, 0.9), spot_deg=60):
    li = bpy.data.lights.new(name, kind)
    li.energy, li.color = energy, color
    if kind == "AREA":
        li.size = size
    else:
        li.spot_size, li.spot_blend, li.shadow_soft_size = math.radians(spot_deg), 0.6, 0.5
    ob = bpy.data.objects.new(name, li)
    ob.location = loc
    scene.collection.objects.link(ob)
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()

# arena lights over the court only; a faint glow on the notebook
for x in (-12, 0, 12):
    light(f"arena_{x}", "AREA", (x, 0, 16), (x, 0, 0), 2600, 9.0)
light("notebook", "SPOT", (NX + 0.6, sy + 1.2, sz + 1.6), (NX, sy + 0.1, sz + 0.4), 60, spot_deg=25, color=(1.0, 0.85, 0.6))

cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
scene.collection.objects.link(cam)
scene.camera = cam

engines = {e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items}
scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engines else ("BLENDER_EEVEE" if "BLENDER_EEVEE" in engines else "CYCLES")
if scene.render.engine == "CYCLES":
    scene.cycles.samples = 32 if PREVIEW else 160
    scene.cycles.use_denoising = True
scene.view_settings.view_transform = "AgX" if "AgX" in [v.identifier for v in bpy.types.ColorManagedViewSettings.bl_rna.properties["view_transform"].enum_items] else "Filmic"
scene.render.image_settings.file_format = "WEBP"
scene.render.image_settings.quality = 74
scene.render.image_settings.color_mode = "RGB"

shots = {
    # from behind the scout's row: notebook bottom-left, the lit court filling the right
    "scouting-moment-1920": ((1920, 800), (-15.6, sy - 1.4, sz + 1.9), (6.0, 6.0, -2.0), 26),
    "scouting-moment-960": ((960, 720), (-15.2, sy - 1.4, sz + 2.2), (2.0, 2.0, -2.0), 24),
}
for name, ((rx, ry), loc, target, lens) in shots.items():
    scene.render.resolution_x, scene.render.resolution_y = rx, ry
    scene.render.resolution_percentage = 50 if PREVIEW else 100
    cam.location = loc
    cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = lens
    scene.render.filepath = os.path.join(OUT, name + ".webp")
    bpy.ops.render.render(write_still=True)
    print("WROTE", scene.render.filepath, scene.render.engine)
