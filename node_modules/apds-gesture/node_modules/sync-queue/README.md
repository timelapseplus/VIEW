#Sync-Queue

## Install
`npm install sync-queue`

## Usage

```.js
var Queue = require('sync-queue')
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
```

## Description
Use `place` to put things in the queue. They will start being executed automatically. Call `next` when you want the next thing in the queue to begin execution.
