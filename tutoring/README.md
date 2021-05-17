# OpenTok tutoring demo

A simple OpenTok demo showing a tutoring setup where 1 teacher is connected to N students in a classroom. Students see only the teacher. Teacher can bring any student on the "stage" so that other students see and hear that student. Students also have a breakout room where they can discuss among each other.

## Features

### Roles

- Teacher: Moderator - Publishes camera and/or screen.
- Students: Publish only

### Students

- Students publish their camera
- Students subscribe to the teacher and any other student who has been brought on stage.
- Students do not subscribe to proctor or to each other.

### Teacher

- Teacher publishes their camera and/or screen.
- Sees multiple students displayed in a thumbnail grid
- Can add or remove students on stage.

### Breakout room

- Students can temporarily leave the classroom and enter a breakout room
- Breakout room can handle max 5 students in full-mesh in this demo.
- Students can get back to the classroom from the breakout room.

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

This demo highlights the ability to quickly subscribe and unsubscribe to OpenTok streams and adjusts layouts based on number and type of streams. This is mainly evident in the student view for each room and in the breakout rooms. Layout of student view adjusts depending on whether the teacher is streaming camera or screen or both, or whether there is a student on stage. Layout of broadcast rooms adjust depending on how many students are in the breakout rooms.

### Application server

[`server.js`](server.js) is the application server script. It sets up rooms, creates OpenTok sessions and tokens and serves a lightweight ExpressJS app to handle different routes. It uses OpenTok NodeJS server-side SDK to talk to OpenTok REST API.

For the purposes of this demo, it stores all room-related data in memory, in the `classRooms` object. A real-life application should store this in a database instead.

Each "room" consists of a room ID and two OpenTok sessions - one for the classroom and another for the breakout room. The application tracks classroms by this room ID.

Application logic in `server.js` is broken down as functions. `createRoom()` creates a room and internally calls `createSession()` to generate OpenTok sessions for the room. It can optionally create a peer-to-peer room by switching the `mediaMode` to `relayed` when calling `createSession()`. `createToken()` generates a token to connect to given OpenTok session.

These functions are called by the HTTP routes exposed by the ExpressJS app instance. The ExpressJS app instance renders views for some routes and returns JSON response for some other routes. The views are stored in the [`views/`](views/) directory.

### Web Client UI

The web client UI is built using basic Bootstrap and uses jQuery to perform some DOM manipulations. Each view uses a common stylesheet and a view-specific stylesheet, which are in the [`static/css/`](static/css/) directory. Each view also has its client-side logic in view-specific scripts present in the [`static/js/`](static/js/) directory.

### Teacher view

Teacher view is served when visting `/teacher/:roomId`. This view is stored in [`views/teacher.ejs`](views/teacher.ejs). It's client-side logic is present in [`static/js/teacher.js`](static/js/teacher.js).

`teacher.js` sets up screenshare extension for Chrome, event bindings for interface controls, handles logic for adding/removing student on stage and manages connection to OpenTok session as a teacher.

### Student view

Student view is served when visiting `/student/:roomId`. This view is stored in [`views/student.ejs`](views/student.ejs). It's client-side logic is present in [`static/js/student.js`](static/js/student.js).

`student.js` reacts to changes in streams added or removed by toggling CSS classes on the parent layout element. [`student.css`](static/css/student.css) has declarations to rearrange the UI elements depending on these configurations.

Student view handles stream subscription logic in a different manner than a regular multiparty video call. Whenever a new student joins the room, other students in the room have necessary information about the new student's stream but they don't subscribe to that student's stream right away.

`student.js` achieves this by adding some custom logic to OpenTok's `streamCreated` event, the event that is triggered whenever there is a new stream available in the session. It subscribes immediately to streams published by the teacher. If a new stream is published by a student, it stores the stream object in a local cache but does not subscribe to the stream. It uses `streamDestroyed` event to clean up this local cache.

The teacher view sends a [signal](https://tokbox.com/developer/guides/signaling/) called `stageAdd` when teacher adds a student to stage and sends another signal called `stageRemove` when a student is removed from stage. Both of these signal events carry a payload identifying the student stream.

`student.js` listens for the `stageAdd` signal event and subscribes to the known stream from the local cache and updates the layout. It also listens to the `stageRemove` signal to unsubscribe the current student stream and updates the layout, effectively bringing the other student off stage. If the `stageAdd` signal's data matches the current student, which happens when the teacher has added the current student to stage, it shows a small badge in the student's self-view area instead.

### Breakout view

Students can join breakout room for the current classroom. The breakout room is a simple multiparty video conference setup where up to 5 students can talk to each other. The breakout room's view is stored in [`views/breakout.ejs`](views/breakout.ejs). It's client-side logic is present in [`static/js/breakout.js`](static/js/breakout.js).

### Screenshare

The codebase for the Chrome screenshare extension is present in the [`extensions/`](extensions/) directory. Firefox 52+ does not need a screenshare.

