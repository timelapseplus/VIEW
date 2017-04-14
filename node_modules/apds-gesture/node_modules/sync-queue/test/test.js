var Queue = require('../');
var queue = new Queue();

queue.place(function one() {
  console.log("I'm func one");

  setTimeout(function() {
    console.log("and I'm still finishing up...");
    queue.next();
  }, 1000);
})

queue.place(function two() {
  console.log("I'm the last func.");
  queue.next();
});

console.log('placed both...');