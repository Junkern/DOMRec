# DOMRec-Core

DOMRec records and replays DOM updates to make lightweight, pixel-perfect screenshots and movies. Perfect for Web application demos.

This project is only possible due to the awesome groundwork by https://github.com/rocallahan in https://github.com/Pernosco/DOMRec. See his article: [DOM Recording For Web Application Demos](https://robert.ocallahan.org/2020/11/dom-recording-for-web-application-demos.html).

## Ecosystem

The ability to record the DOM of a website makes this package very flexible and allows many other possibilites. There are a few tools that already built up on this:

* [Puppeteer](https://github.com/Junkern/domrec-puppeteer): Record the DOM when using puppeteer (also works in headless mode)
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

```js
<script src="./dist/recording.js"></script>
window.recorder = new DOMRecorder(document.getElementById("content"));
```

In most cases you want to start recording after the `DOMContentLoaded` event has fired.

Ending a recording is easy:

```js
const contents = window.recorder.stop();
document.body.textContent = JSON.stringify(contents);
```

### Replaying

```js
<script src="./dist/replay.js"></script>
window.demoMovie = {/* the JSON data of the recording must be placed here*/}
<div class="DOMRecMovie" id="demoMovie" style=""></div>
```

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
* `height`: The height of the initial root node
* `width`: The width of the initial root node