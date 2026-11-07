import { TRANSITIONS } from './bagelTransitions.js'
import { LIE_TRANSITIONS, LIE_FRAME_MS, LIE_HEAD_OFFSETS } from './bagelLieTransitions.js'
import { SLEEP_TRANSITIONS, SLEEP_FRAME_MS, SLEEP_HEAD_OFFSETS } from './bagelSleepTransitions.js'

// Times are milliseconds; positions and walking speed use logical art pixels.
export const BEHAVIOR = {
  initial: { sit: 65, lie: 25, sleep: 10 },
  choices: {
    sit: { walk: 55, lie: 30, sit: 15 },
    stand: { sit: 70, walk: 30 },
    lie: { sleep: 55, sit: 35, lie: 10 },
    arrived: { sit: 75, stand: 25 },
  },
  durations: { sit: [5000, 20000], stand: [1000, 5000], lie: [6000, 20000], sleep: [15000, 50000] },
  distances: [
    { weight: 45, range: [.1, .25] },
    { weight: 40, range: [.25, .5] },
    { weight: 15, range: [.5, .8] },
  ],
  speed: [10, 14],
  repeatPenalty: .55,
  maxExtensions: 1,
  strollAfter: 60000,
  blinkWait: [3000, 7500],
  blinkFrame: 96,
  wagBursts: [3, 8],
  wagPause: [300, 1800],
  wagFrame: 270,
  standFrame: 180,
  beforeWalk: 300,
  settle: 260,
}
const clamp = (x, max) => Math.max(0, Math.min(x, max))
const sample = ([min, max], random) => min + (max - min) * random()
// Averaging two draws favors ordinary pauses while retaining occasional extremes.
const duration = (phase, random) => Math.round(sample(BEHAVIOR.durations[phase], () => (random() + random()) / 2))
function choose(weights, random) {
  const entries = Object.entries(weights).filter(([, weight]) => weight > 0)
  let roll = random() * entries.reduce((sum, [, weight]) => sum + weight, 0)
  return entries.find(([, weight]) => (roll -= weight) < 0)?.[0] ?? entries.at(-1)?.[0]
}

export function initialJourney() {
  return { initialized: false, phase: 'sit', elapsed: 0, wait: 0, x: 0, origin: 0, target: 0,
    direction: 1, speed: 12, history: [], stops: [], stationary: 0, extensions: 0,
    pendingWalk: false, blinkElapsed: 0, blinkWait: 4000, wagElapsed: 0, wagDuration: 1620, wagWait: 600 }
}
export function createJourney(maxX, random = Math.random) {
  const phase = choose(BEHAVIOR.initial, random)
  const x = Math.floor(random() * (Math.max(0, Math.floor(maxX)) + 1))
  return { ...initialJourney(), initialized: true, phase, x, origin: x, target: x,
    direction: random() < .5 ? -1 : 1, wait: duration(phase, random), history: [phase], stops: [x],
    blinkWait: sample(BEHAVIOR.blinkWait, random), wagDuration: Math.round(sample(BEHAVIOR.wagBursts, random)) * BEHAVIOR.wagFrame * 2,
    wagWait: sample(BEHAVIOR.wagPause, random) }
}

export function resizeJourney(previous, maxX) {
  maxX = Math.max(0, Math.floor(maxX))
  const x = clamp(previous.x, maxX)
  const target = clamp(previous.target, maxX)
  const changed = x !== previous.x || target !== previous.target
  return { ...previous, x, target, stops: previous.stops.map(stop => clamp(stop, maxX)),
    ...(changed && previous.phase === 'walk' ? { origin: x, elapsed: 0 } : {}) }
}

function destination(state, maxX, random) {
  const band = Number(choose(Object.fromEntries(BEHAVIOR.distances.map((item, i) => [i, item.weight])), random))
  const [low, high] = BEHAVIOR.distances[band].range.map(fraction => Math.max(1, Math.round(fraction * maxX)))
  const ranges = [[Math.max(0, state.x - high), state.x - low], [state.x + low, Math.min(maxX, state.x + high)]]
    .filter(([a, b]) => a <= b)
  if (!ranges.length) return state.x < maxX / 2 ? maxX : 0
  let best = state.x
  let bestScore = -1
  // Reject recently used stops when possible, without retrying indefinitely on tiny rails.
  for (let attempt = 0; attempt < 8; attempt++) {
    const [a, b] = ranges[Math.min(ranges.length - 1, Math.floor(random() * ranges.length))]
    const candidate = a + Math.floor(random() * (b - a + 1))
    const score = Math.min(...state.stops.map(stop => Math.abs(candidate - stop)))
    if (score > bestScore) { best = candidate; bestScore = score }
    if (score >= Math.max(2, maxX * .08)) break
  }
  return best
}
function nextActivity(state, random, maxX) {
  const weights = { ...BEHAVIOR.choices[state.phase] }
  for (const activity of state.history) if (weights[activity]) weights[activity] *= BEHAVIOR.repeatPenalty
  if (state.extensions >= BEHAVIOR.maxExtensions) weights[state.phase] = 0
  if (!maxX) weights.walk = 0
  if (maxX && state.stationary > BEHAVIOR.strollAfter) return state.phase === 'sit' || state.phase === 'stand' ? 'walk' : 'sit'
  // Waking always includes an awake pause, then a sit; don't fall straight back asleep.
  if (state.phase === 'lie' && state.history.at(-2) === 'sleep') return 'sit'
  return choose(weights, random)
}

export function advanceJourney(previous, delta, maxX, random = Math.random) {
  const state = resizeJourney(previous, maxX)
  maxX = Math.max(0, Math.floor(maxX))
  delta = Math.max(0, delta)
  state.elapsed += delta
  state.stationary += delta
  const enter = phase => {
    state.phase = phase
    state.elapsed = 0
    state.blinkElapsed = 0
    if (BEHAVIOR.durations[phase]) {
      state.wait = duration(phase, random)
      state.history = [...state.history.slice(-2), phase]
      state.extensions = 0
      state.blinkWait = sample(BEHAVIOR.blinkWait, random)
    }
  }
  const planWalk = () => {
    state.target = destination(state, maxX, random)
    state.speed = sample(BEHAVIOR.speed, random)
    state.pendingWalk = true
  }
  if (['sit', 'stand', 'lie'].includes(state.phase)) {
    state.blinkElapsed += delta
    if (state.blinkElapsed >= state.blinkWait + BEHAVIOR.blinkFrame * 3) {
      state.blinkElapsed = 0
      state.blinkWait = sample(BEHAVIOR.blinkWait, random)
    }
  }
  if (state.phase === 'sit') {
    state.wagElapsed += delta
    if (state.wagElapsed >= state.wagDuration + state.wagWait) {
      state.wagElapsed = 0
      state.wagDuration = Math.round(sample(BEHAVIOR.wagBursts, random)) * BEHAVIOR.wagFrame * 2
      state.wagWait = sample(BEHAVIOR.wagPause, random)
    }
  }
  if (state.phase === 'stand' && state.pendingWalk) {
    if (state.elapsed >= BEHAVIOR.beforeWalk) {
      state.pendingWalk = false
      state.origin = state.x
      state.direction = state.target >= state.x ? 1 : -1
      enter('walk')
    }
  } else if (['sit', 'stand', 'lie'].includes(state.phase) && state.elapsed >= state.wait) {
    const next = nextActivity(state, random, maxX)
    if (next === state.phase) {
      state.elapsed = 0
      state.wait = duration(state.phase, random)
      state.extensions++
    } else if (next === 'walk') {
      planWalk()
      if (state.phase === 'sit') enter('rise')
      else { state.elapsed = 0 }
    } else if (state.phase === 'sit') enter('lie-down')
    else if (state.phase === 'stand') enter('lower')
    else enter(next === 'sleep' ? 'head-down' : 'sit-up')
  } else if (state.phase === 'rise' && state.elapsed >= TRANSITIONS.length * BEHAVIOR.standFrame) enter('stand')
  else if (state.phase === 'lower' && state.elapsed >= TRANSITIONS.length * BEHAVIOR.standFrame) {
    enter('sit')
    state.wagElapsed = 0
  } else if (state.phase === 'walk') {
    const distance = Math.floor(state.elapsed * state.speed / 1000)
    state.x = clamp(state.direction > 0 ? Math.min(state.target, state.origin + distance) : Math.max(state.target, state.origin - distance), maxX)
    state.stationary = 0
    if (state.x === state.target) {
      state.history = [...state.history.slice(-2), 'walk']
      state.stops = [...state.stops.slice(-1), state.x]
      enter('settle')
    }
  } else if (state.phase === 'settle' && state.elapsed >= BEHAVIOR.settle) enter(choose(BEHAVIOR.choices.arrived, random) === 'sit' ? 'lower' : 'stand')
  else if (state.phase === 'lie-down' && state.elapsed >= LIE_TRANSITIONS.length * LIE_FRAME_MS) enter('lie')
  else if (state.phase === 'sit-up' && state.elapsed >= LIE_TRANSITIONS.length * LIE_FRAME_MS) { enter('sit'); state.wagElapsed = 0 }
  else if (state.phase === 'head-down' && state.elapsed >= SLEEP_TRANSITIONS.length * SLEEP_FRAME_MS) enter('sleep')
  else if (state.phase === 'sleep' && state.elapsed >= state.wait) enter('head-up')
  else if (state.phase === 'head-up' && state.elapsed >= SLEEP_TRANSITIONS.length * SLEEP_FRAME_MS) enter('lie')
  return state
}

// Zs are driven by the same paused clock as the dog, so each nap begins 1 → 2 → 3.
export function sleepZs(elapsed) {
  return [0, 1, 2].map(index => {
    const age = elapsed - index * 800
    const step = age < 0 ? -1 : Math.floor((age % 2400) / 300)
    return { x: Math.max(0, step), y: step > 0 ? step * -2 : 0, opacity: step < 0 || step === 7 ? 0 : step === 6 ? .65 : 1 }
  })
}
export function journeyView(state) {
  const forward = (count, ms) => Math.min(count - 1, Math.floor(state.elapsed / ms))
  const phase = state.phase
  let frame = 0
  let headOffset = 0
  if (phase === 'walk') frame = Math.floor(state.elapsed / (2000 / state.speed)) % 4
  if (phase === 'rise' || phase === 'lower') {
    frame = forward(TRANSITIONS.length, BEHAVIOR.standFrame)
    if (phase === 'lower') frame = TRANSITIONS.length - 1 - frame
  }
  if (phase === 'lie-down' || phase === 'sit-up') {
    frame = forward(LIE_TRANSITIONS.length, LIE_FRAME_MS)
    if (phase === 'sit-up') frame = LIE_TRANSITIONS.length - 1 - frame
    headOffset = LIE_HEAD_OFFSETS[frame]
  }
  if (phase === 'head-down' || phase === 'head-up') {
    frame = forward(SLEEP_TRANSITIONS.length, SLEEP_FRAME_MS)
    if (phase === 'head-up') frame = SLEEP_TRANSITIONS.length - 1 - frame
    headOffset = SLEEP_HEAD_OFFSETS[frame]
  }
  if (phase === 'lie') headOffset = 10
  if (phase === 'sleep') headOffset = 18
  const blink = ['sit', 'stand', 'lie'].includes(phase) && state.blinkElapsed >= state.blinkWait
    ? Math.min(3, Math.floor((state.blinkElapsed - state.blinkWait) / BEHAVIOR.blinkFrame)) : 3
  const tail = phase === 'sit' && state.wagElapsed < state.wagDuration ? 1 + Math.floor(state.wagElapsed / BEHAVIOR.wagFrame) % 2 : 0
  return { initialized: state.initialized, x: state.x, direction: state.direction, phase, frame, headOffset, blink, tail,
    zs: phase === 'sleep' ? sleepZs(state.elapsed) : [] }
}
