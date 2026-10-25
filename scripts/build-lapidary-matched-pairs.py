"""Compose existing smooth cabochons into matched pairs, preserving their domes."""
import bpy
from pathlib import Path
from mathutils import Vector
ROOT = Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.render.resolution_x = 512
scene.render.resolution_y = 512
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.world.color = (.3, .3, .3)
for name, pos, energy, size in [('Key',(-.04,.05,.08),.08,.05),('Fill',(.05,-.02,.06),.03,.05)]:
    data=bpy.data.lights.new(name,'AREA'); data.energy=energy; data.shape='DISK'; data.size=size
    obj=bpy.data.objects.new(name,data); scene.collection.objects.link(obj); obj.location=pos
    obj.rotation_euler=(Vector((0,0,0))-obj.location).to_track_quat('-Z','Y').to_euler()
data=bpy.data.cameras.new('Pair camera'); camera=bpy.data.objects.new('Pair camera',data); scene.collection.objects.link(camera); scene.camera=camera; data.type='ORTHO'
for folder in sorted((ROOT/'public/models/lapidary').glob('*-v1')):
    key=folder.name[:-3]; source=folder/f'{key}.glb'
    if not source.exists(): continue
    if (folder/'matched-pair-v1.glb').exists(): continue
    bpy.ops.import_scene.gltf(filepath=str(source))
    meshes=[o for o in bpy.context.selected_objects if o.type=='MESH']
    if not meshes: continue
    left=meshes[0]
    bpy.context.view_layer.update()
    width=left.dimensions.x
    left.location.x=-width*.58
    right=left.copy(); right.data=left.data.copy(); scene.collection.objects.link(right); right.location.x=width*.58
    # Reflection across the vertical plane produces a true left/right pair.
    if key in ('freeform','side-tongue','split-oval','split-marquise','wing'): right.scale.x *= -1
    bpy.ops.object.select_all(action='DESELECT'); left.select_set(True); right.select_set(True)
    bpy.context.view_layer.objects.active=right
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    bpy.ops.export_scene.gltf(filepath=str(folder/'matched-pair-v1.glb'),export_format='GLB',use_selection=True,export_yup=True)
    data.ortho_scale=max(width*2.65,left.dimensions.y*1.35)
    camera.location=(0,0,.15); camera.rotation_euler=(0,0,0)
    # Imported glTF is converted back into Blender's Z-up space: the dome faces -Y.
    camera.location=(0,-.15,0); camera.rotation_euler=(Vector((0,0,0))-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(folder/'matched-pair-front-v1.png'); bpy.ops.render.render(write_still=True)
    camera.location=(.035,-.15,.025); camera.rotation_euler=(Vector((0,0,0))-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(folder/'matched-pair-poster-v1.png'); bpy.ops.render.render(write_still=True)
    for obj in meshes+[right]: bpy.data.objects.remove(obj,do_unlink=True)
    print('Built matched pair:',key,flush=True)
