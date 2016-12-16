'use strict';

var Button = require('../'),
  button4 = new Button('button4'),
  lastPressed = button4.pressed(),
  lastHeld = button4.held(),
  lastReleased = button4.released();

setInterval(function () {
  if (lastPressed !== button4.pressed() ||
      lastHeld !== button4.held() ||
      lastReleased !== button4.released()) {

    lastPressed = button4.pressed();
    lastHeld = button4.held();
    lastReleased = button4.released();

    console.log('pressed: ' + lastPressed + ', ' +
      'held: ' + lastHeld + ', ' +
      'released: ' + lastReleased + ', '
    );
  }
}, 1);

