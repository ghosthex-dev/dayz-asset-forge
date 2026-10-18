import sys
import os
import subprocess
import json
import py3d
from PIL import Image

def get_base_dir():
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))

def find_odol_convert():
    base_dir = get_base_dir()
    candidates = [
        os.path.join(base_dir, "odol-convert.exe"),
        os.path.join(base_dir, "odol-convert", "odol-convert.exe"),
        os.path.join(base_dir, "..", "tools", "odol-convert", "odol-convert.exe"),
        os.path.join(os.getcwd(), "tools", "odol-convert", "odol-convert.exe"),
    ]
    for c in candidates:
        if os.path.exists(c):
            return os.path.abspath(c)
    return None

def convert_odol_if_needed(p3d_path):
    with open(p3d_path, "rb") as f:
        magic = f.read(4)

    if magic == b"ODOL":
        converter_exe = find_odol_convert()
        if not converter_exe:
            raise FileNotFoundError("odol-convert.exe not found in tools directory")

        dir_name = os.path.dirname(p3d_path)
        base_name = os.path.splitext(os.path.basename(p3d_path))[0]
        mlod_path = os.path.join(dir_name, f"{base_name}_mlod.p3d")

        res = subprocess.run([converter_exe, p3d_path], capture_output=True, text=True)
        if res.returncode != 0:
            raise RuntimeError(f"odol-convert failed: {res.stderr or res.stdout}")

        if not os.path.exists(mlod_path):
            raise FileNotFoundError(f"Expected converted MLOD at {mlod_path}")
        return mlod_path
    elif magic == b"MLOD":
        return p3d_path
    else:
        raise ValueError(f"Unknown P3D header: {magic}")

def p3d_to_obj_and_json(p3d_path, out_obj_path, out_json_path):
    mlod_path = convert_odol_if_needed(p3d_path)

    with open(mlod_path, "rb") as f:
        p3d = py3d.P3D(f)

    visual_lods = [lod for lod in p3d.lods if len(lod.faces) > 0]
    if not visual_lods:
        raise ValueError("No visual LOD with faces found in P3D")

    main_lod = visual_lods[0]

    memory_points = []
    for lod in p3d.lods:
        if lod.resolution >= 1e13 or "memory" in str(lod.resolution).lower():
            for sel_name, sel_obj in lod.selections.items():
                for pt in sel_obj.points.keys():
                    memory_points.append({
                        "id": f"mem_{sel_name}_{len(memory_points)}",
                        "name": sel_name,
                        "position": [round(pt.coords[0], 5), round(pt.coords[1], 5), round(pt.coords[2], 5)],
                        "color": "#10b981",
                        "description": f"DayZ Memory Point: {sel_name}"
                    })

    textures = []
    materials = []
    for face in main_lod.faces:
        if face.texture and face.texture not in textures:
            textures.append(face.texture)
        if face.material and face.material not in materials:
            materials.append(face.material)

    named_selections = []
    for sel_name in main_lod.selections.keys():
        named_selections.append({
            "id": f"sel_{sel_name}",
            "name": sel_name,
            "materialSlot": "Material 1",
            "color": "#3b82f6"
        })

    v_lines = []
    vt_lines = []
    vn_lines = []
    f_lines = []

    for pt in main_lod.points:
        v_lines.append(f"v {pt.coords[0]:.6f} {pt.coords[1]:.6f} {pt.coords[2]:.6f}")

    uv_cache = {}
    normal_cache = {}

    for face in main_lod.faces:
        face_tokens = []
        for v in face.vertices:
            p_idx = v.point_index + 1
            u, v_coord = v.uv[0], 1.0 - v.uv[1]
            uv_key = (round(u, 6), round(v_coord, 6))
            if uv_key not in uv_cache:
                vt_lines.append(f"vt {u:.6f} {v_coord:.6f}")
                uv_cache[uv_key] = len(vt_lines)
            vt_idx = uv_cache[uv_key]

            if v.normal:
                norm_key = (round(v.normal[0], 4), round(v.normal[1], 4), round(v.normal[2], 4))
                if norm_key not in normal_cache:
                    vn_lines.append(f"vn {v.normal[0]:.4f} {v.normal[1]:.4f} {v.normal[2]:.4f}")
                    normal_cache[norm_key] = len(vn_lines)
                vn_idx = normal_cache[norm_key]
                face_tokens.append(f"{p_idx}/{vt_idx}/{vn_idx}")
            else:
                face_tokens.append(f"{p_idx}/{vt_idx}")

        if len(face_tokens) == 3:
            f_lines.append(f"f {' '.join(face_tokens)}")
        elif len(face_tokens) == 4:
            f_lines.append(f"f {face_tokens[0]} {face_tokens[1]} {face_tokens[2]}")
            f_lines.append(f"f {face_tokens[0]} {face_tokens[2]} {face_tokens[3]}")

    with open(out_obj_path, "w", encoding="utf-8") as out:
        out.write("# DayZ Asset Forge OBJ Export\n")
        out.write(f"# Source: {os.path.basename(p3d_path)}\n\n")
        out.write("\n".join(v_lines) + "\n\n")
        out.write("\n".join(vt_lines) + "\n\n")
        out.write("\n".join(vn_lines) + "\n\n")
        out.write("\n".join(f_lines) + "\n")

    meta = {
        "sourceFile": os.path.basename(p3d_path),
        "vertexCount": len(v_lines),
        "faceCount": len(f_lines),
        "textures": textures,
        "materials": materials,
        "namedSelections": named_selections,
        "memoryPoints": memory_points,
        "lodResolutions": [lod.resolution for lod in p3d.lods]
    }
    with open(out_json_path, "w", encoding="utf-8") as out:
        json.dump(meta, out, indent=2)

    print(f"SUCCESS: {len(v_lines)} vertices, {len(f_lines)} triangles exported to {out_obj_path}")

def rgba_to_png(rgba_path, width, height, out_png_path):
    with open(rgba_path, "rb") as f:
        data = f.read()
    img = Image.frombytes("RGBA", (width, height), data)
    img.save(out_png_path, "PNG")
    print(f"SUCCESS: Saved {out_png_path} ({width}x{height})")

def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  dayz_helper convert-p3d <in.p3d> <out.obj> <out.json>")
        print("  dayz_helper rgba-to-png <in.rgba> <width> <height> <out.png>")
        sys.exit(1)

    cmd = sys.argv[1].lower()
    if cmd in ("convert-p3d", "p3d"):
        if len(sys.argv) < 5:
            print("Usage: dayz_helper convert-p3d <in.p3d> <out.obj> <out.json>")
            sys.exit(1)
        p3d_to_obj_and_json(sys.argv[2], sys.argv[3], sys.argv[4])
    elif cmd in ("rgba-to-png", "rgba"):
        if len(sys.argv) < 6:
            print("Usage: dayz_helper rgba-to-png <in.rgba> <width> <height> <out.png>")
            sys.exit(1)
        rgba_to_png(sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), sys.argv[5])
    elif len(sys.argv) == 4 and not cmd.startswith("-"):
        # Backwards compatibility: dayz_helper <in.p3d> <out.obj> <out.json>
        p3d_to_obj_and_json(sys.argv[1], sys.argv[2], sys.argv[3])
    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)

if __name__ == "__main__":
    main()
