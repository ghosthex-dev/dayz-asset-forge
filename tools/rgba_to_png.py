import sys
from PIL import Image

def rgba_to_png(rgba_path, width, height, out_png_path):
    with open(rgba_path, "rb") as f:
        data = f.read()
    img = Image.frombytes("RGBA", (width, height), data)
    img.save(out_png_path, "PNG")
    print(f"Saved {out_png_path} ({width}x{height})")

if __name__ == "__main__":
    if len(sys.argv) < 5:
        print("Usage: python rgba_to_png.py <in.rgba> <width> <height> <out.png>")
        sys.exit(1)
    rgba_to_png(sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4])
