"""Construit les bâtiments du village, exporte un .glb par bâtiment, aligne et fait un rendu.

Lancement (depuis la racine du projet) :
  "C:/Program Files/Blender Foundation/Blender 5.3/blender.exe" -b --factory-startup --python blender/build_village.py

Sorties :
  assets/models/<nom>.glb       un fichier par bâtiment (Draco, Y vers le haut, origine au sol)
  blender/village.blend         la scène avec tous les bâtiments alignés
  blender/rendu-batiments.png   le rendu de validation
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

from village_lib import (  # noqa: E402
    ENC, FEN, MUR, PORTE, TOIT, VIT, VOLET, ENS,
    arch_bay, body, box, build_object, chimney, cylinder, door, export_glb,
    facade_back, facade_front, facade_left, facade_right, gable_roof, hex_rgb,
    make_material, prism, rot_z, tr, window,
)

OUT_DIR = os.path.join(ROOT, "assets", "models")
GLASS = ("#3B4B58", 0.2)


def palette(mur, toit, volet, porte, enc="#EFE8DA", ens="#EDE6D6"):
    return {
        "Mur": (mur, 0.9), "Toit": (toit, 0.8), "Encadrement": (enc, 0.85),
        "Volet": (volet, 0.7), "Porte": (porte, 0.6), "Fenetre": GLASS,
        "Vitrine": ("#34444F", 0.15), "Enseigne": (ens, 0.6),
    }


def columns(W, n):
    step = W / n
    return [-W / 2 + step * (i + 0.5) for i in range(n)]


def bays(W, n, win_w, fw=0.12):
    """Travées : positions, largeur de fenêtre et largeur de volet pour que deux volets voisins
    ne se touchent jamais (ni ne dépassent l'angle de la façade)."""
    step = W / n
    w = min(win_w, (step - 2 * fw - 0.08) / 2)
    gap = step - w - 2 * fw                     # place entre deux encadrements
    sw = min(w / 2 + 0.02, gap / 2 - 0.04)
    return columns(W, n), w, sw


# ---------------------------------------------------------------- maisons


def maison(name, W, D, floors, n_win, door_col, pitch, pal, chimney_x=None,
           ground_h=2.9, floor_h=2.65, win_w=0.85):
    bm = bmesh.new()
    H = ground_h + floor_h * (floors - 1)
    body(bm, W, D, H)
    hr = gable_roof(bm, W, D, H, pitch)
    F, B = facade_front(W, D), facade_back(W, D)
    xs, win_w, sw = bays(W, n_win, win_w)

    # bandeaux d'étage en façade
    for k in range(1, floors):
        box(bm, ENC, (0, -0.04, ground_h + floor_h * (k - 1)), (W - 0.3, 0.08, 0.12), M=F)

    # rez-de-chaussée : porte + fenêtres
    for i, x in enumerate(xs):
        if i == door_col:
            door(bm, F, x, min(1.0, win_w + 0.15), 2.15)
        else:
            window(bm, F, x, 0.95, win_w, 1.3, sw=sw)
    # étages
    for k in range(1, floors):
        z0 = ground_h + floor_h * (k - 1) + 0.85
        h = 1.4 if k < floors - 1 or floors == 2 else 1.2
        for x in xs:
            window(bm, F, x, z0, win_w, h, sw=sw)

    # façade arrière : fenêtres plus simples, une porte de jardin
    for k in range(floors):
        z0 = 0.95 if k == 0 else ground_h + floor_h * (k - 1) + 0.85
        for i, x in enumerate(xs[::2] if n_win == 3 else xs):
            if k == 0 and i == 0:
                door(bm, B, x, 0.9, 2.1, transom=False)
            else:
                window(bm, B, x, z0, win_w * 0.9, 1.2, shutters=False)
    # pignons : une petite fenêtre au dernier étage
    zt = ground_h + floor_h * (floors - 2) + 1.0 if floors > 1 else 1.0
    for S in (facade_left(W, D), facade_right(W, D)):
        window(bm, S, 0, zt, 0.6, 0.8, shutters=False, mullions=False)

    if chimney_x is not None:
        chimney(bm, chimney_x * W / 2, D * 0.18, H - 0.5, H + hr + 0.45)

    obj, tris = build_object(name, bm, pal)
    return obj, tris, (W, D)


# ---------------------------------------------------------------- boutiques


def boutique(name, W, D, upper, n_win, pitch, pal, door_side=1, chimney_x=None,
             shop_h=3.6, floor_h=2.6, win_w=0.85):
    bm = bmesh.new()
    H = shop_h + floor_h * upper
    body(bm, W, D, H)
    hr = gable_roof(bm, W, D, H, pitch)
    F, B = facade_front(W, D), facade_back(W, D)

    # ---- devanture en boiserie peinte (matériau Porte)
    dw = W - 0.5
    left, right = -dw / 2, dw / 2
    door_w, door_h = 1.0, 2.35
    pil = 0.25                      # pilastres
    dx = door_side * (dw / 2 - pil - door_w / 2)
    v0 = -door_side * (dw / 2 - pil)                     # bord extérieur de la vitrine
    v1 = dx - door_side * (door_w / 2 + 0.2)              # bord côté porte
    vx, vw = (v0 + v1) / 2, abs(v1 - v0)
    vz0, vz1 = 0.6, 2.55
    for x in (left + pil / 2, right - pil / 2):          # pilastres
        box(bm, PORTE, (x, -0.09, 1.425), (pil, 0.18, 2.85), M=F)
    box(bm, PORTE, (dx - door_side * (door_w / 2 + 0.1), -0.07, 1.3), (0.2, 0.14, 2.6), M=F)
    box(bm, PORTE, (0, -0.1, 2.72), (dw, 0.2, 0.3), M=F)              # entablement
    box(bm, PORTE, (vx, -0.07, vz0 / 2), (vw, 0.14, vz0), M=F)        # soubassement
    # vitrine (carreaux en retrait) + petits bois
    box(bm, VIT, (vx, -0.04, (vz0 + vz1) / 2), (vw, 0.02, vz1 - vz0), M=F)
    box(bm, PORTE, (vx, -0.07, vz1 + 0.03), (vw, 0.12, 0.06), M=F)
    if vw > 2.0:
        box(bm, PORTE, (vx, -0.07, (vz0 + vz1) / 2), (0.08, 0.1, vz1 - vz0), M=F)
    # porte vitrée
    box(bm, PORTE, (dx, -0.03, door_h / 2), (door_w, 0.05, door_h), M=F)
    box(bm, VIT, (dx, -0.065, 0.75 + (door_h - 0.95) / 2), (door_w - 0.26, 0.02, door_h - 0.95), M=F)
    box(bm, VIT, (dx, -0.04, (door_h + 2.57) / 2), (door_w, 0.02, 2.57 - door_h), M=F)  # imposte
    box(bm, ENC, (dx, -0.2, 0.08), (door_w + 0.4, 0.4, 0.16), M=F)    # marche
    # enseigne vide encadrée, au-dessus de la vitrine
    box(bm, PORTE, (0, -0.14, 3.2), (dw - 0.2, 0.06, 0.74), M=F)
    box(bm, ENS, (0, -0.18, 3.2), (dw - 0.4, 0.04, 0.58), M=F)
    # auvent incliné au-dessus de la vitrine + lambrequin
    a, depth = math.radians(22), 1.15
    aw = vw + 0.3
    box(bm, VOLET, (vx, -0.22 - depth / 2 * math.cos(a), 2.6 - depth / 2 * math.sin(a)),
        (aw, depth, 0.04), rot=(a, 0, 0), M=F)
    fy, fz = -0.22 - depth * math.cos(a), 2.6 - depth * math.sin(a)
    box(bm, VOLET, (vx, fy, fz - 0.13), (aw, 0.03, 0.26), M=F)
    for s in (-1, 1):                                                   # bras
        box(bm, ENC, (vx + s * (aw / 2 - 0.05), (fy - 0.22) / 2, 2.6 - depth / 2 * math.sin(a) - 0.05),
            (0.03, depth, 0.03), rot=(a, 0, 0), M=F)

    # ---- étages
    box(bm, ENC, (0, -0.04, shop_h), (W - 0.3, 0.08, 0.12), M=F)
    xs, win_w, sw = bays(W, n_win, win_w)
    for k in range(upper):
        z0 = shop_h + floor_h * k + 0.8
        for x in xs:
            window(bm, F, x, z0, win_w, 1.35, sw=sw)
    # arrière
    door(bm, B, xs[0], 0.95, 2.15, transom=False)
    window(bm, B, xs[-1], 1.0, 0.8, 1.2, shutters=False)
    for k in range(upper):
        for x in xs:
            window(bm, B, x, shop_h + floor_h * k + 0.8, win_w * 0.9, 1.2, shutters=False)
    zt = shop_h + floor_h * (upper - 1) + 1.0
    for S in (facade_left(W, D), facade_right(W, D)):
        window(bm, S, 0, zt, 0.6, 0.8, shutters=False, mullions=False)

    if chimney_x is not None:
        chimney(bm, chimney_x * W / 2, D * 0.18, H - 0.5, H + hr + 0.45)

    obj, tris = build_object(name, bm, pal)
    return obj, tris, (W, D)


# ---------------------------------------------------------------- église


def eglise(pal):
    bm = bmesh.new()
    NW, NL, NH = 7.6, 12.0, 8.0
    ny0, ny1 = -5.5, 6.5
    ncy = (ny0 + ny1) / 2
    # nef
    box(bm, MUR, (0, ncy, NH / 2), (NW, NL, NH), bevel_vertical=0.1)
    box(bm, ENC, (0, ncy, 0.3), (NW + 0.08, NL + 0.08, 0.6), bevel_vertical=0.1)
    box(bm, ENC, (0, ncy, NH - 0.12), (NW + 0.14, NL + 0.14, 0.24), bevel_vertical=0.1)
    gable_roof(bm, NL, NW, NH, 48, ox=0.35, ov=0.45, M=tr(0, ncy, 0) @ rot_z(math.pi / 2),
               tile_step=0.55)
    # baies cintrées et contreforts sur les flancs
    R = facade_right(NW, 0)
    L = facade_left(NW, 0)
    for y in (-2.4, 0.9, 4.2):
        arch_bay(bm, R, y, 3.0, 1.15, 3.4, FEN)
        arch_bay(bm, L, -y, 3.0, 1.15, 3.4, FEN)
    for y in (-4.05, -0.75, 2.55, 5.85):
        for s in (-1, 1):
            box(bm, ENC, (s * (NW / 2 + 0.3), y, 2.6), (0.6, 0.6, 5.2))
            box(bm, ENC, (s * (NW / 2 + 0.17), y, 5.9), (0.34, 0.6, 1.4))

    # abside en hémicycle
    ar, ah, seg = 3.3, 6.8, 9
    half = [(ar * math.cos(math.pi * i / seg), -ar * math.sin(math.pi * i / seg)) for i in range(seg + 1)]
    rx = Matrix.Rotation(math.pi / 2, 4, "X")
    prism(bm, MUR, half, 0.0, ah, M=tr(0, ny1, 0) @ rx)
    ring = [(x * 1.03, z * 1.03) for x, z in half]
    prism(bm, ENC, ring, ah - 0.25, ah, M=tr(0, ny1, 0) @ rx)
    prism(bm, ENC, ring, 0.0, 0.6, M=tr(0, ny1, 0) @ rx)
    # toit conique de l'abside
    rr, apex = ar + 0.4, ah + 2.9
    arc = [bm.verts.new((rr * math.cos(math.pi * i / seg), ny1 + rr * math.sin(math.pi * i / seg), ah))
           for i in range(seg + 1)]
    top = bm.verts.new((0, ny1, apex))
    faces = [bm.faces.new((arc[i], arc[i + 1], top)) for i in range(seg)]
    faces.append(bm.faces.new(arc))
    faces.append(bm.faces.new((arc[0], top, arc[-1])))
    for f in faces:
        f.material_index = TOIT
    for ang in (50, 90, 130):
        t = math.radians(ang)
        r = ar * math.cos(math.pi / seg / 2) * 0.995
        M = tr(r * math.cos(t), ny1 + r * math.sin(t), 0) @ rot_z(t + math.pi / 2)
        arch_bay(bm, M, 0, 2.8, 0.8, 2.6, FEN, surround=0.12)

    # clocher-porche en façade (vers -Y)
    TW, TH = 4.2, 15.0
    ty0 = -9.7
    tcy = ty0 + TW / 2
    box(bm, MUR, (0, tcy, TH / 2), (TW, TW, TH), bevel_vertical=0.12)
    box(bm, ENC, (0, tcy, 0.35), (TW + 0.1, TW + 0.1, 0.7), bevel_vertical=0.12)
    for z in (8.4, TH - 0.15):
        box(bm, ENC, (0, tcy, z), (TW + 0.16, TW + 0.16, 0.3), bevel_vertical=0.12)
    T = tr(0, ty0, 0)
    arch_bay(bm, T, 0, 0, 1.8, 3.4, PORTE, surround=0.3, sd=0.16, depth=0.05, segs=8)
    box(bm, ENC, (0, -0.55, 0.09), (3.2, 1.1, 0.18), M=T)
    box(bm, ENC, (0, -0.85, 0.045), (3.6, 1.7, 0.09), M=T)
    # oculus
    cylinder(bm, ENC, (0, -0.05, 6.1), 0.85, 0.1, 16, rot=(math.pi / 2, 0, 0), M=T)
    cylinder(bm, FEN, (0, -0.11, 6.1), 0.62, 0.04, 16, rot=(math.pi / 2, 0, 0), M=T)
    # horloge
    cylinder(bm, ENC, (0, -0.06, 9.7), 0.75, 0.12, 16, rot=(math.pi / 2, 0, 0), M=T)
    box(bm, PORTE, (0, -0.13, 9.88), (0.06, 0.02, 0.4), M=T)
    box(bm, PORTE, (0.13, -0.13, 9.7), (0.3, 0.02, 0.06), M=T)
    # baies du beffroi (abat-son) sur les quatre faces
    for S in (tr(0, ty0, 0), tr(0, ty0 + TW, 0) @ rot_z(math.pi),
              tr(-TW / 2, tcy, 0) @ rot_z(-math.pi / 2), tr(TW / 2, tcy, 0) @ rot_z(math.pi / 2)):
        arch_bay(bm, S, 0, 11.0, 1.1, 2.4, PORTE, segs=6)
    # flèche octogonale + clochetons d'angle + croix
    SH = 8.5
    cylinder(bm, TOIT, (0, tcy, TH + SH / 2), 2.45, SH, 8, rot=(0, 0, math.pi / 8), radius_top=0.0)
    for sx in (-1, 1):
        for sy in (-1, 1):
            cylinder(bm, TOIT, (sx * 1.75, tcy + sy * 1.75, TH + 0.7), 0.55, 1.4, 4,
                     rot=(0, 0, math.pi / 4), radius_top=0.0)
    box(bm, ENC, (0, tcy, TH + SH + 0.5), (0.1, 0.1, 1.2))
    box(bm, ENC, (0, tcy, TH + SH + 0.75), (0.6, 0.1, 0.1))

    obj, tris = build_object("eglise", bm, pal)
    return obj, tris, (NW, ty0 * -1 + ny1 + ar)


# ---------------------------------------------------------------- scène


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def lineup(objs, gap=3.0):
    widths = []
    for o in objs:
        xs = [v.co.x for v in o.data.vertices]
        widths.append((min(xs), max(xs)))
    total = sum(b - a for a, b in widths) + gap * (len(objs) - 1)
    x = -total / 2
    for o, (a, b) in zip(objs, widths):
        o.location = (x - a, 0, 0)
        x += (b - a) + gap


def label(text, x, y, mat):
    cu = bpy.data.curves.new(f"lbl-{text}", type="FONT")
    cu.body = text
    cu.align_x = "CENTER"
    cu.size = 1.1
    cu.extrude = 0.02
    ob = bpy.data.objects.new(f"lbl-{text}", cu)
    ob.location = (x, y, 0.02)
    ob.data.materials.append(mat)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def setup_render(objs, path):
    scene = bpy.context.scene
    # sol, étiquettes
    sol = make_material("Sol", hex_rgb("#B9B5A6"), 0.95)
    lbl = make_material("Etiquette", hex_rgb("#2E3338"), 0.6)
    me = bpy.data.meshes.new("sol")
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=150)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(sol)
    ground = bpy.data.objects.new("sol", me)
    scene.collection.objects.link(ground)
    extras = []
    for o in objs:
        ys = [v.co.y for v in o.data.vertices]
        extras.append(label(o.name, o.location.x, min(ys) - 2.6, lbl))

    # monde + soleil
    world = bpy.data.worlds.new("ciel")
    scene.world = world
    if world.node_tree is None:
        world.use_nodes = True
    bg =world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = hex_rgb("#CFE0EE")
    bg.inputs["Strength"].default_value = 0.9
    sun_d = bpy.data.lights.new("soleil", "SUN")
    sun_d.energy = 3.2
    sun_d.angle = math.radians(3)
    sun = bpy.data.objects.new("soleil", sun_d)
    sun.rotation_euler = (math.radians(52), math.radians(-18), math.radians(-35))
    scene.collection.objects.link(sun)

    # caméra cadrée automatiquement sur tous les bâtiments
    cam_d = bpy.data.cameras.new("camera")
    cam_d.lens = 50
    cam = bpy.data.objects.new("camera", cam_d)
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.rotation_euler = (math.radians(80), 0, math.radians(-8))
    scene.render.resolution_x = 3600
    scene.render.resolution_y = 1300
    bpy.context.view_layer.update()   # matrices à jour après l'alignement
    coords = []
    for o in objs + extras:
        for c in o.bound_box:
            coords.extend(o.matrix_world @ Vector(c))
    loc, _ = cam.camera_fit_coords(bpy.context.evaluated_depsgraph_get(), coords)
    fwd = cam.rotation_euler.to_matrix() @ Vector((0, 0, -1))
    cam.location = Vector(loc) - fwd * 3.0

    scene.render.engine = "CYCLES"
    scene.cycles.samples = 96
    scene.cycles.use_denoising = True
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        for kind in ("OPTIX", "CUDA"):
            prefs.compute_device_type = kind
            prefs.get_devices()
            devs = [d for d in prefs.devices if d.type == kind]
            if devs:
                for d in devs:
                    d.use = True
                scene.cycles.device = "GPU"
                print(f"[rendu] GPU {kind}")
                break
    except Exception as e:  # pas de GPU : on reste sur le CPU
        print("[rendu] CPU", e)
    scene.view_settings.view_transform = "AgX"
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def main():
    reset_scene()
    os.makedirs(OUT_DIR, exist_ok=True)

    builds = [
        maison("maison-a", 5.2, 7.0, 3, 3, 0, 30,
               palette("#E8DCC0", "#A0523A", "#5D7A8C", "#4F3A2C"), chimney_x=0.55),
        maison("maison-b", 4.4, 6.5, 2, 2, 1, 38,
               palette("#D9B27A", "#8E4A33", "#5E7D56", "#6B4430"), chimney_x=-0.5),
        maison("maison-c", 6.2, 7.5, 2, 3, 1, 35,
               palette("#EFE9DE", "#9C5B3F", "#8E3A32", "#3F4A52", enc="#D9CDB6")),
        maison("maison-d", 4.8, 6.8, 3, 2, 0, 30,
               palette("#E3C2AE", "#7E4434", "#8A8F94", "#5A3A2E")),
        maison("maison-e", 5.6, 7.2, 2, 3, 2, 40,
               palette("#E6CF8F", "#A35A3C", "#7FA3B8", "#45545E"), chimney_x=-0.6),
        boutique("boutique-a", 5.6, 7.5, 2, 3, 25,
                 palette("#E4DED2", "#985039", "#8C2F2F", "#2F4F3E"), door_side=1),
        boutique("boutique-b", 6.0, 7.0, 1, 3, 40,
                 palette("#E9D3B0", "#8A4733", "#2F5C7A", "#1F3A52", ens="#F1EBDD"),
                 door_side=-1, chimney_x=0.55),
        eglise(palette("#D8CDB8", "#4E5560", "#5A3B2A", "#5A3B2A", enc="#C2B49A")),
    ]

    print("\n=== Bilan ===")
    ok = True
    objs = []
    for obj, tris, (W, D) in builds:
        zs = [v.co.z for v in obj.data.vertices]
        H = max(zs)
        mats = [m.name.split(".")[0] for m in obj.data.materials]
        church = obj.name == "eglise"
        bad = []
        if tris >= 4000:
            bad.append("triangles")
        if not church and not (4 <= W <= 6.5 and 6 <= D <= 8 and 6 <= H <= 11):
            bad.append("dimensions")
        ok &= not bad
        print(f"{obj.name:11s} murs {W:4.1f} x {D:4.1f} m  haut {H:5.2f} m  {tris:5d} tris  "
              f"{', '.join(mats)}  {'OK' if not bad else 'ERREUR ' + ','.join(bad)}")
        export_glb(obj, os.path.join(OUT_DIR, f"{obj.name}.glb"))
        objs.append(obj)
    if not ok:
        raise SystemExit("Contraintes non respectées")

    lineup(objs)
    setup_render(objs, os.path.join(HERE, "rendu-batiments.png"))
    bpy.context.preferences.filepaths.save_version = 0   # pas de village.blend1
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "village.blend"), compress=True)
    print("=== Terminé ===")


main()
