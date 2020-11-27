import { DOMREC_ADD, DOMREC_ATTR, DOMREC_CANVAS_DATA, DOMREC_DELAY, DOMREC_FORCE_STYLE_FLUSH, DOMREC_FRAME, DOMREC_INPUT, DOMREC_LABEL, DOMREC_MOUSE_DOWN, DOMREC_MOUSE_MOVE, DOMREC_MOUSE_UP, DOMREC_REMOVE, DOMREC_SCROLL, DOMREC_TEXT } from './../constants'
import { setTitle } from './common'

export class DOMReplay {
  public initialState: any
  public actions: any
  public width: number
  public height: number
  public hostElem: any
  public hostDoc: Document
  public host: HTMLElement
  public index: number
  public scaleX: number
  public scaleY: number
  public nodes: Record<string, any>
  public cursor: HTMLDivElement
  public DOMRecStylesheetCache: any = (window as any).DOMRecStylesheetCache;
  public pendingTimeout: any = null;
  public caretElement: any = null;
  public maybeFocusedElement: any = null;
  public maybeFocusedElementChanged = false;

  constructor(hostElem: any) {
    let state = window[hostElem.id] as any
    this.initialState = state.initialState
    this.actions = state.actions
    this.width = state.width
    this.height = state.height
    this.hostElem = hostElem
    const hostFrame = hostElem.lastChild
    this.hostDoc = hostFrame.contentDocument
    this.host = this.hostDoc.body
    this.index = 0
    this.scaleX = 1
    this.scaleY = 1
    this.nodes = {}
    this.cursor = this.hostDoc.createElement("div")
    const cursorImage = this.hostDoc.createElementNS("http://www.w3.org/2000/svg", "svg")
    cursorImage.setAttribute("viewBox", "0 0 320 512")
    cursorImage.innerHTML = '<path d="M302.189 329.126H196.105l55.831 135.993c3.889 9.428-.555 19.999-9.444 23.999l-49.165 21.427c-9.165 4-19.443-.571-23.332-9.714l-53.053-129.136-86.664 89.138C18.729 472.71 0 463.554 0 447.977V18.299C0 1.899 19.921-6.096 30.277 5.443l284.412 292.542c11.472 11.179 3.007 31.141-12.5 31.141z"/>'
    this.cursor.setAttribute("class", "mouseCursor")
    this.cursor.appendChild(cursorImage)
    this.reset()

    const resize = (function () {
      const margin = 2
      this.scaleX = (this.hostDoc.defaultView.innerWidth - 2 * margin) / state.width
      this.scaleY = (this.hostDoc.defaultView.innerHeight - 2 * margin) / state.height
      this.hostDoc.body.style.transform = "translate(2px, 2px) scale(" + this.scaleX + "," + this.scaleY + ")"
    }).bind(this)
    resize()
    hostFrame.contentWindow.addEventListener("resize", resize)
  }

  public reset() {
    this.index = 0
    this.nodes = {}
    this.host.textContent = ""
    let child = this.deserialize(this.initialState[0])
    child.style.width = this.width + "px"
    child.style.height = this.height + "px"
    this.host.appendChild(child)
    for (let a of this.initialState[1]) {
      this.doAction(a)
    }
    this.notifyPossibleFocusChange()
  }

  public deserialize(obj) {
    let node
    if ("" in obj) {
      node = this.hostDoc.createElement(obj[""])
      if ("a" in obj) {
        for (let a in obj.a) {
          if (a == "cached" && obj[""] == "STYLE") {
            let cached = this.DOMRecStylesheetCache[obj.a[a]]
            if (cached) {
              node.textContent = cached
            }
            continue
          }
          if (a == "fakefocus") {
            this.maybeFocusedElement = node
            this.maybeFocusedElementChanged = true
          }
          node.setAttribute(a, obj.a[a])
        }
      }
      if ("c" in obj) {
        for (let c of obj.c) {
          node.appendChild(this.deserialize(c))
        }
      }
    } else if ("d" in obj) {
      node = this.hostDoc.createTextNode(obj.d)
    } else {
      node = this.hostDoc.createTextNode("")
    }
    this.nodes[obj.id] = node
    return node
  }

  public node(id) {
    if (id == null) {
      return null
    }
    if (id in this.nodes) {
      return this.nodes[id]
    }
    throw "Unknown ID " + id
  }

  public setCursorPos(x, y) {
    this.cursor.style.left = x + "px"
    this.cursor.style.top = y + "px"
    if (!this.cursor.parentNode) {
      this.host.appendChild(this.cursor)
    }
  }

  public step() {
    let action = this.actions[this.index++]
    this.doAction(action)
    this.notifyPossibleFocusChange()
    return action
  }

  public setupFrame(frame) {
    frame.contentDocument.body.remove()
    frame.contentDocument.documentElement.appendChild(frame.DOMRecBody)
    this.notifyPossibleFocusChange()
  }

  public notifyPossibleFocusChange() {
    if (!this.maybeFocusedElementChanged) {
      return
    }
    this.maybeFocusedElementChanged = false
    if (this.caretElement) {
      this.caretElement.remove()
      this.caretElement = null
    }
    if (this.maybeFocusedElement &&
      this.maybeFocusedElement.hasAttribute("fakeFocus") &&
      this.maybeFocusedElement.ownerDocument.documentElement.contains(this.maybeFocusedElement)) {
      this.setCaret(this.maybeFocusedElement)
    }
  }

  public doAction(action) {
    if (DOMREC_MOUSE_MOVE in action) {
      let a = action[DOMREC_MOUSE_MOVE]
      this.setCursorPos(a[0], a[1])
    } else if (DOMREC_DELAY in action || DOMREC_LABEL in action) {
      // do nothing
    } else if (DOMREC_ATTR in action) {
      let a = action[DOMREC_ATTR]
      let attr = a[1]
      let node = this.node(a[0])
      if (typeof a[2] == "string") {
        node.setAttribute(attr, a[2])
        if (attr == "fakefocus") {
          this.maybeFocusedElement = node
          this.maybeFocusedElementChanged = true
        }
      } else {
        node.removeAttribute(attr)
      }
    } else if (DOMREC_TEXT in action) {
      let a = action[DOMREC_TEXT]
      this.node(a[0]).data = a[1]
    } else if (DOMREC_ADD in action) {
      let a = action[DOMREC_ADD]
      this.node(a[0]).insertBefore(this.deserialize(a[2]), this.node(a[1]))
      for (let action of a[3]) {
        this.doAction(action)
      }
    } else if (DOMREC_REMOVE in action) {
      let n = action[DOMREC_REMOVE]
      let node = this.node(n)
      // XXX delete descendant nodes from our map too?
      delete this.nodes[n]
      node.remove()
    } else if (DOMREC_INPUT in action) {
      let a = action[DOMREC_INPUT]
      let n = this.node(a[0])
      let v = a[1]
      if (v) {
        n.value = v
      }
      this.maybeFocusedElementChanged = true
    } else if (DOMREC_MOUSE_DOWN in action) {
      let a = action[DOMREC_MOUSE_DOWN]
      this.setCursorPos(a[0], a[1])
      this.cursor.classList.add("down")
    } else if (DOMREC_MOUSE_UP in action) {
      let a = action[DOMREC_MOUSE_UP]
      this.setCursorPos(a[0], a[1])
      this.cursor.classList.remove("down")
    } else if (DOMREC_FORCE_STYLE_FLUSH in action) {
      let n = action[DOMREC_FORCE_STYLE_FLUSH]
      this.node(n).getBoundingClientRect()
    } else if (DOMREC_SCROLL in action) {
      let a = action[DOMREC_SCROLL]
      let container = this.node(a[0])
      if (container.getClientRects().length > 0) {
        let s = a[1]
        if (s == "bottom") {
          container.scrollTop = 1000000
        } else {
          let element = this.node(s)
          let o = element
          let offsetY = 0
          do {
            offsetY += o.offsetTop
            o = o.offsetParent
          } while (o != container)
          let offsetHeight = element.offsetHeight
          if (offsetY < o.scrollTop || offsetY + offsetHeight > o.scrollTop + o.clientHeight) {
            let y
            if (a.length >= 3) {
              y = offsetY - a[2]
            } else {
              y = offsetY - (o.clientHeight - offsetHeight) / 2
            }
            container.scrollTo(0, y)
          }
        }
      }
    } else if (DOMREC_FRAME in action) {
      let a = action[DOMREC_FRAME]
      let frame = this.node(a[0])
      frame.DOMRecBody = this.deserialize(a[1])
      if (frame.contentDocument.readyState == "complete") {
        this.setupFrame(frame)
      } else {
        frame.addEventListener("load", (function (event) {
          // Firefox might have destroyed our document due to loading "about:blank".
          // Restore it.
          this.setupFrame(frame)
        }).bind(this))
      }
    } else if (DOMREC_CANVAS_DATA in action) {
      let a = action[DOMREC_CANVAS_DATA]
      let n = this.node(a[0])
      var img = new window.Image()
      n.loadingImage = img
      const onload = (event) => {
        // Check that the right image is drawing. If images decode out of
        // order we could have a problem.
        if (n.loadingImage == event.target) {
          n.getContext("2d").drawImage(img, 0, 0)
          n.loadingImage = null
        }
        img.removeEventListener("load", onload)
      }
      img.addEventListener("load", onload)
      img.setAttribute("src", a[1])
    } else {
      throw "Unknown action"
    }
  }

  public setCaret(element) {
    // Create a fake caret for the text. We need to measure its position using hacks.
    // Currently we assume 'element' is a display:inline <input> or <textarea>.
    if (!(element.tagName == "INPUT" || element.tagName == "TEXTAREA" ||
      element.hasAttribute("contenteditable"))) {
      return
    }

    let e = document.createElement("DIV")
    e.classList.add("fakeInput")
    e.style.left = element.offsetLeft + "px"
    e.style.top = element.offsetTop + "px"
    e.style.width = element.offsetWidth + "px"
    function pixels(v) {
      if (v.endsWith("px")) {
        return parseInt(v.substring(0, v.length - 2))
      }
      return 0
    }
    let cs = window.getComputedStyle(element)
    function fixPadding(direction) {
      e.style["padding" + direction] = pixels(cs["border" + direction + "Width"]) +
        pixels(cs["padding" + direction]) + "px"
    }
    fixPadding("Left")
    fixPadding("Top")
    fixPadding("Right")
    fixPadding("Bottom")
    for (let p of ["fontFamily", "fontSize", "verticalAlign", "wordWrap", "whiteSpace"]) {
      e.style[p] = cs[p]
    }
    if (cs.display == "inline-block" || cs.display == "inline") {
      let baselineMeasurer = document.createElement("DIV")
      baselineMeasurer.classList.add("baselineMeasurer")
      element.parentNode.insertBefore(baselineMeasurer, element)
      let baselineRect = baselineMeasurer.getBoundingClientRect()
      let elementRect = element.getBoundingClientRect()
      baselineMeasurer.remove()
      // Create an empty span to push the text baseline down to where it needs to be
      let span = document.createElement("span")
      span.style.height = (baselineRect.bottom - elementRect.top) / this.scaleY + "px"
      e.appendChild(span)
    }
    let value = "value" in element ? element.value : element.textContent
    let textIndex = value.length
    // Work around https://bugs.chromium.org/p/chromium/issues/detail?id=839987.
    // If the value is entirely whitespace then we might need more workarounds but
    // that doesn't happen currently.
    if (value == "") {
      value = "|"
    }
    e.appendChild(document.createTextNode(value))

    let parent = element.offsetParent ? element.offsetParent : element.ownerDocument.documentElement
    parent.appendChild(e)

    let r = new Range()
    r.setStart(e.lastChild, textIndex)
    r.collapse(true)
    let rangeRect = r.getClientRects()[0]
    let parentRect = parent.getBoundingClientRect()
    let caret = document.createElement("DIV") as any
    caret.classList.add("fakeCaret")
    caret.style.left = (rangeRect.left - parentRect.left) / this.scaleX + "px"
    caret.style.top = (rangeRect.top - parentRect.top) / this.scaleY + "px"
    caret.style.height = rangeRect.height / this.scaleY + "px"
    caret.inputElement = element

    e.remove()
    parent.appendChild(caret)
    this.caretElement = caret
  }

  public labelIndex(name, def?) {
    if (typeof name == "undefined") {
      return def
    }
    for (let i = 0; i < this.actions.length; ++i) {
      if (this.actions[i][DOMREC_LABEL] == name) {
        return i
      }
    }
    throw "Unknown label " + name
  }

  public stop() {
    if (this.pendingTimeout != null) {
      clearTimeout(this.pendingTimeout)
      this.pendingTimeout = null
    }
    this.hostElem.classList.remove("playing")
    setTitle(this.hostElem)
  }

  public stopped() {
    return this.pendingTimeout == null
  }

  public seekInternal(index) {
    if (this.index > index) {
      this.reset()
    }
    while (this.index < index) {
      this.step()
    }
  }

  public seek(name) {
    let index = this.labelIndex(name, 0)
    this.stop()
    this.seekInternal(index)
  }



  public play(options) {
    this.stop()
    let stopAtIndex = this.actions.length
    if (options && ("end" in options)) {
      stopAtIndex = this.labelIndex(options.end)
    }
    let loop = !!(options && options.loop)
    let loopToIndex = 0
    let timeScale = 1.0
    if (options && ("timeScale" in options)) {
      timeScale = options.timeScale
    }
    let playStart = Date.now()
    let playTime = 0
    let oneLoopTime = 0
    if (loop) {
      for (let i = loopToIndex; i < stopAtIndex; ++i) {
        let action = this.actions[i]
        if (DOMREC_DELAY in action) {
          oneLoopTime += action[DOMREC_DELAY]
        }
      }
      if (oneLoopTime <= 0) {
        loop = false
      }
    }
    let doPlay = (function () {
      this.pendingTimeout = null
      while (true) {
        if (this.index >= stopAtIndex) {
          if (loop) {
            let delay = Date.now() - playStart
            while (delay > timeScale * (playTime + oneLoopTime)) {
              // Fake playing some loops without doing the work to catch up to real time
              playTime += oneLoopTime
            }
            this.hostElem.classList.add("looping")
            setTimeout((function () {
              this.hostElem.classList.remove("looping")
            }).bind(this), 500)
            this.seekInternal(loopToIndex)
          } else {
            break
          }
        }
        let action = this.step()
        if (DOMREC_DELAY in action) {
          playTime += action[DOMREC_DELAY]
          let delay = Date.now() - playStart
          if (delay < timeScale * playTime) {
            this.pendingTimeout = setTimeout(doPlay, timeScale * playTime - delay)
            break
          }
        }
      }
    }).bind(this)
    this.hostElem.classList.add("playing")
    setTitle(this.hostElem)
    doPlay()
  }
}
