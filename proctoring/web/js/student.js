/* global OT, chrome */

window.addEventListener('load', function studentController () {
  var session
  var publisherCamera
  var publisherScreen
  var id = window.location.hash.slice(1)

  function _msg (m) {
    $('#message').text(m)
  }

  function toggleSourceControl (value) {
    if (value === 'camera') {
      $('#select-camera').show()
      $('#camera-view').show()
      $('#select-screen').hide()
      $('#screen-view').hide()
    } else if (value === 'screen') {
      $('#select-camera').hide()
      $('#camera-view').hide()
      $('#select-screen').show()
      $('#screen-view').show()
    }
  }

  toggleSourceControl($('input[type=radio][name=videoType]').val())

  $('input[type=radio][name=videoType]').change(function () {
    toggleSourceControl(this.value)
  })

  function installChromeExtension () {
    var extUrl = 'https://chrome.google.com/webstore/detail/fbjkpogjjhklbffmfooofjgablhmcnhn'
    if (chrome && chrome.webstore) {
      chrome.webstore.install(extUrl, function () {
        $('#chrome-ext-install').hide()
        $('#share-screen').removeClass('invisible')
        _msg('Chrome screenshare extension installed')
      }, function (err) {
        console.log(err)
        _msg('Please install the screen sharing extension and refresh the page.')
      })
    }
  }

  function checkScreenShareSupport (callback) {
    OT.checkScreenSharingCapability(function (res) {
      var screenshareEnabled = false
      if (!res.supported || res.extensionRegistered === false) {
        _msg('Screensharing is not supported')
      } else if (res.extensionRequired === 'chrome' && res.extensionInstalled === false) {
        console.log('Chrome Screenshare required')
        $('#chrome-ext-install').show()
      } else {
        console.log('Screenshare available')
        $('#chrome-ext-install').hide()
        $('#share-screen').removeClass('invisible')
        screenshareEnabled = true
      }
      // Trigger callback
      callback(screenshareEnabled, res)
    })
  }

  var createPublisherScreenshare = function () {
    var opts = {
      audioSource: null,
      insertMode: 'append',
      publishAudio: false,
      videoSource: 'screen',
      width: '100%',
      height: '100%',
      name: $('#camera-name').val()
    }

    _msg('Setting up screenshare...')

    publisherScreen = OT.initPublisher('screen-view', opts, function (err) {
      if (err) {
        console.log(err)
        _msg('Error getting access to screen share.')
        return
      }
      _msg('Screen sharing started.')
      $('#share-screen').attr('disabled', 'disabled').hide()
      $('#publish').removeAttr('disabled').show()
    })
    $('input[type=radio][name=videoType]').attr('disabled', 'disabled')

    publisherScreen.on('mediaStopped', function () {
      _msg('Screen sharing stopped')
    })
  }

  $('#share-screen').on('click', createPublisherScreenshare)

  $('#chrome-ext-install').on('click', function (evt) {
    installChromeExtension()
  })

  function launchSession (data) {
    session = OT.initSession(data.apiKey, data.sessionId)

    session.on('streamCreated', function (event) {
      console.log('streamCreated', event)
      if (event.stream.connection.data === id) {
        session.subscribe(event.stream, 'other-sources', {
          insertMode: 'append',
          width: '200px',
          height: '150px'
        })
      }
    })

    session.connect(data.token, function (error) {
      if (error) {
        _msg('Error connecting to OpenTok session')
        _msg('Error')
        console.log(error)
        return
      }
      console.log('Connected to session', data.sessionId)
      _msg('Connected to OpenTok')
      $('.start-camera').removeAttr('disabled')

      $('#start-camera').on('click', function (evt) {
        publisherCamera = OT.initPublisher('camera-view', {
          audioSource: null,
          videoSource: $('#camera-list').val(),
          height: '100%',
          width: '100%',
          insertMode: 'append',
          name: $('#camera-name').val()
        }, function (err) {
          if (err) {
            _msg('Error getting feed for camera 1')
            console.log(err)
            return
          }
          $('input[type=radio][name=videoType]').attr('disabled', 'disabled')
          $('#publish').removeAttr('disabled').show()
          $('.camera').attr('disabled', 'disabled')
          $('#start-camera').hide()
        })
      })

      $('#publish').on('click', function (evt) {
        if (publisherCamera != null) {
          session.publish(publisherCamera, function (err) {
            if (err) {
              _msg('Unable to publish camera 1')
              console.log(err)
              return
            }
            $('#publish').attr('disabled', 'disabled').hide()
            console.log('Published camera')
            _msg('Live')
          })
        }
        if (publisherScreen != null) {
          session.publish(publisherScreen, function (err) {
            if (err) {
              _msg('Unable to publish screen')
              console.log(err)
              return
            }
            $('#publish').attr('disabled', 'disabled').hide()
            console.log('Published camera')
            _msg('Live')
          })
        }
      })
    })
  }

  OT.getDevices(function (err, devices) {
    if (err) {
      _msg('Error getting list of media devices')
      console.log(err)
      return
    }
    console.log('MediaDevices', devices)
    if (devices.length < 1) {
      _msg('No media devices available')
      console.error('No media devices available')
      return
    }

    var videoDevices = devices.filter(function (d) {
      return d.kind === 'videoInput'
    }).map(function (d, i) {
      var deviceLabel = d.label.replace(/_/g, ' ').split(' (')[0] || 'Camera ' + (i + 1)
      return '<option value="' + d.deviceId + '">' + deviceLabel + '</option>'
    })

    $('#camera-list').append(videoDevices.join(''))

    $.get('/token?id=' + id, function (data) {
      console.log('Token data', data)
      window.location.hash = data.id
      $('#share-url').val(window.location.href)
      $('.navbar-brand').attr('href', window.location.href)
      OT.registerScreenSharingExtension('chrome', 'fbjkpogjjhklbffmfooofjgablhmcnhn', 2)
      checkScreenShareSupport(function () {
        launchSession(data)
      })
    }, 'json')
      .fail(function (err) {
        _msg('Error getting token')
        console.log(err)
      })
  })
})
