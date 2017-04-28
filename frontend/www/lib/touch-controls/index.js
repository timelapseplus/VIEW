
window.TouchControl = function(canvasId) {
  this._events = {};
  this._canvas = new fabric.Canvas(canvasId);
  this._canvas.selection = false;
  var min = Math.min(this._canvas.width, this._canvas.height);
  var max = Math.max(this._canvas.width, this._canvas.height);
  this._radius = min / 6;
  this._border = 6;
  var type;
  if(max == min) {
    type = 'xy';
    this._width = this._radius*2 - this._border;
    this._height = this._radius*2 - this._border;
    this._centerLeft = this._canvas.width/2 - this._radius + this._border;
    this._centerTop = this._canvas.height/2 - this._radius + this._border;
  } else if(this._canvas.width > this._canvas.height) {
    type = 'x';
    this._height = min * 0.8;
    this._width = max / 12;
    this._centerLeft = max/2 - this._width / 2;
    this._centerTop = min/2 - this._height / 2;
  } else if(this._canvas.width < this._canvas.height) {
    type = 'y';
    this._width = min * 0.8;
    this._height = max / 12;
    this._centerLeft = min/2 - this._width / 2;
    this._centerTop = max/2 - this._height / 2;
  }
  this._releasedColor = 'rgba(20,20,20,0.5)';
  this._pressedColor = 'rgba(85,153,238,0.5)';
  this._borderColor = 'rgba(85,153,238,1)';
  this._animationOptions = {
    duration: 300,
    onChange: this._canvas.renderAll.bind(this._canvas),
    easing: fabric.util.ease['easeOutQuart']
  }
  if(max == min) {
    this._joystick = new fabric.Circle({
      left: this._centerLeft,
      top: this._centerTop,
      originX: 'left',
      originY: 'top',
      radius: this._radius - this._border,
      angle: 0,
      fill: this._releasedColor,
      stroke: this._borderColor,
      strokeWidth: this._border,
      transparentCorners: false,
      hasControls: false,
      hasBorders: false
    });
  } else {
    console.log("setting up rect");
    this._joystick = new fabric.Rect({
      left: this._centerLeft,
      top: this._centerTop,
      originX: 'left',
      originY: 'top',
      width: this._width - this._border,
      height: this._height - this._border,
      angle: 0,
      fill: this._releasedColor,
      stroke: this._borderColor,
      strokeWidth: this._border,
      transparentCorners: false,
      hasControls: false,
      hasBorders: false,
      lockMovementX: type == 'y' ? true : false,
      lockMovementY: type == 'x' ? true : false
    });
  }

  this._xLine = new fabric.Line([0, this._canvas.height / 2, this._canvas.width, this._canvas.height / 2], {
    left: 0,
    top: this._canvas.height / 2 - this._border/4,
    fill: '#000',
    stroke: '#000',
    strokeWidth: this._border,
    strokeDashArray: [this._border/3, this._border*2],
    hasControls: false,
    hasBorders: false,
    selectable: false
  });
  this._yLine = new fabric.Line([this._canvas.width / 2, 0, this._canvas.width / 2, this._canvas.height], {
    left: this._canvas.width / 2 - this._border/4,
    top: 0,
    fill: '#000',
    stroke: '#000',
    strokeWidth: this._border,
    strokeDashArray: [this._border/3, this._border*2],
    hasControls: false,
    hasBorders: false,
    selectable: false
  });
  this._centerPoint = new fabric.Circle({
      left: this._canvas.width/2-this._border*0.75,
      top: this._canvas.height/2-this._border*0.75,
      originX: 'left',
      originY: 'top',
      radius: this._border / 2,
      angle: 0,
      fill: '#000',
      stroke: '#000',
      strokeWidth: this._border,
      transparentCorners: false,
      hasControls: false,
      hasBorders: false,
      selectable: false
  });
  
  if(type == 'xy' || type == 'x') this._canvas.add(this._xLine);
  if(type == 'xy' || type == 'y') this._canvas.add(this._yLine);
  this._canvas.add(this._centerPoint);
  this._canvas.add(this._joystick);
  
  var self = this;
  this._canvas.on('mouse:down', function(object){
    if(!object.target) return;
    object.target.setFill(self._pressedColor);
    self._canvas.renderAll();
    if(self._events.start) self._events.start();
    return false;
  });
  this._canvas.on('mouse:up', function(object){
    if(!object.target) return;
    object.target.setFill(self._releasedColor);
    self._canvas.renderAll();
    self._joystick.animate('left', self._centerLeft, self._animationOptions);
    self._joystick.animate('top', self._centerTop, self._animationOptions);
    if(self._events.pos) self._events.pos(0, 0);
    if(self._events.stop) self._events.stop();
  });
  this._canvas.on('object:moving', function(object){
    var left = (object.target.left - self._centerLeft + self._border) / ((self._canvas.width-self._border)/2 - self._width/2);
    var top = (object.target.top - self._centerTop + self._border) / ((self._canvas.height-self._border)/2 - self._height/2);
    if(left >= 1) {
      object.target.setLeft(self._canvas.width/2 - self._width/2 + self._centerLeft - self._border);
      left = 1;
    }
    if(left <= -1) {
      object.target.setLeft(-(self._canvas.width/2 - self._width/2 - self._centerLeft));
      left = -1;
    }
    if(top >= 1) {
      object.target.setTop(self._canvas.height/2 - self._height/2 + self._centerTop - self._border);
      top = 1;
    }
    if(top <=-1) {
      object.target.setTop(-(self._canvas.height/2 - self._height/2 - self._centerTop));
      top = -1;
    }
    if(self._events.pos) self._events.pos(left, top);
    //console.log(left, top);
    return false;
  });

  return this;
}

window.TouchControl.prototype.delete = function() {
  this._canvas.dispose();
}

window.TouchControl.prototype.on = function(evt, func) {
  this._events[evt] = func;
}

