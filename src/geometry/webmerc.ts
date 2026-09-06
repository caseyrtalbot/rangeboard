/**
 * Web Mercator tile math for the satellite basemap. Pure functions, no React.
 * The scenario geoRef anchors lon/lat to the world frame (meters, +y south):
 * mercator offsets from the anchor are scaled by cos(lat0) so distances near
 * the anchor are true ground meters.
 */

export const R = 6378137

interface GeoPoint {
  lat: number
  lon: number
}

export function mercX(lonDeg: number): number {
  return (R * lonDeg * Math.PI) / 180
}

export function mercY(latDeg: number): number {
  return R * Math.log(Math.tan(Math.PI / 4 + (latDeg * Math.PI) / 360))
}

/** Lon/lat of the top-left corner of tile (z, x, y). */
export function tileToLonLat(z: number, x: number, y: number): GeoPoint {
  const n = 2 ** z
  const lon = (x / n) * 360 - 180
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI
  return { lat, lon }
}

function anchorK(lat0: number): number {
  return Math.cos((lat0 * Math.PI) / 180)
}

/** World meters of a lon/lat point relative to the anchor. */
export function lonLatToWorld(ref: GeoPoint, lonDeg: number, latDeg: number): { x: number; y: number } {
  const k = anchorK(ref.lat)
  return {
    x: (mercX(lonDeg) - mercX(ref.lon)) * k,
    y: -(mercY(latDeg) - mercY(ref.lat)) * k,
  }
}

/** Mercator coordinates of a world point, inverse of the anchor mapping. */
export function worldToMerc(ref: GeoPoint, wx: number, wy: number): { mx: number; my: number } {
  const k = anchorK(ref.lat)
  return { mx: wx / k + mercX(ref.lon), my: -wy / k + mercY(ref.lat) }
}

/** Tile indices containing a mercator point, clamped to the zoom's grid. */
export function tileIndex(z: number, mx: number, my: number): { tx: number; ty: number } {
  const n = 2 ** z
  const max = n - 1
  const tx = Math.floor(((1 + mx / (Math.PI * R)) / 2) * n)
  const ty = Math.floor(((1 - my / (Math.PI * R)) / 2) * n)
  return {
    tx: Math.min(max, Math.max(0, tx)),
    ty: Math.min(max, Math.max(0, ty)),
  }
}

/** Ground size of one tile edge in world meters at the anchor latitude. */
export function tileWorldSizeM(z: number, lat0: number): number {
  return ((2 * Math.PI * R) / 2 ** z) * anchorK(lat0)
}

/** Tile zoom whose native resolution meets the camera's pixels per meter. */
export function pickZoom(lat0: number, pxPerMeter: number): number {
  const z = Math.ceil(Math.log2(156543.03392 * anchorK(lat0) * pxPerMeter))
  return Math.min(19, Math.max(2, z))
}
