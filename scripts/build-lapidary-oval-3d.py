"""Build the closed 20 × 14 × 4 mm oval cabochon, its GLB, and matching PNGs."""
import bpy
import math
import json
from collections import Counter
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/models/lapidary/oval-v1"
OUT.mkdir(parents=True, exist_ok=True)
scene = bpy.data.scenes.new("Oval Cabochon Interactive Studio")
bpy.context.window.scene = scene
scene.unit_settings.system = "METRIC"
scene.unit_settings.length_unit = "MILLIMETERS"
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 96
scene.cycles.use_denoising = True
scene.render.film_transparent = True
scene.render.resolution_x = scene.render.resolution_y = 1024
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.view_settings.view_transform = "AgX"
scene.world = bpy.data.worlds.new("Soft Neutral Studio")
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = .3

material = bpy.data.materials.new("Plain Green Polished Cabochon")
material.diffuse_color = (.025, .19, .09, 1)
material.use_nodes = True
bsdf = material.node_tree.nodes.get("Principled BSDF")
bsdf.inputs["Base Color"].default_value = material.diffuse_color
bsdf.inputs["Roughness"].default_value = .22
bsdf.inputs["Metallic"].default_value = 0
bsdf.inputs["IOR"].default_value = 1.48
bsdf.inputs["Coat Weight"].default_value = .22
bsdf.inputs["Coat Roughness"].default_value = .2

# A continuous closed surface: domed face, straight girdle, rounded lower edge,
# and flat back. All dimensions are in meters for correct glTF export.
segments = 128
radial_rings = 40
vertices = [(0, 0, .004)]
levels = []
for ring in range(1, radial_rings + 1):
    phi = math.pi*.5*ring/radial_rings
    levels.append((math.sin(phi), .0008+.0032*math.cos(phi)))
levels += [(1, .0003), (.997, .00018), (.986, .00008), (.97, .00002)]
for radius, z in levels:
    for index in range(segments):
        theta = 2*math.pi*index/segments
        vertices.append((.007*radius*math.cos(theta), .010*radius*math.sin(theta), z))
faces = [(0, 1+i, 1+(i+1)%segments) for i in range(segments)]
for ring in range(len(levels)-1):
    a, b = 1+ring*segments, 1+(ring+1)*segments
    for i in range(segments):
        j = (i+1)%segments
        faces.append((a+i, b+i, b+j, a+j))
faces.append(tuple(reversed(range(1+(len(levels)-1)*segments, 1+len(levels)*segments))))
mesh = bpy.data.meshes.new("Closed Oval 20x14x4mm Mesh")
mesh.from_pydata(vertices, [], faces, shade_flat=False)
mesh.validate()
mesh.update()
edge_usage = Counter(tuple(sorted((face[i], face[(i+1)%len(face)]))) for face in faces for i in range(len(face)))
assert all(count == 2 for count in edge_usage.values()), "Cabochon mesh must be closed"
obj = bpy.data.objects.new("Oval Cabochon 20x14x4mm", mesh)
scene.collection.objects.link(obj)
obj.data.materials.append(material)
for polygon in mesh.polygons:
    polygon.use_smooth = True
mesh.polygons[-1].use_smooth = False
obj["description"] = "Plain polished green oval, domed face, flat back, rounded girdle"
obj["example_dimensions_mm"] = "20 x 14 x 4"

camera_data = bpy.data.cameras.new("Cabochon Preview Camera")
camera = bpy.data.objects.new("Cabochon Preview Camera", camera_data)
scene.collection.objects.link(camera)
scene.camera = camera
camera_data.type = "ORTHO"
camera_data.ortho_scale = .026
target = Vector((0, 0, .0018))

def light(name, position, energy, size):
    data = bpy.data.lights.new(name, "AREA")
    data.energy, data.size = energy, size
    data.shape = "RECTANGLE"
    data.size_y = size*.65
    item = bpy.data.objects.new(name, data)
    scene.collection.objects.link(item)
    item.location = position
    item.rotation_euler = (target-Vector(position)).to_track_quat("-Z", "Y").to_euler()

light("Upper Left Softbox", (-.035, .04, .065), .075, .045)
light("Right Fill", (.04, -.015, .05), .012, .045)
light("Low Edge Reflection", (.015, -.045, .03), .025, .025)

camera.location = (0, 0, .12)
camera.rotation_euler = (0, 0, 0)
scene.render.filepath = str(OUT / "front.png")
bpy.context.view_layer.update()
bpy.ops.render.render(write_still=True)
camera.location = (.045, -.025, .1)
camera.rotation_euler = (target-Vector(camera.location)).to_track_quat("-Z", "Y").to_euler()
scene.render.filepath = str(OUT / "poster.png")
bpy.ops.render.render(write_still=True)

# Blender Z-up to glTF Y-up: rotate the face to glTF +Z, with length upright.
obj.rotation_euler.x = math.pi*.5
bpy.context.view_layer.objects.active = obj
bpy.ops.object.select_all(action="DESELECT")
obj.select_set(True)
bpy.context.view_layer.update()
bpy.ops.export_scene.gltf(filepath=str(OUT / "oval.glb"), export_format="GLB", use_selection=True, use_active_scene=True, export_yup=True, export_apply=True, export_extras=True)
obj.rotation_euler.x = 0
bpy.context.view_layer.update()
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "assets/lapidary/oval-interactive-v1.blend"))
print(json.dumps({"assets": str(OUT), "mesh_closed": True, "dimensions_mm": [20,14,4], "vertices": len(vertices), "faces": len(faces)}))
