# HM-ALPHA3-M09: the matchday backdrop -- arriving at a Swedish sports
# hall at dusk on matchday: the hall with its lit glass entrance and high
# windows, lamp posts along the car park, supporters (simple silhouettes)
# walking in, a deep blue evening sky. Text sits on the darker left.
# Procedural and headless, no external assets, no text or logos.
#
# Usage:
#   blender -b --factory-startup --python render_arena_moment.py -- <out_dir> [preview]
import bpy, math, os, sys
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = args[0] if args else os.path.join(os.getcwd(), "arena-moment")
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

ASPHALT = material("asphalt", (0.025, 0.028, 0.035), 0.85)
HALL = material("hall", (0.09, 0.1, 0.12), 0.7)
CLADDING = material("cladding", (0.14, 0.16, 0.2), 0.6, 0.3)
GLOW = material("glow", (1.0, 0.7, 0.38), 0.4, 0.0, 6.0)
WINDOW = material("window", (1.0, 0.72, 0.4), 0.4, 0.0, 3.0)
LAMP = material("lamp", (1.0, 0.85, 0.6), 0.4, 0.0, 30.0)
POLE = material("pole", (0.05, 0.05, 0.06), 0.5, 0.6)
PEOPLE = material("people", (0.015, 0.016, 0.02), 0.8)
STRIPE = material("stripe", (0.75, 0.42, 0.18), 0.5)
LINE = material("line", (0.6, 0.6, 0.6), 0.6)

def box(size, loc, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.scale = size
    o.data.materials.append(mat)
    return o

def cyl(r, h, loc, mat, verts=16):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, location=loc, vertices=verts)
    o = bpy.context.active_object
    o.data.materials.append(mat)
    return o

# the car park
box((120, 90, 0.1), (0, 20, -0.05), ASPHALT)
for k in range(-6, 7):
    box((0.12, 5.0, 0.01), (k * 3.0 + 6, 4, 0.006), LINE)  # parking lines

# the hall: a long low box, cladding band, roof edge, glass entrance with a canopy, a strip of high windows
HX, HY = 10.0, 30.0
box((44, 24, 11), (HX, HY, 5.5), HALL)
box((44.4, 24.4, 1.2), (HX, HY, 11.4), CLADDING)
box((44.6, 0.2, 0.25), (HX, HY - 12.2, 8.6), STRIPE)              # a warm band across the facade (no text)
for i in range(14):
    box((2.0, 0.1, 1.3), (HX - 17 + i * 2.6, HY - 12.06, 9.6), WINDOW)
box((14, 0.1, 4.2), (HX + 6, HY - 12.06, 2.1), GLOW)             # glass entrance
for i in range(8):
    box((0.12, 0.2, 4.2), (HX - 1 + i * 2, HY - 12.1, 2.1), POLE)   # mullions
box((16, 4, 0.3), (HX + 6, HY - 14, 4.5), CLADDING)               # canopy
for x in (HX - 1.5, HX + 13.5):
    cyl(0.18, 4.4, (x, HY - 15.6, 2.2), POLE)

# lamp posts along the car park
for x, y in ((-14, 2), (-2, 2), (10, 2), (22, 2), (-14, 14), (22, 14)):
    cyl(0.1, 7.5, (x, y, 3.75), POLE, 10)
    box((1.2, 0.4, 0.15), (x, y + 0.5, 7.5), POLE)
    box((0.9, 0.3, 0.06), (x, y + 0.6, 7.42), LAMP)

# supporters walking towards the entrance: simple silhouettes (body + head)
import random
random.seed(7)
for i in range(46):
    x = HX + 6 + random.uniform(-14, 12)
    y = random.uniform(-2, HY - 16)
    h = random.uniform(1.6, 1.9)
    cyl(0.22, h * 0.82, (x, y, h * 0.41), PEOPLE, 10)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.13, location=(x, y, h * 0.9), segments=12, ring_count=8)
    bpy.context.active_object.data.materials.append(PEOPLE)

# the evening sky
world = scene.world or bpy.data.worlds.new("w")
scene.world = world
world.use_nodes = True
nodes, links = world.node_tree.nodes, world.node_tree.links
bg = nodes["Background"]
sky = nodes.new("ShaderNodeTexGradient")
coord = nodes.new("ShaderNodeTexCoord")
ramp = nodes.new("ShaderNodeValToRGB")
ramp.color_ramp.elements[0].color = (0.02, 0.035, 0.08, 1)
ramp.color_ramp.elements[1].color = (0.002, 0.003, 0.01, 1)
mapping = nodes.new("ShaderNodeMapping")
mapping.inputs["Rotation"].default_value = (0, math.radians(90), 0)
links.new(coord.outputs["Generated"], mapping.inputs["Vector"])
links.new(mapping.outputs["Vector"], sky.inputs["Vector"])
links.new(sky.outputs["Fac"], ramp.inputs["Fac"])
links.new(ramp.outputs["Color"], bg.inputs["Color"])
bg.inputs["Strength"].default_value = 0.6

def light(name, kind, loc, target, energy, size=1.0, color=(1, 0.85, 0.62), spot_deg=70):
    li = bpy.data.lights.new(name, kind)
    li.energy, li.color = energy, color
    if kind == "AREA":
        li.size = size
    elif kind == "SPOT":
        li.spot_size, li.spot_blend, li.shadow_soft_size = math.radians(spot_deg), 0.7, 0.5
    ob = bpy.data.objects.new(name, li)
    ob.location = loc
    scene.collection.objects.link(ob)
    if target:
        ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()

for x, y in ((-14, 2), (-2, 2), (10, 2), (22, 2), (-14, 14), (22, 14)):
    light(f"lamp_{x}_{y}", "SPOT", (x, y + 0.6, 7.3), (x, y + 1.5, 0), 900, spot_deg=80)
light("entrance", "AREA", (HX + 6, HY - 13.5, 3.5), (HX + 6, HY - 20, 0), 2200, 10.0)
light("moon", "SUN", (0, 0, 30), (10, 40, 0), 0.25, color=(0.55, 0.65, 1.0))

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
    # from the far corner of the car park, the hall and its entrance on the right, sky and dark asphalt on the left
    "arena-moment-1920": ((1920, 800), (-40, -14, 3.2), (-5, 26, 6.0), 28),
    "arena-moment-960": ((960, 720), (-14, -20, 3.0), (16, 22, 5.0), 26),
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
