function setTitle(d) {
  if (d.hasAttribute("popOut")) {
    if (d.classList.contains("poppedOut")) {
      d.title = "Click outside to shrink";
    } else {
      d.title = "Click to enlarge";
    }
  } else if (d.classList.contains("DOMRecMovie")) {
    if (d.classList.contains("playing")) {
      d.title = "Click to pause";
    } else {
      d.title = "Click to resume";
    }
  } else {
    d.title = "";
  }
}

interface Recording {
  stylesheets: string[]
  initialState: any[]
  iframeStylesheets: { [k: string]: string }
  actions: any[]
  width: number
  height: number
}

export {setTitle, Recording}