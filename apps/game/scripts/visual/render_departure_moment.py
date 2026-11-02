# HM-ALPHA3-M05: the departure Moment backdrop -- an empty locker room after
# a player has packed up: a row of lockers (one left open and empty), a
# bench with a zipped kit bag and a match ball, and daylight falling in
# through an open door on the right. The left side stays dark for text.
# Procedural and headless (no .blend file, no external assets, no text or
# logos); renders WebP stills.
#
# Usage:
#   blender -b --factory-startup --python render_departure_moment.py -- <out_dir> [preview]
#
# Scale in metres: lockers 0.45 m wide x 1.85 m tall, bench 0.42 m high;
# the ball is a men's size 3 handball (radius 0.094 m).
import bpy, math, os, sys
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = args[0] if args else os.path.join(os.getcwd(), "departure-moment")
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

WALL = material("wall", (0.06, 0.08, 0.11), 0.8)
FLOOR = material("floor", (0.09, 0.09, 0.1), 0.35)
LOCKER = material("locker", (0.035, 0.07, 0.13), 0.45, 0.3)
LOCKER_IN = material("locker_in", (0.02, 0.025, 0.035), 0.9)
WOOD = material("wood", (0.42, 0.26, 0.13), 0.55)
METAL = material("metal", (0.55, 0.56, 0.58), 0.3, 1.0)
BAG = material("bag", (0.45, 0.09, 0.06), 0.65)
STRAP = material("strap", (0.04, 0.04, 0.05), 0.6)
BALL_A = material("ball_a", (0.9, 0.88, 0.82), 0.6)
BALL_B = material("ball_b", (0.62, 0.1, 0.07), 0.6)
DOORLIGHT = material("doorlight", (1.0, 0.92, 0.78), 0.5, 0.0, 6.0)

def box(name, size, loc, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    o.data.materials.append(mat)
    return o

# room: floor, back wall (y = 1.2), right wall with a doorway (x = 3.4)
box("floor", (12, 8, 0.02), (0, 0, -0.01), FLOOR)
box("back_wall", (12, 0.1, 3.2), (0, 1.25, 1.6), WALL)
box("right_wall_a", (0.1, 1.6, 3.2), (3.45, 0.35, 1.6), WALL)
box("right_wall_b", (0.1, 4.0, 3.2), (3.45, -3.6, 1.6), WALL)
box("door_head", (0.1, 1.2, 0.8), (3.45, -0.95, 2.8), WALL)
box("doorway_glow", (0.02, 1.15, 2.35), (3.62, -0.95, 1.18), DOORLIGHT)

# a row of lockers along the back wall; the second from the right stands open and empty
for i in range(9):
    x = -3.0 + i * 0.47
    if i == 7:
        box(f"locker_{i}_inside", (0.43, 0.02, 1.83), (x, 1.17, 0.95), LOCKER_IN)
        box(f"locker_{i}_door", (0.43, 0.03, 1.83), (x + 0.33, 0.9, 0.95), LOCKER, rot=(0, 0, math.radians(-62)))
        box(f"locker_{i}_shelf", (0.42, 0.4, 0.02), (x, 1.0, 1.55), LOCKER_IN)
    else:
        box(f"locker_{i}", (0.45, 0.45, 1.85), (x, 0.97, 0.95), LOCKER)
        box(f"locker_{i}_vent", (0.3, 0.005, 0.05), (x, 0.744, 1.7), LOCKER_IN)
        box(f"locker_{i}_handle", (0.02, 0.02, 0.12), (x + 0.17, 0.74, 1.0), METAL)

# a bench in front of the lockers
box("bench_top", (3.6, 0.36, 0.04), (0.4, 0.3, 0.42), WOOD)
for lx in (-1.2, 2.0):
    box(f"bench_leg_{lx}", (0.05, 0.3, 0.4), (lx, 0.3, 0.2), METAL)

# a zipped kit bag on the bench (a rounded box) with a strap
bpy.ops.mesh.primitive_cube_add(size=1, location=(1.55, 0.3, 0.6))
bag = bpy.context.active_object
bag.scale = (0.62, 0.3, 0.32)
bevel = bag.modifiers.new("bevel", "BEVEL")
bevel.width, bevel.segments = 0.08, 6
bag.data.materials.append(BAG)
for p in bag.data.polygons:
    p.use_smooth = True
bpy.ops.mesh.primitive_torus_add(major_radius=0.22, minor_radius=0.012, location=(1.55, 0.3, 0.78), rotation=(math.radians(90), 0, 0))
strap = bpy.context.active_object
strap.data.materials.append(STRAP)

# a size 3 handball on the floor by the bench
R = 0.094
bpy.ops.mesh.primitive_uv_sphere_add(radius=R, segments=64, ring_count=32, location=(0.8, -0.15, R))
ball = bpy.context.active_object
ball.data.materials.append(BALL_A)
ball.data.materials.append(BALL_B)
for poly in ball.data.polygons:
    poly.use_smooth = True
    c = poly.center
    poly.material_index = 1 if (math.atan2(c.y, c.x) * 3 / math.pi) % 2 < 1 else 0

# light: daylight through the door, a faint ceiling fill, the world near black
world = scene.world or bpy.data.worlds.new("w")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.003, 0.004, 0.006, 1)

def light(name, kind, loc, target, energy, size=1.0, color=(1, 0.95, 0.86), spot_deg=None):
    li = bpy.data.lights.new(name, kind)
    li.energy, li.color = energy, color
    if kind == "AREA":
        li.size = size
    if kind == "SPOT":
        li.spot_size, li.spot_blend = math.radians(spot_deg or 50), 0.7
        li.shadow_soft_size = 0.3
    ob = bpy.data.objects.new(name, li)
    ob.location = loc
    scene.collection.objects.link(ob)
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()

light("door_sun", "AREA", (4.6, -0.95, 1.4), (1.2, 0.3, 0.4), 900, 1.4, (1.0, 0.9, 0.74))
light("bench_spot", "SPOT", (1.4, -0.8, 2.9), (1.4, 0.4, 0.4), 260, spot_deg=48)
light("fill", "AREA", (1.5, -2.5, 2.6), (1.5, 0.8, 1.0), 18, 2.0, (0.65, 0.75, 1.0))

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
    "departure-moment-1920": ((1920, 800), (-1.4, -3.6, 1.35), (0.9, 0.5, 0.85), 30),
    "departure-moment-960": ((960, 720), (0.2, -3.2, 1.4), (1.2, 0.5, 0.8), 30),
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
