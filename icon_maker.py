from PIL import Image, ImageDraw

def generate_sort_icon(color="#2196F3", arrow_color="white"):
    # Create a high-res master
    size = 512
    master = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(master)
    
    # Draw Rounded Rectangle Background
    draw.rounded_rectangle([20, 20, 492, 492], radius=60, fill=color)
    
    # Draw Up Arrow (Left Side)
    draw.polygon([(160, 120), (80, 240), (240, 240)], fill=arrow_color)
    draw.rectangle([130, 240, 190, 400], fill=arrow_color)
    
    # Draw Down Arrow (Right Side)
    draw.polygon([(352, 400), (272, 280), (432, 280)], fill=arrow_color)
    draw.rectangle([322, 120, 382, 280], fill=arrow_color)
    
    Save in all required Firefox sizes
    required_sizes = [16, 32, 48, 128]
    import os
    if not os.path.exists('icons'): os.makedirs('icons')

    for s in required_sizes:
        icon = master.resize((s, s), Image.Resampling.LANCZOS)
        icon.save(f"icons/icon{s}.png")
        print(f"Generated: icons/icon{s}.png")

if __name__ == "__main__":

    generate_sort_icon(color="#4A90E2")