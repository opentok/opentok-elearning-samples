/* global OT, room, chrome */

window.addEventListener('load', function studentController () {
  var session
  var publishers = {
    camera: null,
    screen: null
  }
  var isPublished = {
    camera: false,
    screen: false
  }
  var stage = {}
  var students = {}
  var isLive = false

  var cameraToggle = $('#camera-toggle')
  var screenToggle = $('#screen-toggle')
  var joinbtn = $('#join')
  var exitbtn = $('#exit').hide()

  function modal (title, content) {
    $('#modal .modal-title').text(title)
    $('#modal .modal-body').html(content)
    $('#modal').modal('show')
  }

  function installChromeExtension () {
    var extUrl = 'https://chrome.google.com/webstore/detail/fbjkpogjjhklbffmfooofjgablhmcnhn'
    if (chrome && chrome.webstore) {
      chrome.webstore.install(extUrl, function () {
        $('#chrome-ext-install').hide()
        screenToggle.show()
      }, function (err) {
        console.log(err)
        modal('Install screenshare extension', '<div>Please install the screen sharing from ' +
        '<a href="' + extUrl + '" target="_blank">this link</a> and reload this page</div>')
      })
    }
  }

  function checkScreenShareSupport (callback) {
    OT.checkScreenSharingCapability(function (res) {
      var screenshareEnabled = false
      if (!res.supported || res.extensionRegistered === false) {
        modal('Screenshare', 'Screensharing is not supported')
      } else if (res.extensionRequired === 'chrome' && res.extensionInstalled === false) {
        console.log('Chrome Screenshare required')
        $('#chrome-ext-install').show()
        screenToggle.hide()
      } else {
        console.log('Screenshare available')
        $('#chrome-ext-install').hide()
        screenToggle.show()
        screenshareEnabled = true
      }
      // Trigger callback
      callback(screenshareEnabled, res)
    })
  }

  function launchSession (data) {
    session = OT.initSession(data.apiKey, data.sessionId)

    function startScreen () {
      var opts = {
        audioSource: null,
        insertMode: 'append',
        publishAudio: false,
        videoSource: 'screen',
        width: '100%',
        height: '100%',
        name: 'Teacher screen'
      }

      publishers.screen = OT.initPublisher('teacher-screen', opts, function (err) {
        if (err) {
          console.log(err)
          return
        }
        screenToggle.addClass('isOn btn-primary').removeClass('btn-outline-primary').text('Stop Screen Share')
        if (isLive && !isPublished.screen) {
          publishScreen()
        }
      })
      $('input[type=radio][name=videoType]').attr('disabled', 'disabled')

      publishers.screen.on('mediaStopped', function () {
        publishers.screen = null
        screenToggle.removeAttr('disabled')
        if (!isLive && publishers.camera == null) {
          joinbtn.attr('disabled', 'disabled')
        }
        isPublished.screen = false
        screenToggle.addClass('btn-outline-primary').removeClass('isOn btn-primary').text('Share Screen')
      })
    }

    function stopScreen () {
      if (publishers.screen) {
        publishers.screen.destroy()
        screenToggle.removeClass('isOn btn-primary').addClass('btn-outline-primary').text('Share Screen')
        publishers.screen = null
        isPublished.screen = false
      }
    }

    function startCamera () {
      if (publishers.camera) {
        publishers.camera && publishers.camera.publishVideo(true)
        cameraToggle.addClass('isOn btn-primary').removeClass('btn-outline-primary').text('Stop Camera')
        return
      }
      var opts = {
        insertMode: 'append',
        width: '100%',
        height: '100%',
        name: 'Teacher camera'
      }
      publishers.camera = OT.initPublisher('teacher-camera', opts, function (err) {
        if (err) {
          console.log(err)
          cameraToggle.removeClass('isOn btn-primary').addClass('btn-outline-primary').text('Start Camera')
          return
        }
        cameraToggle.addClass('isOn btn-primary').removeClass('btn-outline-primary').text('Stop Camera')
        joinbtn.removeAttr('disabled')
        if (isLive && !isPublished.camera) {
          session.publish(publishers.camera, function (err) {
            if (err) {
              isPublished.camera = false
              return
            }
            isPublished.camera = true
          })
        }
      })
    }

    function stopCamera () {
      if (publishers.camera) {
        publishers.camera && publishers.camera.publishVideo(false)
        cameraToggle.removeClass('isOn btn-primary').addClass('btn-outline-primary').text('Start Camera')
      }
    }

    function toggleCamera (evt) {
      evt.preventDefault()
      if (cameraToggle.hasClass('isOn')) {
        stopCamera()
      } else {
        startCamera()
      }
      return false
    }

    function toggleScreen (evt) {
      evt.preventDefault()
      if (screenToggle.hasClass('isOn')) {
        stopScreen()
      } else {
        startScreen()
      }
      return false
    }

    screenToggle.on('click', toggleScreen)

    cameraToggle.on('click', toggleCamera)

    $('#chrome-ext-install').on('click', function (evt) {
      evt.preventDefault()
      installChromeExtension()
      return false
    })

    function publishScreen () {
      session.publish(publishers.screen, function (err) {
        if (err) {
          console.log(err)
          return
        }
        console.log('Published screen')
        isLive = true
        isPublished.screen = true
        joinbtn.hide().attr('disabled', 'disabled')
        exitbtn.removeAttr('disabled').show()
      })
    }

    joinbtn.on('click', function (evt) {
      evt.preventDefault()
      if (publishers.camera != null && !isPublished.camera) {
        session.publish(publishers.camera, function (err) {
          if (err) {
            console.log(err)
            return
          }
          console.log('Published camera')
          isLive = true
          isPublished.camera = true
          joinbtn.hide().attr('disabled', 'disabled')
          exitbtn.removeAttr('disabled').show()
        })
      }
      if (publishers.screen != null && !isPublished.screen) {
        publishScreen()
      }
      return false
    })

    exitbtn.on('click', function (evt) {
      evt.preventDefault()
      if (publishers.camera) {
        publishers.camera.destroy()
      }
      if (publishers.screen) {
        publishers.screen.destroy()
      }
      if (session) {
        session.disconnect()
      }
      document.location.href = document.location.origin
    })

    $('#students').on('click', '.stage-add', function (evt) {
      evt.preventDefault()
      var streamId = evt.target.dataset.streamid
      var stream = students[streamId]
      console.log('Adding to stage', stream)
      if (stream) {
        session.signal({
          type: 'stageAdd',
          data: streamId
        }, function (err) {
          if (err) {
            console.log(err)
            return
          }
          stream.subscribeToVideo(false)
          $('#students-on-stage').append('<div id="stage-' + streamId + '" class="stream stage-stream"> ' +
            '<div class="action-buttons">' +
              '<button class="btn btn-secondary stage-remove" ' +
                'data-streamid="' + streamId + '">Remove from stage</button>' +
              '</div>' +
            '</div>')
          $('#stage-' + streamId).append(stream.element)
          $('#stream-' + streamId).hide()
          stream.subscribeToAudio(true)
          stream.subscribeToVideo(true)
          stage[streamId] = stream
        })
      }
      return false
    })

    $('#students-on-stage').on('click', '.stage-remove', function (evt) {
      evt.preventDefault()
      var streamId = evt.target.dataset.streamid
      var stream = stage[streamId]
      console.log('Removing from stage', stream)
      if (stream) {
        session.signal({
          type: 'stageRemove',
          data: streamId
        }, function (err) {
          if (err) {
            console.log(err)
            return
          }
          stream.subscribeToVideo(false)
          stream.subscribeToAudio(false)
          $('#stream-' + streamId).append(stream.element)
          $('#stream-' + streamId).show()
          stream.subscribeToAudio(false)
          stream.subscribeToVideo(true)
          $('#stage-' + streamId).remove()
          stage[streamId] = null
          delete stage[streamId]
        })
      }
      return false
    })

    function subscribe (stream, connId) {
      var innerhtml = '<div id="stream-' + stream.id + '" class="stream col-3 type-' + stream.videoType + '">' +
        '<div class="action-buttons">' +
          '<button type="button" class="btn btn-secondary stage-add" ' +
            'data-streamid="' + stream.id + '">Add to stage</button>' +
        '</div>' +
      '</div>'
      $('#students').append(innerhtml)
      var s = session.subscribe(stream, 'stream-' + stream.id, {
        insertMode: 'append',
        width: '100%',
        height: '100%',
        style: { buttonDisplayMode: 'off' }
      }, function (err) {
        if (err) {
          alert('Error subscribing to stream')
          console.log(err)
          return
        }
        console.log('Subscribed to stream ' + stream.id + ' of connection ' + connId)
      })
      s.subscribeToVideo(true)
      s.subscribeToAudio(false)
      students[stream.id] = s
    }

    session.on('signal:onStage', function (evt) {
      Object.keys(stage).forEach(function (k) {
        session.signal({
          to: evt.from,
          type: 'stageAdd',
          data: k
        })
      })
    })

    session.on('streamDestroyed', function (event) {
      console.log('Stream destroyed', event)
      students[event.stream.id] = null
      delete students[event.stream.id]
      stage[event.stream.id] = null
      delete stage[event.stream.id]
      $('#stream-' + event.stream.id).remove()
      $('#stage-' + event.stream.id).remove()
    })

    session.on('connectionDestroyed', function (event) {
      console.log('Connection destroyed', event)
    })

    session.on('streamCreated', function (event) {
      console.log('Stream created', event)
      try {
        var data = JSON.parse(event.stream.connection.data)
        if (data.userType === 'student') {
          subscribe(event.stream, data)
        }
      } catch (e) {
        console.log('Error subscribing to stream', e)
      }
    })

    session.connect(data.token, function (error) {
      if (error) {
        alert('Error connecting to OpenTok session')
        console.log(error)
        return
      }
      console.log('Connected to session', data.sessionId)
      startCamera()
    })
  }

  $.get('/token/' + room.roomId + '/teacher', function (data) {
    OT.registerScreenSharingExtension('chrome', 'fbjkpogjjhklbffmfooofjgablhmcnhn', 2)
    checkScreenShareSupport(function () {
      launchSession(data)
    })
  }, 'json')
    .fail(function (err) {
      console.log(err)
    })
})
