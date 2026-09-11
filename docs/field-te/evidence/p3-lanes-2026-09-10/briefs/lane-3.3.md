# Lane 3.3 EO/IR, branch `calib/p3-eoir`, model tag id `eoir-dri`

This lane fits a statistical estimate to a published datasheet value. Validation means the model reproduces the vendor number.

Files owned: `src/analysis/sensorEnv/eoir.ts`, its tests, `eoir.verify.test.ts`, your rows in `src/analysis/fidelity.ts` and `fidelity.test.ts`.

Deliverable (plan row 3.3): Johnson criteria per band from the optics. Pixels on target = target span (`spanMFor(target)`) / (range times IFOV), IFOV = `pixelPitchUm` / `focalLengthMm` (or `fovDeg` / `detectorPixelsH` when the pitch or focal length is null and both of those are present). Detect, recognize and identify ranges at the Johnson line-pair thresholds (1, 4, 8 cycles across the critical dimension; state the source) for the band of record (`eoBand`; a dual sensor takes the better of visible by day and thermal by night). Beer-Lambert extinction from visibility: transmission exp(-sigma R) with sigma from the Koschmieder relation on `visibilityMFor(env)` for visible, and a smaller extinction for thermal (one constant ratio with its source); apply as a contrast loss against a threshold, replacing the hard visibility cap on this path. Keep `eoRangeFactor`, `capVisibility`, `refSpanMFor`, `visibilityMFor`, `eoIrNeedsCue`, `NIGHT_VISIBLE_FACTOR`, `VISIBILITY_BY_PRECIP` exported with their meaning on the fallback path.

Fallback: the `eoirSpanRatio` switch, or a sensor with no optics fields (pitch and focal length null and no fov and pixel count), keeps today's span-ratio scaling and Koschmieder cap bit for bit.

Stop condition: an advertised DRI triple is reproduced (the seed provenance rows of at least one EO/IR sensor with L1 optics fields quote detect, recognize and identify ranges for a stated target; reproduce all three within 10 percent and pin any deviation as known). Validation tier: `datasheet`.
