# Geometry and time dossier

Status: E1 evidence baseline, 2026-09-05. Source tree `d8a76f1`; numerical source files unchanged by this lane. [Index and verification](README.md).

## Intended quantity and use

Predict position, bearing, slant distance, angular eligibility, sampled boundary arrival and engagement windows for a flat local planning laydown. Applicability: constant-altitude trajectories on piecewise straight horizontal paths, fixed sensor/launcher heights above a common ground datum. An external basemap supplies presentation context; it does not introduce terrain into the engine.

## Equations, units and frame

- [geo.ts](../../../src/geometry/geo.ts#L148): path distance `s=max(0,t-delay)*speed`; interpolate each segment by its Euclidean length, clamp at endpoints. Distances are meters, time seconds, speed m/s. Heading is clockwise from north; +x east, +y south. At exact final-segment distance the position is already the endpoint although `done` changes only after it.
- [slant.ts](../../../src/geometry/slant.ts#L18): `r=sqrt(g²+dh²)`, projection `g=sqrt(max(0,r²-dh²))`, elevation `atan2(dh,g)` in degrees. `radioHorizonM=4120*(sqrt(max(0,h1))+sqrt(max(0,h2)))` in meters; the fixed effective-Earth-radius approximation incorporates 4/3 refraction.
- [sensorEnv.ts](../../../src/analysis/sensorEnv.ts#L457): altitude feet to meters uses exactly 0.3048. Ceiling, horizon and elevation are distinct gates; acoustic skips horizon/elevation after checking ceiling. Elevation tolerance is 0.001° PF.
- [sim.ts](../../../src/playback/sim.ts#L606): DT=0.5 s; arrival is the first sampled ground distance inside defended radius. Warning is arrival minus first detection. Closest approach is distinct; `geo.ts::closestApproach` also searches sampled positions rather than analytically minimizing a segment.

## Inputs, pedigree and calibration

Instance altitude resolves through the entity, threat profile, then the altitude-band midpoint; mount height defaults to 4 m PF ([types.ts](../../../src/model/types.ts#L355)). Stated ceilings/range/angle rows retain source conditions in [seed inventory](seed-inventory.json). The horizon is an analytical approximation, not fitted to a local terrain survey. No site calibration or measured datum offset is available. Historical geodesy/terrain standards in [engine-refactor plan §12](../../engine-refactor/PLAN.md#L768) describe possible methods, not implemented WGS84/EGM2008/DTED processing in this model.

## Numerical method, verification and independent comparison

[geo.test.ts](../../../src/geometry/geo.test.ts) and [slant.test.ts](../../../src/geometry/slant.test.ts) verify cardinal bearings, interpolation and inverse geometry/edge cases. [accuracy.verify.test.ts](../../../src/playback/accuracy.verify.test.ts) verifies sampled timing and window logic. All were rerun in E1 (see index).

For one continuous crossing that persists until the next sample, first admitted grid time has delay in [0,DT), with displacement at most speed*DT for constant speed. This is an analytical local bound, not a blanket error bound: a short crossing can be missed entirely; curved/multi-segment paths, formation unions and scan scheduling need their own analysis. Path interpolation itself has only floating-point error within a specified straight segment. Ground projection clamps physically impossible slant/height combinations to zero for rendering; a zero ring is not an additional physical solution.

Independent field comparison: none. Geometric identities are independent mathematical checks; the source-backed radial inbound radar fixture begins outside range and checks the input-to-sweep path, but calibrates its radar range (see radar dossier). The old KuRFS/Coyote browser probe starts inside detection range and cannot validate detection timing.

## Unsupported conditions and data needs

Terrain masking, unequal local terrain elevations, changing altitude, Earth-curved trajectories over long distances, weather-dependent refractivity and optical-specific horizon behavior lack evidence here. No universal accuracy percentage is established. E2 needs delayed starts not aligned to DT, path endpoints, short window crossings and timestep refinement with a quantity-specific error report. Any later 3D/terrain increment needs a declared datum, resolution, elevation data and bounded use case first.
