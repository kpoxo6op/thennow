// Home page map. MapLibre (~280 KB gzipped) is only fetched once the map
// container is near the viewport and the page has finished loading, so it never
// competes with the first paint. Story cards work without it.
;(function () {
  var el = document.querySelector('[data-testid="home-map"]')
  var dataEl = document.getElementById("map-data")
  if (!el || !dataEl) return
  var posts = JSON.parse(dataEl.textContent || "[]")
  var LIMITS = { minLat: -37.2, maxLat: -36.55, minLng: 174.25, maxLng: 175.05, minZoom: 9, maxZoom: 16 }

  function clamp(v, lo, hi) {
    return Math.min(hi, Math.max(lo, v))
  }

  function viewportFromUrl() {
    var q = new URL(location.href).searchParams
    var lat = Number(q.get("lat")), lng = Number(q.get("lng")), z = Number(q.get("z"))
    if (!q.get("lat") || !q.get("lng") || !q.get("z")) return null
    if (!isFinite(lat) || !isFinite(lng) || !isFinite(z)) return null
    if (lat < LIMITS.minLat || lat > LIMITS.maxLat) return null
    if (lng < LIMITS.minLng || lng > LIMITS.maxLng) return null
    if (z < LIMITS.minZoom || z > LIMITS.maxZoom) return null
    return { lat: lat, lng: lng, z: z }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    })
  }

  function loadAsset(tag, attrs) {
    return new Promise(function (resolve, reject) {
      var node = document.createElement(tag)
      for (var k in attrs) node[k] = attrs[k]
      node.onload = resolve
      node.onerror = reject
      document.head.appendChild(node)
    })
  }

  function start() {
    Promise.all([
      loadAsset("link", { rel: "stylesheet", href: el.dataset.css }),
      loadAsset("script", { src: el.dataset.js }),
    ]).then(init)
  }

  function init() {
    var maplibregl = window.maplibregl
    var initial = viewportFromUrl()
    var map = new maplibregl.Map({
      attributionControl: { compact: true },
      center: initial ? [initial.lng, initial.lat] : [174.76, -36.85],
      container: el,
      keyboard: false,
      maxZoom: 17,
      minZoom: 8,
      scrollZoom: false,
      style: el.dataset.style,
      zoom: initial ? initial.z : 10,
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right")

    posts.forEach(function (post) {
      var marker = document.createElement("a")
      marker.className = "tn-map-marker"
      marker.href = "/" + post.slug
      marker.setAttribute("aria-label", post.name)
      marker.dataset.testid = "home-map-marker"
      var popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true, maxWidth: "220px", offset: 18 }).setHTML(
        '<div style="width:190px;font-family:sans-serif">' +
          '<a href="/' + post.slug + '" style="display:block;color:inherit">' +
          '<img src="' + post.thumb + '" alt="' + escapeHtml(post.name) +
          '" style="display:block;width:100%;height:110px;object-fit:cover;margin-bottom:10px">' +
          '<strong style="display:block;font-size:14px;line-height:1.35">' + escapeHtml(post.name) + "</strong></a>" +
          '<div style="margin-top:8px;font-size:13px"><a href="/' + post.slug +
          '" style="color:#0f172a;text-decoration:underline">Open story</a></div></div>'
      )
      new maplibregl.Marker({ element: marker }).setLngLat([post.lng, post.lat]).setPopup(popup).addTo(map)
    })

    if (!initial && posts.length) {
      var bounds = new maplibregl.LngLatBounds()
      posts.forEach(function (post) {
        bounds.extend([post.lng, post.lat])
      })
      map.fitBounds(bounds, { padding: 72, duration: 0 })
    }

    var cards = document.querySelectorAll("[data-card]")
    function update() {
      var b = map.getBounds()
      var visible = {}
      var any = false
      posts.forEach(function (post) {
        if (b.contains([post.lng, post.lat])) {
          visible[post.slug] = true
          any = true
        }
      })
      cards.forEach(function (card) {
        card.hidden = any && !visible[card.dataset.card]
      })

      var c = map.getCenter()
      var url = new URL(location.href)
      url.searchParams.set("lat", String(clamp(Number(c.lat.toFixed(6)), LIMITS.minLat, LIMITS.maxLat)))
      url.searchParams.set("lng", String(clamp(Number(c.lng.toFixed(6)), LIMITS.minLng, LIMITS.maxLng)))
      url.searchParams.set("z", String(clamp(Number(map.getZoom().toFixed(2)), LIMITS.minZoom, LIMITS.maxZoom)))
      var next = url.pathname + url.search + url.hash
      if (next !== location.pathname + location.search + location.hash) history.replaceState(null, "", next)
    }
    map.on("moveend", update)
    update()
  }

  function whenLoaded(fn) {
    if (document.readyState === "complete") fn()
    else addEventListener("load", fn, { once: true })
  }

  whenLoaded(function () {
    if (!("IntersectionObserver" in window)) return start()
    var io = new IntersectionObserver(
      function (entries) {
        if (entries.some(function (e) { return e.isIntersecting })) {
          io.disconnect()
          start()
        }
      },
      { rootMargin: "300px" }
    )
    io.observe(el)
  })
})()
