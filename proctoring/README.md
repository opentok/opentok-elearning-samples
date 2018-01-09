# OpenTok proctoring demo

A simple OpenTok demo showing a proctoring setup where each participant publishes multiple video feeds simultaneously and proctors can zoom in on student views.

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/kaustavdm/opentok-lms-demos/tree/proctoring)

## Features

### Students

- Students join and start publishing their feed
- Students can publish their camera and screen video
- After joining, students can use same URL to publish multiple streams, optionally choosing a different video source each time they publish.
- Students do not subscribe to proctor or to each other

### Proctor

- Proctor sees multiple students displayed in a thumbnail grid
- Proctor can click on each student feed to maximize
- Proctor can get screenshots of student video feed when maximized
- Proctor can also view students in full screen mode

## Install

Install NodeJS v8.0+

Install dependencies with `npm`

```sh
$ npm install
```

Get OpenTok API keys and set them as environment variables:

```sh
$ export OPENTOK_API_KEY="opentok-api-key-here"
$ export OPENTOK_API_SECRET="opentok-api-secret-here"
```
Start the server:

```sh
$ npm start
```

This will start the application on port `8080`. To change port, set the `PORT` environment variable. For example, to start the application on port `3000`, do this:

```sh
$ PORT=3000 npm start
```

To start secure server, set the `SECURE` environment variable to some value. For example, this will start the application on HTTPS port 3000:

```sh
$ SECURE=1 PORT=3000 npm start
```

## Walkthrough

This demo highlights OpenTok features like ability to choose camera when publishing, screensharing, dynamically subscribing and unsubscribing streams and getting screen captures of live video streams.

It uses a single session to publish and subscribe streams. All student streams are published to the same session. Proctors join the same session and subscribe to student streams.

### Application server

[`server.js`](server.js) is the application server script. It sets up rooms, creates OpenTok sessions and tokens and serves a lightweight ExpressJS app to handle different HTTP routes. It uses OpenTok NodeJS server-side SDK to talk to OpenTok REST API. On application start, `server.js` creates a new OpenTok session and reuses it for the rest of the application lifetime.

`server.js` also mounts the [`web/`](web/) directory as static file server on the web root `/`.

#### Generating OpenTok tokens

The HTTP API exposed by `server.js` includes the route [`GET /token`](server.js#L42-L61) to create tokens. This endpoint returns necessary credentials to connect to OpenTok session including OpenTok API key, session ID and token. It also returns the currently used token role and an `id` parameter. The `id` parameter is used to logically group streams published by one student. It can be specified using the `id` query parameter when calling the endpoint, else, `server.js` will generate an `id` if the query parameter is not specified. The value of this `id` parameter is used as the `data` property when creating token.

### Web UI

The UI for this demo is kept intentionally simple to focus on the main features. The Web UI is present in the [`web/`] directory and includes all assets - stylesheets, JavaScript and HTML files - that are served as part of the web client for this demo.

The homepage of this demo has two links: "Join as Proctor" and "Join as Student".

### Student view

Clicking on "Join as Student" takes you to the student view. This is served from [`web/student.html`](web/student.html) with its JavaScript at [`web/js/student.js`](web/js/student.js).

`student.js` handles OpenTok related UI logic. It sets up screensharing, populates list of available cameras by calling `OT.getDevices()`, fetches OpenTok credentials, connects to OpenTok session and starts publishing stream based on user inputs.

[Calling `OT.getDevices()`](web/js/student.js#L177) returns a list of all available media devices. This demo filters through them to pick video inputs and populates a `<select>` list in the UI with the data. The user can then select which camera they want to stream from.

The UI switches between sharing camera and screen depending on user's selection in the UI. Screensharing extension is packaged in the [`extensions/`](extensions/) directory. The demo code uses a pre-published screenshare extension for Chrome. Upon joining, the URL is updated to include the `id` value. You can visit the same URL in another browser window or from another computer to publish another stream as same student.

### Proctor view

Clicking on "Join as Proctor" takes you to the proctor view. This is served from [`web/proctor.html`](web/proctor.html) with its JavaScript at [`web/js/proctor.js`](web/js/proctor.js).

Proctor sees list of multiple students connected, each grouped by their `id`. The initial view in `proctor.html` shows only one camera feed from each student as thumbnails. When the proctor zooms in on a student by clicking their thumbnail, `proctor.js` looks up existing known streams for that student and subscribes to them immediately. These new subscriptions happen quite fast. Proctor can then take screenshots of each stream or go to full-screen mode. When closing the individual student view, the UI stays subscribed to only one stream for that student and unsubscribes to the other ones.

`proctor.js` achieves this workflow by tapping into the connection and stream events emitted by the OpenTok SDK. It uses `streamCreated` and `streamDestroyed` to maintain local cache of connection and stream data. Connections are grouped using the `id` from the connection `data` as their key.

It subscribes to new streams only if it is the first stream in the group; creating a new thumbnail container and displaying a smaller dimension version of the subscribed stream. If new streams are published with the same `id`, it will add them to the local cache without subscribing to the new stream. It will only subscribe to new streams of a student as they are created if proctor has zoomed in on that student.
