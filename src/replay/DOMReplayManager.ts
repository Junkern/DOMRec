import { Recording, setTitle } from './common'
import { DOMReplay } from './DOMReplay'

class DOMReplayManager {
  private DOMRecStylesheetCache: { [k: string]: string } = {}

  constructor(private node: HTMLElement, private recording: Recording) {
    if (!recording || !recording.initialState || !recording.actions || !recording.width || !recording.height) {
      throw new Error('A required property in the recording object is missing')
    }
    this.recording.stylesheets = this.recording.stylesheets || []
    this.recording.iframeStylesheets = this.recording.iframeStylesheets || {}
  }

  addReplayStylesheet(url: string) {
    this.recording.stylesheets.push(url)
  }

  public async init() {
    const loadPromise = this.loadIframeStylesheets()
    const iframeSetupPromise = this.createReplayIframe()
    await Promise.all([loadPromise, iframeSetupPromise])
    this.onloaded(this.node, () => {
      this.setupMovieReplay(this.node)
    })
  }

  private loadIframeStylesheets(): Promise<any[]> {
    // let promises = [DOMSetupReplayPromise]
    const promises = []
    for (let s in this.recording.iframeStylesheets) {
      let cached = s
      let url = this.recording.iframeStylesheets[s]
      promises.push(window.fetch(url).then(function (response) {
        if (!response.ok) {
          throw "Failed to load " + url + ": " + response.statusText
        }
        return response.text()
      }).then((text) => {
        if (typeof text != "string") {
          throw "Unexpected source text: " + text
        }
        this.DOMRecStylesheetCache[cached] = text
      }))
    }
    return Promise.all(promises)
  }

  private async createReplayIframe(): Promise<void> {
    return new Promise((resolve) => {
      const createIframe = (height: number, width: number) => {
        this.node.textContent = ''
        let frame = document.createElement("iframe") as any
        let srcdoc = '<html class="replay"><head>'
        for (const sheet of this.recording.stylesheets) {
          srcdoc += '<link rel="stylesheet" href="' + sheet + '">'
        }
        frame.srcdoc = srcdoc
        // Crazy hack to get the correct size for the IFRAME. We insert an SVG element
        // with the correct aspect ratio and let its intrinsic height be the height of our
        // DIV, then make the IFRAME use that height. Too bad there's no way to tell an IFRAME
        // to use a specific intrinsic ratio.
        let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
        if (window.origin == "http://127.0.0.1:3000" &&
          (this.node.style.width != width + "px" ||
            this.node.style.height != height + "px")) {
          alert("Invalid dimensions for " + this.node.id + ": expected " +
            width + "px x " + height + "px, got " +
            this.node.style.width + " x " + this.node.style.height)
        }
        svg.setAttribute("viewBox", "0 0 " + width + " " + height)
        this.node.appendChild(svg)
        this.node.appendChild(frame)
        // IFRAME navigation to the srcdoc document will have started but for now
        // we will have a blank document. Make sure this doesn't confuse us.
        frame.contentDocument.initialDoc = true;
        (this.node as any).frame = frame

        if (!this.node.hasAttribute("fixedWidth")) {
          this.node.style.maxWidth = width + "px"
          this.node.style.width = ''
        }
        this.node.style.height = ''
        return true
      }
      if (document.readyState == "loading") {
        document.addEventListener("DOMContentLoaded", () => {
          createIframe(this.recording.height, this.recording.width)
          resolve()
        })
      } else {
        createIframe(this.recording.height, this.recording.width)
        resolve()
      }
    })
  }

  private onloaded(element, callback) {
    if (!element.frame) {
      return
    }
    function waitForFonts() {
      element.frame.contentDocument.fonts.ready.then(callback)
    }
    let doc = element.frame.contentDocument
    if (doc.readyState == "complete" && !doc.initialDoc) {
      waitForFonts()
    } else {
      element.frame.addEventListener("load", waitForFonts)
    }
  }

  private createFullscreenButton(d) {
    if (!document.fullscreenEnabled) {
      return
    }
    let fullscreen = document.createElement("button")
    fullscreen.className = "fullscreen"
    fullscreen.title = "Click to enter/exit fullscreen"
    fullscreen.addEventListener("click", (event) => {
      event.stopPropagation()
      if (document.fullscreenElement == d) {
        document.exitFullscreen()
      } else {
        const resize = () => {
          let cw = d.clientWidth
          let ch = d.clientHeight
          if (this.recording.width * ch < this.recording.height * cw) {
            d.frame.style.top = "0"
            d.frame.style.height = "100%"
            let w = this.recording.width * (ch / this.recording.height)
            d.frame.style.width = w + "px"
            d.frame.style.left = "calc(50% - " + w / 2 + "px)"
          } else {
            d.frame.style.left = "0"
            d.frame.style.width = "100%"
            let h = this.recording.height * (cw / this.recording.width)
            d.frame.style.height = h + "px"
            d.frame.style.top = "calc(50% - " + h / 2 + "px)"
          }
        }
        let addedResizeListener = false
        d.requestFullscreen().then(function () {
          resize()
          if (!addedResizeListener) {
            addedResizeListener = true
            window.addEventListener("resize", resize)
          }
        })
      }
    })
    d.appendChild(fullscreen)
  }

  private tryPopOut(d, event) {
    if (!d.hasAttribute("popOut") || d.classList.contains("poppedOut") ||
      document.fullscreenElement == d) {
      return false
    }
    event.stopPropagation()

    let container = d.parentNode
    let dRect = d.getBoundingClientRect()
    container.scrollIntoView({ behavior: 'smooth', block: 'start' })

    if (window.getComputedStyle(d).position == 'absolute') {
      let savedMinHeight = container.style.minHeight
      container.style.minHeight = "0"
      let containerRect = container.getBoundingClientRect()
      let newDWidth = 220 + containerRect.width
      let newDHeight = newDWidth * dRect.height / dRect.width
      container.style.height = containerRect.height + "px"
      container.getBoundingClientRect()
      d.classList.add("poppedOut")
      container.style.height = (containerRect.height + newDHeight + 20) + "px"
      d.style.width = newDWidth + "px"
      d.style.top = (containerRect.height + 10) + "px"
      d.escapeHandler = function (event) {
        if (!d.contains(event.target)) {
          document.removeEventListener("click", d.escapeHandler, true)
          d.classList.remove("poppedOut")
          container.style.height = ''
          container.style.minHeight = savedMinHeight
          d.style.width = ''
          d.style.top = ''
          setTitle(d)
          // Don't stop propagation; allow the click to function normally
        }
      }
    } else {
      let containerRect = container.getBoundingClientRect()
      let newDWidth = containerRect.width
      d.classList.add("poppedOut")
      d.style.left = "0"
      d.style.width = newDWidth + "px"
      d.escapeHandler = function (event) {
        if (!d.contains(event.target)) {
          document.removeEventListener("click", d.escapeHandler, true)
          d.classList.remove("poppedOut")
          d.style.left = ''
          d.style.width = ''
          setTitle(d)
          // Don't stop propagation; allow the click to function normally
        }
      }
    }

    document.addEventListener("click", d.escapeHandler, true)
    setTitle(d)
    return true
  }

  private setupMovieReplay(d) {
    d.player = new DOMReplay(d, this.recording, this.DOMRecStylesheetCache)
    let replayIndicator = document.createElement("div")
    d.appendChild(replayIndicator)
    let play = document.createElement("button")
    play.className = "play"
    d.appendChild(play)
    this.createFullscreenButton(d)
    d.addEventListener("click", (event) => {
      if (this.tryPopOut(d, event)) {
        return
      }
      event.stopPropagation()
      if (d.player.stopped()) {
        d.player.play({ loop: true })
      } else {
        d.player.stop()
      }
    })
    setTitle(d)
  }
}

export {DOMReplayManager}