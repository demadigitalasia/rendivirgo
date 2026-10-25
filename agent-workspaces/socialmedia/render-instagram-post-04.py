from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path('/Users/drefan/Projects/RENDI VIRGO')
OUT = ROOT / 'agent-workspaces/socialmedia'
OUT.mkdir(parents=True, exist_ok=True)
S = 2
W = H = 1080 * S

PAPER = '#F7F4EE'
FOREST = '#103B2C'
FOREST_DEEP = '#08261D'
JADE = '#477D68'
SAND = '#E6DFD2'
BRONZE = '#B08A53'
BRONZE_LIGHT = '#D9BC8B'
GRAY = '#6B7069'

SERIF_CANDIDATES = [
    '/System/Library/Fonts/Supplemental/Georgia.ttf',
    '/Library/Fonts/Georgia.ttf',
]
SANS_CANDIDATES = [
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    '/Library/Fonts/Arial.ttf',
]

def font_from(candidates, size):
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size=size)
    return ImageFont.load_default()

canvas = Image.new('RGBA', (W, H), PAPER)
draw = ImageDraw.Draw(canvas)

# Soft stone-colored photo field and a restrained bronze orbit.
draw.rounded_rectangle((948, 248, 2070, 1665), radius=470, fill=SAND)
draw.ellipse((1180, 395, 2020, 1515), outline=BRONZE, width=4)
draw.arc((1028, 322, 1970, 1440), start=205, end=332, fill=JADE, width=3)

# Official wordmark, kept in its original colors and proportions.
logo_path = ROOT / 'assets/branding/rendi-virgo-logo.png'
logo = Image.open(logo_path).convert('RGBA')
logo.thumbnail((472, 158), Image.Resampling.LANCZOS)
canvas.alpha_composite(logo, (142, 82))
draw = ImageDraw.Draw(canvas)

# Editorial label and headline.
meta_font = font_from(SANS_CANDIDATES, 30)
small_font = font_from(SANS_CANDIDATES, 34)
body_font = font_from(SANS_CANDIDATES, 58)
title_font = font_from(SERIF_CANDIDATES, 166)
footer_font = font_from(SANS_CANDIDATES, 34)
footer_small = font_from(SANS_CANDIDATES, 27)

draw.text((150, 382), 'THE STONE JOURNAL  /  04', font=meta_font, fill=JADE)
draw.rounded_rectangle((150, 465, 278, 473), radius=4, fill=BRONZE)
draw.multiline_text((145, 510), 'Look\ncloser.', font=title_font, fill=FOREST, spacing=-8)
draw.multiline_text((154, 1010), 'A quiet study in\ngreen, pattern\nand light.', font=body_font, fill=GRAY, spacing=18)
draw.line((154, 1320, 280, 1320), fill=BRONZE, width=5)
draw.text((154, 1354), 'COLOR.  PATTERN.  PLACE.', font=meta_font, fill=FOREST)

# Editorial cutout artwork, explicitly used as a visual study rather than a product listing.
art_path = ROOT / 'public/images/editorial/moss-agate-fern.webp'
art = Image.open(art_path).convert('RGBA')
art.thumbnail((1440, 960), Image.Resampling.LANCZOS)
canvas.alpha_composite(art, (704, 478))
draw = ImageDraw.Draw(canvas)

# Minimal footer with the brand's approved CTA.
footer_y = 1790
draw.rectangle((0, footer_y, W, H), fill=FOREST_DEEP)
draw.rectangle((150, footer_y + 72, 208, footer_y + 77), fill=BRONZE_LIGHT)
draw.text((150, footer_y + 110), 'EXPLORE THE COLLECTION', font=footer_font, fill=PAPER)
draw.text((150, footer_y + 180), 'rendivirgo.com', font=footer_small, fill=BRONZE_LIGHT)
draw.text((1580, footer_y + 122), 'EDITORIAL SERIES   /   04', font=footer_small, fill='#D7DDD7')

# Downsample for a crisp 1080 x 1080 Instagram feed post.
final = canvas.convert('RGB').resize((1080, 1080), Image.Resampling.LANCZOS)
png_path = OUT / 'rendi-virgo-instagram-stone-journal-04.png'
pdf_path = OUT / 'rendi-virgo-instagram-stone-journal-04.pdf'
final.save(png_path, format='PNG', optimize=True)
final.save(pdf_path, format='PDF', resolution=150.0, quality=95)
print('PNG', png_path, final.size, png_path.stat().st_size)
print('PDF', pdf_path, pdf_path.stat().st_size)
