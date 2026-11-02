# HM-ALPHA3-M09 (9D): "Klubbhuset" -- the club's home, seen across the car
# park at dusk. Three tiers that follow the club's economic band:
#   local  (E5-E7): a modest sports hall with a small office annex
#   pro    (E3-E4): a clad hall with a glass office wing and a lit band
#   elite  (E1-E2): a large arena with a glass atrium and a training hall
# The club's colours are added in CSS on top, so one render serves every
# club. Procedural and headless, no external assets, no text or logos.
#
# Usage:
#   blender -b --factory-startup --python render_klubbhuset.py -- <out_dir> [preview]
import bpy, math, os, sys, random
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = args[0] if args else os.path.join(os.getcwd(), "klubbhuset")
PREVIEW = len(args) > 1 and args[1] == "preview"
os.makedirs(OUT, exist_ok=True)
scene = bpy.context.scene


def clear():
    for block in (bpy.data.objects, bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras):
        for item in list(block):
            block.remove(item)


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


def sky():
    world = scene.world or bpy.data.worlds.new("w")
    scene.world = world
    world.use_nodes = True
    nodes, links = world.node_tree.nodes, world.node_tree.links
    bg = nodes["Background"]
    grad = nodes.new("ShaderNodeTexGradient")
    coord = nodes.new("ShaderNodeTexCoord")
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.09, 0.08, 0.12, 1)
    ramp.color_ramp.elements[1].color = (0.01, 0.015, 0.04, 1)
    mapping = nodes.new("ShaderNodeMapping")
    mapping.inputs["Rotation"].default_value = (0, math.radians(90), 0)
    links.new(coord.outputs["Generated"], mapping.inputs["Vector"])
    links.new(mapping.outputs["Vector"], grad.inputs["Vector"])
    links.new(grad.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 0.7


def build(tier):
    clear()
    ASPHALT = material("asphalt", (0.03, 0.032, 0.038), 0.85)
    GRASS = material("grass", (0.02, 0.04, 0.025), 0.9)
    BRICK = material("brick", (0.16, 0.07, 0.05), 0.8)
    HALL = material("hall", (0.1, 0.11, 0.13), 0.7)
    CLADDING = material("cladding", (0.15, 0.17, 0.21), 0.55, 0.35)
    GLASS = material("glass", (1.0, 0.74, 0.45), 0.3, 0.0, 2.6)
    WINDOW = material("window", (1.0, 0.76, 0.46), 0.4, 0.0, 3.0)
    STRIPE = material("stripe", (0.85, 0.48, 0.2), 0.4, 0.0, 1.5)
    POLE = material("pole", (0.06, 0.06, 0.07), 0.5, 0.6)
    FLAG = material("flag", (0.75, 0.75, 0.72), 0.7)
    LAMP = material("lamp", (1.0, 0.85, 0.6), 0.4, 0.0, 30.0)
    LINE = material("line", (0.55, 0.55, 0.55), 0.6)

    box((160, 120, 0.1), (0, 30, -0.06), GRASS)
    box((90, 40, 0.1), (5, 8, -0.05), ASPHALT)
    for k in range(-7, 8):
        box((0.12, 5.0, 0.01), (k * 3.0 + 6, 6, 0.006), LINE)

    if tier == "local":
        hx, hy, w, d, h = 8.0, 34.0, 30, 20, 8.5
        box((w, d, h), (hx, hy, h / 2), BRICK)
        box((w + 0.4, d + 0.4, 0.6), (hx, hy, h + 0.3), HALL)
        for i in range(7):
            box((1.6, 0.1, 1.0), (hx - 10 + i * 3.3, hy - d / 2 - 0.06, 6.6), WINDOW)
        # the office annex with the kansli and the changing rooms
        box((12, 9, 5.5), (hx + 18, hy - 4, 2.75), BRICK)
        for i in range(3):
            box((1.8, 0.1, 1.2), (hx + 14 + i * 3.6, hy - 8.56, 3.6), WINDOW)
        box((3.2, 0.1, 2.6), (hx + 18, hy - 8.56, 1.3), GLASS)
        flags = [(hx + 26, hy - 12)]
        entrance = (hx + 18, hy - 9)
    elif tier == "pro":
        hx, hy, w, d, h = 4.0, 34.0, 44, 24, 11
        box((w, d, h), (hx, hy, h / 2), HALL)
        box((w + 0.4, d + 0.4, 1.2), (hx, hy, h + 0.6), CLADDING)
        box((w + 0.6, 0.2, 0.3), (hx, hy - d / 2 - 0.2, 8.6), STRIPE)
        for i in range(14):
            box((2.0, 0.1, 1.3), (hx - 17 + i * 2.6, hy - d / 2 - 0.06, 9.7), WINDOW)
        # the glass office wing: kansli, analysis room, press room
        box((18, 10, 8), (hx + 31, hy - 4, 4), CLADDING)
        for row in range(2):
            for i in range(5):
                box((2.6, 0.1, 1.8), (hx + 24.5 + i * 3.3, hy - 9.06, 2.2 + row * 3.4), WINDOW)
        box((12, 0.1, 4), (hx + 2, hy - d / 2 - 0.06, 2), GLASS)
        box((14, 4, 0.3), (hx + 2, hy - d / 2 - 2, 4.4), CLADDING)
        flags = [(hx + 40, hy - 14), (hx + 43, hy - 14), (hx + 46, hy - 14)]
        entrance = (hx + 2, hy - d / 2 - 1)
    else:
        hx, hy, w, d, h = 0.0, 40.0, 62, 38, 16
        box((w, d, h), (hx, hy, h / 2), HALL)
        box((w + 0.6, d + 0.6, 1.6), (hx, hy, h + 0.8), CLADDING)
        for row in range(2):
            box((w + 0.8, 0.2, 0.35), (hx, hy - d / 2 - 0.25, 11 + row * 2.4), STRIPE)
        # the glass atrium across the front
        box((30, 6, 12), (hx, hy - d / 2 - 3, 6), GLASS)
        for i in range(11):
            box((0.18, 0.3, 12), (hx - 15 + i * 3, hy - d / 2 - 6.1, 6), POLE)
        box((34, 8, 0.4), (hx, hy - d / 2 - 4, 12.2), CLADDING)
        # the training hall and the offices to the side
        box((24, 18, 9), (hx + 46, hy - 2, 4.5), CLADDING)
        for row in range(2):
            for i in range(6):
                box((2.4, 0.1, 1.6), (hx + 37 + i * 3.4, hy - 11.06, 2.4 + row * 3.4), WINDOW)
        flags = [(hx - 26 + i * 4, hy - 30) for i in range(5)]
        entrance = (hx, hy - d / 2 - 6)

    for x, y in flags:
        cyl(0.08, 9, (x, y, 4.5), POLE, 8)
        box((0.06, 1.8, 1.1), (x, y + 0.95, 8.3), FLAG)

    lamps = [(-20, 0), (-6, 0), (8, 0), (22, 0), (-20, 14), (22, 14)]
    for x, y in lamps:
        cyl(0.1, 7.5, (x, y, 3.75), POLE, 10)
        box((1.2, 0.4, 0.15), (x, y + 0.5, 7.5), POLE)
        box((0.9, 0.3, 0.06), (x, y + 0.6, 7.42), LAMP)
        light(f"lamp_{x}_{y}", "SPOT", (x, y + 0.6, 7.3), (x, y + 1.5, 0), 700, spot_deg=80)

    random.seed(11)
    people = {"local": 6, "pro": 14, "elite": 24}[tier]
    PEOPLE = material("people", (0.015, 0.016, 0.02), 0.8)
    for _ in range(people):
        x = entrance[0] + random.uniform(-10, 10)
        y = random.uniform(2, entrance[1] - 3)
        hgt = random.uniform(1.6, 1.9)
        cyl(0.22, hgt * 0.82, (x, y, hgt * 0.41), PEOPLE, 10)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.13, location=(x, y, hgt * 0.9), segments=12, ring_count=8)
        bpy.context.active_object.data.materials.append(PEOPLE)

    light("entrance", "AREA", (entrance[0], entrance[1] - 1.5, 4), (entrance[0], entrance[1] - 8, 0), 1800, 10.0)
    light("dusk", "SUN", (0, 0, 30), (20, 50, 0), 0.6, color=(0.75, 0.68, 0.9))
    sky()


cam = None
engines = {e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items}
for tier in ("local", "pro", "elite"):
    build(tier)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    scene.collection.objects.link(cam)
    scene.camera = cam
    scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engines else ("BLENDER_EEVEE" if "BLENDER_EEVEE" in engines else "CYCLES")
    if scene.render.engine == "CYCLES":
        scene.cycles.samples = 32 if PREVIEW else 160
        scene.cycles.use_denoising = True
    scene.view_settings.view_transform = "AgX" if "AgX" in [v.identifier for v in bpy.types.ColorManagedViewSettings.bl_rna.properties["view_transform"].enum_items] else "Filmic"
    scene.render.image_settings.file_format = "WEBP"
    scene.render.image_settings.quality = 74
    scene.render.image_settings.color_mode = "RGB"
    far = {"local": 1.0, "pro": 1.2, "elite": 1.5}[tier]
    shots = {
        f"klubbhuset-{tier}-1920": ((1920, 720), (-42 * far, -16 * far, 3.4 * far), (4, 32, 5.5 * far), 28),
        f"klubbhuset-{tier}-960": ((960, 640), (-18 * far, -22 * far, 3.2 * far), (14, 30, 5.0 * far), 26),
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
