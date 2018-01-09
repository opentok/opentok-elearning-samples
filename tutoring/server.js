/**
 * OpenTok tutoring demo main server script
 */

const express = require('express')
const OpenTok = require('opentok')
const { randomBytes } = require('crypto')

const classRooms = {}

let createId = () => {
  var id = randomBytes(3).toString('hex')
  return [id.slice(0, 3), id.slice(3)].join('-')
}

// Get configurations
const PORT = process.env.PORT || 8080

const OPENTOK_API_KEY = process.env.OPENTOK_API_KEY
if (!OPENTOK_API_KEY) {
  throw new Error('Provide OPENTOK_API_KEY environment variable')
}

const OPENTOK_API_SECRET = process.env.OPENTOK_API_SECRET
if (!OPENTOK_API_SECRET) {
  throw new Error('Provide OPENTOK_API_SECRET environment variable')
}

// Generate an OpenTok session. Will will use a single session only
const OT = new OpenTok(OPENTOK_API_KEY, OPENTOK_API_SECRET)

function createSession (mediaMode = 'routed') {
  return new Promise(function (resolve, reject) {
    OT.createSession({ mediaMode: mediaMode }, (err, session) => {
      if (err) {
        console.log('Error creating OpenTok session', err)
        return reject(err)
      }
      return resolve(session)
    })
  })
}

function createToken (sessionId, userName, userType = 'student', role = 'publisher') {
  try {
    const token = OT.generateToken(sessionId, {
      role: role,
      data: JSON.stringify({ userName: userName, userType: userType }),
      expireTime: Math.round((Date.now() / 1000) + (60 * 60)) // 1 hour from now()
    })
    return Promise.resolve(token)
  } catch (e) {
    return Promise.reject(e)
  }
}

function createRoom (p2p = false) {
  return new Promise(function (resolve, reject) {
    const room = {
      roomId: createId(),
      sessionId: null,
      breakoutSessionId: null,
      students: []
    }
    createSession(p2p ? 'relayed' : 'routed')
      .then(session => {
        room.sessionId = session.sessionId
        return createSession()
      })
      .then(session => {
        room.breakoutSessionId = session.sessionId
        classRooms[room.roomId] = room
        return resolve(room)
      })
      .catch(reject)
  })
}

function getRoom (req, res, next) {
  const room = classRooms[req.params.roomId || req.query.roomId]
  if (room) {
    req.room = room
    next()
  } else {
    const _err = new Error('Room not found')
    _err.status = 404
    next(_err)
  }
}

// Create expressJS app instance
const app = express()

// Set view engine
app.set('view engine', 'ejs')

// Mount the `./static` dir to web-root as static.
app.use('/', express.static('./static'))

app.get('/room', (req, res, next) => {
  let roomId = req.query.id
  let room = classRooms[roomId]
  if (roomId && room) {
    return res.status(200).json({
      roomId: roomId,
      sessionId: room.sessionId,
      students: room.students,
      apiKey: OPENTOK_API_KEY
    })
  }
  const p2p = req.query.p2p === '1'
  // If room doesn't exist, generate session Ids
  createRoom(p2p)
    .then(room => {
      return res.status(200).json({
        roomId: room.roomId,
        sessionId: room.sessionId,
        breakoutSessionId: room.breakoutSessionId,
        students: room.students,
        apiKey: OPENTOK_API_KEY,
        p2p: p2p
      })
    })
    .catch(next)
})

app.get('/token/:roomId/student', getRoom, (req, res, next) => {
  var name = req.query.name || createId()
  createToken(req.room.sessionId, name, 'student', 'publisher')
    .then(token => {
      return res.status(200).json({
        userName: name,
        token: token,
        sessionId: req.room.sessionId,
        apiKey: OPENTOK_API_KEY
      })
    })
    .catch(next)
})

app.get('/token/:roomId/teacher', getRoom, (req, res, next) => {
  var name = req.query.name || createId()
  createToken(req.room.sessionId, name, 'teacher', 'moderator')
    .then(token => {
      return res.status(200).json({
        userName: name,
        token: token,
        sessionId: req.room.sessionId,
        apiKey: OPENTOK_API_KEY
      })
    })
    .catch(next)
})

app.get('/token/:roomId/breakout', getRoom, (req, res, next) => {
  var name = req.query.name || createId()
  createToken(req.room.breakoutSessionId, name, 'breakout', 'publisher')
    .then(token => {
      return res.status(200).json({
        userName: name,
        token: token,
        breakoutSessionId: req.room.breakoutSessionId,
        apiKey: OPENTOK_API_KEY
      })
    })
    .catch(next)
})

app.get('/teacher/:roomId', getRoom, (req, res, next) => {
  res.render('teacher', { room: req.room })
})

app.get('/student/:roomId', getRoom, (req, res, next) => {
  res.render('student', { room: req.room })
})

app.get('/breakout/:roomId', getRoom, (req, res, next) => {
  res.render('breakout', { room: req.room })
})

app.get('/teacher', (req, res, next) => {
  if (req.query.roomId) {
    return res.redirect(`/teacher/${req.query.roomId.trim()}`)
  }
  createRoom(req.query.p2p === '1')
    .then(room => {
      return res.redirect(`/teacher/${room.roomId}`)
    })
    .catch(next)
})

app.get('/student', (req, res, next) => {
  if (req.query.roomId) {
    return res.redirect(`/student/${req.query.roomId.trim()}`)
  }
  createRoom(req.query.p2p === '1')
    .then(room => {
      return res.redirect(`/student/${room.roomId}`)
    })
    .catch(next)
})

// error handler
app.use(function (err, req, res, next) {
  err.status = err.status || 500
  res.status(err.status).json({
    message: err.message || 'Unable to perform request',
    status: err.status
  })
})

if (!process.env.SECURE || process.env.SECURE === '0') {
  // Bootstrap and start HTTP server for app
  app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`)
  })
} else {
  const https = require('https')
  const fs = require('fs')
  const tlsOpts = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem')
  }
  https.createServer(tlsOpts, app).listen(PORT, () => {
    console.log(`Listening on secure port ${PORT}...`)
  })
}
