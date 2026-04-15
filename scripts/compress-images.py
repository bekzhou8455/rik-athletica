"""
Image compression for RIK Athletica.
Converts large PNGs/JPEGs to web-optimised JPEGs.
Run from project root: python3 scripts/compress-images.py
"""
import os
from PIL import Image, ImageOps

MEDIA_DIR = os.path.join(os.path.dirname(__file__), "..", "assets", "media")

# Rules: (filename_pattern, max_px_long_side, jpeg_quality)
RULES = {
    # Hero / full-viewport athlete photos
    "hero-reel-poster": (1920, 70),
    "AL-DSC": (1920, 82),
    "DSC0": (1920, 82),
    "athlete-": (1920, 82),
    "lab-hero": (1920, 80),
    # Product shots — kept sharp
    "refuel-studio": (1200, 88),
    "euphoria-studio": (1200, 88),
    "bundle-studio": (1200, 88),
    "Bundle_pack": (1200, 88),
    "Fefuel_back": (1200, 88),
    "Euphoria_back": (1200, 88),
    "gel-texture-close": (1200, 85),
    # Protocol composites
    "comp-": (1400, 88),
    # Phone render
    "rik-phone-calendar": (1200, 85),
}

def get_rule(name):
    for prefix, rule in RULES.items():
        if name.startswith(prefix):
            return rule
    return None  # skip

def compress(src_path, out_path, max_px, quality):
    try:
        img = Image.open(src_path)
        img = ImageOps.exif_transpose(img)  # correct orientation
        # Convert to RGB (handles RGBA PNGs — phone calendar stays transparent, skip)
        if img.mode in ("RGBA", "P"):
            # Check if image has meaningful transparency (phone calendar etc.)
            if img.mode == "RGBA":
                alpha = img.split()[-1]
                if alpha.getextrema()[0] < 250:
                    # Has real transparency — keep as PNG with compression
                    img.save(out_path.replace(".jpg", ".png"), "PNG", optimize=True)
                    size_before = os.path.getsize(src_path)
                    size_after = os.path.getsize(out_path.replace(".jpg", ".png"))
                    print(f"  PNG  {os.path.basename(src_path):40s}  {size_before/1e6:.1f}MB → {size_after/1e6:.1f}MB")
                    return out_path.replace(".jpg", ".png")
            img = img.convert("RGB")
        elif img.mode != "RGB":
            img = img.convert("RGB")

        # Resize if larger than max_px on the long side
        w, h = img.size
        if max(w, h) > max_px:
            scale = max_px / max(w, h)
            img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

        img.save(out_path, "JPEG", quality=quality, optimize=True, progressive=True)
        size_before = os.path.getsize(src_path)
        size_after = os.path.getsize(out_path)
        print(f"  JPEG {os.path.basename(src_path):40s}  {size_before/1e6:.1f}MB → {size_after/1e6:.1f}MB  (q={quality})")
        return out_path
    except Exception as e:
        print(f"  ERR  {os.path.basename(src_path)}: {e}")
        return None

def main():
    converted_png_to_jpg = {}  # old_name → new_name (for HTML updates)
    files = sorted(os.listdir(MEDIA_DIR))

    for fname in files:
        if fname.startswith(".") or os.path.isdir(os.path.join(MEDIA_DIR, fname)):
            continue
        base, ext = os.path.splitext(fname)
        ext_lower = ext.lower()

        # Only process photos
        if ext_lower not in (".jpg", ".jpeg", ".png"):
            continue

        # Skip logos (small, need transparency)
        if "logo" in fname.lower():
            continue

        rule = get_rule(base)
        if rule is None:
            continue

        max_px, quality = rule
        src = os.path.join(MEDIA_DIR, fname)
        out = os.path.join(MEDIA_DIR, base + ".jpg")

        result = compress(src, out, max_px, quality)

        # Track PNG→JPEG conversions for HTML path updates
        if result and ext_lower == ".png" and result.endswith(".jpg"):
            converted_png_to_jpg[fname] = base + ".jpg"

    print(f"\nConverted {len(converted_png_to_jpg)} PNG→JPEG:")
    for old, new in converted_png_to_jpg.items():
        print(f"  {old} → {new}")

    return converted_png_to_jpg

if __name__ == "__main__":
    print("Compressing images...\n")
    main()
    print("\nDone.")
