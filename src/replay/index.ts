// For subframe external stylesheets, replay loads the stylesheet text and inject the
// text directly into the subframe.
// The key here is the stylesheet URL in the recorded document's LINK

import { setTitle } from './common'
import { DOMReplay } from './DOMReplay'

const DOMRecStylesheetCache = {};
const DOMREC_SKIP_HIDDEN_IDS = ['toolbox'];

// element, the value is the URL from which we should fetch its text during replay.
const DOMREC_REPLAY_FRAME_STYLESHEETS = {
};
// These stylesheets will be loaded in the main replay frame. We don't try to load
// the original stylesheets from the recording at all; instead list their replay-time
// URLs here.
// XXX this assumes a fixed list of stylesheets will do for all the replays that
// use this script!
const DOMREC_REPLAY_STYLESHEETS = [
    "domrec-replay.css",
];
// Full URL of the current script
let DOMRecScriptURL = document.currentScript ? (document as any).currentScript.src : null;

// This function gets called to rewrite all the stylesheet URLs during replay.
// This can apply dynamic changes e.g. using DOMRecScriptURL.
function rewriteResourceURL(url) {
  return url;
}

function DOMSetupReplay(element) {
  let data = window[element.id] as any;
  if (!("initialState" in data)) {
    return false;
  }
  element.textContent = '';
  let frame = document.createElement("iframe") as any;
  let srcdoc = '<html class="replay"><head>';
  for (let sheet of DOMREC_REPLAY_STYLESHEETS) {
    sheet = rewriteResourceURL(sheet);
    srcdoc += '<link rel="stylesheet" href="' + sheet + '">';
  }
  frame.srcdoc = srcdoc;
  // Crazy hack to get the correct size for the IFRAME. We insert an SVG element
  // with the correct aspect ratio and let its intrinsic height be the height of our
  // DIV, then make the IFRAME use that height. Too bad there's no way to tell an IFRAME
  // to use a specific intrinsic ratio.
  let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  if (window.origin == "http://127.0.0.1:3000" &&
      (element.style.width != data.width + "px" ||
       element.style.height != data.height + "px")) {
    alert("Invalid dimensions for " + element.id + ": expected " +
          data.width + "px x " + data.height + "px, got " +
          element.style.width + " x " + element.style.height);
  }
  svg.setAttribute("viewBox", "0 0 " + data.width + " " + data.height);
  element.appendChild(svg);
  element.appendChild(frame);
  // IFRAME navigation to the srcdoc document will have started but for now
  // we will have a blank document. Make sure this doesn't confuse us.
  frame.contentDocument.initialDoc = true;
  element.frame = frame;

  if (!element.hasAttribute("fixedWidth")) {
    element.style.maxWidth = data.width + "px";
    element.style.width = '';
  }
  element.style.height = '';
  return true;
}
let DOMResolveSetupReplay;
const DOMSetupReplayPromise = new Promise(function(resolve, reject) {
  DOMResolveSetupReplay = resolve;
});
function DOMSetupReplayAll() {
  for (let d of Array.from(document.querySelectorAll(".DOMRecMovie:not(.demo)"))) {
    if (!DOMSetupReplay(d)) {
      return false;
    }
  }
  DOMResolveSetupReplay();
  return true;
}
if (document.readyState == "loading") {
  document.addEventListener("DOMContentLoaded", function() {
    if (!DOMSetupReplayAll()) {
      throw "Data missing";
    }
  });
} else {
  if (!DOMSetupReplayAll()) {
    // The script with the DOMRec data hasn't loaded yet.
    let s = document.currentScript.previousElementSibling;
    if (s.tagName != "SCRIPT") {
      throw "Expected DOMRec data script!";
    }
    s.addEventListener("load", function() {
      if (!DOMSetupReplayAll()) {
        throw "Data missing";
      }
    });
  }
}

function DOMReplayStylesheetCacheLoaded() {
  function onloaded(element, callback) {
    if (!element.frame) {
      return;
    }
    function waitForFonts() {
      element.frame.contentDocument.fonts.ready.then(callback);
    }
    let doc = element.frame.contentDocument;
    if (doc.readyState == "complete" && !doc.initialDoc) {
      waitForFonts();
    } else {
      element.frame.addEventListener("load", waitForFonts);
    }
  }

  function createFullscreenButton(d) {
    if (!document.fullscreenEnabled) {
      return;
    }
    let fullscreen = document.createElement("button");
    fullscreen.className = "fullscreen";
    fullscreen.title = "Click to enter/exit fullscreen";
    fullscreen.addEventListener("click", function(event) {
      event.stopPropagation();
      if (document.fullscreenElement == d) {
        document.exitFullscreen();
      } else {
        const resize = () => {
          let cw = d.clientWidth;
          let ch = d.clientHeight;
          let data = window[d.id] as any;
          if (data.width*ch < data.height*cw) {
            d.frame.style.top = "0";
            d.frame.style.height = "100%";
            let w = data.width*(ch/data.height);
            d.frame.style.width = w + "px";
            d.frame.style.left = "calc(50% - " + w/2 + "px)";
          } else {
            d.frame.style.left = "0";
            d.frame.style.width = "100%";
            let h = data.height*(cw/data.width);
            d.frame.style.height = h + "px";
            d.frame.style.top = "calc(50% - " + h/2 + "px)";
          }
        }
        let addedResizeListener = false;
        d.requestFullscreen().then(function() {
          resize();
          if (!addedResizeListener) {
            addedResizeListener = true;
            window.addEventListener("resize", resize);
          }
        });
      }
    });
    d.appendChild(fullscreen);
  }

  function tryPopOut(d, event) {
    if (!d.hasAttribute("popOut") || d.classList.contains("poppedOut") ||
        document.fullscreenElement == d) {
      return false;
    }
    event.stopPropagation();

    let container = d.parentNode;
    let dRect = d.getBoundingClientRect();
    container.scrollIntoView({behavior: 'smooth', block: 'start'});

    if (window.getComputedStyle(d).position == 'absolute') {
      let savedMinHeight = container.style.minHeight;
      container.style.minHeight = "0";
      let containerRect = container.getBoundingClientRect();
      let newDWidth = 220 + containerRect.width;
      let newDHeight = newDWidth*dRect.height/dRect.width;
      container.style.height = containerRect.height + "px";
      container.getBoundingClientRect();
      d.classList.add("poppedOut");
      container.style.height = (containerRect.height + newDHeight + 20) + "px";
      d.style.width = newDWidth + "px";
      d.style.top = (containerRect.height + 10) + "px";
      d.escapeHandler = function(event) {
        if (!d.contains(event.target)) {
          document.removeEventListener("click", d.escapeHandler, true);
          d.classList.remove("poppedOut");
          container.style.height = '';
          container.style.minHeight = savedMinHeight;
          d.style.width = '';
          d.style.top = '';
          setTitle(d);
          // Don't stop propagation; allow the click to function normally
        }
      };
    } else {
      let containerRect = container.getBoundingClientRect();
      let newDWidth = containerRect.width;
      d.classList.add("poppedOut");
      d.style.left = "0";
      d.style.width = newDWidth + "px";
      d.escapeHandler = function(event) {
        if (!d.contains(event.target)) {
          document.removeEventListener("click", d.escapeHandler, true);
          d.classList.remove("poppedOut");
          d.style.left = '';
          d.style.width = '';
          setTitle(d);
          // Don't stop propagation; allow the click to function normally
        }
      };
    }

    document.addEventListener("click", d.escapeHandler, true);
    setTitle(d);
    return true;
  }

  function setupMovieReplay(d) {
    d.player = new DOMReplay(d);
    let replayIndicator = document.createElement("div");
    d.appendChild(replayIndicator);
    let play = document.createElement("button");
    play.className = "play";
    d.appendChild(play);
    createFullscreenButton(d);
    d.addEventListener("click", function(event) {
      if (tryPopOut(d, event)) {
        return;
      }
      event.stopPropagation();
      if (d.player.stopped()) {
        d.player.play({loop:true});
      } else {
        d.player.stop();
      }
    });
    setTitle(d);
  }

  for (let d of Array.from(document.querySelectorAll(".DOMRecMovie:not(.demo)"))) {
    onloaded(d, function() {
      setupMovieReplay(d);
    });
  }

  window.addEventListener("click", ({ target, preventDefault, stopPropagation }: MouseEvent) => {
    if ((target as any).classList.contains("DOMRecShowDemo")) {
      let demo = (target as any).nextSibling;
      demo.classList.toggle("show");
      if (demo.player) {
        if (demo.classList.contains("show")) {
          demo.player.play({loop:true});
        } else {
          demo.player.stop();
        }
      } else {
        DOMSetupReplay(demo);
        onloaded(demo, function() {
          setupMovieReplay(demo);
          demo.player.play({loop:true});
        });
      }

      event.preventDefault();
      event.stopPropagation();
    }
  });
}

function DOMReplayLoadStylesheets() {
  if (!DOMRecScriptURL) {
    // We were injected, not loaded, so just bail out.
    return;
  }
  // The ?1 suffix distinguishes this resource from non-CORS direct loads, to
  // ensure the results are cached separately. Cloudfront/S3 doesn't set CORS
  // headers on non-CORS loads.
  let promises = [DOMSetupReplayPromise];
  for (let s in DOMREC_REPLAY_FRAME_STYLESHEETS) {
    let cached = s;
    let url = rewriteResourceURL(DOMREC_REPLAY_FRAME_STYLESHEETS[s]);
    promises.push(window.fetch(url).then(function(response) {
      if (!response.ok) {
        throw "Failed to load " + url + ": " + response.statusText;
      }
      return response.text();
    }).then(function(text) {
      if (typeof text != "string") {
        throw "Unexpected source text: " + text;
      }
      DOMRecStylesheetCache[cached] = text;
    }));
  }
  Promise.all(promises).then(DOMReplayStylesheetCacheLoaded);
}
DOMReplayLoadStylesheets();

window.addEventListener("load", function() {
  document.body.classList.add("loaded");
});