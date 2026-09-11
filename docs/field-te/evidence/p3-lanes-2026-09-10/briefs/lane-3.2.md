# Lane 3.2 Passive RF, branch `calib/p3-rf`, model tag id `rf-link`

This lane fits a statistical estimate to a published datasheet value. Validation means the model reproduces the vendor number.

Files owned: `src/analysis/sensorEnv/rf.ts`, `src/analysis/rfLink.ts` (new), their tests, `rfLink.verify.test.ts`, your rows in `src/analysis/fidelity.ts` and `fidelity.test.ts`.

Deliverable (plan row 3.2): a link budget in `rfLink.ts` that lane 3.6 will share for jam-to-signal. Received power at the sensor = target UAS `radiatedPowerW` (EIRP, dBW) minus free-space path loss at the band's centre frequency (the `JamBand` names in `types.ts` give the band; pick the centre frequency per band in one table with its source) minus an urban margin when `environment.emBackground` is `urban` and `environment.apply` (one constant in dB with its source; the existing `urbanRangeM` override stays as the datasheet cap when present) compared with `receiverSensitivityDbm`. Detection range is where received power equals sensitivity. Direction-finding accuracy: the seed `azimuthAccuracyDeg` at the reference SNR, scaled by 1 / sqrt(SNR ratio) above it (Cramer-Rao form), floored at the seed value. Geolocation: with `geolocationMinNodes` sensors of the same model hearing the target UAS at once, a position estimate whose range sigma is the cross-range sigma at the baseline geometry (state the formula); with fewer nodes the sensor stays bearing only (today's null range accuracy). Export the functions `sensorEnv.ts` consumers need (`effectiveDetectRangeM` reads RF through `rf.ts`); keep every existing export name of `rf.ts`.

Fallback: the `rfBandGate` switch, or a null `radiatedPowerW` on the target UAS or a null `receiverSensitivityDbm` on the sensor, keeps today's band-overlap gate and placard range bit for bit.

Stop condition: a datasheet detection range is reproduced within its stated condition (the seed provenance rows of the RF sensors quote them; pick at least two sensors and one target UAS with an L1 `radiatedPowerW`); the band-gate path unchanged. Validation tier: `datasheet`.
