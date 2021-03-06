# DOMRec-Core

DOMRec records and replays DOM updates to make lightweight, pixel-perfect screenshots and movies. Perfect for Web application demos.

This project is only possible due to the awesome groundwork by https://github.com/rocallahan in https://github.com/Pernosco/DOMRec. See his article: [DOM Recording For Web Application Demos](https://robert.ocallahan.org/2020/11/dom-recording-for-web-application-demos.html).

## Ecosystem

The ability to record the DOM of a website makes this package very flexible and allows many other possibilites. There are a few tools that already built up on this:

* [Puppeteer](https://github.com/Junkern/domrec-puppeteer): Record the DOM when using puppeteer. This makes it perfect for E2E tests, as it also works in headless mode, 
* [Playwright](https://github.com/Junkern/domrec-playwright): Record the DOM when using playwright. This makes it perfect for E2E tests, as it also works in headless mode, 
* [Firefox Extension](https://github.com/Junkern/domrec-firefox-extension): A small extension which allows you to easily use `domrec-core` to record DOM changes of any website.

## Installation

```sh
npm install --save domrec-core
# or
yarn add domrec-core
```

You can find the two needed files (`recording.js` and `replay.js`) inside the `dist` folder.

## Usage

The code basically consists of two parts: 

* `Recording` the DOM
* And `replaying` an existing record

### Recording

To start a recording, you have to pass an HTML node to the `DOMRecorder` class. You can also pass `document.body` in case you want to record the whole window.

Example which only records everything inside a div with the id `content`: 

```html
<script src="./dist/recording.js"></script>
<script>
window.recorder = new DOMRecorder(document.getElementById("content"));
</script>
```

In most cases you want to start recording after the `DOMContentLoaded` event has fired.

Ending a recording is easy:

```js
const contents = window.recorder.stop();
document.body.textContent = JSON.stringify(contents);
```

### Replaying

Use the `DOMReplayManager` to setup and init the replay of a recording. You have to pass two parameters:

* first parameter: The node you want to play the recording inside
* second parameter: A stored recording

```html
<script src="./dist/replay.js"></script>
<div id="replayContainer" style=""></div>
<script>
  const recording = contents // the stored contents object from the recording above
  const m = new DOMReplayManager(document.getElementById('replayContainer'), recording)
  m.addReplayStylesheet('./domrec-replay.css')
  m.init()
</script>
```

In most cases you want to add the `demo/domrec-replay.css` file with the `addReplayStylesheet` function, otherwise it will look really bad. Try it out ;)

For now it is only possible to replay one recording. It is planned to support the replay of multiple recordings one after another. If you need that feature, please open an issue.

## Demo

* Download this repository
* Install all dependencies: `npm install`
* Build the source code: `npm run build` (in case you want to have source-maps of better debugging, use `build:dev`)
* Open the `demo/record-demo.html` in the browser and start recording.
* Paste the finished recording below the `//// Paste your demo data text here.` inside `demo/replay-demo.html` and simply open `demo/replay-demo.html` 

## Data Structures

The recording produces an object with the following properties:

* `initialState`: The initial state of the DOM when starting to record
* `actions`: The DOM changes
* `stylesheets`: The (external) stylesheets of the website when the recording started
* `iframeStylesheets`: Contains the URL of stylesheets of iframes encountered during recording.
* `height`: The height of the initial root node
* `width`: The width of the initial root node