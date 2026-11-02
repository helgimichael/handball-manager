# HM-ALPHA3 release readiness: the trophy Moment backdrop -- a generic
# championship cup on a dark plinth beside a match ball, at the edge of a
# court in a single pool of light, the left side dark for text. Used by the
# season-end Moment (SM-guld, Svenska cupen) and the competition headers.
# Builds everything procedurally -- no .blend file, no external assets, no
# real trophy's design -- and renders WebP stills.
#
# Usage (headless, same pattern as render_court_moment.py):
#   blender -b --factory-startup --python render_trophy_moment.py -- <out_dir> [preview]
#
# Scale, in metres: trophy 0.62 m tall on a 0.9 m plinth; the ball is a
# men's size 3 handball (58-60 cm circumference -> radius 0.094 m); the floor
# carries the 5 cm goal-area line (6 m arc) of a regulation court.
import bpy, bmesh, math, os, sys
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = args[0] if args else os.path.join(os.getcwd(), "trophy-moment")
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

GOLD = material("gold", (0.95, 0.72, 0.3), 0.18, 1.0)
PLINTH = material("plinth", (0.012, 0.018, 0.03), 0.35)
PLATE = material("plate", (0.75, 0.6, 0.3), 0.3, 1.0)
FLOOR = material("floor", (0.45, 0.24, 0.12), 0.35)
LINE = material("line", (0.92, 0.9, 0.84), 0.5)
BALL_A = material("ball_a", (0.9, 0.88, 0.82), 0.6)
BALL_B = material("ball_b", (0.62, 0.1, 0.07), 0.6)

def link(obj, mat):
    obj.data.materials.append(mat)
    scene.collection.objects.link(obj)
    return obj

def lathe(name, profile, mat, segments=96, loc=(0, 0, 0)):
    """Revolve a (radius, z) profile around Z."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    rings = []
    for i in range(segments):
        a = 2 * math.pi * i / segments
        rings.append([bm.verts.new((r * math.cos(a), r * math.sin(a), z)) for r, z in profile])
    for i in range(segments):
        A, B = rings[i], rings[(i + 1) % segments]
        for j in range(len(profile) - 1):
            bm.faces.new((A[j], B[j], B[j + 1], A[j + 1]))
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    ob.location = loc
    return link(ob, mat)

# --- floor and the 6 m goal-area arc ------------------------------------------------------
bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, 0))
floor = bpy.context.active_object
floor.data.materials.append(FLOOR)

def arc_line(radius, center, a0, a1, width=0.05, steps=80):
    me = bpy.data.meshes.new("arc")
    bm = bmesh.new()
    inner, outer = [], []
    for i in range(steps + 1):
        a = a0 + (a1 - a0) * i / steps
        inner.append(bm.verts.new((center[0] + (radius - width / 2) * math.cos(a), center[1] + (radius - width / 2) * math.sin(a), 0.003)))
        outer.append(bm.verts.new((center[0] + (radius + width / 2) * math.cos(a), center[1] + (radius + width / 2) * math.sin(a), 0.003)))
    for i in range(steps):
        bm.faces.new((inner[i], inner[i + 1], outer[i + 1], outer[i]))
    bm.to_mesh(me)
    bm.free()
    link(bpy.data.objects.new("arc", me), LINE)

# goal line along y = 6.6 behind the plinth (posts at x = +-1.5): quarter circles of
# radius 6 m centred on each post, joined by the 3 m straight segment at y = 0.6
arc_line(6.0, (1.5, 6.6), math.radians(270), math.radians(360))
arc_line(6.0, (-1.5, 6.6), math.radians(180), math.radians(270))
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0.6, 0.003))
seg = bpy.context.active_object; seg.scale = (3.0, 0.05, 1); seg.data.materials.append(LINE)

# --- plinth: two stepped blocks and a brass plate ------------------------------------------
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.42))
p = bpy.context.active_object; p.scale = (0.62, 0.62, 0.84); p.data.materials.append(PLINTH)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.87))
p = bpy.context.active_object; p.scale = (0.5, 0.5, 0.06); p.data.materials.append(PLINTH)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -0.312, 0.55))
p = bpy.context.active_object; p.scale = (0.3, 0.01, 0.1); p.data.materials.append(PLATE)

# --- trophy: foot, stem, knop and a wide cup, revolved from one profile ----------------------
base = 0.9
profile = [
    (0.0, base), (0.15, base), (0.15, base + 0.03), (0.12, base + 0.05), (0.13, base + 0.07),
    (0.06, base + 0.12), (0.035, base + 0.2), (0.06, base + 0.23), (0.06, base + 0.25), (0.035, base + 0.27),
    (0.04, base + 0.31), (0.09, base + 0.34), (0.15, base + 0.4), (0.18, base + 0.48), (0.19, base + 0.56),
    (0.205, base + 0.6), (0.2, base + 0.62), (0.185, base + 0.6), (0.17, base + 0.52), (0.0, base + 0.5),
]
lathe("trophy", profile, GOLD)

# handles: half tori on either side of the bowl
for side in (-1, 1):
    bpy.ops.mesh.primitive_torus_add(major_radius=0.085, minor_radius=0.014, major_segments=48, minor_segments=16,
                                     location=(side * 0.2, 0, base + 0.48), rotation=(math.radians(90), 0, 0))
    h = bpy.context.active_object
    h.data.materials.append(GOLD)
    for poly in h.data.polygons:
        poly.use_smooth = True

# --- a size 3 handball resting on the floor in front of the plinth ------------------------
R = 0.094
bpy.ops.mesh.primitive_uv_sphere_add(radius=R, segments=64, ring_count=32, location=(-0.62, -0.55, R))
ball = bpy.context.active_object
ball.data.materials.append(BALL_A)
ball.data.materials.append(BALL_B)
for poly in ball.data.polygons:
    poly.use_smooth = True
    c = poly.center
    # two-colour panel pattern: bands by longitude
    poly.material_index = 1 if (math.atan2(c.y, c.x) * 3 / math.pi) % 2 < 1 else 0

# --- light: one hard key from above-right, a cool rim, the world almost black ---------------
world = bpy.data.worlds.new("w") if not scene.world else scene.world
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.004, 0.006, 0.01, 1)

def spot(name, loc, target, energy, size_deg, blend=0.6, color=(1, 0.95, 0.86)):
    li = bpy.data.lights.new(name, "SPOT")
    li.energy, li.spot_size, li.spot_blend, li.color = energy, math.radians(size_deg), blend, color
    li.shadow_soft_size = 0.25
    ob = bpy.data.objects.new(name, li)
    ob.location = loc
    scene.collection.objects.link(ob)
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()

spot("key", (1.0, -1.2, 4.0), (0, 0, 1.2), 520, 22, 0.5)
spot("rim", (-1.6, 2.2, 2.4), (0, 0, 1.3), 420, 30, 0.7, (0.7, 0.8, 1.0))
spot("floor", (-0.6, -1.6, 3.4), (-0.4, -0.4, 0), 650, 62, 0.95)

def area(name, loc, target, energy, size, color=(1, 0.93, 0.82)):
    li = bpy.data.lights.new(name, "AREA")
    li.energy, li.size, li.color = energy, size, color
    ob = bpy.data.objects.new(name, li)
    ob.location = loc
    scene.collection.objects.link(ob)
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()

# broad soft sources so the polished gold has something to reflect
area("softbox_l", (-1.4, -1.0, 2.0), (0, 0, 1.25), 160, 1.4)
area("softbox_r", (1.5, -0.6, 1.6), (0, 0, 1.2), 90, 1.0, (0.8, 0.86, 1.0))

# --- camera: low, the trophy right of centre ------------------------------------------------
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
    # wide hero: trophy at ~70 % of the width
    "trophy-moment-1920": ((1920, 800), (-2.35, -4.6, 1.35), (-1.0, 0, 0.95), 50),
    # narrow: trophy centred, a little closer
    "trophy-moment-960": ((960, 720), (-0.3, -4.2, 1.45), (-0.15, 0, 0.95), 42),
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
