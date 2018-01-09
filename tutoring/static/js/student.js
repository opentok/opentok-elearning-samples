/* global OT, room */

window.addEventListener('load', function studentController () {
  var session
  var publisherCamera
  var students = {}
  var stage = {}
  var streamsDiv = $('#streams')
  var timerContainer = $('#elapsed-time')

  $('#controls').hide()

  function startTimer () {
    timerContainer.parent().prepend('Elapsed Time: ')
    var starttime = new Date()
    setInterval(function updateTimer () {
      var t = Date.parse(new Date()) - Date.parse(starttime)
      timerContainer.text([
        Math.floor((t / (1000 * 60 * 60)) % 24),
        Math.floor((t / 1000 / 60) % 60),
        Math.floor((t / 1000) % 60)
      ].join(':'))
    }, 1000)
  }

  function launchSession (data) {
    session = OT.initSession(data.apiKey, data.sessionId)

    function subscribeTeacherCamera (stream) {
      session.subscribe(stream, 'teacher-camera', {
        insertMode: 'append',
        width: '100%',
        height: '100%'
      }, function (err) {
        if (err) {
          console.log('Error subscribing to teacher\'s camera stream', err)
          $('#teacher-camera').addClass('has-stream')
        }
        $('#teacher-camera').addClass('has-stream')
        streamsDiv.addClass('hasTeacherCamera')
      })
    }

    function subscribeTeacherScreen (stream) {
      session.subscribe(stream, 'teacher-screen', {
        insertMode: 'append',
        width: '100%',
        height: '100%'
      }, function (err) {
        if (err) {
          console.log('Error subscribing to teacher\'s screen stream', err)
        }
        $('#teacher-screen').addClass('has-stream')
        streamsDiv.addClass('hasTeacherScreen')
      })
    }

    function parseConnectionData (conn) {
      var data = null
      try {
        data = JSON.parse(conn.data)
        console.log('Parsed connection data', data)
      } catch (e) {
        console.log('Error parsing stream connection data', e)
      }
      return data
    }

    session.on('streamCreated', function (event) {
      console.log('streamCreated', event)
      var data = parseConnectionData(event.stream.connection)
      if (data == null) {
        return
      }
      if (data.userType === 'teacher') {
        switch (event.stream.videoType) {
          case 'camera':
            subscribeTeacherCamera(event.stream)
            break
          case 'screen':
            subscribeTeacherScreen(event.stream)
            break
        }
      } else if (data.userType === 'student') {
        students[event.stream.id] = event.stream
      }
    })

    session.on('streamDestroyed', function (event) {
      var data = parseConnectionData(event.stream.connection)
      if (data == null) {
        return
      }
      if (data.userType === 'teacher') {
        switch (event.stream.videoType) {
          case 'camera':
            $('#teacher-camera').removeClass('has-stream')
            streamsDiv.removeClass('hasTeacherCamera')
            break
          case 'screen':
            $('#teacher-screen').removeClass('has-stream')
            streamsDiv.removeClass('hasTeacherScreen')
            break
        }
      } else if (data.userType === 'student') {
        students[event.stream.id] = null
        delete students[event.stream.id]
      }
      if (stage[event.stream.id]) {
        stage[event.stream.id] = null
        delete stage[event.stream.id]
      }
    })

    session.on('signal:stageAdd', function (evt) {
      var stream = students[evt.data]
      console.log('Added to stage', evt.data, stream)
      if (!stream) {
        $('#self-view .badge').show()
        return
      }
      if (stream) {
        var s = session.subscribe(stream, 'student-stage', {
          insertMode: 'append',
          width: '100%',
          height: '100%'
        }, function (err) {
          if (err) {
            console.log('Error subscribing to student on stage', err)
          }
          streamsDiv.addClass('hasStudent')
          $('#student-stage').addClass('has-stream')
        })
        s.subscribeToAudio(true)
        s.subscribeToVideo(true)
        stage[stream.id] = s
      }
    })

    session.on('signal:stageRemove', function (evt) {
      var s = stage[evt.data]
      console.log('Removed from stage', evt.data, s)
      $('#student-stage').removeClass('has-stream')
      streamsDiv.removeClass('hasStudent')
      if (!s) {
        $('#self-view .badge').hide()
        return
      }
      if (s) {
        session.unsubscribe(s, function (err) {
          if (err) {
            console.log('Error unsubscribing from student on stage', err)
          }
          stage[evt.data] = null
          delete stage[evt.data]
        })
      }
    })

    session.connect(data.token, function (error) {
      if (error) {
        console.log(error)
        return
      }
      console.log('Connected to session', data.sessionId)
      startTimer()
      $('#controls').show()
      publisherCamera = OT.initPublisher('self-view', {
        resolution: '320x240',
        height: '100%',
        width: '100%',
        insertMode: 'append',
        name: $('#user-name').val()
      }, function (err) {
        if (err) {
          console.log(err)
          return
        }
        session.publish(publisherCamera, function (err) {
          if (err) {
            console.log(err)
            return
          }
          console.log('Published camera')
          session.signal({ type: 'onStage' })
        })
      })
    })
  }

  OT.getDevices(function (err, devices) {
    if (err) {
      console.log(err)
      return
    }
    console.log('MediaDevices', devices)
    if (devices.length < 1) {
      console.error('No media devices available')
      return
    }

    $('#join-room').removeAttr('disabled')
    $('#join-room').on('click', function (evt) {
      evt.preventDefault()
      $.get('/token/' + room.roomId + '/student?name=' + $('#user-name').val(), function (data) {
        console.log('Token data', data)
        $('#join-form').hide()
        launchSession(data)
      }, 'json')
        .fail(function (err) {
          console.log(err)
        })
      return false
    })
  })
})
