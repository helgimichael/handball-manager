# HM-ALPHA3-M07: the Boardroom / board-verdict Moment backdrop -- a small
# club's boardroom late at night: a long table with empty chairs, papers
# at one place, low pendant lights, and through the window wall the lit
# sports hall across the car park. Text sits on the dark wall on the
# left. Procedural and headless, no external assets, no text or logos;
# renders WebP stills.
#
# Usage:
#   blender -b --factory-startup --python render_boardroom_moment.py -- <out_dir> [preview]
import bpy, math, os, sys
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = args[0] if args else os.path.join(os.getcwd(), "boardroom-moment")
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

WOOD = material("wood", (0.16, 0.08, 0.035), 0.32)
FLOOR = material("floor", (0.035, 0.04, 0.05), 0.7)
WALL = material("wall", (0.05, 0.06, 0.075), 0.9)
CHAIR = material("chair", (0.025, 0.03, 0.04), 0.45)
METAL = material("metal", (0.6, 0.6, 0.62), 0.3, 1.0)
PAPER = material("paper", (0.92, 0.9, 0.84), 0.7)
FRAME = material("frame", (0.02, 0.02, 0.025), 0.5)
GLASS = material("glass", (0.02, 0.03, 0.05), 0.05)
HALL = material("hall", (1.0, 0.82, 0.55), 0.5, 0.0, 6.0)
HALL_DIM = material("hall_dim", (0.6, 0.7, 0.9), 0.5, 0.0, 1.2)
STREET = material("street", (1.0, 0.7, 0.35), 0.5, 0.0, 12.0)
SHADE = material("shade", (0.9, 0.75, 0.5), 0.5, 0.0, 3.0)
BALL = material("ball", (0.75, 0.32, 0.08), 0.6)

def box(size, loc, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.scale = size
    o.data.materials.append(mat)
    return o

def cyl(r, h, loc, mat, verts=32):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, location=loc, vertices=verts)
    o = bpy.context.active_object
    o.data.materials.append(mat)
    return o

# room: x along the table, y toward the window wall (y = +4), floor at z = 0
box((14, 9, 0.1), (0, 0, -0.05), FLOOR)
box((14, 0.2, 3.2), (0, -4.5, 1.6), WALL)            # back wall (behind camera side)
box((0.2, 9, 3.2), (-7, 0, 1.6), WALL)               # end wall (in view, behind the text)
box((14, 9, 0.1), (0, 0, 3.2), WALL)                 # ceiling
# window wall: mullions only (open glazing, so the hall outside reads)
for x in range(-6, 7, 2):
    box((0.08, 0.12, 3.2), (x, 4.0, 1.6), FRAME)
box((14, 0.12, 0.08), (0, 4.0, 0.9), FRAME)

# the table and chairs (the head of the table, nearest the camera, has the papers)
box((6.0, 1.6, 0.06), (0, 0.6, 0.76), WOOD)
for x in (-2.6, 2.6):
    box((0.12, 1.2, 0.72), (x, 0.6, 0.37), WOOD)
for i, x in enumerate((-2.2, -1.1, 0.0, 1.1, 2.2)):
    for side in (-1, 1):
        y = 0.6 + side * 1.15
        turn = 0.06 * ((i * 7 + (side + 1) * 3) % 5 - 2)
        box((0.5, 0.48, 0.06), (x, y, 0.48), CHAIR, rot=(0, 0, turn))
        box((0.5, 0.06, 0.62), (x, y + side * 0.24, 0.82), CHAIR, rot=(0, 0, turn))
        cyl(0.025, 0.46, (x, y, 0.23), METAL, 12)
# head of the table: the chair pulled out, papers and a pen, a handball at the far end
box((0.5, 0.48, 0.06), (3.35, 0.6, 0.48), CHAIR, rot=(0, 0, -0.25))
box((0.06, 0.5, 0.62), (3.62, 0.6, 0.82), CHAIR, rot=(0, 0, -0.25))
for k, (dx, dy, r) in enumerate(((0, 0, 4), (0.05, 0.03, -6), (-0.04, 0.05, 11))):
    box((0.3, 0.42, 0.004), (2.35 + dx, 0.55 + dy, 0.792 + k * 0.004), PAPER, rot=(0, 0, math.radians(r)))
box((0.15, 0.01, 0.01), (2.2, 0.35, 0.805), METAL, rot=(0, 0, math.radians(30)))
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.095, location=(-2.6, 0.75, 0.885))
bpy.context.active_object.data.materials.append(BALL)
bpy.ops.object.shade_smooth()

# pendant lights over the table
for x in (-1.6, 0.0, 1.6):
    cyl(0.006, 1.3, (x, 0.6, 2.55), METAL, 8)
    cyl(0.22, 0.12, (x, 0.6, 1.85), SHADE, 32)

# outside: the sports hall across the car park, its high windows lit; street lights
box((16, 6, 5), (2, 22, 1.5), WALL)
for i in range(9):
    box((1.2, 0.1, 0.8), (-5.5 + i * 1.6, 18.9, 3.1), HALL)
box((14, 0.1, 0.3), (2, 18.9, 0.9), HALL_DIM)
for x in (-6, -1, 4, 9):
    cyl(0.05, 4.0, (x, 12, 2.0), FRAME, 8)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.14, location=(x, 12, 4.05))
    bpy.context.active_object.data.materials.append(STREET)
box((40, 30, 0.1), (0, 20, -0.06), FLOOR)

world = scene.world or bpy.data.worlds.new("w")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.004, 0.006, 0.014, 1)

def light(name, kind, loc, target, energy, size=1.0, color=(1, 0.86, 0.66), spot_deg=60):
    li = bpy.data.lights.new(name, kind)
    li.energy, li.color = energy, color
    if kind == "AREA":
        li.size = size
    elif kind == "SPOT":
        li.spot_size, li.spot_blend, li.shadow_soft_size = math.radians(spot_deg), 0.7, 0.3
    else:
        li.shadow_soft_size = 0.3
    ob = bpy.data.objects.new(name, li)
    ob.location = loc
    scene.collection.objects.link(ob)
    if target:
        ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()

# warm pools of light from the pendants; a cold fill from the window
for x in (-1.6, 0.0, 1.6):
    light(f"pendant_{x}", "SPOT", (x, 0.6, 1.78), (x, 0.6, 0.0), 260, spot_deg=80)
light("window_fill", "AREA", (0, 3.6, 1.8), (0, 0, 0.8), 25, 6.0, (0.55, 0.65, 0.95))
light("hall_glow", "AREA", (2, 17, 3), (0, 4, 1), 900, 10.0, (1.0, 0.85, 0.6))

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
    # from the dark corner: the empty table running right, the lit hall through the window
    "boardroom-moment-1920": ((1920, 800), (6.4, -3.7, 1.75), (-1.4, 2.0, 0.95), 24),
    "boardroom-moment-960": ((960, 720), (5.8, -3.5, 1.8), (-0.8, 1.8, 0.95), 22),
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
