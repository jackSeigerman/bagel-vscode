import { SITTING } from "./bagelTrace.js"
export { TRANSITIONS } from "./bagelTransitions.js"

// Every pose uses the approved 32 × 32 grid and the exact same head pixels.
// The new torso, tail and four stepping legs are drawn in that same palette.
function standingPose(frame = -1) {
  const grid = Array.from({ length: 32 }, () => Array(32).fill("."))
  const paint = (x, y, rows) => rows.forEach((row, dy) => [...row].forEach((color, dx) => {
    if (color !== "." && grid[y + dy] && x + dx >= 0 && x + dx < 32) grid[y + dy][x + dx] = color
  }))
  const stride = frame < 0 ? [0, 0, 0, 0] : [
    [-2, 2, 2, -2], [0, 0, 0, 0], [2, -2, -2, 2], [0, 0, 0, 0]
  ][frame]
  const leg = (x, index, far = false) => {
    const top = 23
    const lift = frame >= 0 && frame % 2 === 1 && index % 2 === (frame === 1 ? 0 : 1) ? 1 : 0
    const floor = 31 - lift
    for (let y = top; y < floor; y++) {
      const shift = Math.round(stride[index] * (y - top) / (floor - top))
      paint(x + shift, y, [far ? "XSSX" : "XGLX"])
    }
    paint(x + stride[index], floor - 1, [far ? "XSCCX" : "XLCCX", "XXXXX"])
  }
  leg(10, 1, true)
  leg(21, 3, true)
  // A slightly fuller curl: one row taller, with a wider fluffy tip.
  // The root stays in the same place so the tail meets the rump cleanly.
  paint(0, 12, [
    "..XXX...", ".XHHHXX.", "XHHLHHLX", "XHLGGGLX", ".XHGGGLX",
    ".XGGGLX.", "..XGGLGX", "...XGGGX", "....XXXX"
  ])
  paint(4, 16, [
    "....XXXXXXXXXXXXXX...", "..XXHHGGGGGGGGGGGLXX.",
    ".XHHGGGGGGGGGGGGCCLX.", "XHGGGGGGGGGGGGGCCCCLX",
    "XGGGHGGGGGGGGGGCCCCLX", "XGGGGGGGGGGGGGGCCCLX.",
    "XGGGGGGGGGGGGGGCCLXX.", ".XGGGGSSSSSSSSSCLXX..",
    "..XXXXSSXXXXXXXXXX..."
  ])
  paint(18, 16, ["GGSSXX", "GGLCCLX", "GGCCCLX"])
  // Small fur curls and warm underside shading, shared by every walk frame
  // so the coat detail moves with her instead of flickering between steps.
  paint(8, 18, ["HL", ".H"])
  paint(13, 17, ["HL", ".H"])
  paint(12, 21, ["HL", ".L"])
  paint(16, 19, ["HL", ".L"])
  paint(7, 21, ["LS"])
  paint(10, 22, ["SS"])
  leg(6, 0)
  leg(17, 2)
  // Layer the original floppy ears, face and pink collar over the new torso.
  paint(0, 0, SITTING.slice(0, 16))
  return grid.map(row => row.join(""))
}

export const STANDING = standingPose()
export const WALKING = Array.from({ length: 4 }, (_, frame) => standingPose(frame))
