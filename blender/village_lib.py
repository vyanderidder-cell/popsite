"""Briques de modélisation pour les bâtiments du village (bpy + bmesh, sans modificateurs).

Conventions :
- 1 unité = 1 mètre, Z vers le haut dans Blender.
- La façade principale regarde -Y.
- Chaque bâtiment est construit dans un seul bmesh ; chaque pièce porte un index de matériau
  (voir MATS). Les matériaux non utilisés sont retirés à la création de l'objet.
"""
import math

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

# Noms imposés par le site (allumage des fenêtres et vitrines).
MATS = ["Mur", "Toit", "Encadrement", "Volet", "Porte", "Fenetre", "Vitrine", "Enseigne"]
MUR, TOIT, ENC, VOLET, PORTE, FEN, VIT, ENS = range(len(MATS))

ID = Matrix.Identity(4)


def rot_z(a):
    return Matrix.Rotation(a, 4, "Z")


def tr(x, y, z):
    return Matrix.Translation((x, y, z))


# Repères de façade : dans le repère local, la façade est le plan y=0, elle regarde -y,
# x court le long de la façade (de gauche à droite vu de face), z vers le haut.
def facade_front(W, D):
    return tr(0, -D / 2, 0)


def facade_back(W, D):
    return tr(0, D / 2, 0) @ rot_z(math.pi)


def facade_left(W, D):  # côté -X
    return tr(-W / 2, 0, 0) @ rot_z(-math.pi / 2)


def facade_right(W, D):  # côté +X
    return tr(W / 2, 0, 0) @ rot_z(math.pi / 2)


# ---------------------------------------------------------------- primitives


def _tag(faces, mat):
    for f in faces:
        f.material_index = mat


def box(bm, mat, center, size, rot=(0, 0, 0), M=ID, bevel_vertical=0.0):
    """Pavé centré sur `center`, dimensions `size`, rotation Euler XYZ `rot`, puis repère M."""
    verts = bmesh.ops.create_cube(bm, size=1.0)["verts"]
    T = M @ tr(*center) @ Euler(rot).to_matrix().to_4x4() @ Matrix.Diagonal((*size, 1.0))
    bmesh.ops.transform(bm, matrix=T, verts=verts)
    faces = {f for v in verts for f in v.link_faces}
    _tag(faces, mat)
    if bevel_vertical > 0:
        edges = {e for f in faces for e in f.edges}
        vert_edges = [
            e for e in edges
            if abs((e.verts[0].co - e.verts[1].co).normalized().z) > 0.99
        ]
        res = bmesh.ops.bevel(
            bm, geom=vert_edges, offset=bevel_vertical, segments=1,
            affect="EDGES", profile=0.5, clamp_overlap=True, material=mat,
        )
        _tag(res["faces"], mat)
    return verts


def prism(bm, mat, pts, y0, y1, M=ID):
    """Polygone convexe `pts` [(x, z)] dans le plan XZ local, extrudé de y0 à y1, puis repère M."""
    a = [bm.verts.new(M @ Vector((x, y0, z))) for x, z in pts]
    b = [bm.verts.new(M @ Vector((x, y1, z))) for x, z in pts]
    faces = [bm.faces.new(a), bm.faces.new(list(reversed(b)))]
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        faces.append(bm.faces.new((a[i], a[j], b[j], b[i])))
    _tag(faces, mat)
    return faces


def cylinder(bm, mat, center, radius, depth, segments, rot=(0, 0, 0), M=ID, radius_top=None):
    r2 = radius if radius_top is None else radius_top
    verts = bmesh.ops.create_cone(
        bm, cap_ends=True, cap_tris=False, segments=segments,
        radius1=radius, radius2=r2, depth=depth,
    )["verts"]
    T = M @ tr(*center) @ Euler(rot).to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=T, verts=verts)
    _tag({f for v in verts for f in v.link_faces}, mat)
    return verts


def arch_outline(w, h, segs=6):
    """Contour d'une baie en plein cintre : base à z=0, largeur w, hauteur totale h."""
    r = w / 2
    spring = h - r
    pts = [(-r, 0.0), (r, 0.0), (r, spring)]
    for i in range(1, segs):
        t = math.pi * i / segs
        pts.append((r * math.cos(t), spring + r * math.sin(t)))
    pts.append((-r, spring))
    return pts


def arch_bay(bm, M, cx, z0, w, h, mat, depth=0.03, surround=0.16, sd=0.08, segs=6):
    """Baie cintrée : encadrement de pierre en saillie et remplissage (vitrail, porte, abat-son)."""
    outer = [(cx + x, z0 + z) for x, z in arch_outline(w + 2 * surround, h + surround, segs)]
    inner = [(cx + x, z0 + z) for x, z in arch_outline(w, h, segs)]
    prism(bm, ENC, outer, -sd, 0.0, M=M)
    prism(bm, mat, inner, -sd - depth, -sd + 0.001, M=M)


# ---------------------------------------------------------------- éléments d'architecture


def window(bm, M, cx, z0, w, h, shutters=True, mullions=True, fd=0.10, fw=0.12, sw=None):
    """Fenêtre sur une façade locale : carreaux en retrait derrière un encadrement saillant."""
    # carreaux, posés au nu du mur, donc 10 cm en retrait de l'encadrement
    box(bm, FEN, (cx, -0.01, z0 + h / 2), (w, 0.02, h), M=M)
    # encadrement : linteau, appui saillant, jambages
    box(bm, ENC, (cx, -fd / 2, z0 + h + fw / 2), (w + 2 * fw, fd, fw), M=M)
    box(bm, ENC, (cx, -(fd + 0.05) / 2, z0 - fw / 2), (w + 2 * fw + 0.12, fd + 0.05, fw), M=M)
    for s in (-1, 1):
        box(bm, ENC, (cx + s * (w / 2 + fw / 2), -fd / 2, z0 + h / 2), (fw, fd, h), M=M)
    if mullions:  # croisée : meneau + traverse
        box(bm, ENC, (cx, -0.035, z0 + h / 2), (0.05, 0.03, h), M=M)
        box(bm, ENC, (cx, -0.035, z0 + h * 0.68), (w, 0.03, 0.05), M=M)
    if shutters:  # volets ouverts rabattus contre le mur
        sw = w / 2 + 0.02 if sw is None else sw
        for s in (-1, 1):
            box(bm, VOLET, (cx + s * (w / 2 + fw + sw / 2 + 0.02), -0.025, z0 + h / 2),
                (sw, 0.05, h + 0.02), M=M)


def door(bm, M, cx, w, h, fw=0.14, fd=0.12, transom=True, step=True):
    box(bm, PORTE, (cx, -0.02, h / 2), (w, 0.04, h), M=M)
    top = h
    if transom:  # imposte vitrée
        box(bm, FEN, (cx, -0.01, h + 0.25), (w, 0.02, 0.4), M=M)
        box(bm, ENC, (cx, -0.035, h + 0.025), (w, 0.03, 0.05), M=M)
        top = h + 0.45
    box(bm, ENC, (cx, -fd / 2, top + fw / 2), (w + 2 * fw, fd, fw), M=M)
    for s in (-1, 1):
        box(bm, ENC, (cx + s * (w / 2 + fw / 2), -fd / 2, top / 2), (fw, fd, top), M=M)
    if step:
        box(bm, ENC, (cx, -0.2, 0.08), (w + 2 * fw + 0.2, 0.4, 0.16), M=M)


def body(bm, W, D, H, bevel=0.09, plinth=0.45, cornice=True):
    """Murs (pavé aux arêtes verticales biseautées), soubassement et corniche."""
    box(bm, MUR, (0, 0, H / 2), (W, D, H), bevel_vertical=bevel)
    if plinth:
        box(bm, ENC, (0, 0, plinth / 2), (W + 0.06, D + 0.06, plinth), bevel_vertical=bevel)
    if cornice:
        box(bm, ENC, (0, 0, H - 0.1), (W + 0.12, D + 0.12, 0.2), bevel_vertical=bevel)


def gable_roof(bm, L, D, ztop, pitch_deg, ox=0.3, ov=0.35, t=0.14, M=ID,
               tile_step=0.42, gable=True):
    """Toit à deux pans, faîtage le long de x (longueur L), portée D le long de y.

    Pans en tuiles suggérées par des rangs en relief, faîtière, débords sur les quatre côtés,
    pignons triangulaires en matériau Mur.
    """
    a = math.radians(pitch_deg)
    hr = (D / 2) * math.tan(a)
    Lh = D / 2 + ov            # demi-portée horizontale avec débord
    Ls = Lh / math.cos(a)      # longueur du pan
    for s in (-1, 1):          # s=-1 : pan avant (côté -y)
        n = Vector((0, s * math.sin(a), math.cos(a)))
        u = Vector((0, -s * math.cos(a), math.sin(a)))   # de l'égout vers le faîtage
        eave = Vector((0, s * Lh, ztop + hr - Lh * math.tan(a)))
        c = eave + u * (Ls / 2) + n * (t / 2)
        box(bm, TOIT, c, (L + 2 * ox, Ls, t), rot=(-s * a, 0, 0), M=M)
        # rangs de tuiles
        rows = int(Ls / tile_step)
        for k in range(rows):
            p = eave + u * (0.12 + k * tile_step) + n * (t + 0.02)
            box(bm, TOIT, p, (L + 2 * ox, 0.07, 0.04), rot=(-s * a, 0, 0), M=M)
    # faîtière (tige carrée tournée à 45°)
    box(bm, TOIT, (0, 0, ztop + hr + t / math.cos(a) - 0.03), (L + 2 * ox + 0.06, 0.2, 0.2),
        rot=(math.pi / 4, 0, 0), M=M)
    if gable:  # comble : prisme triangulaire (pignons)
        e = 0.02
        prism(bm, MUR, [(-D / 2 + e, ztop), (D / 2 - e, ztop), (0, ztop + hr)],
              -L / 2 + e, L / 2 - e, M=M @ rot_z(math.pi / 2))
    return hr


def chimney(bm, x, y, z0, z1, w=0.55, d=0.75):
    box(bm, MUR, (x, y, (z0 + z1) / 2), (w, d, z1 - z0))
    box(bm, ENC, (x, y, z1 + 0.06), (w + 0.12, d + 0.12, 0.12))
    box(bm, ENC, (x, y, z1 - 0.35), (w + 0.06, d + 0.06, 0.08))


# ---------------------------------------------------------------- matériaux et objets


def hex_rgb(h):
    h = h.lstrip("#")
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (*lin, 1.0)


def make_material(name, color, rough=0.85, metal=0.0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = color
    m.roughness = rough
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    return m


def build_object(name, bm, palette):
    """Crée l'objet à partir du bmesh. Matériaux nommés '<Nom>.<bâtiment>' dans le .blend ;
    le suffixe est retiré à l'export pour obtenir exactement Mur, Toit, etc."""
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    used = sorted({f.material_index for f in bm.faces})
    remap = {old: new for new, old in enumerate(used)}
    for f in bm.faces:
        f.material_index = remap[f.material_index]
    tris = sum(len(f.verts) - 2 for f in bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for idx in used:
        base = MATS[idx]
        color, rough = palette[base]
        me.materials.append(make_material(f"{base}.{name}", hex_rgb(color), rough))
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return obj, tris


def export_glb(obj, path):
    """Exporte un seul objet (placé à l'origine) en .glb, matériaux renommés sans suffixe."""
    saved_loc = obj.location.copy()
    obj.location = (0, 0, 0)
    renamed = []
    for m in obj.data.materials:
        old = m.name
        m.name = old.split(".")[0]
        renamed.append((m, old))
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
        export_materials="EXPORT",
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
    )
    for m, old in renamed:
        m.name = old
    obj.location = saved_loc
