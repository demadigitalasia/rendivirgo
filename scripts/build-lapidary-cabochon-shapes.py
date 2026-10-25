"""Build plain green interactive cabochon models for the custom-order shape picker."""
import bpy
import math
import sys
import numpy as np
from collections import Counter
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
MODEL_ROOT = ROOT / "public/models/lapidary"
BLEND_PATH = ROOT / "assets/lapidary/cabochon-interactive-v1.blend"
MODEL_ROOT.mkdir(parents=True, exist_ok=True)
BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)

SHAPES = {
    "split-oval": (10, 24, 4),
    "split-marquise": (9, 28, 4),
    "fan": (18, 20, 4),
    "wing": (12, 28, 4),
    "tapered-baton": (7, 32, 3.5),
    "kite": (14, 28, 4),
    "rounded-rectangle": (10, 26, 4),
    "oval": (14, 20, 4),
    "round": (16, 16, 4),
    "teardrop": (15, 20, 4),
    "long-oval": (10, 22, 4),
    "cushion": (17, 17, 4),
    "freeform": (17, 18, 4),
    "pear": (16, 20, 4),
    "marquise": (11, 23, 4),
    "half-oval": (24, 12, 4),
    "rounded-triangle": (18, 20, 4),
    "side-tongue": (13, 22, 4),
    "ladder-trapezoid": (14, 23, 4),
    "rhombus": (12, 24, 4),
    "keystone": (15, 21, 4),
    "tongue": (14, 22, 4),
    "cartouche": (14, 22, 4),
    "wide-shield": (22, 13, 4),
    "bowed-rectangle": (15, 22, 4),
    "barrel": (14, 22, 4),
    "shield": (15, 23, 4),
    "trillion": (19, 20, 4),
    "bowed-triangle": (22, 16, 4),
    "emerald-octagon": (17, 20, 4),
}
SEGMENTS = 128
RINGS = 40

scene = bpy.data.scenes.new("Cabochon Shape Interactive Studio")
bpy.context.window.scene = scene
scene.unit_settings.system = "METRIC"
scene.unit_settings.length_unit = "MILLIMETERS"
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.render.film_transparent = True
scene.render.resolution_x = scene.render.resolution_y = 768
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.view_settings.look = "AgX - Medium High Contrast"
scene.world = bpy.data.worlds.new("Soft Neutral Studio")
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = .6

material = bpy.data.materials.new("Plain Green Polished Cabochon")
material.diffuse_color = (.025, .19, .09, 1)
material.use_nodes = True
bsdf = material.node_tree.nodes.get("Principled BSDF")
bsdf.inputs["Base Color"].default_value = material.diffuse_color
bsdf.inputs["Roughness"].default_value = .28
bsdf.inputs["Metallic"].default_value = 0
bsdf.inputs["IOR"].default_value = 1.48
bsdf.inputs["Coat Weight"].default_value = .1
bsdf.inputs["Coat Roughness"].default_value = .3

def signed_power(value, power):
    return math.copysign(abs(value) ** power, value)

def bezier(t, points):
    weights = ((1-t)**3, 3*(1-t)**2*t, 3*(1-t)*t*t, t**3)
    return tuple(sum(w*p[axis] for w, p in zip(weights, points)) for axis in (0, 1))

def rounded_polygon(points, rounding=.10):
    result = []
    for i, p in enumerate(points):
        prev, nxt = points[i-1], points[(i+1) % len(points)]
        entry = tuple(p[j]+(prev[j]-p[j])*rounding for j in (0,1))
        leave = tuple(p[j]+(nxt[j]-p[j])*rounding for j in (0,1))
        for k in range(12):
            t = k/12
            result.append(tuple((1-t)**2*entry[j]+2*(1-t)*t*p[j]+t*t*leave[j] for j in (0,1)))
        end = tuple(nxt[j]+(p[j]-nxt[j])*rounding for j in (0,1))
        for k in range(20):
            result.append(tuple(leave[j]+(end[j]-leave[j])*k/20 for j in (0,1)))
    return result

POLYGONS = {
    "kite": ([(0,1),(1,-.25),(0,-1),(-1,-.25)], .09),
    "fan": ([(-.5,1),(.5,1),(1,-.65),(0,-1),(-1,-.65)], .18),
    "tapered-baton": ([(-.9,1),(.9,1),(.35,-1),(-.35,-1)], .2),
    "rounded-rectangle": ([(-1,1),(1,1),(1,-1),(-1,-1)], .2),
    "rounded-triangle": ([(-1,1),(1,1),(0,-1)], .22),
    "ladder-trapezoid": ([(-.55,1),(.55,1),(1,-1),(-1,-1)], .055),
    "rhombus": ([(0,1),(1,0),(0,-1),(-1,0)], .055),
    "emerald-octagon": ([(-.72,1),(.72,1),(1,.75),(1,-.75),(.72,-1),(-.72,-1),(-1,-.75),(-1,.75)], .045),
}
CURVES = {
    "split-oval": [((1,1),(-.12,1),(-1,.55),(-1,0)),((-1,0),(-1,-.55),(-.12,-1),(1,-1)),((1,-1),(1,-.33),(1,.33),(1,1))],
    "split-marquise": [((1,1),(.25,.65),(-1,.22),(-1,0)),((-1,0),(-1,-.22),(.25,-.65),(1,-1)),((1,-1),(1,-.33),(1,.33),(1,1))],
    "wing": [((1,1),(.1,.9),(-.55,.7),(-1,.45)),((-1,.45),(-.8,-.05),(.25,-.7),(1,-1)),((1,-1),(.8,-.25),(.85,.5),(1,1))],
    "side-tongue": [((-1,.58),(-.55,.85),(.25,1),(1,1)),((1,1),(1,.15),(.8,-1),(.02,-1)),((.02,-1),(-.6,-1),(-1,-.15),(-1,.58))],
    "tongue": [((-1,1),(-.4,1),(.4,1),(1,1)),((1,1),(1,.15),(.9,-1),(0,-1)),((0,-1),(-.9,-1),(-1,.15),(-1,1))],
    "shield": [((-1,.85),(-.4,1.05),(.4,1.05),(1,.85)),((1,.85),(1,-.15),(.85,-.85),(0,-1)),((0,-1),(-.85,-.85),(-1,-.15),(-1,.85))],
    "wide-shield": [((-1,.7),(-.4,1.1),(.4,1.1),(1,.7)),((1,.7),(.95,-.3),(.6,-1),(0,-1)),((0,-1),(-.6,-1),(-.95,-.3),(-1,.7))],
    "trillion": [((-1,.85),(-.4,1.1),(.4,1.1),(1,.85)),((1,.85),(.95,.05),(.55,-.75),(0,-1)),((0,-1),(-.55,-.75),(-.95,.05),(-1,.85))],
    "bowed-triangle": [((-1,.65),(-.4,1.12),(.4,1.12),(1,.65)),((1,.65),(.85,-.05),(.45,-.8),(0,-1)),((0,-1),(-.45,-.8),(-.85,-.05),(-1,.65))],
    "barrel": [((-.88,.9),(-.3,1.05),(.3,1.05),(.88,.9)),((.88,.9),(.98,.3),(.98,-.3),(.88,-.9)),((.88,-.9),(.3,-1.05),(-.3,-1.05),(-.88,-.9)),((-.88,-.9),(-.98,-.3),(-.98,.3),(-.88,.9))],
    "bowed-rectangle": [((-.72,.95),(-.25,1.05),(.25,1.05),(.72,.95)),((.72,.95),(1.08,.75),(1.08,-.75),(.72,-.95)),((.72,-.95),(.25,-1.05),(-.25,-1.05),(-.72,-.95)),((-.72,-.95),(-1.08,-.75),(-1.08,.75),(-.72,.95))],
    "keystone": [((-.62,1),(-.2,1),(.2,1),(.62,1)),((.62,1),(.75,.35),(.9,-.4),(1,-.8)),((1,-.8),(.4,-1.08),(-.4,-1.08),(-1,-.8)),((-1,-.8),(-.9,-.4),(-.75,.35),(-.62,1))],
}
BOUNDARIES = {}
for key, (points, rounding) in POLYGONS.items():
    BOUNDARIES[key] = rounded_polygon(points, rounding)
for key, curves in CURVES.items():
    BOUNDARIES[key] = [bezier(i/80, curve) for curve in curves for i in range(80)]
BOUNDARIES["half-oval"] = [(math.cos(t*math.pi/160), 1-2*math.sin(t*math.pi/160)) for t in range(161)] + [(-1+2*t/80,1) for t in range(1,80)]
for key, points in BOUNDARIES.items():
    # Normalize dimensions and enforce counterclockwise face winding.
    mins = [min(p[j] for p in points) for j in (0,1)]
    maxs = [max(p[j] for p in points) for j in (0,1)]
    points = [tuple(2*(p[j]-mins[j])/(maxs[j]-mins[j])-1 for j in (0,1)) for p in points]
    area = sum(p[0]*points[(i+1)%len(points)][1]-points[(i+1)%len(points)][0]*p[1] for i,p in enumerate(points))
    BOUNDARIES[key] = points if area > 0 else list(reversed(points))

def outline(theta, key, width, length):
    c, s = math.cos(theta), math.sin(theta)
    a, b = width / 2000, length / 2000
    if key in BOUNDARIES:
        points = BOUNDARIES[key]
        at = (theta/(2*math.pi) % 1)*len(points)
        index = int(at)
        t = at-index
        p, q = points[index], points[(index+1)%len(points)]
        return a*(p[0]+(q[0]-p[0])*t), b*(p[1]+(q[1]-p[1])*t)
    if key == "cartouche":
        # Capsule with long straight sides and semicircular ends.
        return a*c, (b-a)*math.copysign(1,s)+a*s
    if key == "cushion":
        n = 4.0
        return a * signed_power(c, 2 / n), b * signed_power(s, 2 / n)
    if key == "marquise":
        # A symmetric lens with pinched tips and a full, convex midsection.
        taper = .2 + .8 * abs(c) ** .5
        return a * c * taper, b * s
    if key in ("teardrop", "pear"):
        # Two tangent-continuous curves form each half: a gently tapered tip,
        # full lower shoulders and a rounded base. No abrupt join at y=0.
        t = math.acos(max(-1, min(1, s))) / math.pi
        shoulder = -.30 if key == "teardrop" else -.18
        tip_control = (.24, .76) if key == "teardrop" else (.36, .79)
        upper = ((0, 1), tip_control, (1, shoulder+.46), (1, shoulder))
        lower = ((1, shoulder), (1, shoulder-.46), (.52, -1), (0, -1))
        x, y = bezier(t*2, upper) if t <= .5 else bezier((t-.5)*2, lower)
        return math.copysign(a*x, c), b*y
    if key == "freeform":
        r = 1 + .12 * math.sin(3 * theta + .4) + .06 * math.sin(5 * theta - .8)
        return a * r * c, b * r * s
    return a * c, b * s

def smooth_dome(vertices, faces, count, boundary_start, rim, dome):
    """Solve a smooth cap across the outline instead of extruding its corners.

    A finite-element Poisson surface has continuous curvature in the interior.
    The square-root profile rounds its shoulder into the thin girdle.
    """
    triangles = []
    for face in faces:
        if max(face) >= count:
            continue
        triangles.append(face[:3])
        if len(face) == 4:
            triangles.append((face[0], face[2], face[3]))
    tri = np.asarray(triangles, dtype=np.int32)
    xy = np.asarray(vertices[:count], dtype=np.float64)[:, :2] * 1000
    p = xy[tri]
    area2 = (p[:,1,0]-p[:,0,0])*(p[:,2,1]-p[:,0,1])-(p[:,2,0]-p[:,0,0])*(p[:,1,1]-p[:,0,1])
    assert np.all(area2 > 1e-14), "Dome triangles must have positive area"
    area = area2/2
    gradients = np.stack((p[:,1]-p[:,2], p[:,2]-p[:,0], p[:,0]-p[:,1]), axis=1)
    gradients = np.stack((gradients[:,:,1], -gradients[:,:,0]), axis=2)/area2[:,None,None]
    stiffness = np.einsum('tik,tjk->tij', gradients, gradients)*area[:,None,None]
    rows = np.repeat(tri, 3, axis=1).ravel()
    cols = np.tile(tri, (1,3)).ravel()
    values = stiffness.ravel()
    mask = (rows < boundary_start) & (cols < boundary_start)
    rows, cols, values = rows[mask], cols[mask], values[mask]
    n = boundary_start
    diagonal = np.bincount(rows[rows == cols], weights=values[rows == cols], minlength=n)
    rhs = np.bincount(tri.ravel(), weights=np.repeat(area/3,3), minlength=count)[:n]
    def multiply(x):
        return np.bincount(rows, weights=values*x[cols], minlength=n)
    solution = np.zeros(n)
    residual = rhs.copy()
    direction = residual/diagonal
    rz = np.dot(residual,direction)
    tolerance = np.linalg.norm(rhs)*1e-8
    for iteration in range(3000):
        product = multiply(direction)
        alpha = rz/np.dot(direction,product)
        solution += alpha*direction
        residual -= alpha*product
        if np.linalg.norm(residual) < tolerance:
            break
        preconditioned = residual/diagonal
        next_rz = np.dot(residual,preconditioned)
        direction = preconditioned+(next_rz/rz)*direction
        rz = next_rz
    assert np.linalg.norm(residual) < tolerance*10, "Dome solver did not converge"
    heights = np.sqrt(np.clip(solution/solution.max(),0,1))
    for index in range(count):
        x,y,_ = vertices[index]
        vertices[index] = (x,y,rim+dome*float(heights[index]) if index < n else rim)
    print(f"smooth cap: {iteration+1} iterations, relative residual {np.linalg.norm(residual)/np.linalg.norm(rhs):.2e}")

def make_shape(key, dimensions):
    width, length, thickness = dimensions
    top = thickness / 1000
    rim = top * .2
    dome = top - rim
    center_y = -length/2000*.18 if key in ("teardrop", "pear") else 0
    vertices = [(0, center_y, top)]
    levels = []
    for ring in range(1, RINGS + 1):
        phi = math.pi * .5 * ring / RINGS
        u = math.sin(phi)
        z = rim + dome * math.cos(phi)
        levels.append((u, z))
    # Tiny rounded girdle and a nearly flat back keep the form manufacturable.
    levels += [(1, top * .065), (.997, top * .035), (.985, top * .008), (.965, top * .004)]
    for scale, z in levels:
        for i in range(SEGMENTS):
            x, y = outline(2 * math.pi * i / SEGMENTS, key, width, length)
            vertices.append((x * scale, center_y + (y-center_y)*scale, z))
    faces = [(0, 1+i, 1+(i+1)%SEGMENTS) for i in range(SEGMENTS)]
    for ring in range(len(levels) - 1):
        start, nxt = 1 + ring * SEGMENTS, 1 + (ring + 1) * SEGMENTS
        for i in range(SEGMENTS):
            j = (i + 1) % SEGMENTS
            faces.append((start + i, nxt + i, nxt + j, start + j))
    faces.append(tuple(reversed(range(1+(len(levels) - 1) * SEGMENTS, 1+len(levels) * SEGMENTS))))
    smooth_dome(vertices, faces[:-1], 1+RINGS*SEGMENTS, 1+(RINGS-1)*SEGMENTS, rim, dome)
    mesh = bpy.data.meshes.new(f"Closed {key} cabochon mesh")
    mesh.from_pydata(vertices, [], faces, shade_flat=False)
    mesh.validate(); mesh.update()
    edge_usage = Counter(tuple(sorted((face[i], face[(i + 1) % len(face)]))) for face in faces for i in range(len(face)))
    assert all(count == 2 for count in edge_usage.values()), f"{key} mesh is not closed"
    obj = bpy.data.objects.new(f"{key.title()} Cabochon {length}x{width}x{thickness}mm", mesh)
    scene.collection.objects.link(obj)
    mesh.materials.append(material)
    for polygon in mesh.polygons: polygon.use_smooth = True
    mesh.polygons[-1].use_smooth = False
    obj["description"] = "Plain polished green cabochon, domed face, rounded girdle, flat back"
    obj["example_dimensions_mm"] = f"{length} x {width} x {thickness}"
    return obj, vertices, faces

def add_light(name, position, energy, size, target):
    data = bpy.data.lights.new(name, "AREA")
    data.energy, data.shape, data.size, data.size_y = energy, "RECTANGLE", size, size * .65
    item = bpy.data.objects.new(name, data); scene.collection.objects.link(item); item.location = position
    item.rotation_euler = (target - Vector(position)).to_track_quat("-Z", "Y").to_euler()

target = Vector((0, 0, .0018))
add_light("Upper Left Softbox", (-.035, .04, .065), .04, .045, target)
add_light("Right Fill", (.04, -.015, .05), .01, .045, target)
add_light("Low Edge Reflection", (.015, -.045, .03), .01, .025, target)
camera_data = bpy.data.cameras.new("Cabochon Preview Camera")
camera = bpy.data.objects.new("Cabochon Preview Camera", camera_data); scene.collection.objects.link(camera); scene.camera = camera
camera_data.type = "ORTHO"; camera.location = (0, 0, .12); camera.rotation_euler = (0, 0, 0)

only = sys.argv[sys.argv.index("--only")+1].split(",") if "--only" in sys.argv else None
for key, dimensions in SHAPES.items():
    if only and key not in only:
        continue
    # Keep all sources in the blend, but render only the current shape.
    for existing in scene.objects:
        if existing.type == "MESH":
            existing.hide_render = True
    obj, vertices, faces = make_shape(key, dimensions)
    folder = MODEL_ROOT / f"{key}-v1"; folder.mkdir(parents=True, exist_ok=True)
    camera_data.ortho_scale = max(dimensions[:2]) / 1000 * 1.42
    asset_version = 4
    scene.render.filepath = str(folder / f"front-v{asset_version}.png")
    bpy.context.view_layer.update(); bpy.ops.render.render(write_still=True)
    camera.location = (.045, -.025, .1)
    camera.rotation_euler = (target - Vector(camera.location)).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = str(folder / f"poster-v{asset_version}.png")
    bpy.ops.render.render(write_still=True)
    camera.location = (0, 0, .12); camera.rotation_euler = (0, 0, 0)
    obj.rotation_euler.x = math.pi * .5
    bpy.ops.object.select_all(action="DESELECT"); obj.select_set(True); bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(filepath=str(folder / f"{key}.glb"), export_format="GLB", use_selection=True, use_active_scene=True, export_yup=True, export_apply=True, export_extras=True)
    obj.rotation_euler.x = 0
    print(f"built {key}: {len(vertices)} vertices, {len(faces)} faces")

bpy.ops.object.select_all(action="DESELECT")
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "outputs/lapidary/dome-audit.blend" if only else BLEND_PATH))
print(f"saved {BLEND_PATH}")
