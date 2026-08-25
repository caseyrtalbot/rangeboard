#!/usr/bin/env python3
"""Generate the RangeBoard track-picture mockup as a single HTML file."""
import math
import os

SP = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(SP, "mockup.html")
REPO = os.path.abspath(os.path.join(SP, "..", ".."))

# IBM Plex is inlined as data URIs: the artifact CSP blocks font CDNs, and a
# silent fallback would misrepresent the design. Faces come from the project's
# own @fontsource dependency, so `npm install` is the only prerequisite.
FACES = [
    ("IBM Plex Sans", 400, "ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2"),
    ("IBM Plex Sans", 600, "ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2"),
    ("IBM Plex Sans", 700, "ibm-plex-sans/files/ibm-plex-sans-latin-700-normal.woff2"),
    ("IBM Plex Mono", 400, "ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2"),
    ("IBM Plex Mono", 600, "ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff2"),
]


def font_css():
    import base64
    out = []
    for family, weight, rel in FACES:
        path = os.path.join(REPO, "node_modules/@fontsource", rel)
        data = base64.b64encode(open(path, "rb").read()).decode()
        out.append(
            "@font-face{font-family:'%s';font-style:normal;font-weight:%d;font-display:block;"
            "src:url(data:font/woff2;base64,%s) format('woff2');}" % (family, weight, data)
        )
    return "\n".join(out)


FONTS = font_css()

W, H = 1200, 700

# ---------------------------------------------------------------- geometry --

def pt(x, y):
    return "%.1f %.1f" % (x, y)


def wedge(cx, cy, heading, sector, r):
    """Sector path. Heading 0 = north (up), clockwise degrees."""
    a0 = math.radians(heading - sector / 2)
    a1 = math.radians(heading + sector / 2)
    x0, y0 = cx + r * math.sin(a0), cy - r * math.cos(a0)
    x1, y1 = cx + r * math.sin(a1), cy - r * math.cos(a1)
    large = 1 if sector > 180 else 0
    return "M %s L %s A %d %d 0 %d 1 %s Z" % (pt(cx, cy), pt(x0, y0), r, r, large, pt(x1, y1))


def diamond(x, y, r):
    return "M %s L %s L %s L %s Z" % (pt(x, y - r), pt(x + r, y), pt(x, y + r), pt(x - r, y))


def brackets(x, y, half, arm):
    """Four corner brackets of a target reticle."""
    out = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            cx, cy = x + sx * half, y + sy * half
            out.append("M %s L %s" % (pt(cx - sx * arm, cy), pt(cx, cy)))
            out.append("M %s L %s" % (pt(cx, cy - sy * arm), pt(cx, cy)))
    return " ".join(out)


def bearing(a, b):
    return math.degrees(math.atan2(b[0] - a[0], -(b[1] - a[1])))


def poly(points):
    return " ".join("%.1f,%.1f" % p for p in points)


# ------------------------------------------------------------------ colors --
C = dict(
    bg="#16181a", panel="#1d2023", input="#121415", border="#33383b", hover="#26292c",
    text="#cfd4cc", dim="#82887e", accent="#a9b4bd", danger="#c4564a", good="#8fae7a",
    warn="#d98f41", ew="#7da7c4", amber="#d9a441", ghost="#6a7178", sensor="#7da7c4",
    effector="#c9975a", uas="#c46a5a",
)

# ------------------------------------------------------------------- laydown -
ASSET = (780, 400)
C2 = (690, 425)

SENSORS = [
    dict(name="EchoShield radar 1", labelDy=-20, pos=(450, 400), r=255, classify=155, omni=True),
    dict(name="RfOne RF 1", pos=(720, 210), r=200, heading=232, sector=100, omni=False),
]

EFFECTORS = [
    dict(key="E1", name="Anvil interceptor 1", pos=(620, 505), r=175, state="semi-active"),
    dict(key="E2", name="M230LF gun 1", pos=(500, 300), r=150, state="active"),
    dict(key="E3", name="DroneShield jammer 1", pos=(255, 470), r=145, state="beam"),
]

TRACKS = [
    dict(key="T1", name="RUS-TAC-01 1", phase="tracked", pos=(330, 250),
         path=[(110, 155), (220, 205), (330, 250), (450, 305)]),
    dict(key="T5", name="RUS-TAC-02 1", phase="jammed", pos=(350, 480),
         path=[(120, 435), (230, 458), (350, 480), (500, 505)]),
    dict(key="T3", name="IRN-TAC-01 1", phase="engaged", pos=(555, 395),
         path=[(215, 360), (380, 378), (555, 395), (780, 400)]),
    dict(key="T2", name="UKR-TAC-04 1", phase="targeted", pos=(600, 585),
         path=[(300, 650), (450, 620), (600, 585), (780, 470)]),
    dict(key="T4", name="GEN-SERIAL 2", phase="ghost", pos=(860, 560),
         path=[(350, 660), (500, 635), (660, 600), (860, 560), (1010, 528)],
         killed=(660, 600)),
]

SHOTS = [
    dict(frm=(620, 505), to=(555, 395), mode="semi-active", channel="kill", delay=0.0),
    dict(frm=(500, 300), to=(555, 395), mode="active", channel="kill", delay=1.0),
]
BEAM = dict(frm=(255, 470), to=(350, 480))

# Sanity: every shot must start inside the firing effector's envelope, and the
# whole laydown must stay inside the frame with a margin.
for shot in SHOTS + [BEAM]:
    src = next(e for e in EFFECTORS if e["pos"] == shot["frm"])
    d = math.dist(shot["frm"], shot["to"])
    assert d <= src["r"], "%s shoots %.0f beyond its %d envelope" % (src["name"], d, src["r"])
for e in EFFECTORS + [dict(name=s["name"], pos=s["pos"], r=s["r"]) for s in SENSORS if s["omni"]]:
    x, y = e["pos"]
    assert -30 <= x - e["r"] and x + e["r"] <= W + 30, "%s ring leaves the frame in x" % e["name"]
    assert -30 <= y - e["r"] and y + e["r"] <= H + 30, "%s ring leaves the frame in y" % e["name"]

PHASE = dict(
    undetected=("UNDETECTED", C["uas"]),
    searching=("SEARCHING", C["dim"]),
    tracked=("TRACKED", C["amber"]),
    identified=("HOSTILE", C["danger"]),
    targeted=("TARGETED", C["danger"]),
    engaged=("ENGAGED", C["danger"]),
    jammed=("ENGAGED · EW", C["ew"]),
    ghost=("GHOST", C["ghost"]),
)

# ------------------------------------------------------------ svg fragments --

def sensor_svg(s):
    x, y = s["pos"]
    col = C["sensor"]
    out = ['<g class="lyr-footprint" fill="none">']
    if s["omni"]:
        out.append('<circle cx="%d" cy="%d" r="%d" fill="%s" fill-opacity=".055"/>' % (x, y, s["r"], col))
        out.append('<circle cx="%d" cy="%d" r="%d" stroke="%s" stroke-opacity=".42" stroke-width="1"/>' % (x, y, s["r"], col))
        out.append('<circle class="lyr-classify" cx="%d" cy="%d" r="%d" stroke="%s" stroke-opacity=".3" stroke-width="1" stroke-dasharray="4 6"/>' % (x, y, s["classify"], col))
    else:
        d = wedge(x, y, s["heading"], s["sector"], s["r"])
        out.append('<path d="%s" fill="%s" fill-opacity=".055"/>' % (d, col))
        out.append('<path d="%s" stroke="%s" stroke-opacity=".42" stroke-width="1"/>' % (d, col))
    out.append("</g>")
    out.append('<g class="ent">'
               '<rect x="%.1f" y="%.1f" width="19" height="12" fill="%s" stroke="#000" stroke-opacity=".35"/>'
               '<text class="ent-label" x="%d" y="%d" text-anchor="middle">%s</text></g>'
               % (x - 9.5, y - 6, col, x, y + s.get("labelDy", 23), s["name"]))
    return "\n".join(out)


def effector_svg(e):
    x, y = e["pos"]
    col = C["effector"]
    cls = "eff eff-%s" % e["state"]
    out = ['<g class="lyr-envelope" fill="none">',
           '<circle cx="%d" cy="%d" r="%d" stroke="%s" stroke-opacity=".34" stroke-width="1" stroke-dasharray="6 7"/>' % (x, y, e["r"], col),
           "</g>",
           '<g class="%s">' % cls,
           '<rect class="eff-frame" x="%.1f" y="%.1f" width="19" height="12" stroke="%s" stroke-width="1.5" fill="%s"/>' % (x - 9.5, y - 6, col, col),
           '<text class="ent-label" x="%d" y="%d" text-anchor="middle">%s</text></g>' % (x, y + 23, e["name"])]
    return "\n".join(out)


def track_svg(t):
    x, y = t["pos"]
    phase = t["phase"]
    label, col = PHASE[phase]
    ghost = phase == "ghost"
    heading = bearing(t["path"][-2], t["path"][-1])
    out = []

    # Flight path, drawn ahead of the ship as the course it keeps flying.
    out.append('<g class="lyr-path" fill="none"><polyline points="%s" stroke="%s" stroke-opacity="%s" '
               'stroke-width="1.2" stroke-dasharray="8 5"/></g>'
               % (poly(t["path"]), C["ghost"] if ghost else C["uas"], ".5" if ghost else ".75"))

    out.append('<g class="trk trk-%s" data-track="%s" tabindex="0" role="button" aria-label="%s">' % (phase, t["key"], t["name"]))
    out.append('<circle class="trk-hit" cx="%d" cy="%d" r="26" fill="#000" fill-opacity="0"/>' % (x, y))

    if phase in ("targeted", "engaged"):
        out.append('<path class="trk-bracket" d="%s" stroke="%s" stroke-width="1.6" fill="none"/>'
                   % (brackets(x, y, 19, 6), col))
    if phase in ("tracked", "identified", "targeted", "engaged", "jammed"):
        out.append('<circle class="trk-ring" cx="%d" cy="%d" r="14" stroke="%s" stroke-width="1.6" fill="none"/>' % (x, y, col))

    # Heading tick under the frame, then the 2525 hostile diamond.
    hx = x + 17 * math.sin(math.radians(heading))
    hy = y - 17 * math.cos(math.radians(heading))
    out.append('<line x1="%d" y1="%d" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="1.6"/>'
               % (x, y, hx, hy, C["ghost"] if ghost else C["uas"]))
    if ghost:
        out.append('<path d="%s" fill="none" stroke="%s" stroke-width="1.7" stroke-dasharray="3.5 3"/>' % (diamond(x, y, 11), C["ghost"]))
    else:
        out.append('<path d="%s" fill="%s" stroke="#000" stroke-opacity=".35"/>' % (diamond(x, y, 11), C["uas"]))

    out.append('<circle class="trk-sel" cx="%d" cy="%d" r="28" stroke="#ffffff" stroke-width="1.3" '
               'stroke-dasharray="4 3" fill="none"/>' % (x, y))
    out.append('<text class="ent-label" x="%d" y="%d" text-anchor="middle" fill="%s">%s</text>'
               % (x, y + 26, C["ghost"] if ghost else "#b7bdb2", t["name"]))
    if ghost:
        out.append('<text class="trk-tag" x="%d" y="%d" text-anchor="middle" fill="%s">GHOST · MISSION KILL</text>' % (x, y + 38, C["ghost"]))
    if phase == "jammed":
        out.append('<text class="trk-tag" x="%d" y="%d" fill="%s">JAM 0.71</text>' % (x + 15, y - 13, C["ew"]))
    out.append("</g>")

    if t.get("killed"):
        kx, ky = t["killed"]
        out.append('<g class="kill-mark" fill="none" stroke="%s" stroke-width="1.3">'
                   '<line x1="%d" y1="%d" x2="%d" y2="%d"/><line x1="%d" y1="%d" x2="%d" y2="%d"/></g>'
                   % (C["ghost"], kx - 5, ky - 5, kx + 5, ky + 5, kx - 5, ky + 5, kx + 5, ky - 5))
        out.append('<text class="trk-tag" x="%d" y="%d" text-anchor="middle" fill="%s">T+4:12</text>' % (kx, ky + 18, C["ghost"]))
    return "\n".join(out)


def trim(a, b, head, tail):
    """Shorten a segment at both ends so it clears the two glyphs."""
    d = math.dist(a, b) or 1
    ux, uy = (b[0] - a[0]) / d, (b[1] - a[1]) / d
    return (a[0] + ux * head, a[1] + uy * head), (b[0] - ux * tail, b[1] - uy * tail)


def shot_svg(s, i):
    fx, fy = trim(s["frm"], s["to"], 13, 15)[0]
    tx, ty = trim(s["frm"], s["to"], 13, 15)[1]
    col = C["danger"] if s["channel"] == "kill" else C["ew"]
    rot = bearing(s["frm"], s["to"])
    line_op = ".72" if s["mode"] == "semi-active" else ".3"
    seeker = ('<circle class="seeker" cx="0" cy="0" r="11" stroke="%s" stroke-width="1" fill="none"/>' % col) \
        if s["mode"] == "active" else ""
    return (
        '<g class="shot shot-%s" style="--dx:%.1fpx;--dy:%.1fpx;--delay:%.2fs">'
        '<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-opacity="%s" stroke-width="1"/>'
        '<g transform="translate(%.1f %.1f)"><g class="round"><g transform="rotate(%.1f)">%s'
        '<path d="M 0 -8 L 6 6 L -6 6 Z" fill="%s"/></g></g></g></g>'
        % (s["mode"], tx - fx, ty - fy, s["delay"], fx, fy, tx, ty, col, line_op, fx, fy, rot, seeker, col)
    )


def beam_svg(b):
    (fx, fy), (tx, ty) = trim(b["frm"], b["to"], 13, 15)
    return ('<g class="shot shot-beam"><line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" '
            'stroke-width="1.4" stroke-dasharray="2 4"/></g>' % (fx, fy, tx, ty, C["ew"]))


def grid_svg():
    out = ['<g class="lyr-grid" stroke="#26292c" stroke-width="1">']
    for x in range(0, W + 1, 60):
        out.append('<line x1="%d" y1="0" x2="%d" y2="%d" stroke="%s"/>' % (x, x, H, "#323639" if x % 300 == 0 else "#26292c"))
    for y in range(0, H + 1, 60):
        out.append('<line x1="0" y1="%d" x2="%d" y2="%d" stroke="%s"/>' % (y, W, y, "#323639" if y % 300 == 0 else "#26292c"))
    out.append("</g>")
    return "\n".join(out)


def connections_svg():
    links = [(SENSORS[0]["pos"], C2), (SENSORS[1]["pos"], C2), (C2, EFFECTORS[0]["pos"]), (C2, EFFECTORS[1]["pos"])]
    out = ['<g class="lyr-conn" stroke="#8a9199" stroke-opacity=".55" stroke-width="1" stroke-dasharray="3 4" fill="none">']
    for a, b in links:
        d = math.dist(a, b)
        ux, uy = (b[0] - a[0]) / d, (b[1] - a[1]) / d
        out.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>'
                   % (a[0] + ux * 15, a[1] + uy * 15, b[0] - ux * 15, b[1] - uy * 15))
    out.append("</g>")
    return "\n".join(out)


def board_svg():
    parts = ['<svg class="board" viewBox="0 0 %d %d" preserveAspectRatio="xMidYMid meet" role="img" '
             'aria-label="Proposed RangeBoard tactical picture">' % (W, H), grid_svg()]
    for s in SENSORS:
        parts.append(sensor_svg(s))
    for e in EFFECTORS:
        parts.append(effector_svg(e))
    parts.append(connections_svg())
    parts.append('<g class="ent"><circle cx="%d" cy="%d" r="8" fill="%s" stroke="#000" stroke-opacity=".35"/>'
                 '<text class="ent-label" x="%d" y="%d" text-anchor="middle">Defended asset</text></g>'
                 % (ASSET[0], ASSET[1], C["good"], ASSET[0], ASSET[1] + 22))
    parts.append('<g class="ent"><circle cx="%d" cy="%d" r="8" fill="%s" stroke="#000" stroke-opacity=".35"/>'
                 '<text class="c2-mark" x="%d" y="%d" text-anchor="middle">C2</text>'
                 '<text class="ent-label" x="%d" y="%d" text-anchor="middle">Lattice C2</text></g>'
                 % (C2[0], C2[1], C["text"], C2[0], C2[1] + 3, C2[0], C2[1] + 22))
    parts.append('<g class="lyr-engage">')
    for i, s in enumerate(SHOTS):
        parts.append(shot_svg(s, i))
    parts.append(beam_svg(BEAM))
    parts.append("</g>")
    for t in TRACKS:
        parts.append(track_svg(t))
    parts.append("</svg>")
    return "\n".join(parts)


# -------------------------------------------------------------- specimens ---

def specimen_track(phase, heading=95):
    x, y = 60, 52
    label, col = PHASE[phase]
    ghost = phase == "ghost"
    out = ['<svg class="spec-svg" viewBox="0 0 120 104" aria-hidden="true">']
    # ENGAGED must be distinguishable from TARGETED in a still frame, so the
    # specimen shows the inbound round that defines it.
    if phase == "engaged":
        out.append('<g class="shot shot-semi-active" style="--dx:44.0px;--dy:-31.0px;--delay:0s">'
                   '<line x1="8" y1="94" x2="46" y2="67" stroke="%s" stroke-opacity=".7" stroke-width="1"/>'
                   '<g transform="translate(8 94)"><g class="round"><g transform="rotate(125)">'
                   '<path d="M 0 -7 L 5 5 L -5 5 Z" fill="%s"/></g></g></g></g>' % (C["danger"], C["danger"]))
    out.append('<g class="trk trk-%s spec">' % phase)
    if phase in ("targeted", "engaged"):
        out.append('<path class="trk-bracket" d="%s" stroke="%s" stroke-width="1.6" fill="none"/>' % (brackets(x, y, 19, 6), col))
    if phase in ("tracked", "identified", "targeted", "engaged"):
        out.append('<circle class="trk-ring" cx="%d" cy="%d" r="14" stroke="%s" stroke-width="1.6" fill="none"/>' % (x, y, col))
    hx = x + 17 * math.sin(math.radians(heading))
    hy = y - 17 * math.cos(math.radians(heading))
    out.append('<line x1="%d" y1="%d" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="1.6"/>' % (x, y, hx, hy, C["ghost"] if ghost else C["uas"]))
    if ghost:
        out.append('<path d="%s" fill="none" stroke="%s" stroke-width="1.8" stroke-dasharray="3.5 3"/>' % (diamond(x, y, 11), C["ghost"]))
    else:
        out.append('<path d="%s" fill="%s" stroke="#000" stroke-opacity=".35"/>' % (diamond(x, y, 11), C["uas"]))
    out.append("</g></svg>")
    return "\n".join(out)


def specimen_effector(state):
    """One effector plus one round in flight, for the guidance specimens."""
    anchor, target = (26, 78), (100, 26)
    frm, to = trim(anchor, target, 14, 16)
    col = C["ew"] if state == "beam" else C["danger"]
    rot = bearing(anchor, target)
    out = ['<svg class="spec-svg spec-wide" viewBox="0 0 130 104" aria-hidden="true">']
    if state == "beam":
        out.append('<g class="shot shot-beam"><line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" '
                   'stroke-width="1.4" stroke-dasharray="2 4"/></g>' % (frm[0], frm[1], to[0], to[1], C["ew"]))
    else:
        line_op = ".72" if state == "semi-active" else ".3"
        seeker = '<circle class="seeker" cx="0" cy="0" r="11" stroke="%s" stroke-width="1" fill="none"/>' % col if state == "active" else ""
        out.append('<g class="shot shot-%s" style="--dx:%.1fpx;--dy:%.1fpx;--delay:0s">'
                   '<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-opacity="%s" stroke-width="1"/>'
                   '<g transform="translate(%.1f %.1f)"><g class="round"><g transform="rotate(%.1f)">%s'
                   '<path d="M 0 -8 L 6 6 L -6 6 Z" fill="%s"/></g></g></g></g>'
                   % (state, to[0] - frm[0], to[1] - frm[1], frm[0], frm[1], to[0], to[1], col, line_op,
                      frm[0], frm[1], rot, seeker, col))
    ring = C["ew"] if state == "beam" else C["danger"]
    out.append('<circle cx="%d" cy="%d" r="13" fill="none" stroke="%s" stroke-width="1.5"/>' % (target[0], target[1], ring))
    out.append('<path d="%s" fill="%s" stroke="#000" stroke-opacity=".35"/>' % (diamond(target[0], target[1], 9), C["uas"]))
    out.append('<g class="eff eff-%s"><rect class="eff-frame" x="%.1f" y="%.1f" width="19" height="12" '
               'stroke="%s" stroke-width="1.5" fill="%s"/></g>' % (state, anchor[0] - 9.5, anchor[1] - 6, C["effector"], C["effector"]))
    out.append("</svg>")
    return "\n".join(out)


def specimen_idle_effector():
    out = ['<svg class="spec-svg spec-wide" viewBox="0 0 130 104" aria-hidden="true">']
    out.append('<circle cx="65" cy="52" r="46" fill="none" stroke="%s" stroke-opacity=".5" stroke-width="1" '
               'stroke-dasharray="8 6"/>' % C["effector"])
    out.append('<g class="eff eff-idle"><rect class="eff-frame" x="55.5" y="46" width="19" height="12" '
               'stroke="%s" stroke-width="1.5" fill="%s"/></g></svg>' % (C["effector"], C["effector"]))
    return "\n".join(out)


# ------------------------------------------------------------------ readout --
READOUT = {
    "T1": dict(name="RUS-TAC-01 1", phase="tracked", model="Orlan-10 class · Group 2 · fixed-wing",
               nav="GPS / inertial", pos="E 2.14 nm, N 1.02 nm", alt="900 - 1,600 ft AGL", spd="61 kt",
               hdg="118", hold="2", sensors="EchoShield radar · RfOne RF",
               cls="SUSPECTED", cont="96%", jam="none", kin="0", jams="0", inc="0",
               eff="0", kills="0.00", res="1.00", arr="T+3:48"),
    "T2": dict(name="UKR-TAC-04 1", phase="targeted", model="FPV 7-inch · Group 1 · fpv",
               nav="RF manual", pos="E 1.62 nm, N 0.41 nm", alt="60 - 300 ft AGL", spd="78 kt",
               hdg="072", hold="2", sensors="EchoShield radar · Squarehead acoustic",
               cls="HOSTILE", cont="91%", jam="none", kin="0", jams="0", inc="0",
               eff="0", kills="0.00", res="1.00", arr="T+1:26"),
    "T3": dict(name="IRN-TAC-01 1", phase="engaged", model="Shahed-136 class · Group 3 · one-way-attack",
               nav="GNSS / inertial", pos="E 1.98 nm, N 0.88 nm", alt="1,200 - 2,400 ft AGL", spd="102 kt",
               hdg="084", hold="3", sensors="EchoShield radar · RfOne RF · Ranger R8SS",
               cls="HOSTILE", cont="99%", jam="none", kin="3", jams="0", inc="2",
               eff="1", kills="0.62", res="0.38", arr="T+0:52"),
    "T4": dict(name="GEN-SERIAL 2", phase="ghost", model="Mugin-5 class · Group 3 · fixed-wing",
               nav="GNSS / RF", pos="E 2.61 nm, N 0.19 nm", alt="700 - 1,100 ft AGL", spd="54 kt",
               hdg="071", hold="0", sensors="track dropped at T+4:12",
               cls="HOSTILE", cont="88%", jam="0.94", kin="1", jams="4", inc="0",
               eff="5", kills="0.96", res="0.04", arr="not reached"),
    "T5": dict(name="RUS-TAC-02 1", phase="jammed", model="DJI Mavic 3 · Group 1 · quad",
               nav="RF manual", pos="E 1.31 nm, N 0.53 nm", alt="120 - 400 ft AGL", spd="32 kt",
               hdg="066", hold="2", sensors="EchoShield radar · Squarehead acoustic",
               cls="HOSTILE", cont="94%", jam="0.71", kin="0", jams="3", inc="1",
               eff="2", kills="0.00", res="1.00", arr="T+2:10"),
}

ANCHOR = {t["key"]: (t["pos"][0] / W * 100, t["pos"][1] / H * 100) for t in TRACKS}


def readout_html(key):
    d = READOUT[key]
    label, col = PHASE[d["phase"]]
    ghost_line = ""
    if d["phase"] == "ghost":
        ghost_line = ('<div class="ro-ghost">Ghost track. Eliminated T+4:12 by mission kill. '
                      'It keeps flying its last course.</div>')
    rows = [
        ("PLATFORM", d["model"]),
        ("NAV", d["nav"]),
        ("POSITION", d["pos"]),
        ("ALTITUDE", d["alt"]),
        ("SPEED / HDG", "%s · %s deg" % (d["spd"], d["hdg"])),
        ("HOLD", "%s sensors · %s" % (d["hold"], d["sensors"])),
        ("CLASS", "%s · continuity %s" % (d["cls"], d["cont"])),
        ("EW", "no jam effect" if d["jam"] == "none" else "jam degrade %s" % d["jam"]),
        ("SALVOS", "%s kinetic · %s jam · %s inbound" % (d["kin"], d["jams"], d["inc"])),
        ("EFFECTS", "%s landed · E[k] %s" % (d["eff"], d["kills"])),
        ("RESIDUAL", "%s ships" % d["res"]),
        ("ARRIVAL", d["arr"]),
    ]
    body = "".join('<div class="ro-k">%s</div><div class="ro-v">%s</div>' % r for r in rows)
    return ('<div class="readout" data-readout="%s">'
            '<div class="ro-head"><span class="ro-name">%s</span>'
            '<span class="ro-phase" style="--pc:%s">%s</span></div>'
            '%s<div class="ro-grid">%s</div>'
            '<div class="ro-foot">PLANNING MODEL · 0.5 S CADENCE · NOT INSTRUMENTED</div></div>'
            % (key, d["name"], col, label, ghost_line, body))


# ------------------------------------------------------------------- chrome --
LAYERS = [
    ("Grid", "grid"), ("Boundaries", "boundaries"), ("Sensor footprints", "sensorFootprints"),
    ("Classify rings", "classifyRings"), ("Effector envelopes", "effectorEnvelopes"),
    ("Threat WEZ", "threatWez"), ("Flight paths", "flightPaths"), ("Connections", "connections"),
    ("Range rings", "rangeRings"), ("Engagements", "engagements"), ("Labels", "labels"),
    ("Track telemetry", "trackTelemetry"),
]
PRESETS = {
    "full": {k: True for _, k in LAYERS},
    "planning": dict({k: True for _, k in LAYERS}, threatWez=False, engagements=False),
    "engagement": dict({k: False for _, k in LAYERS}, grid=True, boundaries=True,
                       effectorEnvelopes=True, flightPaths=True, engagements=True,
                       labels=True, trackTelemetry=True),
    "clean": dict({k: False for _, k in LAYERS}, grid=True, labels=True, trackTelemetry=True),
}
PRESETS["full"]["threatWez"] = False


def view_menu(open_class=""):
    groups = [
        ("Coverage", ["sensorFootprints", "classifyRings", "effectorEnvelopes", "threatWez"]),
        ("Tracks", ["flightPaths", "engagements", "labels", "trackTelemetry"]),
        ("Reference", ["grid", "boundaries", "connections", "rangeRings"]),
    ]
    name = {k: n for n, k in LAYERS}
    out = ['<div class="menu view-menu %s" role="menu">' % open_class]
    out.append('<div class="menu-head">Preset</div><div class="seg seg-menu">'
               '<button class="active">Full</button><button>Planning</button>'
               '<button>Engagement</button><button>Clean</button></div>')
    for title, keys in groups:
        out.append('<div class="menu-head">%s</div>' % title)
        for k in keys:
            on = PRESETS["full"][k]
            out.append('<button class="menu-item" role="menuitemcheckbox" aria-checked="%s">'
                       '<span class="tick">%s</span>%s</button>' % ("true" if on else "false", "&#10003;" if on else "", name[k]))
    out.append('<div class="menu-head">Basemap</div><div class="seg seg-menu">'
               '<button class="active">Canvas</button><button>Sat</button><button>Airspace</button></div>')
    out.append('<div class="menu-head">Units</div><div class="seg seg-menu">'
               '<button class="active">kt nm</button><button>m km</button></div>')
    out.append("</div>")
    return "\n".join(out)


def ctx_menu():
    name = {k: n for n, k in LAYERS}
    items = "".join('<button class="menu-item" role="menuitemcheckbox" aria-checked="%s"><span class="tick">%s</span>%s</button>'
                    % ("true" if PRESETS["full"][k] else "false", "&#10003;" if PRESETS["full"][k] else "", name[k])
                    for _, k in LAYERS)
    return ('<div class="ctx-demo">'
            '<div class="menu ctx" role="menu">'
            '<div class="menu-head">Add at this point</div>'
            '<button class="menu-item">Place system <span class="caret">&#9656;</span></button>'
            '<button class="menu-item">Place sensor <span class="caret">&#9656;</span></button>'
            '<button class="menu-item">Place effector <span class="caret">&#9656;</span></button>'
            '<button class="menu-item is-open">Display <span class="caret">&#9656;</span></button>'
            '</div>'
            '<div class="menu ctx flyout" role="menu">'
            '<div class="menu-head">Preset</div>'
            '<button class="menu-item">Full picture</button>'
            '<button class="menu-item">Planning</button>'
            '<button class="menu-item">Engagement</button>'
            '<button class="menu-item">Clean</button>'
            '<div class="menu-head">Layers</div>%s</div></div>' % items)


def toolbar_before():
    seg = lambda items, active=0: '<div class="seg">%s</div>' % "".join(
        '<button class="%s">%s</button>' % ("active" if i == active else "", t) for i, t in enumerate(items))
    return ('<div class="tb tb-before">'
            '<span class="brand">RANGEBOARD</span>'
            + seg(["Board", "T&amp;E Ops"])
            + '<input class="scn-old" value="C-UAS T&amp;E Planning" readonly aria-label="Scenario name">'
            + seg(["Select", "Boundary", "Connect", "Path", "Calibrate"])
            + seg(["Canvas", "Sat", "Airspace"])
            + seg(["kt nm", "m km"])
            + '<div class="seg"><button>WEZ</button></div>'
            + '<span class="tb-gap"></span>'
            + '<span class="pill pill-good">ROE FREE</span>'
            + '<span class="pill pill-warn">ENV DERATE</span>'
            + '<span class="pill pill-dim">SAVED 14:30</span>'
            + '<div class="seg"><button>Undo</button><button>Redo</button></div>'
            + '<div class="seg"><button>New</button><button>Import</button><button>Export</button>'
              '<button>Capture frame</button></div></div>')


def toolbar_after(with_menu=False):
    seg = lambda items, active=0: '<div class="seg">%s</div>' % "".join(
        '<button class="%s">%s</button>' % ("active" if i == active else "", t) for i, t in enumerate(items))
    menu = view_menu("is-open") if with_menu else ""
    return ('<div class="tb tb-after">'
            '<span class="brand">RANGEBOARD</span>'
            + seg(["Board", "T&amp;E Ops"])
            + '<input class="scn" value="C-UAS T&amp;E Planning" readonly aria-label="Scenario name">'
            + seg(["Select", "Boundary", "Connect", "Path", "Calibrate"])
            + '<div class="menu-wrap"><button class="tb-menu %s" aria-haspopup="true" aria-expanded="%s">'
              'View <span class="caret">&#9662;</span></button>%s</div>'
              % ("active" if with_menu else "", "true" if with_menu else "false", menu)
            + '<span class="tb-gap"></span>'
            + '<span class="pill pill-good">ROE FREE</span>'
            + '<span class="pill pill-warn">ENV DERATE</span>'
            + '<span class="pill pill-dim">SAVED 14:30</span>'
            + '<div class="seg"><button title="Undo">&#8630;</button><button title="Redo">&#8631;</button></div>'
            + '<div class="menu-wrap"><button class="tb-menu" aria-haspopup="true" aria-expanded="false">'
              '&#8943;</button></div></div>')


def preset_matrix():
    head = "".join("<th>%s</th>" % p.capitalize() for p in ["full", "planning", "engagement", "clean"])
    rows = []
    for label, key in LAYERS:
        cells = "".join('<td><span class="dot %s" aria-label="%s"></span></td>'
                        % ("on" if PRESETS[p][key] else "off", "on" if PRESETS[p][key] else "off")
                        for p in ["full", "planning", "engagement", "clean"])
        rows.append("<tr><th scope=\"row\">%s</th>%s</tr>" % (label, cells))
    return ('<div class="table-wrap"><table class="matrix"><caption class="sr-only">Layer visibility per preset</caption>'
            '<thead><tr><th scope="col">Layer</th>%s</tr></thead><tbody>%s</tbody></table></div>' % (head, "".join(rows)))


# ---------------------------------------------------------------------- css --
CSS = """
:root{
  --bg:#16181a; --panel:#1d2023; --inputbg:#121415; --border:#33383b; --hover:#26292c;
  --text:#cfd4cc; --dim:#82887e; --accent:#a9b4bd; --danger:#c4564a; --good:#8fae7a;
  --warn:#d98f41; --ew:#7da7c4; --amber:#d9a441; --ghost:#6a7178;
  --page:#0e1011; --rule:#22262a; --sans:'IBM Plex Sans',system-ui,sans-serif;
  --mono:'IBM Plex Mono',ui-monospace,Menlo,monospace;
  color-scheme:dark;
}
*{box-sizing:border-box}
body{margin:0;background:var(--page);color:var(--text);font-family:var(--sans);font-size:14px;line-height:1.55;
  -webkit-font-smoothing:antialiased}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.wrap{max-width:1240px;margin:0 auto;padding:0 28px 96px}
a{color:var(--accent)}
:focus-visible{outline:1px solid var(--accent);outline-offset:2px}

/* ---- page typography ---- */
.eyebrow{font-family:var(--mono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--dim)}
h1{font-size:clamp(30px,4.4vw,50px);line-height:1.04;letter-spacing:-.02em;font-weight:600;margin:14px 0 0;
  text-wrap:balance;color:#e6eae4}
.lede{max-width:64ch;color:var(--text);font-size:16px;margin:16px 0 0}
.meta{display:flex;flex-wrap:wrap;gap:8px 22px;margin-top:22px;font-family:var(--mono);font-size:10.5px;
  letter-spacing:.1em;text-transform:uppercase;color:var(--dim)}
header.page{padding:64px 0 40px;border-bottom:1px solid var(--rule)}

section{padding-top:64px}
.sec-head{display:flex;align-items:baseline;gap:16px;border-top:1px solid var(--rule);padding-top:18px}
.sec-num{font-family:var(--mono);font-size:11px;letter-spacing:.12em;color:var(--dim);flex:none;width:32px}
h2{font-size:24px;font-weight:600;letter-spacing:-.01em;margin:0;color:#e6eae4}
.sec-sub{margin:10px 0 0 48px;max-width:62ch;color:var(--dim)}
h3{font-size:12px;font-family:var(--mono);font-weight:600;letter-spacing:.12em;text-transform:uppercase;
  color:var(--dim);margin:36px 0 12px}
p{margin:12px 0 0;max-width:64ch}
ul.notes{margin:14px 0 0;padding-left:18px;max-width:64ch}
ul.notes li{margin:6px 0}
strong{color:#e6eae4;font-weight:600}
code{font-family:var(--mono);font-size:.9em;color:var(--accent);background:var(--inputbg);
  border:1px solid var(--border);border-radius:2px;padding:1px 5px}

/* ---- app shell ---- */
.shell-scroll{overflow-x:auto;margin-top:28px;border:1px solid var(--border);background:var(--bg)}
.shell{min-width:1180px;background:var(--bg);display:flex;flex-direction:column}
.rail{display:flex;min-height:0}
.sliver{width:40px;flex:none;background:var(--panel);border-right:1px solid var(--border);
  display:flex;align-items:center;justify-content:center;color:var(--dim)}
.sliver.right{border-right:0;border-left:1px solid var(--border);width:52px}
.sliver span{font-family:var(--mono);font-size:9.5px;letter-spacing:.2em;text-transform:uppercase;
  writing-mode:vertical-rl;transform:rotate(180deg)}
.stage{position:relative;flex:1;min-width:0;background:var(--bg)}
.board{display:block;width:100%;height:auto}

/* ---- toolbar ---- */
.tb{display:flex;align-items:center;gap:9px;padding:7px 11px;background:var(--panel);
  border-bottom:1px solid var(--border)}
.tb-before{flex-wrap:wrap;row-gap:7px}
.brand{font-family:var(--sans);font-weight:700;letter-spacing:.19em;font-size:12px;color:var(--accent);
  padding-right:3px}
.tb-gap{flex:1}
.seg{display:flex;border:1px solid var(--border);border-radius:3px;overflow:hidden}
.seg button{background:transparent;color:var(--text);border:0;border-right:1px solid var(--border);
  padding:4px 9px;font:500 12px var(--sans);cursor:pointer}
.seg button:last-child{border-right:0}
.seg button.active{background:var(--accent);color:#121415;font-weight:600}
.scn-old{width:184px;background:var(--inputbg);color:var(--text);border:1px solid var(--border);
  border-radius:3px;padding:4px 8px;font:400 12px var(--sans)}
.scn{width:184px;background:transparent;color:var(--text);border:0;border-bottom:1px solid transparent;
  padding:4px 2px;font:600 12.5px var(--sans)}
.scn:hover,.scn:focus{border-bottom-color:var(--border);outline:none}
.tb-menu{background:transparent;color:var(--text);border:1px solid var(--border);border-radius:3px;
  padding:4px 10px;font:500 12px var(--sans);cursor:pointer;display:flex;align-items:center;gap:6px}
.tb-menu.active{border-color:var(--accent);color:#e6eae4}
.tb-menu:hover{background:var(--hover)}
.caret{font-size:9px;color:var(--dim)}
.pill{font-family:var(--mono);font-size:9.5px;letter-spacing:.11em;text-transform:uppercase;
  border:1px solid var(--border);border-radius:2px;padding:2px 7px;color:var(--dim);white-space:nowrap}
.pill-good{color:var(--good);border-color:#3a4a36}
.pill-warn{color:var(--warn);border-color:#4a3a26}
.pill-dim{color:var(--dim)}
.menu-wrap{position:relative}

/* ---- menus ---- */
.menu{background:var(--panel);border:1px solid var(--border);border-radius:3px;padding:5px;
  min-width:206px;box-shadow:0 12px 30px rgba(0,0,0,.55)}
.view-menu{position:absolute;top:calc(100% + 6px);left:0;z-index:6;display:none}
.view-menu.is-open{display:block}
.menu-static{position:static;display:block;box-shadow:none}
.menu-head{font-family:var(--mono);font-size:9px;letter-spacing:.16em;text-transform:uppercase;
  color:var(--dim);padding:9px 8px 4px}
.menu-item{display:flex;align-items:center;gap:8px;width:100%;background:transparent;border:0;
  color:var(--text);text-align:left;padding:5px 8px;font:400 12.5px var(--sans);cursor:pointer;
  border-radius:2px}
.menu-item:hover,.menu-item.is-open{background:var(--hover)}
.menu-item .caret{margin-left:auto}
.tick{width:11px;color:var(--accent);font-size:10px;flex:none}
.seg-menu{margin:2px 4px 4px}
.seg-menu button{flex:1;padding:4px 6px;font-size:11.5px}
.ctx-demo{display:flex;align-items:flex-start;gap:0}
.ctx{min-width:190px}
.ctx.flyout{margin-left:-1px;border-left-color:var(--border)}

/* ---- board svg ---- */
.ent-label{font-family:var(--mono);font-size:10px;fill:#b7bdb2}
.c2-mark{font-family:var(--mono);font-size:9px;font-weight:600;fill:#121415}
.trk-tag{font-family:var(--mono);font-size:9px;letter-spacing:.06em}
.trk{cursor:pointer}
.trk .trk-sel{opacity:0}
.trk.is-selected .trk-sel{opacity:1}
.trk:hover .trk-sel{opacity:.45}
.trk:focus{outline:none}
.trk:focus-visible .trk-sel{opacity:.6}
.kill-mark{opacity:.75}
.dim-layer{opacity:.35;transition:opacity .2s}

/* ---- motion ---- */
/* Still frame shows the round mid-flight; the animation takes over from here. */
.shot .round{transform:translate(calc(var(--dx) * .55),calc(var(--dy) * .55))}
@media (prefers-reduced-motion:no-preference){
  .shot-semi-active .round,.shot-active .round{
    animation:fly 2.4s linear infinite;animation-delay:var(--delay,0s)}
  .shot-beam line{animation:beam .5s steps(1,end) infinite}
  .eff-active .eff-frame{animation:launch 2.4s steps(1,end) infinite}
  .trk-engaged .trk-ring,.trk-engaged .trk-bracket{animation:pulse .5s steps(1,end) infinite}
  .trk-jammed .trk-ring{animation:pulse .5s steps(1,end) infinite}
  .seeker{animation:seek 2.4s linear infinite;animation-delay:var(--delay,0s)}
}
@keyframes fly{
  0%{transform:translate(0,0);opacity:0}
  4%{opacity:1}
  92%{opacity:1}
  100%{transform:translate(var(--dx),var(--dy));opacity:0}
}
@keyframes seek{0%,14%{opacity:0}15%,100%{opacity:.85}}
@keyframes beam{0%{stroke-opacity:.9}50%{stroke-opacity:.32}}
@keyframes launch{0%,6%{fill-opacity:1}7%,12%{fill-opacity:0}13%,18%{fill-opacity:1}19%,100%{fill-opacity:0}}
@keyframes pulse{0%{opacity:1}50%{opacity:.5}}
.eff-idle .eff-frame{fill-opacity:0}
.eff-semi-active .eff-frame,.eff-beam .eff-frame{fill-opacity:1}
.eff-active .eff-frame{fill-opacity:0}

/* ---- readout ---- */
.readout{width:292px;background:var(--inputbg);border:1px solid var(--border);border-radius:3px;
  padding:9px 11px 8px}
.readout-dock{position:absolute;top:14px;right:14px;z-index:4;pointer-events:none}
.leader{position:absolute;inset:0;width:100%;height:100%;z-index:3;pointer-events:none}
.ro-head{display:flex;align-items:center;gap:9px;padding-bottom:7px;border-bottom:1px solid var(--border)}
.ro-name{font:600 12.5px var(--sans);color:#e6eae4}
.ro-phase{margin-left:auto;font-family:var(--mono);font-size:9px;letter-spacing:.12em;text-transform:uppercase;
  color:var(--pc);border:1px solid var(--pc);border-radius:2px;padding:1px 6px;white-space:nowrap}
.ro-grid{display:grid;grid-template-columns:66px 1fr;gap:2px 10px;margin-top:7px;align-items:baseline}
.ro-k{font-family:var(--mono);font-size:8.5px;letter-spacing:.09em;color:var(--dim);text-transform:uppercase}
.ro-v{font-family:var(--mono);font-size:10.5px;line-height:1.35;color:var(--text);
  font-variant-numeric:tabular-nums}
.ro-ghost{margin-top:8px;font-size:11.5px;color:var(--ghost);border-left:2px solid var(--ghost);padding-left:8px}
.ro-foot{margin-top:9px;padding-top:6px;border-top:1px solid var(--border);font-family:var(--mono);
  font-size:8.5px;letter-spacing:.11em;color:var(--dim)}
.readout.static{width:320px}

/* ---- timeline ---- */
.tl{display:flex;align-items:center;gap:12px;padding:7px 12px;background:var(--panel);
  border-top:1px solid var(--border);font-family:var(--mono);font-size:10.5px;color:var(--dim)}
.tl-btn{width:24px;height:20px;border:1px solid var(--border);border-radius:2px;background:transparent;
  color:var(--text);cursor:pointer;font-size:10px}
.tl-track{flex:1;height:3px;background:var(--inputbg);border-radius:2px;position:relative}
.tl-fill{position:absolute;inset:0 62% 0 0;background:var(--accent);border-radius:2px}
.tl-knob{position:absolute;left:38%;top:50%;width:9px;height:9px;margin:-4.5px 0 0 -4.5px;
  background:var(--accent);border-radius:50%}

/* ---- specimen grids ---- */
.spec-row{display:grid;gap:1px;background:var(--border);border:1px solid var(--border);margin-top:22px}
.spec-6{grid-template-columns:repeat(6,minmax(0,1fr))}
.spec-4{grid-template-columns:repeat(4,minmax(0,1fr))}
.spec-2{grid-template-columns:repeat(2,minmax(0,1fr))}
@media(max-width:900px){.spec-6{grid-template-columns:repeat(3,minmax(0,1fr))}
  .spec-4{grid-template-columns:repeat(2,minmax(0,1fr))}
  .spec-2{grid-template-columns:1fr}}
.spec{background:var(--bg);padding:18px 16px 17px;display:flex;flex-direction:column;gap:2px}
.spec-art{display:flex;align-items:center;justify-content:center;height:132px;margin-bottom:14px}
.spec-svg{display:block;width:100%;max-width:176px;height:auto}
.spec-name{font-family:var(--mono);font-size:10px;letter-spacing:.11em;text-transform:uppercase}
.spec-desc{font-size:11.5px;color:var(--dim);line-height:1.5}
.swatch{display:inline-block;width:7px;height:7px;border-radius:1px;margin-right:6px;vertical-align:1px}

/* ---- annotated pair ---- */
.pair{display:grid;grid-template-columns:340px 1fr;gap:36px;margin-top:24px;align-items:start}
@media(max-width:800px){.pair{grid-template-columns:1fr}}
.ann{display:grid;grid-template-columns:112px 1fr;gap:5px 16px;font-size:12.5px}
.ann dt{font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);
  padding-top:3px}
.ann dd{margin:0;color:var(--text)}

/* ---- matrix ---- */
.table-wrap{overflow-x:auto;margin-top:22px;border:1px solid var(--border);max-width:860px}
.matrix{border-collapse:collapse;width:100%;min-width:460px;background:var(--bg)}
.matrix th,.matrix td{border-bottom:1px solid var(--rule);padding:5px 12px;text-align:left}
.matrix thead th{font-family:var(--mono);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;
  color:var(--dim);font-weight:400;background:var(--panel)}
.matrix tbody th{font-weight:400;font-size:12.5px;color:var(--text)}
.matrix td{text-align:center;width:80px}
.matrix tbody tr:hover{background:var(--panel)}
.matrix tbody tr:last-child th,.matrix tbody tr:last-child td{border-bottom:0}
.dot{display:inline-block;width:7px;height:7px;border-radius:50%}
.dot.on{background:var(--accent)}
.dot.off{border:1px solid var(--border)}

/* ---- misc blocks ---- */
.count{display:flex;gap:38px;flex-wrap:wrap;margin-top:26px}
.count div{display:flex;flex-direction:column;gap:2px}
.count b{font:600 30px var(--sans);color:#e6eae4;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.count span{font-family:var(--mono);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim)}
.cap{font-family:var(--mono);font-size:10px;letter-spacing:.09em;color:var(--dim);margin-top:10px}
.callout{border-left:2px solid var(--warn);padding:2px 0 2px 14px;margin-top:26px;max-width:64ch}
.callout .h{font-family:var(--mono);font-size:9.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--warn)}
footer{margin-top:76px;padding-top:22px;border-top:1px solid var(--rule);font-family:var(--mono);
  font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim)}
"""

# --------------------------------------------------------------------- html --
HTML = """<title>RangeBoard Track Picture</title>
<style>__FONTS__
__CSS__</style>

<div class="wrap">
<header class="page">
  <div class="eyebrow">RangeBoard &middot; board workspace &middot; proposal</div>
  <h1>Track picture and declutter</h1>
  <p class="lede">Five changes to the board. The chrome loses its clutter. A selected trackfile shows live
  telemetry. The track highlight follows the engagement, and an eliminated track becomes a ghost that keeps
  its course. Effectors draw the shot they fired. Every layer sits behind one menu.</p>
  <div class="meta">
    <span>Baseline 9d5843f</span><span>24 Aug 2026</span><span>Mockup only &middot; nothing is built yet</span>
  </div>
</header>

<section id="board">
  <div class="sec-head"><span class="sec-num">Board</span><h2>Proposed board view</h2></div>
  <p class="sec-sub">One toolbar row. Five trackfiles in five states. Two rounds in flight and one jam beam.
  Click any trackfile to move the telemetry readout.</p>
  <div class="shell-scroll">
    <div class="shell">
      __TB_AFTER__
      <div class="rail">
        <div class="sliver"><span>Library</span></div>
        <div class="stage" id="stage">
          __BOARD__
          <svg class="leader" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <line id="leader-line" vector-effect="non-scaling-stroke" stroke="#a9b4bd"
                  stroke-opacity=".45" stroke-width="1" stroke-dasharray="3 3"/>
          </svg>
          <div class="readout-dock" id="readout-host"></div>
        </div>
        <div class="sliver right"><span>Analysis</span></div>
      </div>
      <div class="tl">
        <button class="tl-btn" aria-label="Play">&#9658;</button>
        <span>RUN-0001</span><span>T+5:08 / 10:24</span>
        <div class="tl-track"><div class="tl-fill"></div><div class="tl-knob"></div></div>
        <span>2x</span><span>Layered (Acoustic + Radar)</span>
      </div>
    </div>
  </div>
  <p class="cap">Geometry is computed. Every shot starts inside the firing effector's own envelope.</p>
</section>

<section id="density">
  <div class="sec-head"><span class="sec-num">01</span><h2>Interface density</h2></div>
  <p class="sec-sub">The board toolbar carries twenty controls and wraps to a second row at common widths.
  Grouping them by how often an operator reaches for them leaves twelve, on one row.</p>

  <h3>Now</h3>
  <div class="shell-scroll"><div class="shell">__TB_BEFORE__</div></div>
  <h3>Proposed</h3>
  <div class="shell-scroll"><div class="shell">__TB_AFTER_2__</div></div>
  <p class="cap">The View menu that now holds the rest is in section 05.</p>

  <div class="count">
    <div><b>20 &rarr; 12</b><span>controls at rest</span></div>
    <div><b>4 &rarr; 1</b><span>segmented controls</span></div>
    <div><b>2</b><span>rows become one</span></div>
  </div>

  <ul class="notes">
    <li><strong>Into the View menu:</strong> basemap, units, threat WEZ, the twelve layer toggles, and the
    satellite controls that only appear in satellite mode.</li>
    <li><strong>Into the overflow menu:</strong> New, Import, Export, Capture frame.</li>
    <li><strong>Stays on the bar:</strong> workspace, scenario name, the five tools, undo, redo, status.</li>
    <li><strong>Restyled:</strong> the scenario name loses its box and shows a rule on hover. Status pills
    become hairline mono chips. Undo and redo become glyphs.</li>
  </ul>
</section>

<section id="telemetry">
  <div class="sec-head"><span class="sec-num">02</span><h2>Trackfile telemetry</h2></div>
  <p class="sec-sub">Select one trackfile and a readout opens at the corner of the board, tied to the track
  by a leader line. It never covers the inbound axis. It reads from the same sweep the analysis panel
  already runs, so it adds no computation.</p>
  <div class="pair">
    <div>__READOUT_STATIC__</div>
    <dl class="ann">
      <dt>Phase</dt><dd>The lifecycle state, in the same color the highlight uses on the canvas.</dd>
      <dt>Platform</dt><dd>Model, UAS group, airframe, and navigation mode from the library spec.</dd>
      <dt>Kinematics</dt><dd>Position in the active display units, altitude band, speed, and heading.</dd>
      <dt>Hold</dt><dd>How many sensors hold the track right now, and which ones.</dd>
      <dt>Class</dt><dd>The classification rung reached, with track continuity since first detection.</dd>
      <dt>EW</dt><dd>Jam degrade probability. It shows only when a jam effect has landed.</dd>
      <dt>Salvos</dt><dd>Kinetic and jam salvos assigned, plus rounds still in flight at this track.</dd>
      <dt>Effects</dt><dd>Effects landed and expected kill mass, in ships.</dd>
      <dt>Residual</dt><dd>Expected surviving ships. Below 0.05 the track becomes a ghost.</dd>
      <dt>Arrival</dt><dd>Time to closest approach at the defended asset.</dd>
      <dt>Placement</dt><dd>The card docks at a fixed corner so the operator learns where to look, and a
      leader line ties it to the selected track.</dd>
    </dl>
  </div>
  <div class="callout">
    <div class="h">Honesty</div>
    <p>Every figure is a deterministic planning-model output sampled at 0.5 seconds. The footer says so.
    Nothing in the readout is labelled as measured or instrumented data.</p>
  </div>
</section>

<section id="states">
  <div class="sec-head"><span class="sec-num">03</span><h2>Track states</h2></div>
  <p class="sec-sub">One ladder, highest state wins. The ring says what the kill chain knows. The brackets
  say a weapon owns the track. The pulse says a round is in the air.</p>
  <div class="spec-row spec-6">__SPEC_TRACKS__</div>
  <ul class="notes">
    <li><strong>Ghost rule:</strong> a track turns ghost when its expected residual falls below 0.05 ships.
    That is the engine's existing <code>SHIP_DEAD_BELOW</code> cutoff, not a new number.</li>
    <li><strong>Ghosts keep flying.</strong> Position still comes from the flight path, so the ghost holds
    its course and speed. The tag says whether it was a hard kill or a mission kill.</li>
    <li><strong>The pulse is derived from sim time,</strong> never from a timer. Pause the run and the pulse
    freezes with it.</li>
  </ul>
</section>

<section id="effectors">
  <div class="sec-head"><span class="sec-num">04</span><h2>Effector engagement</h2></div>
  <p class="sec-sub">A thin line runs from the effector to the threat, and a small triangle travels it as the
  round. What the effector glyph does depends on how that weapon guides.</p>
  <div class="spec-row spec-4">__SPEC_EFFECTORS__</div>
  <ul class="notes">
    <li><strong>The mapping is not invented.</strong> It reads the researched guidance field already in
    <code>integrationData.ts</code>: <code>fc-uplink</code> and <code>operator</code> give semi-active,
    <code>self</code> and <code>c2-cue</code> give active. Jammers, lasers, and high-power microwave are
    beams.</li>
    <li><strong>Flight time is real.</strong> The round leaves at the salvo assignment time and lands at the
    effect time, both already in the engagement ledger.</li>
    <li><strong>Rounds in flight are never deleted.</strong> If the target turns ghost mid-flight, the round
    still completes.</li>
  </ul>
  <div class="callout">
    <div class="h">One decision for you</div>
    <p>You wrote "triangle". Effectors today draw the MIL-STD-2525 rectangle frame, matching the palette
    glyphs. This mockup keeps the rectangle and gives the travelling round the triangle. Say the word and
    the effector frame becomes a triangle instead.</p>
  </div>
</section>

<section id="declutter">
  <div class="sec-head"><span class="sec-num">05</span><h2>Declutter controls</h2></div>
  <p class="sec-sub">Twelve layers, four presets. Reachable from the View menu and from right-click on the
  board. Toggles stay open so you can switch several at once. Presets close the menu.</p>
  <div class="spec-row spec-2">
    <div class="spec"><div class="spec-art" style="height:auto;padding:4px 0 16px">__VIEW_MENU__</div>
      <div class="spec-name">View menu</div>
      <div class="spec-desc">Presets first, then layers grouped by what they answer. Basemap and units move
      down here too.</div></div>
    <div class="spec"><div class="spec-art" style="height:auto;padding:4px 0 16px">__CTX_MENU__</div>
      <div class="spec-name">Right-click &rarr; Display</div>
      <div class="spec-desc">The same list as a flyout on the canvas menu and on the entity menu, so the
      operator never leaves the board.</div></div>
  </div>
  __MATRIX__
  <p class="cap">Layer visibility is view state. It is not undoable, and it never enters the scenario file.</p>
</section>

<section id="scope">
  <div class="sec-head"><span class="sec-num">06</span><h2>What this does not touch</h2></div>
  <p class="sec-sub">Boundaries of the change, so nothing you already accepted gets rewritten.</p>
  <ul class="notes">
    <li>The <strong>engine</strong> is unchanged. No new sweep, no new threshold, no change to detection,
    routing, or attrition math. Every new value is derived from data the ledger already holds.</li>
    <li>The <strong>Analysis panel</strong> rebuilt in 9d5843f keeps its markup and its behavior. It gets
    spacing and token polish only.</li>
    <li>The <strong>T&amp;E Ops workspace</strong> is untouched.</li>
    <li>The <strong>scenario schema</strong> is untouched. Layer visibility persists to its own local key,
    the way display units already do.</li>
  </ul>
</section>

<footer>RangeBoard &middot; proposed board refactor &middot; mockup for review</footer>
</div>

<script>
const READOUTS = __READOUT_JSON__;
const ANCHORS = __ANCHOR_JSON__;
const host = document.getElementById('readout-host');
const leader = document.getElementById('leader-line');

/* The readout docks at a fixed corner and a leader ties it to the selected
   track, so it never covers the inbound axis. */
function select(key){
  document.querySelectorAll('#stage .trk').forEach(function(g){
    g.classList.toggle('is-selected', g.dataset.track === key);
  });
  host.innerHTML = READOUTS[key];
  const stage = document.getElementById('stage');
  const card = host.getBoundingClientRect();
  const box = stage.getBoundingClientRect();
  const a = ANCHORS[key];
  leader.setAttribute('x1', a[0]);
  leader.setAttribute('y1', a[1]);
  leader.setAttribute('x2', (card.left - box.left) / box.width * 100);
  leader.setAttribute('y2', (card.top + 22 - box.top) / box.height * 100);
}

document.querySelectorAll('#stage .trk').forEach(function(g){
  g.addEventListener('click', function(){ select(g.dataset.track); });
  g.addEventListener('keydown', function(e){
    if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); select(g.dataset.track); }
  });
});
select('T3');
window.addEventListener('resize', function(){
  const on = document.querySelector('#stage .trk.is-selected');
  if(on) select(on.dataset.track);
});
</script>
"""


def main():
    import json
    specs = []
    for phase, desc in [
        ("undetected", "No sensor has held it. The glyph carries no ring."),
        ("searching", "Held before, not held now. The gap is visible, so a drop reads at a glance."),
        ("tracked", "A sensor holds it. Not yet promoted to hostile."),
        ("identified", "The classification ladder reached hostile."),
        ("targeted", "Inside a usable engagement window. A weapon owns the track."),
        ("engaged", "A round is in the air at it. Ring and brackets pulse."),
        ("ghost", "Expected residual below 0.05 ships. It keeps flying its course."),
    ]:
        if phase == "searching":
            continue
        label, col = PHASE[phase]
        specs.append('<div class="spec"><div class="spec-art">%s</div><div class="spec-name" style="color:%s">'
                     '<span class="swatch" style="background:%s"></span>%s</div>'
                     '<div class="spec-desc">%s</div></div>'
                     % (specimen_track(phase), col, col, label, desc))

    eff_specs = [
        ('<div class="spec"><div class="spec-art">%s</div><div class="spec-name" style="color:%s">IDLE</div>'
         '<div class="spec-desc">Outline frame. Nothing is in the air.</div></div>'
         % (specimen_idle_effector(), C["effector"])),
        ('<div class="spec"><div class="spec-art">%s</div><div class="spec-name" style="color:%s">SEMI-ACTIVE</div>'
         '<div class="spec-desc">The effector holds the uplink or the sight, so the frame stays filled and '
         'the guidance line stays bright for the whole time of flight. Anvil, Coyote, gun mounts.</div></div>'
         % (specimen_effector("semi-active"), C["effector"])),
        ('<div class="spec"><div class="spec-art">%s</div><div class="spec-name" style="color:%s">ACTIVE</div>'
         '<div class="spec-desc">The round guides itself. The frame blinks at launch, then goes back to '
         'outline while a seeker ring rides the round.</div></div>'
         % (specimen_effector("active"), C["effector"])),
        ('<div class="spec"><div class="spec-art">%s</div><div class="spec-name" style="color:%s">BEAM</div>'
         '<div class="spec-desc">No discrete round. A pulsing dashed beam runs for the dwell and the frame '
         'stays filled. Jammers, laser, high-power microwave.</div></div>'
         % (specimen_effector("beam"), C["ew"])),
    ]

    html = HTML
    html = html.replace("__FONTS__", FONTS)
    html = html.replace("__CSS__", CSS)
    html = html.replace("__TB_AFTER_2__", toolbar_after(with_menu=False))
    html = html.replace("__TB_AFTER__", toolbar_after(with_menu=False))
    html = html.replace("__TB_BEFORE__", toolbar_before())
    html = html.replace("__BOARD__", board_svg())
    html = html.replace("__READOUT_STATIC__", readout_html("T3").replace('class="readout"', 'class="readout static"'))
    html = html.replace("__SPEC_TRACKS__", "".join(specs))
    html = html.replace("__SPEC_EFFECTORS__", "".join(eff_specs))
    html = html.replace("__VIEW_MENU__", view_menu("is-open").replace("view-menu is-open", "view-menu is-open menu-static"))
    html = html.replace("__CTX_MENU__", ctx_menu())
    html = html.replace("__MATRIX__", preset_matrix())
    html = html.replace("__READOUT_JSON__", json.dumps({k: readout_html(k) for k in READOUT}))
    html = html.replace("__ANCHOR_JSON__", json.dumps(ANCHOR))
    open(OUT, "w").write(html)
    print("wrote", OUT, len(html), "bytes")


if __name__ == "__main__":
    main()
