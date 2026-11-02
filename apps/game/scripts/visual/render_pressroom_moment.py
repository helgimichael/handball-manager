# HM-ALPHA3-M08: the Media Centre / press conference backdrop -- a small
# arena press room after a match: a table with a cluster of microphones,
# an empty chair, a blank backdrop wall, rows of reporters' chairs in the
# dark foreground and two soft camera lights. Text sits on the dark left.
# Procedural and headless, no external assets, no text or logos.
#
# Usage:
#   blender -b --factory-startup --python render_pressroom_moment.py -- <out_dir> [preview]
import bpy, math, os, sys
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = args[0] if args else os.path.join(os.getcwd(), "pressroom-moment")
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

FLOOR = material("floor", (0.03, 0.035, 0.045), 0.7)
WALL = material("wall", (0.05, 0.065, 0.09), 0.9)
BACKDROP = material("backdrop", (0.035, 0.06, 0.11), 0.7)
STRIPE = material("stripe", (0.75, 0.42, 0.18), 0.5)
TABLE = material("table", (0.1, 0.1, 0.11), 0.4)
CLOTH = material("cloth", (0.05, 0.08, 0.13), 0.9)
METAL = material("metal", (0.55, 0.56, 0.6), 0.25, 1.0)
MIC = material("mic", (0.02, 0.02, 0.025), 0.4)
FOAM = [material(f"foam{i}", c, 0.8) for i, c in enumerate([(0.7, 0.12, 0.1), (0.1, 0.25, 0.55), (0.85, 0.65, 0.1), (0.12, 0.45, 0.25)])]
CHAIR = material("chair", (0.012, 0.014, 0.02), 0.6)
GLASS = material("glass", (0.8, 0.85, 0.9), 0.05)
WATER = material("water", (0.6, 0.7, 0.85), 0.05)

def box(size, loc, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.scale = size
    o.data.materials.append(mat)
    return o

def cyl(r, h, loc, mat, verts=24, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, location=loc, vertices=verts, rotation=rot)
    o = bpy.context.active_object
    o.data.materials.append(mat)
    return o

# room: x across, y depth (backdrop at y = +3), floor z = 0
box((14, 12, 0.1), (0, 0, -0.05), FLOOR)
box((14, 0.2, 4), (0, 3.2, 2), WALL)
box((7, 0.05, 3), (1.5, 3.05, 1.9), BACKDROP)                 # backdrop panel
box((7, 0.06, 0.08), (1.5, 3.02, 0.9), STRIPE)                 # a thin warm stripe (no text)
box((7, 0.06, 0.03), (1.5, 3.02, 3.3), STRIPE)

# the table, its cloth front, the chair behind
box((3.2, 0.9, 0.06), (1.5, 1.9, 0.78), TABLE)
box((3.2, 0.04, 0.72), (1.5, 1.45, 0.42), CLOTH)
box((0.55, 0.5, 0.06), (1.5, 2.6, 0.5), CHAIR)
box((0.55, 0.06, 0.7), (1.5, 2.85, 0.9), CHAIR)

# the microphone cluster: stands angled at the empty chair, coloured foam windshields
for i, (dx, tilt) in enumerate(((-0.3, -0.3), (-0.1, -0.1), (0.1, 0.12), (0.3, 0.32))):
    base = (1.5 + dx, 1.6, 0.81)
    cyl(0.05, 0.02, base, METAL)
    stem = cyl(0.008, 0.32, (base[0], base[1] + 0.05, base[2] + 0.16), METAL, 8, rot=(math.radians(-25), 0, tilt))
    head = (base[0] + 0.05 * math.sin(tilt), base[1] + 0.14, base[2] + 0.31)
    cyl(0.028, 0.14, head, MIC, 16, rot=(math.radians(65), 0, tilt))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.04, location=(head[0], head[1] + 0.06, head[2] + 0.03))
    bpy.context.active_object.data.materials.append(FOAM[i])
# a glass of water and a bottle
cyl(0.035, 0.11, (2.3, 1.85, 0.865), GLASS, 20)
cyl(0.03, 0.08, (2.3, 1.85, 0.85), WATER, 20)
cyl(0.035, 0.24, (2.45, 1.95, 0.93), GLASS, 20)

# reporters' chairs in the dark foreground
for row in range(2):
    for k in range(-5, 6):
        x = k * 0.75 + (0.3 if row % 2 else 0)
        y = -0.6 - row * 1.0
        box((0.5, 0.45, 0.05), (x, y, 0.46), CHAIR)
        box((0.5, 0.05, 0.5), (x, y - 0.22, 0.72), CHAIR)

world = scene.world or bpy.data.worlds.new("w")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.003, 0.004, 0.008, 1)

def light(name, kind, loc, target, energy, size=1.0, color=(1, 0.95, 0.88), spot_deg=50):
    li = bpy.data.lights.new(name, kind)
    li.energy, li.color = energy, color
    if kind == "AREA":
        li.size = size
    else:
        li.spot_size, li.spot_blend, li.shadow_soft_size = math.radians(spot_deg), 0.6, 0.4
    ob = bpy.data.objects.new(name, li)
    ob.location = loc
    scene.collection.objects.link(ob)
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()

# two camera lights from the room on the table and backdrop
light("key", "SPOT", (0.2, -1.8, 3.0), (1.6, 1.8, 0.9), 1100, spot_deg=36)
light("fill", "SPOT", (3.6, -1.2, 2.6), (1.6, 2.0, 0.9), 420, spot_deg=40, color=(0.8, 0.85, 1.0))
light("back", "SPOT", (1.6, 2.4, 3.6), (1.6, 3.0, 1.6), 160, spot_deg=60, color=(0.6, 0.72, 1.0))

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
    # from the back of the room, low, the table and microphones on the right
    "pressroom-moment-1920": ((1920, 800), (-3.4, -3.4, 2.0), (0.6, 2.2, 0.95), 32),
    "pressroom-moment-960": ((960, 720), (-1.6, -3.4, 2.0), (1.3, 2.0, 0.95), 26),
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
