"""Render one upright, texture-free satin cabochon for visual approval."""

import bpy
import json
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "outputs/lapidary/satin-preview"
OUTPUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT / "assets/lapidary/cabochon-shapes.blend"))
scene = bpy.data.scenes["RV Cabochon CAD Studio"]
bpy.context.window.scene = scene
scene.name = "RV Satin Cabochon Preview"

for collection in scene.collection.children:
    if collection.name.startswith("RV Shape | "):
        collection.hide_render = collection.name != "RV Shape | oval"
        collection.hide_viewport = collection.name != "RV Shape | oval"

for obj in scene.objects:
    if obj.type == "CURVE":
        obj.hide_render = True
        obj.hide_viewport = True
    elif obj.type == "MESH":
        obj.rotation_euler = (0, 0, 0)

surface = bpy.data.materials["Satin Sage Green CAD Surface"]
surface.name = "Plain Forest Green Satin"
surface.diffuse_color = (.055, .28, .15, 1)
bsdf = surface.node_tree.nodes.get("Principled BSDF")
bsdf.inputs["Base Color"].default_value = (.055, .28, .15, 1)
bsdf.inputs["Roughness"].default_value = .34
bsdf.inputs["Metallic"].default_value = 0
bsdf.inputs["Coat Weight"].default_value = .12
bsdf.inputs["Coat Roughness"].default_value = .34
rim = bpy.data.materials["Deep Green Flat Back and Girdle"]
rim.diffuse_color = (.045, .23, .12, 1)
rim_bsdf = rim.node_tree.nodes.get("Principled BSDF")
rim_bsdf.inputs["Base Color"].default_value = (.045, .23, .12, 1)
rim_bsdf.inputs["Roughness"].default_value = .4
rim_bsdf.inputs["Metallic"].default_value = 0

camera = scene.camera
camera.location = (0, 0, 12)
camera.rotation_euler = (0, 0, 0)
camera.data.ortho_scale = 2.65
target = Vector((0, 0, .15))
lights = [
    ("Large Upper Left Softbox", (-3.5, 4.0, 6.5), 550, 4.5),
    ("Right Fill Softbox", (4, -1.5, 5), 70, 5),
    ("Back Rim Softbox", (1, -4, 4), 35, 3.5),
]
for name, location, energy, size in lights:
    light = bpy.data.objects[name]
    light.location = location
    light.rotation_euler = (target-Vector(location)).to_track_quat("-Z", "Y").to_euler()
    light.data.energy = energy
    light.data.size = size

scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (1, 1, 1, 1)
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = .25
scene.render.resolution_x = 1024
scene.render.resolution_y = 1024
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.cycles.samples = 96
scene.render.filepath = str(OUTPUT / "oval-satin-front.png")
bpy.context.view_layer.update()
bpy.ops.render.render(write_still=True)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "assets/lapidary/cabochon-satin-preview.blend"))
print(json.dumps({"png": scene.render.filepath, "style": "upright front view, plain green satin, no textures or lines"}))
