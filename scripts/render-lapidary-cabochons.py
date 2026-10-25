"""Render editable, texture-free cabochon CAD models as transparent PNG assets.

Run with Blender's bundled Python:
  blender --background --factory-startup --python scripts/render-lapidary-cabochons.py
An optional -- oval renders only the oval for a quick art-direction preview.
"""

import bpy
import json
import math
import sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public/images/lapidary/shapes/cad"
SOURCE = ROOT / "assets/lapidary/cabochon-shapes.blend"
OUTPUT.mkdir(parents=True, exist_ok=True)
SOURCE.parent.mkdir(parents=True, exist_ok=True)
N = 128
DOME_HEIGHT = 0.5
RIM_Z = 0.035
SHAPES = ["oval", "round", "teardrop", "long-oval", "cushion", "freeform", "pear", "marquise"]
requested = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else SHAPES
requested = requested or SHAPES

# A dedicated new scene leaves any startup objects and user scenes intact.
scene = bpy.data.scenes.new("RV Cabochon CAD Studio")
bpy.context.window.scene = scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.render.resolution_x = 768
scene.render.resolution_y = 768
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.image_settings.color_depth = "8"
scene.render.image_settings.compression = 80
scene.view_settings.view_transform = "AgX"
scene.world = bpy.data.worlds.new("RV Studio World")
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.8, 0.88, 0.82, 1)
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.4


def material(name, color, roughness, metallic=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return mat


surface_mat = material("Satin Sage Green CAD Surface", (0.13, 0.33, 0.20), 0.28, 0.12)
edge_mat = material("Forest Green Surface Control Lines", (0.021, 0.071, 0.048), 0.6)
rim_mat = material("Deep Green Flat Back and Girdle", (0.13, 0.26, 0.18), 0.39)


def bezier(p0, p1, p2, p3, steps=32):
    values = []
    for i in range(steps):
        t = i / steps
        s = 1 - t
        values.append((s**3*p0[0] + 3*s*s*t*p1[0] + 3*s*t*t*p2[0] + t**3*p3[0],
                       s**3*p0[1] + 3*s*s*t*p1[1] + 3*s*t*t*p2[1] + t**3*p3[1]))
    return values


def pointed_outline(width, top, bottom, shoulder):
    return (bezier((0, top), (width*.19, top*.73), (width, shoulder+.48), (width, shoulder))
            + bezier((width, shoulder), (width, bottom+.23), (width*.46, bottom), (0, bottom))
            + bezier((0, bottom), (-width*.46, bottom), (-width, bottom+.23), (-width, shoulder))
            + bezier((-width, shoulder), (-width, shoulder+.48), (-width*.19, top*.73), (0, top)))


def outline(name):
    if name == "teardrop":
        return pointed_outline(.64, 1.12, -1.0, -.27)
    if name == "pear":
        return pointed_outline(.84, 1.12, -.97, -.28)
    if name == "marquise":
        return (bezier((0, 1.15), (.20, .78), (.63, .38), (.68, 0))
                + bezier((.68, 0), (.63, -.38), (.20, -.78), (0, -1.15))
                + bezier((0, -1.15), (-.20, -.78), (-.63, -.38), (-.68, 0))
                + bezier((-.68, 0), (-.63, .38), (-.20, .78), (0, 1.15)))
    points = []
    for i in range(256):
        t = 2*math.pi*i/256
        c, s = math.cos(t), math.sin(t)
        if name == "round":
            x, y = .98*c, .98*s
        elif name == "long-oval":
            x, y = .46*c, 1.16*s
        elif name == "cushion":
            x = .93*math.copysign(abs(c)**.52, c)
            y = .98*math.copysign(abs(s)**.52, s)
        elif name == "freeform":
            r = 1 + .14*math.cos(3*t+.45) + .09*math.sin(2*t-.65)
            x, y = .80*r*c, 1.03*r*s
        else:
            x, y = .77*c, 1.13*s
        points.append((x, y))
    return points


def boundary_radius(points, angle):
    dx, dy = math.cos(angle), math.sin(angle)
    crossings = []
    for a, b in zip(points, points[1:]+points[:1]):
        ex, ey = b[0]-a[0], b[1]-a[1]
        determinant = dx*ey-dy*ex
        if abs(determinant) < 1e-10:
            continue
        distance = (a[0]*ey-a[1]*ex)/determinant
        along = (a[0]*dy-a[1]*dx)/determinant
        if distance > 0 and -1e-8 <= along <= 1+1e-8:
            crossings.append(distance)
    return min(crossings) if crossings else 1.0


def mesh_object(collection, name, vertices, faces, mat):
    mesh = bpy.data.meshes.new(name + " Mesh")
    mesh.from_pydata(vertices, [], faces, shade_flat=False)
    mesh.validate()
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.use_smooth = True
    obj.rotation_euler.z = math.radians(-12)
    return obj


def line_object(collection, name, coordinates, thickness=.006, closed=False):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 2
    curve.bevel_depth = thickness
    curve.bevel_resolution = 2
    spline = curve.splines.new("POLY")
    spline.points.add(len(coordinates)-1)
    for point, coordinate in zip(spline.points, coordinates):
        point.co = (*coordinate, 1)
    spline.use_cyclic_u = closed
    obj = bpy.data.objects.new(name, curve)
    collection.objects.link(obj)
    curve.materials.append(edge_mat)
    obj.rotation_euler.z = math.radians(-12)
    return obj


collections = {}
for name in SHAPES:
    collection = bpy.data.collections.new("RV Shape | " + name)
    scene.collection.children.link(collection)
    collections[name] = collection
    boundary = outline(name)
    radii = [boundary_radius(boundary, 2*math.pi*j/N) for j in range(N)]

    def surface(x, y, lift=0):
        a = math.atan2(y, x)
        radius = boundary_radius(boundary, a)
        r = min(math.hypot(x, y)/radius, 1)
        return (x, y, RIM_Z + DOME_HEIGHT*math.sqrt(max(0, 1-r*r)) + lift)

    vertices = [(0, 0, RIM_Z+DOME_HEIGHT)]
    rings = 40
    for ring in range(1, rings+1):
        phi = math.pi*.5*ring/rings
        r = math.sin(phi)
        for j in range(N):
            angle = 2*math.pi*j/N
            vertices.append((r*radii[j]*math.cos(angle), r*radii[j]*math.sin(angle), RIM_Z+DOME_HEIGHT*math.cos(phi)))
    faces = [(0, 1+j, 1+(j+1)%N) for j in range(N)]
    for ring in range(rings-1):
        a, b = 1+ring*N, 1+(ring+1)*N
        for j in range(N):
            nj = (j+1)%N
            faces.append((a+j, b+j, b+nj, a+nj))
    mesh_object(collection, name.title()+" | Domed Surface", vertices, faces, surface_mat)

    vertices = []
    rim_levels = [(1.0, RIM_Z), (1.0, -.045), (.985, -.11), (.955, -.14)]
    for scale, z in rim_levels:
        vertices.extend((scale*radii[j]*math.cos(2*math.pi*j/N), scale*radii[j]*math.sin(2*math.pi*j/N), z) for j in range(N))
    faces = []
    for ring in range(len(rim_levels)-1):
        for j in range(N):
            nj = (j+1)%N
            faces.append((ring*N+j, (ring+1)*N+j, (ring+1)*N+nj, ring*N+nj))
    faces.append(tuple(reversed(range((len(rim_levels)-1)*N, len(rim_levels)*N))))
    mesh_object(collection, name.title()+" | Flat Back and Girdle", vertices, faces, rim_mat)

    # Sparse surface patch lines reproduce a CAD control-surface presentation.
    for axis in (0, 1):
        low = min(point[axis] for point in boundary)
        high = max(point[axis] for point in boundary)
        for index, fraction in enumerate((-.45, 0, .45)):
            constant = (low+high)*.5+fraction*(high-low)*.5
            intersections = []
            for a, b in zip(boundary, boundary[1:]+boundary[:1]):
                delta = b[axis]-a[axis]
                if abs(delta) < 1e-9:
                    continue
                factor = (constant-a[axis])/delta
                if 0 <= factor <= 1:
                    intersections.append(a[1-axis]+factor*(b[1-axis]-a[1-axis]))
            if len(intersections) < 2:
                continue
            start, end = min(intersections), max(intersections)
            points = []
            for i in range(129):
                moving = start+(end-start)*i/128
                x, y = (constant, moving) if axis == 0 else (moving, constant)
                points.append(surface(x, y, .005))
            line_object(collection, f"{name} | Surface Patch {axis}-{index}", points, .0075)
    line_object(collection, name+" | Top Girdle Outline", [(radii[j]*math.cos(2*math.pi*j/N), radii[j]*math.sin(2*math.pi*j/N), RIM_Z+.003) for j in range(N)], .009, True)
    line_object(collection, name+" | Lower Girdle Outline", [(.985*radii[j]*math.cos(2*math.pi*j/N), .985*radii[j]*math.sin(2*math.pi*j/N), -.109) for j in range(N)], .006, True)


camera_data = bpy.data.cameras.new("Cabochon Orthographic Camera")
camera = bpy.data.objects.new("Cabochon Orthographic Camera", camera_data)
scene.collection.objects.link(camera)
camera.location = (0, -7, 11)
target = Vector((0, 0, .08))
camera.rotation_euler = (target-Vector(camera.location)).to_track_quat("-Z", "Y").to_euler()
camera_data.type = "ORTHO"
camera_data.ortho_scale = 3.0
scene.camera = camera


def area_light(name, position, energy, size):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = position
    obj.rotation_euler = (target-Vector(position)).to_track_quat("-Z", "Y").to_euler()


area_light("Large Upper Left Softbox", (-3.0, -3.7, 6.5), 500, 5)
area_light("Right Fill Softbox", (4, -.6, 5), 180, 4)
area_light("Back Rim Softbox", (-1, 4, 4), 240, 3)
bpy.context.view_layer.update()

for name in requested:
    if name not in collections:
        raise ValueError("Unknown cabochon shape: "+name)
    for key, collection in collections.items():
        collection.hide_render = key != name
    scene.render.filepath = str(OUTPUT / (name+".png"))
    bpy.ops.render.render(write_still=True)

for name, collection in collections.items():
    collection.hide_render = name != "oval"
    collection.hide_viewport = name != "oval"
scene.render.filepath = str(OUTPUT / "oval.png")
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
print(json.dumps({"rendered": requested, "output": str(OUTPUT), "blend_file": str(SOURCE)}))
