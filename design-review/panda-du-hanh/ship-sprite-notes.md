# Panda Du Hành — Production ship sprite

Generated with the built-in image_gen tool from gameplay-v2.png. The final prompt is recorded in [ship-sprite-prompt.md](ship-sprite-prompt.md).

## Files

- Master PNG: assets/game/panda-du-hanh/panda-ship.png — 1347×1168, 1,002,553 bytes.
- Web asset: assets/game/panda-du-hanh/panda-ship.webp — 512×444, 35,670 bytes.
- Small web asset: assets/game/panda-du-hanh/panda-ship-small.webp — 256×222, 13,060 bytes.
- Alpha report: [ship-sprite-report.json](ship-sprite-report.json).

The WebP variants use deterministic Chrome Canvas resizing/encoding of the generated master. All retain transparent alpha; 69.0% of master pixels are transparent and corner alpha is zero in both variants. No source image content was painted or edited by the packaging step.

## Direction and positioning

Rear/slightly overhead view. The panda faces upward, away from the viewer. Visible are the back of the ivory-white head, emerald ears and teal scarf; there is no front-facing face. The spacecraft nose points toward the top of the image, and three rear engine outlets point toward the bottom.

Master visible bounds (alpha >128): x=87–1260, y=140–994. Normalized bounds: x≈0.065–0.936, y≈0.120–0.852. There is intentional transparent padding around the craft.

Suggested muzzle point in full-image coordinates: x=0.50, y=0.125. Aim/rotation pivot near x=0.50, y=0.50. These are visual anchors rather than collision bounds; check the projectile origin against the rendered sprite after sizing.

For gameplay display, set the full-image height so the visible craft is around 7–10% of the playfield height. Do not stretch width/height independently. Use the small WebP at small CSS sizes, with the 512px version available for higher DPR.

The sprite has no baked long exhaust flame. Runtime can draw a short subtle flame and muzzle pulse independently. Rotate/lean only slightly, preserving the rear-facing pilot.

The build script uses an explicit public asset allowlist, so consuming web assets must be added to scripts/build.mjs by the integrating agent.
