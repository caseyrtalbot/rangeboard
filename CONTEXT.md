# RangeBoard run timeline context

Vocabulary for the run timeline: the strip under the board that shows every platform's
activity in one run on a shared time axis. Terms only; the design lives in the run
timeline spec and the implementation contracts in the engineering reference.

## Language

**Run timeline**:
The strip under the board that shows every platform's activity in one run on one time axis.
_Avoid_: Engagement timeline, engagement strip, activity timeline

**Row**:
One horizontal band of the run timeline that belongs to one platform or one track.
_Avoid_: Lane (as a synonym for a platform row)

**Sub-lane**:
One band inside a sensor row that belongs to one track that sensor holds.

**Group**:
A collapsible set of rows of one kind on one side. Collapsed, it shows one summary row.

**Side**:
Red or blue. A threat is red. Every other platform is blue. The side follows from the kind.
_Avoid_: Team, force, affiliation

**Platform**:
A sensor, C2 node, effector or threat placed on the board. A marker or an asset is not a platform.
_Avoid_: System, emitter, item

**Threat**:
A red UAS entity with a planned flight path. The truth object, not the picture of it.
_Avoid_: Flying object, drone, target

**Track**:
The blue picture of one threat, or of nothing (a false track). A sensor track is held by one
sensor. A fused track is formed by a C2 node from sensor tracks.
_Avoid_: Contact, detection (as a noun for the track)

**Jammer**:
An effector whose channel is electronic warfare. A jammer is not its own kind of platform.
_Avoid_: EW system, emitter

**Mark**:
One instant on a row: detect, classify, assign, release, effect, arrival.
_Avoid_: Event (as a display term), tick, pin

**Span**:
One interval on a row: hold, coast, preparation, flight, dwell, window.
_Avoid_: Bar, segment, block

**Hold**:
The span in which a sensor holds a track with measurements.

**Coast**:
The span in which a sensor holds a track without a measurement.
_Avoid_: Drop, gap, lost

**Track quality**:
How well a track estimate matches the threat. It rises on a measurement and falls while the
track coasts.
_Avoid_: Confidence, accuracy, health

**Classification**:
The state of a track: unknown, suspected, then hostile.
_Avoid_: Identification, ID, target quality

**Assignment**:
The C2 decision that pairs one effector with one track.
_Avoid_: Tasking, allocation, commit

**Release**:
The instant an effector's round, beam or emission leaves it.
_Avoid_: Launch (kinetic only), fire, shot

**Effect**:
The instant an engagement resolves on the threat: hard kill, mission kill, soft kill or miss.
_Avoid_: Intercept (kinetic only), outcome, result

**Dwell**:
A jammer's span from release to effect.
_Avoid_: Jam window, emission time

**Window**:
The span in which a threat is inside an effector's engagement range.
_Avoid_: WEZ time, opportunity

**Arrival**:
The instant a threat reaches its planned end point or its defended asset.
_Avoid_: Impact, leak, hit

**Enabled**:
A platform that takes part in the run from T+0. There is no separate activation time.
_Avoid_: Activated, powered, emitting

**Observed horizon**:
The latest run time the playback has observed. Nothing draws past it. Scrubbing never advances it.
_Avoid_: Progress, watermark

**Playhead**:
The line at the current simulation time on the run timeline.
_Avoid_: Cursor (in the timeline), scrubber, needle

**Viewport**:
The visible window of the time axis. It follows the playhead while playing.
_Avoid_: Zoom level, range, scroll window
