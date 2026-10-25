# Custom-order dome controls

The shape preview deforms the cap of the existing GLB in the browser and recomputes vertex normals. The girdle and flat back remain unchanged. It supports single and matched-pair GLBs, including mirrored shapes. The initial mesh uses an illustrative 20% girdle height; example model dimensions remain illustrative rather than a manufacturing drawing.

Customers choose Studio recommendation, Low, Medium, or High, then change dome height in millimetres. Presets change starting height only; the same smooth cap profile is preserved. Local mesh Y is the thickness axis, while X/Z define the unchanged outline. Model node rotations and pair spacing remain unchanged. The viewer retains camera orbit, target and field of view when a new dome loads. Overall thickness is a separate target and must exceed dome height. Shape width constrains the allowed height. Settings are saved in the session draft, review, and request item work notes, so existing admin request views and exports retain the specification without a schema migration.

Admin: Lapidary → Content → Custom order · Dome controls. Enable/disable, minimum, maximum, medium default height, width ratio, and English/Indonesian heading are stored in SiteSetting `lapidary.dome`, through the authenticated PATCH `/api/admin/lapidary/content/dome`. Changes are audited. Public content exposes the settings. Request API validates heights and overall thickness.

The four profile options are fixed. Model thumbnails/fallback posters are static shape illustrations; the interactive model shows the requested cap. The studio confirms feasibility and material suitability.

Verification: all 60 GLBs (30 single and 30 paired) were checked at dome heights 1.9, 3.2, and 4.8 mm: unchanged X/Z positions, base/girdle positions and node transforms, with correct cap maximum. Browser comparison of Oval Low and High confirmed a stable front silhouette and a changing side thickness with the same camera orientation.

Generated blob URLs remain valid for the lifetime of the mounted preview. They are released on unmount, rather than on each slider effect cleanup, to prevent model-viewer asynchronous loads from fetching an already-revoked URL. Manual browser switching Low/Medium/High repeatedly kept the preview loaded.
