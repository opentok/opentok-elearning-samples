/* global OT, room */

window.addEventListener('load', function studentController () {
  var session
  var publisher
  var streamCount = 0
  var subscribersDiv = $('#subscribers')
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
    session = OT.initSession(data.apiKey, data.breakoutSessionId)

    session.on('streamCreated', function (evt) {
      subscribersDiv.removeClass('streams-' + streamCount)
      streamCount++
      subscribersDiv.addClass('streams-' + streamCount)
      var c = document.createElement('div')
      c.className = 'stream'
      c.id = 'stream-' + evt.stream.id
      subscribersDiv.append(c)
      session.subscribe(evt.stream, 'stream-' + evt.stream.id, {
        insertMode: 'append',
        width: '100%',
        height: '100%'
      })
    })

    session.on('streamDestroyed', function (evt) {
      subscribersDiv.removeClass('streams-' + streamCount)
      $('#stream-' + evt.stream.id).remove()
      streamCount--
      subscribersDiv.addClass('streams-' + streamCount)
    })

    session.connect(data.token, function (err) {
      if (err) {
        console.log(err)
        return
      }
      publisher = OT.initPublisher('self-view', {
        insertMode: 'append',
        width: '100%',
        height: '100%',
        resolution: '640x480',
        name: $('#user-name').val()
      }, function (err) {
        if (err) {
          console.log('Error creating publisher', err)
          return
        }
        $('#controls').show()
        session.publish(publisher, function (err) {
          if (err) {
            console.log('Error publishing to session', err)
          }
          startTimer()
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
      $.get('/token/' + room.roomId + '/breakout?name=' + $('#user-name').val(), function (data) {
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
