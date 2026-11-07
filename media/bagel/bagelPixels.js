import { PALETTE, SITTING } from "./bagelTrace.js"

// Split the approved drawing into layers without changing any resting pixel.
// The boundary follows the tail's inner edge, behind the stationary haunch.
const tailEdge = { 19: 7, 20: 8, 21: 8, 22: 7, 23: 6, 24: 5, 25: 5,
  26: 5, 27: 5, 28: 5, 29: 6, 30: 7, 31: 7 }
const isTail = (x, y) => tailEdge[y] !== undefined && x <= tailEdge[y]
const selectPixels = predicate => SITTING.map((row, y) => [...row].map((c, x) => predicate(x, y) ? c : ".").join(""))
export const BODY = selectPixels((x, y) => !isTail(x, y))
const restingTail = selectPixels(isTail)

function wagTail(direction) {
  return restingTail.map((row, y) => {
    const pixels = Array(32).fill(".")
    const shift = y < 29 ? direction * Math.round(Math.max(0, 29 - y) / 5) : 0
    for (let x = 0; x < 32; x++) {
      if (row[x] !== ".") pixels[x + shift] = row[x]
    }
    // Close the inner seam when the tail leans away. The body covers it;
    // the free tip and the common root keep their original pixel shapes.
    if (shift < 0 && y >= 20 && y <= 28) {
      for (let x = tailEdge[y] + shift + 1; x <= tailEdge[y]; x++) pixels[x] = row[tailEdge[y]]
    }
    return pixels.join("")
  })
}

export const TAILS = [restingTail, wagTail(-1), wagTail(1)]

// Eyes remain black in BODY. Two independent coat-colored masks produce:
// 1. bottom only; 2. neither; 3. bottom only; 4. both black again.
function eyelids(y) {
  return Array.from({ length: 32 }, (_, row) => Array.from({ length: 32 }, (_, x) =>
    row === y && (x === 21 || x === 25) ? "L" : "."
  ).join(""))
}
export const UPPER_EYELIDS = eyelids(7)
export const LOWER_EYELIDS = eyelids(8)

export function pixelShadows(rows) {
  return rows.flatMap((row, y) => [...row].flatMap((color, x) =>
    PALETTE[color] ? [`calc(${x} * var(--bagel-pixel)) calc(${y} * var(--bagel-pixel)) 0 ${PALETTE[color]}`] : []
  )).join(",")
}
