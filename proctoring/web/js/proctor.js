/* global OT */

window.addEventListener('load', function studentController () {
  var session
  var connections = {}
  var streams = {}
  var subscribers = {}
  var studentsDiv = $('#students')
  var msg = $('#message')
  var zoomed = null

  function screenshot (subscriberid) {
    if (subscribers[subscriberid]) {
      return 'data:image/png;base64,' + subscribers[subscriberid].getImgData()
    }
    return null
  }

  function launchSession (data) {
    session = OT.initSession(data.apiKey, data.sessionId)

    $('#students').on('click', 'button.zoom', function (evt) {
      evt.target.parentNode.classList.add('zoomed')
      evt.target.classList.add('zoomed')
      evt.target.classList.remove('zoom')
      evt.target.innerText = 'Exit'
      var connId = evt.target.dataset.connid
      if (!connections[connId]) {
        console.log('No streams available for connid', connId)
        return
      }
      connections[connId].forEach(function (c) {
        console.log('Zooming', c, streams[c], subscribers[c])
        if (!subscribers[c]) {
          subscribe(streams[c], connId)
        }
      })
      zoomed = connId
    })

    $('#students').on('click', '.screenshot', function (evt) {
      var imgdata = screenshot(evt.target.dataset.streamid)
      if (imgdata != null) {
        var l = document.createElement('a')
        l.setAttribute('href', imgdata)
        l.setAttribute('download', 'screenshot-' + Date.now() + '.png')
        l.click()
      }
      return false
    })

    $('#students').on('click', 'div.zoomed button.fullscreen', function (evt) {
      var elm = evt.target.parentNode.parentNode
      if (elm.requestFullscreen) {
        elm.requestFullscreen()
      } else if (elm.webkitRequestFullScreen) {
        elm.webkitRequestFullScreen()
      } else if (elm.mozRequestFullScreen) {
        elm.mozRequestFullScreen()
      }
    })

    $('#students').on('click', 'button.zoomed', function (evt) {
      var connId = evt.target.dataset.connid
      connections[connId].forEach(function (c, i) {
        if (i === 0) {
          return
        }
        unsubscribe(c)
      })
      evt.target.parentNode.classList.remove('zoomed')
      // evt.target.parentNode.classList.remove('col-12')
      // evt.target.parentNode.classList.add('col-4')
      evt.target.classList.remove('zoomed')
      evt.target.classList.add('zoom')
      evt.target.innerText = 'Zoom'
      zoomed = null
    })

    function unsubscribe (streamId) {
      console.log('Unsubscribing', subscribers[streamId])
      if (subscribers[streamId]) {
        session.unsubscribe(subscribers[streamId])
      }
      subscribers[streamId] = null
      $('#stream' + streamId).remove()
    }

    function subscribe (stream, connId) {
      var innerhtml = '<div id="stream' + stream.id + '" class="stream type-' + stream.videoType + '">' +
        '<div class="action-buttons">' +
          '<button type="button" class="btn btn-secondary fullscreen">Zoom</button>' +
          '<button type="button" class="btn btn-secondary screenshot" data-streamid="' + stream.id + '">Screenshot</button>' +
        '</div>' +
      '</div>'
      $('#conn' + connId).append(innerhtml)
      var s = session.subscribe(stream, 'stream' + stream.id, {
        insertMode: 'append',
        width: '100%',
        height: '100%'
      }, function (err) {
        if (err) {
          alert('Error subscribing to stream')
          console.log(err)
          return
        }
        console.log('Subscribed to stream ' + stream.id + ' of connection ' + connId)
      })
      subscribers[stream.id] = s
    }

    session.on('streamDestroyed', function (event) {
      console.log('Stream destroyed', event)
      var id = event.stream.connection.data
      streams[event.stream.id] = null
      connections[id] = connections[id].filter(function (c) {
        return c !== event.stream.id
      })
      $('#stream' + event.stream.id).remove()
    })

    session.on('connectionDestroyed', function (event) {
      var id = event.connection.data
      console.log('Connection destroyed', event, connections[id])
      if (connections[id].length > 0) {
        if (!subscribers[connections[id][0]]) {
          subscribe(streams[connections[id][0]], id)
        }
      } else {
        $('#conn' + id).remove()
      }
    })

    session.on('streamCreated', function (event) {
      console.log('Stream created', event)
      var id = event.stream.connection.data
      var streamId = event.stream.id
      if (!connections[id] || connections[id].length === 0) {
        connections[id] = []
        studentsDiv.append('<div id="conn' + id + '" class="col-4">' +
          '<button type="button" class="btn btn-primary btn-sm zoom" data-connid="' + id + '">Zoom</button></div>')
        subscribe(event.stream, id)
      } else if (zoomed === id) {
        subscribe(event.stream, id)
      }
      connections[id].push(streamId)
      streams[streamId] = event.stream
    })

    session.connect(data.token, function (error) {
      if (error) {
        alert('Error connecting to OpenTok session')
        msg.text('Error')
        console.log(error)
        return
      }
      console.log('Connected to session', data.sessionId)
      msg.text('Connected to OpenTok')
    })
  }

  $.get('/token?id=proctor', function (data) {
    launchSession(data)
  }, 'json')
    .fail(function (err) {
      alert('Error getting token')
      console.log(err)
    })
})
