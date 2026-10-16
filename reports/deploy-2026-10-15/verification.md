# Production deployment verification

- Domain: https://rendivirgo.com
- Platform: Coolify (Dockerfile), application `rendivirgo-web`
- Commit: `f3db4622fb660dd3db86568d419d177df3ce1be2`
- Deployment: `ul9nwdmsrznmgcmnol7dhhmf` — finished
- Container: `ncugnzbiqzkfho6u621zmkeo-154123646402` — healthy
- `/`, `/shop`, and owner cutout PNG: HTTP 200
- Homepage includes owner section and scroll motion markers.
- API health: status ok, database up, uploads up.
- Browser confirms homepage motion initialized (`data-scroll-motion=ready`).

The separate Vercel target is not connected to the live domain. Its automatic deployment still reports Error; the live Coolify deployment above completed successfully.
