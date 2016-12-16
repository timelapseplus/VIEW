'use strict';

var Button = require('../'),
  button4 = new Button('button4');

button4.on('press', function () {
  console.log('press');
});

button4.on('hold', function () {
  console.log('hold');
});

button4.on('release', function () {
  console.log('release');
});

