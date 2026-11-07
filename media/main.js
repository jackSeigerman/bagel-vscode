/*
 * Bagel in the sidebar: the website footer's Bagel (FooterBagel.jsx), drawn
 * without React. The drawings and the behavior controller in ./bagel/ are
 * copied from the website unchanged (scripts/sync-bagel.mjs).
 *
 * She runs only while the section is open and on screen, and keeps still
 * with reduced motion. VS Code discards the page when the section is
 * collapsed, so where she is and what she's doing is saved with the view's
 * state and picked up again when it reopens.
 */
import { initialJourney, createJourney, resizeJourney, advanceJourney, journeyView } from "./bagel/bagelBehavior.js"
import { BODY, UPPER_EYELIDS, LOWER_EYELIDS, TAILS, pixelShadows } from "./bagel/bagelPixels.js"
import { STANDING, TRANSITIONS, WALKING } from "./bagel/bagelWalk.js"
import { LYING } from "./bagel/bagelLying.js"
import { LIE_TRANSITIONS } from "./bagel/bagelLieTransitions.js"
import { RESTING } from "./bagel/bagelResting.js"
import { SLEEP_TRANSITIONS } from "./bagel/bagelSleepTransitions.js"

// In VS Code there's a state store; opened as a plain page (for testing)
// there isn't, and she just starts afresh.
const vscode = typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : null

// Every drawing as a box-shadow, worked out once.
const art = {
  body: pixelShadows(BODY),
  tails: TAILS.map(pixelShadows),
  upper: pixelShadows(UPPER_EYELIDS),
  lower: pixelShadows(LOWER_EYELIDS),
  sleeping: pixelShadows(RESTING),
  sleepTransitions: SLEEP_TRANSITIONS.map(pixelShadows),
  lying: pixelShadows(LYING),
  lieTransitions: LIE_TRANSITIONS.map(pixelShadows),
  standing: pixelShadows(STANDING),
  transitions: TRANSITIONS.map(pixelShadows),
  walking: WALKING.map(pixelShadows),
}

const stage = document.getElementById("stage")
stage.innerHTML = `
  <div class="bagel" role="img" aria-label="Bagel the goldendoodle" data-ready="false">
    <div class="bagel__sitting">
      <span class="bagel__pixels" data-part="tail"></span>
      <span class="bagel__pixels" data-part="body"></span>
    </div>
    <span class="bagel__pixels" data-part="pose"></span>
    <span class="bagel__pixels bagel__blink" data-part="upper"></span>
    <span class="bagel__pixels bagel__blink" data-part="lower"></span>
    <span class="bagel__zs"><i class="bagel__z"></i><i class="bagel__z"></i><i class="bagel__z"></i></span>
  </div>`
const dog = stage.querySelector(".bagel")
const part = (name) => stage.querySelector(`[data-part="${name}"]`)
const sitting = stage.querySelector(".bagel__sitting")
const tail = part("tail")
const pose = part("pose")
const upper = part("upper")
const lower = part("lower")
const zsBox = stage.querySelector(".bagel__zs")
const zs = [...stage.querySelectorAll(".bagel__z")]
part("body").style.boxShadow = art.body
upper.style.boxShadow = art.upper
lower.style.boxShadow = art.lower

/** Sets a style only when it changes: most frames, nothing does. */
const set = (el, prop, value) => {
  if (el.style.getPropertyValue(prop) !== value) el.style.setProperty(prop, value)
}
const show = (el, visible) => {
  if (el.hidden === visible) el.hidden = !visible
}

const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
let journey = vscode?.getState()?.journey ?? initialJourney()
let bounds = 0

function draw() {
  const still = reduceQuery.matches
  const view = journeyView(journey)
  const phase = still ? "sit" : view.phase
  const seated = phase === "sit"
  const moving =
    phase === "sleep" ? art.sleeping
    : phase === "head-down" || phase === "head-up" ? art.sleepTransitions[view.frame]
    : phase === "lie" ? art.lying
    : phase === "lie-down" || phase === "sit-up" ? art.lieTransitions[view.frame]
    : phase === "walk" ? art.walking[view.frame]
    : phase === "rise" || phase === "lower" ? art.transitions[view.frame]
    : art.standing

  set(dog, "left", `calc(var(--bagel-inset) + ${view.x} * var(--bagel-pixel))`)
  set(dog, "--bagel-head-y", String(still ? 0 : view.headOffset))
  dog.dataset.direction = String(view.direction)
  dog.dataset.ready = String(view.initialized || still)

  show(sitting, seated)
  if (seated) set(tail, "box-shadow", art.tails[still ? 0 : view.tail])
  show(pose, !seated)
  if (!seated) set(pose, "box-shadow", moving)
  show(upper, !still && view.blink < 3)
  show(lower, !still && view.blink === 1)

  show(zsBox, phase === "sleep")
  if (phase === "sleep") {
    view.zs.forEach((z, i) => {
      set(zs[i], "opacity", String(z.opacity))
      set(zs[i], "left", `calc(${z.x} * var(--bagel-pixel))`)
      set(zs[i], "top", `calc(${z.y} * var(--bagel-pixel))`)
    })
  }
}

// How far she can walk: the section's width, less the insets and herself, in
// art pixels. Narrowing the sidebar keeps her and her destination inside it.
function measure() {
  const styles = getComputedStyle(stage)
  const pixel = parseFloat(styles.getPropertyValue("--bagel-pixel"))
  const inset = parseFloat(styles.getPropertyValue("--bagel-inset"))
  bounds = Math.max(0, Math.floor((stage.clientWidth - 2 * inset) / pixel) - 32)
  if (stage.clientWidth > 0) {
    if (!journey.initialized) journey = createJourney(bounds)
    journey = resizeJourney(journey, bounds)
  }
  draw()
}
new ResizeObserver(measure).observe(stage)
measure()

// The clock: one step per frame, while she's on screen and allowed to move.
let frame = 0
let last
function tick(now) {
  const delta = last === undefined ? 0 : Math.min(now - last, 100)
  last = now
  if (journey.initialized) journey = advanceJourney(journey, delta, bounds)
  draw()
  frame = requestAnimationFrame(tick)
}
function run() {
  const go = !document.hidden && !reduceQuery.matches
  if (go && !frame) {
    last = undefined
    frame = requestAnimationFrame(tick)
  } else if (!go && frame) {
    cancelAnimationFrame(frame)
    frame = 0
    draw()
  }
}
document.addEventListener("visibilitychange", run)
reduceQuery.addEventListener("change", run)
run()

// Remember her between openings of the section.
const save = () => vscode?.setState({ journey })
setInterval(save, 1000)
window.addEventListener("pagehide", save)
document.addEventListener("visibilitychange", save)
