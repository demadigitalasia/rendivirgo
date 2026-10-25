# Lapidary cabochon CAD assets

These eight images are actual Blender 5.2 Cycles renders, with plain sage-green
surfaces and dark surface-patch curves. They replace the natural stone texture
icons in the custom order shape picker.

- Editable native source: `assets/lapidary/cabochon-shapes.blend`
- Model and studio setup: `scripts/render-lapidary-cabochons.py`
- Transparent PNG preparation: `scripts/prepare-lapidary-cabochons.mjs`
- Website assets: `public/images/lapidary/shapes/cad/{shape}.png`
- Shapes: oval, round, teardrop, long-oval, cushion, freeform, pear, marquise.

Each model has a domed top, flat back, girdle, and sparse control-surface lines.
Named collections isolate the eight models; the oval collection is initially
visible when opening the Blender file. Camera, green materials, and studio lights
are included, without external textures or dependencies.

Re-render from the repository root:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python scripts/render-lapidary-cabochons.py
node scripts/prepare-lapidary-cabochons.mjs
```

Blender renders 768×768 RGBA images. Preparation normalizes each silhouette within
a 512×512 transparent canvas and checks that the alpha channel is preserved. The
form uses Next Image to serve appropriately sized versions of the PNGs.
