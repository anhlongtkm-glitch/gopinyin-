# Quiet family-space background

Generated with the built-in image_gen tool from the approved gameplay-v2 style reference. [Final prompt](space-family-prompt.md), [master](space-family-master.png), [packaging report](space-family-report.json).

Production assets: assets/game/panda-du-hanh/space-family.webp and space-family-small.webp. The background is opaque, has no text or UI, and keeps the middle dark and low-detail. Family-house planet is far upper-left, small moon far upper-right. No foreground asteroids or ship.

WebP variants are deterministic Chrome Canvas resizing/encoding of the generated master. Use the full version for wide desktop and the small variant for lower resolution when appropriate. CSS should preserve aspect ratio; if using cover, check edge cropping at narrow portrait sizes. The calm center remains suitable for dynamic word capsules.

Add only selected WebP paths to the explicit public asset list in scripts/build.mjs; leave this master and notes out of the production bundle.
