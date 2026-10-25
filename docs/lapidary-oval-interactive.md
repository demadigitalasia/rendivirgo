# Oval interactive prototype

The custom-order shape picker supports 23 standard shapes in one vertically scrollable grid, followed by “Other shape”. The grid supports wheel, touch, and keyboard navigation without a separate disclosure. “Other shape” remains a text-only option because it has no fixed geometry. Long oval covers elongated oval; Marquise covers navette.

Additional shapes: Half oval, Rounded triangle, Side tongue, Ladder trapezoid, Rhombus, Keystone, Tongue, Cartouche, Wide shield, Bowed rectangle, Barrel, Shield, Trillion, Bowed triangle and Emerald octagon. These are smooth domed cabochons; the Emerald name refers to its octagonal outline.

The frontend shape catalog is `lib/lapidary-shapes.ts`; the request and Suite component allowlists are in `api/src/lapidary/lapidary.dto.ts`. No database migration is required because shape keys are stored as strings. The API process must load the updated DTO before it accepts the new keys.

## Assets

- Editable Blender source: `assets/lapidary/cabochon-interactive-v1.blend`
- Web models, transparent front thumbnails, and fallback posters: `public/models/lapidary/<shape>-v1/`
- Generator: `scripts/build-lapidary-cabochon-shapes.py`
- Viewer: `components/lapidary/oval-cabochon-preview.tsx` (shared component for all standard shapes)

Regenerate from the repository root with Blender 5.2:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python scripts/build-lapidary-cabochon-shapes.py
```

Every closed mesh has a domed face, rounded girdle and flat back. The illustrative dimensions are stored in the shared generator and shown in the viewer facts. Form dimensions do not resize these previews. The material is plain polished green, without stone textures or wire lines.

Asset revision 4 replaces the radial extrusion cap with a finite-element Poisson cap. The silhouette is fixed at the girdle, and a smooth height field is solved across its interior before applying the rounded shoulder profile. This prevents corners in the outline from creating radial creases across the dome. The generator checks triangle areas, solver convergence and closed mesh edges. Thumbnails and posters use `front-v4.png` and `poster-v4.png`; model URLs also carry revision 4 to avoid old browser cache entries.

The viewer registers model-viewer only after opening. It supports drag, touch, keyboard rotation, zoom, camera presets and reset. Failed model loads show the PNG poster and a retry action. Only one picker can display the interactive viewer at a time. These asset paths are currently defined in code; this prototype does not add an admin model uploader.
