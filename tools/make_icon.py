from PIL import Image, ImageDraw, ImageFont
import os

def create_app_icon():
    size = 256
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Dark rounded background shield / badge
    draw.rounded_rectangle([8, 8, size - 8, size - 8], radius=48, fill=(18, 20, 24, 255), outline=(16, 185, 129, 220), width=6)
    
    # Inner subtle glow
    draw.rounded_rectangle([18, 18, size - 18, size - 18], radius=38, fill=(24, 27, 32, 255), outline=(34, 197, 94, 80), width=3)

    # 3D Wireframe Cube / DayZ Badge in center
    # Top diamond
    center_x, center_y = 128, 120
    poly_top = [(center_x, center_y - 48), (center_x + 56, center_y - 20), (center_x, center_y + 8), (center_x - 56, center_y - 20)]
    draw.polygon(poly_top, fill=(16, 185, 129, 240), outline=(52, 211, 153, 255))

    # Left face
    poly_left = [(center_x - 56, center_y - 20), (center_x, center_y + 8), (center_x, center_y + 68), (center_x - 56, center_y + 40)]
    draw.polygon(poly_left, fill=(5, 150, 105, 230), outline=(16, 185, 129, 255))

    # Right face
    poly_right = [(center_x, center_y + 8), (center_x + 56, center_y - 20), (center_x + 56, center_y + 40), (center_x, center_y + 68)]
    draw.polygon(poly_right, fill=(4, 120, 87, 230), outline=(16, 185, 129, 255))

    # Text banner "DAYZ FORGE"
    draw.rectangle([32, 196, size - 32, 232], fill=(16, 185, 129, 255))
    
    # Save icon.png
    public_dir = os.path.join(os.getcwd(), "public")
    os.makedirs(public_dir, exist_ok=True)
    png_path = os.path.join(public_dir, "icon.png")
    img.save(png_path, "PNG")

    # Save icon.ico (multiple resolutions)
    ico_path = os.path.join(public_dir, "icon.ico")
    img.save(ico_path, format="ICO", sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])

    print(f"Created {png_path} and {ico_path}")

if __name__ == "__main__":
    create_app_icon()
