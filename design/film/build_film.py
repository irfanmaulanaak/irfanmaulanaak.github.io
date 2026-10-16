import json
import math
import os
import sys

import bmesh
import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Vector

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
BLEND_OUT = ARGS[0] if ARGS else "/tmp/film.blend"
TRACKS_OUT = ARGS[1] if len(ARGS) > 1 else "/tmp/film-tracks.json"
FRAMES = 252
HX, BX = 34.0, 68.0

for ob in list(bpy.data.objects):
    bpy.data.objects.remove(ob, do_unlink=True)
sc = bpy.context.scene
sc.name = "Film"


def set_interp(target, path, index, frame, interp):
    owner = target.id_data
    full = path if target == owner else target.path_from_id(path)
    ad = owner.animation_data
    bag = ad.action.layers[0].strips[0].channelbag(ad.action_slot)
    for fc in bag.fcurves:
        if fc.data_path == full and (index < 0 or fc.array_index == index):
            for kp in fc.keyframe_points:
                if abs(kp.co[0] - frame) < 1e-3:
                    kp.interpolation = interp


def key(target, path, frame, value=None, index=-1, interp="BEZIER"):
    if value is not None:
        cur = getattr(target, path)
        if index >= 0:
            cur[index] = value
        elif hasattr(cur, "__len__") and not isinstance(cur, str):
            cur[:] = value
        else:
            setattr(target, path, value)
    target.keyframe_insert(path, index=index, frame=frame)
    if interp != "BEZIER":
        set_interp(target, path, index, frame, interp)


def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c) + (1,)


def base_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bs = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bs.outputs[0], out.inputs[0])
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    return m, nt, bs, mp


def ramp(nt, fac, c1, c2, p1=0.0, p2=1.0):
    r = nt.nodes.new("ShaderNodeValToRGB")
    e = r.color_ramp.elements
    e[0].position, e[0].color = p1, srgb(c1)
    e[1].position, e[1].color = p2, srgb(c2)
    nt.links.new(fac, r.inputs["Fac"])
    return r


def bump(nt, bs, h, strength=0.2, dist=0.02):
    b = nt.nodes.new("ShaderNodeBump")
    b.inputs["Strength"].default_value = strength
    b.inputs["Distance"].default_value = dist
    nt.links.new(h, b.inputs["Height"])
    nt.links.new(b.outputs["Normal"], bs.inputs["Normal"])


def noise(nt, vec, scale, detail=6, rough=0.55):
    n = nt.nodes.new("ShaderNodeTexNoise")
    n.inputs["Scale"].default_value = scale
    n.inputs["Detail"].default_value = detail
    n.inputs["Roughness"].default_value = rough
    nt.links.new(vec, n.inputs["Vector"])
    return n


def plaster(name, c1, c2, scale=18, b=0.08, rough=0.9):
    m, nt, bs, mp = base_mat(name)
    n = noise(nt, mp.outputs[0], scale)
    nt.links.new(ramp(nt, n.outputs["Fac"], c1, c2, 0.35, 0.7).outputs[0], bs.inputs["Base Color"])
    bs.inputs["Roughness"].default_value = rough
    bump(nt, bs, n.outputs["Fac"], b)
    return m


def fabric(name, c1, c2, scale=220):
    m, nt, bs, mp = base_mat(name)
    w1 = nt.nodes.new("ShaderNodeTexWave"); w1.wave_type = "BANDS"; w1.bands_direction = "X"; w1.inputs["Scale"].default_value = scale
    w2 = nt.nodes.new("ShaderNodeTexWave"); w2.wave_type = "BANDS"; w2.bands_direction = "Y"; w2.inputs["Scale"].default_value = scale
    for w in (w1, w2):
        nt.links.new(mp.outputs[0], w.inputs["Vector"])
    mx = nt.nodes.new("ShaderNodeMath"); mx.operation = "MULTIPLY"
    nt.links.new(w1.outputs["Fac"], mx.inputs[0]); nt.links.new(w2.outputs["Fac"], mx.inputs[1])
    n = noise(nt, mp.outputs[0], 6, 4)
    nt.links.new(ramp(nt, n.outputs["Fac"], c1, c2, 0.3, 0.75).outputs[0], bs.inputs["Base Color"])
    bs.inputs["Roughness"].default_value = 0.95
    bump(nt, bs, mx.outputs[0], 0.35, 0.01)
    return m


def wood(name, c1, c2, scale=3.0, planks=False):
    m, nt, bs, mp = base_mat(name)
    mp.inputs["Scale"].default_value = (1, 6, 1)
    w = nt.nodes.new("ShaderNodeTexWave"); w.wave_type = "RINGS"
    w.inputs["Scale"].default_value = scale; w.inputs["Distortion"].default_value = 6; w.inputs["Detail"].default_value = 3
    nt.links.new(mp.outputs[0], w.inputs["Vector"])
    col = ramp(nt, w.outputs["Fac"], c1, c2, 0.2, 0.8).outputs[0]
    if planks:
        br = nt.nodes.new("ShaderNodeTexBrick")
        br.inputs["Scale"].default_value = 1.6; br.inputs["Mortar Size"].default_value = 0.006
        br.inputs["Brick Width"].default_value = 2.2; br.inputs["Row Height"].default_value = 0.22
        br.inputs["Color1"].default_value = (1, 1, 1, 1); br.inputs["Color2"].default_value = (0.8, 0.8, 0.8, 1)
        br.inputs["Mortar"].default_value = (0, 0, 0, 1)
        tc2 = nt.nodes.new("ShaderNodeTexCoord"); nt.links.new(tc2.outputs["Object"], br.inputs["Vector"])
        mul = nt.nodes.new("ShaderNodeMix"); mul.data_type = "RGBA"; mul.blend_type = "MULTIPLY"; mul.inputs["Factor"].default_value = 1.0
        nt.links.new(col, mul.inputs[6]); nt.links.new(br.outputs["Color"], mul.inputs[7]); col = mul.outputs[2]
        bump(nt, bs, br.outputs["Fac"], 0.4, 0.01)
    else:
        bump(nt, bs, w.outputs["Fac"], 0.06, 0.01)
    nt.links.new(col, bs.inputs["Base Color"])
    bs.inputs["Roughness"].default_value = 0.55
    return m


def metal(name, c1, c2, rough=0.35, metallic=0.35, brushed=True):
    m, nt, bs, mp = base_mat(name)
    if brushed:
        mp.inputs["Scale"].default_value = (1, 1, 60)
    n = noise(nt, mp.outputs[0], 40, 8, 0.7)
    nt.links.new(ramp(nt, n.outputs["Fac"], c1, c2, 0.3, 0.7).outputs[0], bs.inputs["Base Color"])
    bs.inputs["Metallic"].default_value = metallic
    bs.inputs["Roughness"].default_value = rough
    return m


def concrete(name, c1, c2):
    m, nt, bs, mp = base_mat(name)
    n = noise(nt, mp.outputs[0], 9, 10, 0.6)
    v = nt.nodes.new("ShaderNodeTexVoronoi"); v.inputs["Scale"].default_value = 60; nt.links.new(mp.outputs[0], v.inputs["Vector"])
    mx = nt.nodes.new("ShaderNodeMath"); mx.operation = "MULTIPLY"
    nt.links.new(n.outputs["Fac"], mx.inputs[0]); nt.links.new(v.outputs["Distance"], mx.inputs[1])
    nt.links.new(ramp(nt, n.outputs["Fac"], c1, c2, 0.35, 0.7).outputs[0], bs.inputs["Base Color"])
    bs.inputs["Roughness"].default_value = 0.92
    bump(nt, bs, mx.outputs[0], 0.15, 0.02)
    return m


def glow(name, hexc, strength, base=None):
    m, nt, bs, mp = base_mat(name)
    bs.inputs["Base Color"].default_value = srgb(base or hexc)
    bs.inputs["Emission Color"].default_value = srgb(hexc)
    bs.inputs["Emission Strength"].default_value = strength
    bs.inputs["Roughness"].default_value = 0.4
    return m


def flat(name, hexc, rough=0.5):
    m, nt, bs, mp = base_mat(name)
    bs.inputs["Base Color"].default_value = srgb(hexc)
    bs.inputs["Roughness"].default_value = rough
    return m


M = {
    "ground": concrete("ground", "#171717", "#202020"),
    "slab": concrete("slab", "#1e1e1e", "#2a2a29"),
    "plaster": plaster("plaster", "#dcd6cb", "#ece8e0"),
    "oakfloor": wood("oakfloor", "#7a5a3c", "#a88560", 4.0, True),
    "walnut": wood("walnut", "#4a3324", "#6e4d34", 3.0),
    "oak": wood("oak", "#9b7650", "#c09a70", 3.5),
    "linen": fabric("linen", "#d9d2c5", "#ebe6dc"),
    "sofa": fabric("sofa", "#6d7066", "#858a7e"),
    "rug": fabric("rug", "#5268c9", "#7d97ff", 160),
    "marble": plaster("marble", "#d8d4cc", "#f2efe9", 4, 0.02, 0.2),
    "terracotta": plaster("terracotta", "#9c5a3c", "#b8704c", 30, 0.1),
    "leaf": plaster("leaf", "#4c6a3f", "#6f8a5c", 12, 0.2, 0.7),
    "steel": metal("steel", "#8d8f91", "#b9bbbd"),
    "darksteel": metal("darksteel", "#3a3b3d", "#56585b", 0.4),
    "rubber": concrete("rubber", "#151515", "#222222"),
    "cardboard": plaster("cardboard", "#a57f52", "#c29c6c", 40, 0.12, 0.85),
    "tape": plaster("tape", "#8a6b45", "#9d7b52", 80, 0.03, 0.4),
    "slate": plaster("slate", "#3c3f44", "#565a60", 14, 0.2, 0.7),
    "sandstone": plaster("sandstone", "#b59c7a", "#cdb898", 25, 0.25, 0.9),
    "plastic": plaster("plastic", "#e9e7e2", "#f4f2ee", 60, 0.02, 0.45),
    "cardblack": plaster("cardblack", "#111113", "#1d1d20", 90, 0.03, 0.35),
    "gold": metal("gold", "#b8914a", "#e0bd72", 0.25, 0.55, False),
        "line": glow("line", "#3f5fff", 1.3, "#0a0f2a"),
    "ring": glow("ring", "#7d97ff", 1.0),
    "tick": glow("tick", "#ffffff", 2.0),
    "screen": flat("screen", "#2a2a2a", 0.3),
    "lamp": flat("lamp", "#2a2a2a", 0.4),
}


def link(o, mat, bevel=0.0, parent=None, smooth=True):
    sc.collection.objects.link(o)
    o.data.materials.append(M[mat] if isinstance(mat, str) else mat)
    if bevel:
        b = o.modifiers.new("bevel", "BEVEL"); b.width = bevel; b.segments = 3; b.limit_method = "ANGLE"
    if smooth:
        for p in o.data.polygons:
            p.use_smooth = True
    if parent:
        o.parent = parent
    return o


def box(name, sx, sy, sz, mat, loc=(0, 0, 0), bevel=0.03, parent=None, rot=(0, 0, 0), anchor="bottom"):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
    if anchor == "bottom":
        bmesh.ops.translate(bm, vec=(0, 0, sz / 2), verts=bm.verts)
    elif anchor == "start":
        bmesh.ops.translate(bm, vec=(sx / 2, 0, 0), verts=bm.verts)
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me)
    o.location = loc; o.rotation_euler = rot
    return link(o, mat, bevel, parent)


def cyl(name, r, h, mat, loc=(0, 0, 0), seg=32, r2=None, bevel=0.0, parent=None):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=h)
    bmesh.ops.translate(bm, vec=(0, 0, h / 2), verts=bm.verts)
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me)
    o.location = loc
    return link(o, mat, bevel, parent, smooth=seg > 8)


def torus(name, mat, R=1.0, r=0.035, U=64, V=8):
    me = bpy.data.meshes.new(name)
    verts, faces = [], []
    for i in range(U):
        a = 2 * math.pi * i / U
        for j in range(V):
            b = 2 * math.pi * j / V
            verts.append(((R + r * math.cos(b)) * math.cos(a), (R + r * math.cos(b)) * math.sin(a), r * math.sin(b)))
    for i in range(U):
        for j in range(V):
            faces.append((i * V + j, ((i + 1) % U) * V + j, ((i + 1) % U) * V + (j + 1) % V, i * V + (j + 1) % V))
    me.from_pydata(verts, [], faces); me.update()
    return link(bpy.data.objects.new(name, me), mat)


def empty(name, loc=(0, 0, 0), parent=None):
    e = bpy.data.objects.new(name, None)
    sc.collection.objects.link(e)
    e.location = loc
    if parent:
        e.parent = parent
    return e


Z = 0.0
box("ground", 130, 44, 0.05, "ground", (34, 0, -0.05), 0)

flur = empty("flur")
box("flur_slab", 8.8, 6.8, 0.1, "slab", (0, 0, 0), 0.03, flur)
FZ = 0.1
floor = box("flur_floor", 7.9, 5.9, 0.02, "oakfloor", (0, 0, FZ - 0.04), 0, flur)
for f, z in [(1, FZ - 0.05), (22, FZ - 0.05), (36, FZ - 0.014)]:
    key(floor, "location", f, z, 2)
walls_def = [(-4, -3, -3, -3), (-2.2, -3, 4, -3), (4, -3, 4, 3), (4, 3, -4, 3), (-4, 3, -4, -3),
             (1, 3, 1, -0.2), (1, -1.1, 1, -3), (-4, 1, -2.2, 1), (-2.2, 3, -2.2, 1.9)]
for i, (x1, y1, x2, y2) in enumerate(walls_def):
    L = math.hypot(x2 - x1, y2 - y1); a = math.atan2(y2 - y1, x2 - x1)
    pl = box(f"plan_{i}", L + 0.12, 0.05, 0.012, "line", (x1, y1, FZ), 0, flur, (0, 0, a), "start")
    pl.data.transform(Matrix.Translation((-0.06, 0, 0)))
    s = 1 + i * 3
    key(pl, "scale", 1, (0.001, 1, 1)); key(pl, "scale", s, (0.001, 1, 1)); key(pl, "scale", s + 12, (1, 1, 1))
    wl = box(f"wall_{i}", L + 0.12, 0.12, 1.15, "plaster", (x1, y1, FZ - 0.03), 0.015, flur, (0, 0, a), "start")
    wl.data.transform(Matrix.Translation((-0.06, 0, 0)))
    s = 28 + i * 3
    key(wl, "scale", 1, (1, 1, 0.001)); key(wl, "scale", s, (1, 1, 0.001)); key(wl, "scale", s + 12, (1, 1, 1))


def cube(sx, sy, sz, mat="plaster", ox=0, oy=0, oz=0):
    return (sx, sy, sz, mat, ox, oy, oz)


pieces = [
    ("rug", (-1.4, -1.3), [cube(2.6, 1.7, 0.02, "rug")]),
    ("sofa", (-1.4, -2.45), [cube(2.2, 0.85, 0.4, "sofa"), cube(2.2, 0.22, 0.42, "sofa", oy=-0.33, oz=0.4), cube(0.2, 0.85, 0.25, "sofa", ox=-1.0, oz=0.4), cube(0.2, 0.85, 0.25, "sofa", ox=1.0, oz=0.4)]),
    ("coffee", (-1.4, -1.25), [cube(1.0, 0.6, 0.35, "walnut")]),
    ("armchair", (0.25, -1.3), [cube(0.8, 0.8, 0.4, "sofa"), cube(0.2, 0.8, 0.4, "sofa", ox=0.3, oz=0.4)]),
    ("plant", (0.55, -2.6), [cube(0.35, 0.35, 0.35, "terracotta"), cube(0.55, 0.55, 0.55, "leaf", oz=0.35)]),
    ("kitchen", (-0.6, 2.62), [cube(2.8, 0.62, 0.9, "marble")]),
    ("dining", (-0.6, 1.25), [cube(1.3, 0.8, 0.72, "oak")] + [cube(0.42, 0.42, 0.45, "walnut", ox=x, oy=y) for x in (-0.35, 0.35) for y in (-0.62, 0.62)]),
    ("bed", (2.7, 1.6), [cube(1.6, 2.0, 0.45, "linen"), cube(1.6, 0.12, 0.9, "walnut", oy=0.95), cube(0.62, 0.38, 0.12, "linen", ox=-0.38, oy=0.62, oz=0.45), cube(0.62, 0.38, 0.12, "linen", ox=0.38, oy=0.62, oz=0.45)]),
    ("night1", (1.5, 2.55), [cube(0.4, 0.4, 0.45, "walnut")]),
    ("night2", (3.72, 2.55), [cube(0.4, 0.4, 0.45, "walnut")]),
    ("desk", (2.7, -2.62), [cube(1.3, 0.6, 0.75, "oak"), cube(0.45, 0.45, 0.45, "sofa", oy=0.62)]),
    ("tub", (-3.55, 2.15), [cube(0.72, 1.5, 0.5, "marble")]),
    ("sink", (-2.65, 2.7), [cube(0.5, 0.4, 0.8, "marble")]),
]
piece_obj = {}
for i, (name, (px, py), parts) in enumerate(pieces):
    e = empty(name, (px, py, FZ), flur)
    piece_obj[name] = e
    for j, (sx, sy, sz, mat, ox, oy, oz) in enumerate(parts):
        box(f"{name}_{j}", sx, sy, sz, mat, (ox, oy, oz), min(0.04, sz / 3), e)
    s = 60 + i * 3
    up = (px, py, FZ + 2.4)
    for f, loc, k in [(1, up, 0), (s, up, 0), (s + 9, (px, py, FZ - 0.04), 1.04), (s + 13, (px, py, FZ), 1)]:
        key(e, "location", f, loc); key(e, "scale", f, (max(k, 0.001),) * 3)

hz = empty("horizon", (HX, 0, 0))
BZ = 0.45
box("belt", 26, 1.3, 0.35, "rubber", (0, 0, 0.1), 0.04, hz)
box("reject", 9, 1.3, 0.2, "rubber", (-8, -2.2, 0.1), 0.04, hz)
box("reject_edge", 9, 0.06, 0.02, "line", (-8, -2.9, 0.3), 0, hz)
X1, X2, X3 = 3.5, 0.0, -3.5
for n, (sx, sy, sz, lx, ly, lz) in {"r_l": (0.14, 0.14, 1.7, X1, -0.95, BZ - 0.35), "r_r": (0.14, 0.14, 1.7, X1, 0.95, BZ - 0.35), "r_t": (0.14, 2.04, 0.14, X1, 0, BZ + 1.21)}.items():
    box(n, sx, sy, sz, "ring", (lx, ly, lz), 0.02, hz)
box("tb_top", 2.4, 1.9, 0.2, "steel", (X2, 0, BZ + 1.1), 0.05, hz)
box("tb_l", 2.4, 0.2, 1.3, "steel", (X2, -0.85, BZ - 0.2), 0.05, hz)
box("tb_r", 2.4, 0.2, 1.3, "steel", (X2, 0.85, BZ - 0.2), 0.05, hz)
lamp = box("tb_lamp", 0.4, 0.4, 0.12, "lamp", (X2, 0, BZ + 1.3), 0.04, hz)
box("p_l", 0.25, 0.25, 2.4, "darksteel", (X3, -0.95, 0.1), 0.03, hz)
box("p_r", 0.25, 0.25, 2.4, "darksteel", (X3, 0.95, 0.1), 0.03, hz)
box("p_t", 0.5, 2.15, 0.3, "darksteel", (X3, 0, 2.5), 0.04, hz)
press = box("p_head", 0.95, 0.95, 0.35, "steel", (X3, 0, BZ + 1.4), 0.05, hz)
box("p_rod", 0.15, 0.15, 1.0, "darksteel", (0, 0, 0.35), 0.02, press)
pusher = box("pusher", 0.9, 0.12, 0.5, "steel", (X3 - 1.1, 1.05, BZ), 0.03, hz)

V = 0.15
blue = srgb("#7d97ff")
press_times, scan_times, box_times, reject_crate = [], [], [], None
for k in range(-8, 10):
    x0 = 21.05 + 2 * k
    rej = k % 3 == 0
    o = box(f"crate{k}", 0.8, 0.8, 0.8, "cardboard", (x0, 0, BZ), 0.05, hz)
    box(f"band{k}", 0.84, 0.84, 0.07, "tape", (0, 0, 0.55), 0, o)
    f_at = lambda x: 1 + (x0 - x) / V
    key(o, "location", 1, x0, 0, "LINEAR"); key(o, "location", 1 + (x0 + 40) / V, -40, 0, "LINEAR")
    fin, fout = f_at(12.6), f_at(-12.6)
    if fin > 1:
        key(o, "scale", 1, (0.001,) * 3, interp="CONSTANT")
    key(o, "scale", max(fin, 1.5), (1.0,) * 3, interp="CONSTANT")
    scan_times.append(f_at(X1)); box_times.append(f_at(X2)); press_times.append(f_at(X3))
    if not rej:
        key(o, "scale", fout, (0.001,) * 3, interp="CONSTANT")
        continue
    m = M["cardboard"].copy(); m.name = f"crate_bad{k}"
    o.data = o.data.copy(); o.data.materials[0] = m
    nt = m.node_tree
    bs = [n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"][0]
    src = bs.inputs["Base Color"].links[0].from_socket
    mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"
    nt.links.new(src, mix.inputs[6]); mix.inputs[7].default_value = blue
    nt.links.new(mix.outputs[2], bs.inputs["Base Color"])
    bs.inputs["Emission Color"].default_value = blue
    tp = f_at(X3); tr = f_at(X3 - 1.1)
    for f, val, e in [(tp - 1, 0.0, 0.0), (tp + 3, 1.0, 0.3)]:
        mix.inputs["Factor"].default_value = val; mix.inputs["Factor"].keyframe_insert("default_value", frame=f)
        bs.inputs["Emission Strength"].default_value = e; bs.inputs["Emission Strength"].keyframe_insert("default_value", frame=f)
    key(o, "location", tr, 0, 1); key(o, "location", tr + 10, -2.2, 1)
    key(o, "location", tr + 4, BZ, 2); key(o, "location", tr + 10, 0.3, 2)
    if 140 < tp < 175:
        reject_crate = (o, tp)
    if tr > 300:
        continue
    for f, y in [(tr - 4, 1.05), (tr + 8, -1.25), (tr + 18, 1.05)]:
        key(pusher, "location", f, y, 1)
for t in press_times:
    for f, z in [(t - 8, BZ + 1.4), (t - 1, BZ + 0.83), (t + 2, BZ + 0.83), (t + 8, BZ + 1.4)]:
        key(press, "location", f, z, 2)
rn = M["ring"].node_tree.nodes["Principled BSDF"]
for t in scan_times:
    for f, e in [(t - 5, 1.0), (t, 3.0), (t + 6, 1.0)]:
        rn.inputs["Emission Strength"].default_value = e; rn.inputs["Emission Strength"].keyframe_insert("default_value", frame=f)
ln = M["lamp"].node_tree.nodes["Principled BSDF"]; ln.inputs["Emission Color"].default_value = blue
dark = srgb("#2a2a2a")
for t in box_times:
    for f, c, e in [(t - 9, dark, 0), (t - 5, blue, 1.6), (t + 5, blue, 1.6), (t + 9, dark, 0)]:
        ln.inputs["Base Color"].default_value = c; ln.inputs["Base Color"].keyframe_insert("default_value", frame=f)
        ln.inputs["Emission Strength"].default_value = e; ln.inputs["Emission Strength"].keyframe_insert("default_value", frame=f)

bz = empty("bitzaro", (BX, 0, 0))
box("bz_slab", 12, 8.5, 0.1, "slab", (0, 0, 0), 0.03, bz)
BZZ = 0.1
VX, VY = -1.3, 0.7
vault = box("vault", 1.9, 1.4, 1.05, "steel", (VX, VY, BZZ), 0.08, bz)
box("slot", 1.0, 0.14, 0.02, "darksteel", (0, 0, 1.05), 0.005, vault)
for f, s in [(1, 0.001), (176, 0.001), (190, 1.0)]:
    key(vault, "scale", f, (1, 1, s))
LOGO_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logos")
with open(os.path.join(LOGO_DIR, "coins.json")) as fh:
    COIN_INFO = json.load(fh)
CHAINS = ["bitcoin", "ethereum", "tron", "solana", "ton", "xrp"]
COIN_R, COIN_T = 0.46, 0.1


def coin_material(chain):
    m = bpy.data.materials.new(f"coin_{chain}")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bs = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bs.outputs[0], out.inputs[0])
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Location"].default_value = (0.5, 0.5, 0)
    mp.inputs["Scale"].default_value = (1 / (2 * COIN_R), 1 / (2 * COIN_R), 1)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    img = nt.nodes.new("ShaderNodeTexImage")
    img.image = bpy.data.images.load(os.path.join(LOGO_DIR, f"coin-{chain}.png"))
    img.extension = "CLIP"
    img.interpolation = "Cubic"
    nt.links.new(mp.outputs[0], img.inputs["Vector"])
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Normal"], sep.inputs[0])
    ab = nt.nodes.new("ShaderNodeMath"); ab.operation = "ABSOLUTE"
    nt.links.new(sep.outputs["Z"], ab.inputs[0])
    gt = nt.nodes.new("ShaderNodeMath"); gt.operation = "GREATER_THAN"; gt.inputs[1].default_value = 0.6
    nt.links.new(ab.outputs[0], gt.inputs[0])
    mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"
    mix.inputs[6].default_value = srgb(COIN_INFO["rims"][chain])
    nt.links.new(gt.outputs[0], mix.inputs["Factor"])
    nt.links.new(img.outputs["Color"], mix.inputs[7])
    nt.links.new(mix.outputs[2], bs.inputs["Base Color"])
    bs.inputs["Roughness"].default_value = 0.3
    bs.inputs["Metallic"].default_value = 0.2
    bs.inputs["Coat Weight"].default_value = 0.6
    bs.inputs["Coat Roughness"].default_value = 0.08
    return m


coin_mesh = bpy.data.meshes.new("coin_disc")
bm = bmesh.new()
bmesh.ops.create_cone(bm, cap_ends=True, segments=72, radius1=COIN_R, radius2=COIN_R, depth=COIN_T)
bm.to_mesh(coin_mesh); bm.free()
for p in coin_mesh.polygons:
    p.use_smooth = True
COIN_MATS = {c: coin_material(c) for c in CHAINS}


def coin_object(name, chain, parent, scale=1.0):
    me = coin_mesh.copy()
    me.materials.append(COIN_MATS[chain])
    o = bpy.data.objects.new(name, me)
    sc.collection.objects.link(o)
    bv = o.modifiers.new("bevel", "BEVEL"); bv.width = 0.018; bv.segments = 3; bv.limit_method = "ANGLE"
    o.parent = parent
    o.scale = (scale,) * 3
    return o


pedestal_h = [0.85, 1.25, 0.7, 1.05, 1.45, 0.8]
towers = []
for i, chain in enumerate(CHAINS):
    a = math.radians(165 - i * 30)
    x, y = VX + 3.3 * math.cos(a), VY + 2.4 * math.sin(a) + 0.3
    h = pedestal_h[i]
    ped = cyl(f"ped{i}", 0.3, h, "darksteel", (x, y, BZZ), seg=48, bevel=0.02, parent=bz)
    s0 = 178 + i * 3
    for f, k_ in [(1, 0.001), (s0, 0.001), (s0 + 10, 1.0)]:
        key(ped, "scale", f, (1, 1, k_))
    center = BZZ + h + COIN_R + 0.06
    piv = empty(f"piv{i}", (x, y, center), bz)
    lt = piv.constraints.new("LOCKED_TRACK")
    lt.track_axis = "TRACK_NEGATIVE_Y"; lt.lock_axis = "LOCK_Z"
    med = coin_object(f"medal{i}", chain, piv)
    for f, k_ in [(1, 0.001), (s0 + 7, 0.001), (s0 + 13, 1.12), (s0 + 17, 1.0)]:
        key(med, "scale", f, (k_,) * 3)
    for f in range(1, FRAMES + 13, 12):
        key(med, "rotation_euler", f, (math.radians(90), 0, math.radians(18) * math.sin(f / 24 + i)))
    towers.append((piv, x, y, center, chain))
TX, TY = 2.5, -1.5
term = empty("terminal", (TX, TY, BZZ), bz)
term.rotation_euler[2] = math.radians(-25)
box("t_base", 1.1, 1.5, 0.28, "plastic", (0, 0, 0), 0.08, term)
box("t_head", 1.0, 0.95, 0.2, "plastic", (0, 0.2, 0.22), 0.07, term, (math.radians(-14), 0, 0))
box("t_screen", 0.72, 0.62, 0.02, "screen", (0, 0.24, 0.43), 0.02, term, (math.radians(-14), 0, 0))
for k_, dx in enumerate((-0.3, -0.1, 0.1, 0.3)):
    box(f"t_key{k_}", 0.14, 0.1, 0.04, "rubber", (dx, -0.5, 0.28), 0.02, term)
tick = empty("t_tick", (0, 0.2, 0.47), term)
tick.rotation_euler = (math.radians(-14), 0, 0)
box("t_tick1", 0.07, 0.22, 0.02, "tick", (-0.07, -0.02, 0), 0, tick, (0, 0, math.radians(40)))
box("t_tick2", 0.07, 0.4, 0.02, "tick", (0.08, 0.06, 0), 0, tick, (0, 0, math.radians(-35)))
for f, s in [(1, 0.001), (178, 0.001), (190, 1.0)]:
    key(term, "scale", f, (s, s, s))
for f, s in [(1, 0.001), (234, 0.001), (239, 1.15), (242, 1.0)]:
    key(tick, "scale", f, (s, s, s))
scr = M["screen"].node_tree.nodes["Principled BSDF"]; scr.inputs["Emission Color"].default_value = blue
for f, c, e in [(1, dark, 0), (232, dark, 0), (236, blue, 1.0)]:
    scr.inputs["Base Color"].default_value = c; scr.inputs["Base Color"].keyframe_insert("default_value", frame=f)
    scr.inputs["Emission Strength"].default_value = e; scr.inputs["Emission Strength"].keyframe_insert("default_value", frame=f)

SLOT = Vector((VX, VY, BZZ + 1.1))
DUR = 16
for i, (piv, tx, ty, tz, chain) in enumerate(towers):
    for j in range(2):
        t0 = 194 + i * 3 + j * 12
        c = coin_object(f"coin_{i}_{j}", chain, bz, 0.001)
        key(c, "scale", t0 - 1, (0.001,) * 3, interp="CONSTANT")
        heading = math.atan2(SLOT.y - ty, SLOT.x - tx)
        for k_ in range(0, DUR + 1, 2):
            u = k_ / DUR; e = u * u * (3 - 2 * u)
            pos = (tx + (SLOT.x - tx) * e, ty + (SLOT.y - ty) * e, tz + (SLOT.z - tz) * u + 1.3 * math.sin(math.pi * u))
            key(c, "location", t0 + k_, pos, interp="LINEAR")
            key(c, "rotation_euler", t0 + k_, (math.radians(90) + u * math.tau * 1.5, 0, heading), interp="LINEAR")
            k = 0.001 if k_ == 0 else (0.5 if u < 0.88 else max(0.001, (1 - u) * 4))
            key(c, "scale", t0 + k_, (k, k, k), interp="LINEAR")
        key(c, "scale", t0 + DUR + 1, (0.001,) * 3, interp="CONSTANT")

card = empty("card", (VX, VY, BZZ + 0.5), bz)
CW, CH = 1.12 * 1.4, 0.7 * 1.4
box("card_body", CW, 0.03 * 1.4, CH, "cardblack", (0, 0, 0), 0.05, card, anchor="center")
box("card_chip", 0.18 * 1.4, 0.01, 0.14 * 1.4, "gold", (-0.3 * 1.4, -0.03, 0.08 * 1.4), 0, card, anchor="center")
visa_mat = bpy.data.materials.new("visa")
visa_mat.use_nodes = True
vnt = visa_mat.node_tree
vbs = vnt.nodes["Principled BSDF"]
vimg = vnt.nodes.new("ShaderNodeTexImage")
vimg.image = bpy.data.images.load(os.path.join(LOGO_DIR, "visa.png"))
vimg.interpolation = "Cubic"
vnt.links.new(vimg.outputs["Alpha"], vbs.inputs["Alpha"])
vbs.inputs["Base Color"].default_value = (1, 1, 1, 1)
vbs.inputs["Roughness"].default_value = 0.35
vw = 0.5
vh = vw / COIN_INFO["visa_aspect"]
vme = bpy.data.meshes.new("visa")
vme.from_pydata([(-vw / 2, 0, -vh / 2), (vw / 2, 0, -vh / 2), (vw / 2, 0, vh / 2), (-vw / 2, 0, vh / 2)], [], [(0, 1, 2, 3)])
uv = vme.uv_layers.new(name="UVMap")
for li, (u_, v_) in enumerate([(0, 0), (1, 0), (1, 1), (0, 1)]):
    uv.data[li].uv = (u_, v_)
vme.materials.append(visa_mat)
visa = bpy.data.objects.new("card_visa", vme)
sc.collection.objects.link(visa)
visa.parent = card
visa.location = (CW / 2 - vw / 2 - 0.1, -0.0245, -CH / 2 + vh / 2 + 0.1)
hidden = (VX, VY, BZZ + 0.5); above = (VX, VY, BZZ + 2.2)
near = (TX - 0.4, TY + 0.2, BZZ + 1.9); hover = (TX - 0.05, TY + 0.1, BZZ + 1.25)
flat_tilt = -math.radians(90 - 14)
for f, loc, k, rx, rz in [(1, hidden, 0, 0, 0), (212, hidden, 0, 0, 0), (220, above, 1, 0, 0), (227, near, 1, flat_tilt * 0.6, -25),
                          (232, hover, 1, flat_tilt, -25), (252, hover, 1, flat_tilt, -25)]:
    key(card, "location", f, loc); key(card, "scale", f, (max(k, 0.001),) * 3)
    key(card, "rotation_euler", f, (rx, 0, math.radians(rz)))
for j in range(3):
    o = torus(f"ring{j}", "ring"); o.parent = bz
    o.location = (TX - 0.02, TY + 0.1, BZZ + 0.62); o.rotation_euler = (math.radians(-14), 0, math.radians(-25))
    for cyc in range(2):
        s0 = 232 + j * 3 + cyc * 9
        for f, s in [(s0 - 1, 0), (s0, 0.25), (s0 + 8, 0.85), (s0 + 9, 0)]:
            key(o, "scale", f, (max(s, 0.001),) * 3)
    key(o, "scale", 1, (0.001,) * 3)

target = empty("cam_target", (0, 0, 0))
cam_data = bpy.data.cameras.new("cam")
cam_data.lens = 42
cam_data.shift_x = -0.12
cam_data.dof.use_dof = True
cam_data.dof.focus_object = target
cam_data.dof.aperture_fstop = 11
cam = bpy.data.objects.new("cam", cam_data)
sc.collection.objects.link(cam)
for tw in towers:
    tw[0].constraints["Locked Track"].target = cam
tc = cam.constraints.new("TRACK_TO"); tc.target = target; tc.track_axis = "TRACK_NEGATIVE_Z"; tc.up_axis = "UP_Y"
sc.camera = cam
shots = [
    (1, (0.4, -1.2, 22), (0, 0.2, 0)),
    (22, (0.6, -2.6, 20), (0, 0.1, 0)),
    (74, (-8.4, -13.0, 10.4), (0.3, 0, 0.4)),
    (100, (-5.8, -9.6, 7.6), (0.4, -0.2, 0.6)),
    (112, (HX + 7.5, -9, 4.6), (HX + X1, 0, 0.9)),
    (146, (HX + 0.8, -9.2, 4.9), (HX, 0, 0.8)),
    (168, (HX - 4.6, -8.6, 5.2), (HX + X3, -0.9, 0.6)),
    (176, (HX - 6.2, -9.5, 5.8), (HX + X3 - 1.2, -1.6, 0.5)),
    (192, (BX - 6.5, -14.5, 12.5), (BX, 0.4, 0.6)),
    (220, (BX + 1.5, -13, 10.5), (BX + 0.3, 0, 0.8)),
    (252, (BX + 7.6, -9.8, 7.0), (BX + 1.5, -0.8, 1.3)),
]
for f, cpos, tpos in shots:
    key(cam, "location", f, cpos); key(target, "location", f, tpos)

sun_d = bpy.data.lights.new("sun", "SUN"); sun_d.energy = 3.2; sun_d.angle = math.radians(8)
sun = bpy.data.objects.new("sun", sun_d); sc.collection.objects.link(sun)
sun.rotation_euler = (math.radians(40), math.radians(12), math.radians(-60))
fill_d = bpy.data.lights.new("fill", "AREA"); fill_d.energy = 650; fill_d.size = 12
fill = bpy.data.objects.new("fill", fill_d); sc.collection.objects.link(fill)
fill.parent = target
fill.location = (-8, -10, 13)
ft = fill.constraints.new("TRACK_TO"); ft.target = target
world = bpy.data.worlds.new("w"); world.use_nodes = True
bg = world.node_tree.nodes.get("Background"); bg.inputs[0].default_value = (0.02, 0.02, 0.022, 1)
sc.world = world

r = sc.render
r.engine = "BLENDER_EEVEE"
r.resolution_x, r.resolution_y, r.resolution_percentage = 1920, 1200, 100
r.fps = 30
sc.frame_start, sc.frame_end = 1, FRAMES
r.film_transparent = True
r.use_motion_blur = True
r.motion_blur_shutter = 0.6
r.image_settings.file_format = "PNG"
r.image_settings.color_mode = "RGBA"
sc.view_settings.view_transform = "AgX"
for k_, v_ in dict(taa_render_samples=48, use_raytracing=True, use_shadows=True, motion_blur_steps=1).items():
    if hasattr(sc.eevee, k_):
        setattr(sc.eevee, k_, v_)

tracks = []


def track(tid, label, start, end, getter):
    pts = []
    for f in range(start, end + 1):
        sc.frame_set(f)
        p = world_to_camera_view(sc, cam, getter())
        pts.append([round(p.x, 4), round(1 - p.y, 4)])
    tracks.append({"id": tid, "label": label, "from": start, "to": end, "pts": pts})


def at(o, dz=0.0):
    return lambda: o.matrix_world.translation + Vector((0, 0, dz))


def world_point(x, y, z):
    return lambda: Vector((x, y, z))


track("flur-plan", "2D floor plan", 6, 34, world_point(-2.5, -1.8, FZ))
track("flur-walls", "Walls and doors found", 40, 72, lambda: bpy.data.objects["wall_2"].matrix_world @ Vector((3.0, 0, 1.15)))
track("flur-furniture", "Real furniture placed", 74, 100, at(piece_obj["sofa"], 0.9))
track("hz-scan", "Scan", 112, 140, world_point(HX + X1, 0, BZ + 1.35))
track("hz-box", "Clean re-run", 128, 156, world_point(HX + X2, 0, BZ + 1.45))
track("hz-press", "Grader challenge", 146, 170, world_point(HX + X3, -0.95, 1.5))
if reject_crate:
    track("hz-broken", "Broken task", int(reject_crate[1]) + 2, 178, at(reject_crate[0], 0.95))
names = ["Bitcoin", "Ethereum", "Tron", "Solana", "TON", "XRP"]
for i, (piv, tx, ty, tz, chain) in enumerate(towers):
    track(f"bz-{chain}", names[i], 194 + i * 3, FRAMES, world_point(BX + tx, ty, tz + COIN_R + 0.04))
track("bz-wallet", "Bitzaro", 196, FRAMES, world_point(BX + VX, VY, BZZ + 1.3))
track("bz-terminal", "Visa contactless payment", 228, FRAMES, world_point(BX + TX, TY, BZZ + 0.9))

with open(TRACKS_OUT, "w") as fh:
    json.dump({"frames": FRAMES, "width": 1920, "height": 1200, "tracks": tracks}, fh, separators=(",", ":"))
sc.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUT)
print("BUILT", len(bpy.data.objects), "objects", len(tracks), "tracks")
