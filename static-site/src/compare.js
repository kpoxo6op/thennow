// Compare page behaviour. Inlined into each story page; no dependencies.
// Protected behaviour (see AGENTS.md): default 50, ?p= drives position,
// ?p=50 normalises away, knob aligns with the reveal border, before image fixed.
;(function () {
  var DEFAULT = 50
  var GUTTER = 40
  var stage = document.querySelector('[data-testid="compare-stage"]')
  var overlay = document.querySelector('[data-testid="compare-overlay"]')
  var input = document.querySelector('[data-testid="compare-slider-input"]')
  var slider = document.querySelector('[data-testid="compare-slider-root"]')
  var blank = document.getElementById("compare-blank")
  var desc = document.getElementById("compare-desc")
  if (!stage || !overlay || !input || !slider) return

  var position = DEFAULT
  var frame = 0

  function clamp(value) {
    return Math.min(100, Math.max(0, value))
  }

  function fromUrl() {
    var raw = new URL(location.href).searchParams.get("p")
    if (!raw) return DEFAULT
    var parsed = Number(raw)
    return isFinite(parsed) ? clamp(parsed) : DEFAULT
  }

  function render() {
    frame = 0
    var width = stage.getBoundingClientRect().width
    var active = Math.max(width - GUTTER * 2, 0)
    var inset = Math.max(0, width - (GUTTER + (position / 100) * active))
    overlay.style.clipPath = "inset(0 " + inset + "px 0 0)"
    slider.style.setProperty("--p", String(position))
    stage.style.setProperty("--p", String(position))
    if (Number(input.value) !== Math.round(position)) {
      input.value = String(Math.round(position))
    }
  }

  function syncUrl() {
    var url = new URL(location.href)
    var rounded = Math.round(position)
    if (rounded === DEFAULT) url.searchParams.delete("p")
    else url.searchParams.set("p", String(rounded))
    var next = url.pathname + url.search + url.hash
    if (next !== location.pathname + location.search + location.hash) {
      history.replaceState(null, "", next)
    }
  }

  function setPosition(next, immediate) {
    position = clamp(next)
    if (immediate) render()
    else if (!frame) frame = requestAnimationFrame(render)
    syncUrl()
  }

  function fromPointer(clientX) {
    var rect = stage.getBoundingClientRect()
    if (!rect.width) return
    var active = Math.max(rect.width - GUTTER * 2, 1)
    var x = Math.min(rect.right - GUTTER, Math.max(rect.left + GUTTER, clientX))
    setPosition(((x - rect.left - GUTTER) / active) * 100)
  }

  input.addEventListener("input", function () {
    setPosition(Number(input.value), true)
  })

  stage.addEventListener("pointerdown", function (event) {
    stage.setPointerCapture(event.pointerId)
    fromPointer(event.clientX)
  })
  stage.addEventListener("pointermove", function (event) {
    if ((event.buttons & 1) === 1) fromPointer(event.clientX)
  })

  // A click without movement toggles a clean view (controls hidden).
  var down = null
  function toggleClean(event) {
    if (down && Math.abs(down.x - event.clientX) < 5 && Math.abs(down.y - event.clientY) < 5) {
      var clean = blank.hidden
      blank.hidden = !clean
      stage.classList.toggle("is-clean", clean)
    }
    down = null
  }
  stage.addEventListener("mousedown", function (event) {
    down = { x: event.clientX, y: event.clientY }
  })
  stage.addEventListener("mouseup", toggleClean)

  // Description expands on click unless the user is selecting text.
  if (desc) {
    desc.addEventListener("mouseup", function () {
      if (String(getSelection()) === "") desc.classList.toggle("is-open")
    })
  }

  addEventListener("resize", function () {
    if (!frame) frame = requestAnimationFrame(render)
  })
  addEventListener("popstate", function () {
    setPosition(fromUrl(), true)
  })

  setPosition(fromUrl(), true)
})()
