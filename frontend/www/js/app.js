// Ionic Starter App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
// 'starter.services' is found in services.js
// 'starter.controllers' is found in controllers.js
angular.module('app', ['ionic', 'ngWebSocket', 'LocalStorageModule'])

.run(function($ionicPlatform) {
    $ionicPlatform.ready(function() {
        // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
        // for form inputs)
        if (window.cordova && window.cordova.plugins.Keyboard) {
            cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
        }
        if (window.StatusBar) {
            // org.apache.cordova.statusbar required
            StatusBar.styleDefault();
        }
    });
})

.config(function($stateProvider, $urlRouterProvider) {

    // Ionic uses AngularUI Router which uses the concept of states
    // Learn more here: https://github.com/angular-ui/ui-router
    // Set up the various states which the app can be in.
    // Each state's controller can be found in controllers.js
    $stateProvider

        .state('app', {
        url: "/app",
        abstract: true,
        templateUrl: "templates/menu.html",
        controller: 'AppCtrl'
    })

    .state('app.capture', {
        url: "/capture",
        views: {
            'menuContent': {
                templateUrl: "templates/capture.html"
            }
        }
    })

    .state('app.timelapse', {
        url: "/timelapse",
        views: {
            'menuContent': {
                templateUrl: "templates/timelapse.html"
            }
        }
    })

    .state('app.view', {
        url: "/view",
        views: {
            'menuContent': {
                templateUrl: "templates/view.html"
            }
        }
    })

    // if none of the above states are matched, use this as the fallback

    $urlRouterProvider.otherwise('/app/capture');


})

.controller('AppCtrl', ['$scope', '$timeout', '$http', '$websocket', '$location', '$ionicPopup', '$ionicActionSheet', '$interval', '$ionicModal', '$state', 'localStorageService', function($scope, $timeout, $http, $websocket, $location, $ionicPopup, $ionicActionSheet, $interval, $ionicModal, $state, localStorageService) {
    console.log("AppCtrl");

    $scope.moment = moment;

    $scope.sid = localStorageService.get('sid');
    console.log("current sid: ", $scope.sid);

    $scope.secondsDescription = function(seconds, index) {
        var hours = Math.floor(seconds / 3600);
        seconds -= (hours * 3600);
        var minutes = Math.floor(seconds / 60);
        seconds -= (minutes * 60);
        var seconds = Math.round(seconds);

        var time = "";

        if (hours > 0) time += hours + 'h ';
        if (minutes > 0) time += minutes + 'm ';
        if (hours == 0 && minutes < 10) time += seconds + 's ';

        if (index > 1) {
            time += "from last keyframe";
        } else {
            time += "from start";
        }

        return time;
    }

    $scope.$on('$stateChangeSuccess', function(event, toState, toParams, fromState, fromParams) {
        console.log("new state:", toState);
        if (toState.name == "app.view") {
            $scope.getClips();
        }
    });

    function updateCache() {
        console.log("updating cache");
        window.applicationCache.swapCache();
        window.location.reload();
    }

    var confirmReload = function() {
        var confirmPopup = $ionicPopup.show({
            title: 'Update Available',
            template: 'Reload app with new version?',
            buttons: [{
                text: 'Next Launch'
            }, {
                text: '<b>Update Now</b>',
                type: 'button-positive',
                onTap: function(e) {
                    return true;
                }
            }]
        });
        confirmPopup.then(function(res) {
            console.log(res);
            if (res) {
                updateCache();
            } else {
                console.log('Next Launch');
            }
        });
    };

    $scope.confirmStop = function() {
        var confirmPopup = $ionicPopup.show({
            title: 'Confirm',
            template: 'Stop Time-lapse?',
            buttons: [{
                text: 'Cancel'
            }, {
                text: '<b>Stop</b>',
                type: 'button-alert',
                onTap: function(e) {
                    return true;
                }
            }]
        });
        confirmPopup.then(function(res) {
            console.log(res);
            if (res) {
                $scope.stopProgram();
            }
        });
    };

    $scope.popupMessage = function(title, message) {
        var confirmPopup = $ionicPopup.show({
            title: title,
            template: message,
            buttons: [{
                text: 'Close'
            }]
        });
    };

    // Triggered on a button click, or some other target
    $scope.showAddDevice = function() {
      $scope.data = {};

      // An elaborate, custom popup
      var addDevicePopup = $ionicPopup.show({
        template: '<input type="number" ng-model="data.code">',
        title: 'Enter code shown on VIEW device',
        subTitle: "if a code isn't shown, make sure the VIEW is connected via WiFi",
        scope: $scope,
        buttons: [
          { text: 'Cancel' },
          {
            text: '<b>Add</b>',
            type: 'button-positive',
            onTap: function(e) {
              if (!$scope.data.code) {
                //don't allow the user to close unless he enters wifi password
                e.preventDefault();
              } else {
                $scope.addDevice($scope.data.code);
                return $scope.data.code;
              }
            }
          }
        ]
      });

      addDevicePopup.then(function(res) {
        console.log('Tapped!', res);
      });

      $timeout(function() {
         addDevicePopup.close(); //close the popup after 3 seconds for some reason
      }, 60000);
     };

    $scope.confirmDelete = function(clip) {
        var confirmPopup = $ionicPopup.show({
            title: 'Confirm',
            template: 'Delete Preview for ' + clip.name + '?',
            buttons: [{
                text: 'Cancel'
            }, {
                text: '<b>Delete</b>',
                type: 'button-alert',
                onTap: function(e) {
                    return true;
                }
            }]
        });
        confirmPopup.then(function(res) {
            console.log(res);
            if (res) {
                sendMessage('delete-clip', {
                    index: clip.index
                });
            }
        });
    };

    window.applicationCache.addEventListener('updateready', confirmReload, false);

    $scope.loginState = "";
    $scope.loginBusy = false;

    $scope.evSetFromApp = false;
    $scope.connected = 0;
    $scope.camera = {
        connected: false
    };

    $scope.timelapse = {
        destination: 'camera',
        mode: 'daytime',
        interval: 6,
        frames: 500,
        nightInterval: 50,
        dayInterval: 10,
        nightCompensation: '-1',
        sunriseCompensation: '-0.66',
        sunsetCompensation: '0',
        keyframes: [{
            focus: 0,
            motor1: 0,
            motor2: 0,
            motor3: 0,
            ev: "not set"
        }]
    };
    $scope.setup = {
        state: 0
    };
    $scope.nmx = {
        connected: false
    };

    $scope.presets = [{
        selected: true,
        name: "Daytime Time-lapse",
        key: "daytime",
        show: ['interval', 'frames'],
        defaults: [{
            key: 'interval',
            value: 3
        }, {
            key: 'frames',
            value: 300
        }]
    }, {
        selected: false,
        name: "Night Time-lapse",
        key: "night",
        show: ['interval', 'frames'],
        defaults: [{
            key: 'interval',
            value: 30
        }, {
            key: 'frames',
            value: 300
        }]
    }, {
        selected: false,
        name: "HDR Time-lapse",
        key: "hdr",
        show: ['interval', 'frames', 'sets', 'bracket'],
        defaults: [{
            key: 'interval',
            value: 15
        }, {
            key: 'frames',
            value: 300
        }, {
            key: 'sets',
            value: 3
        }, {
            key: 'bracket',
            value: 1
        }]
    }, {
        selected: false,
        name: "Sunset Bulb-ramp",
        key: "sunset",
        show: ['duration'],
        defaults: [{
            key: 'duration',
            value: 4 * 60
        }]
    }, {
        selected: false,
        name: "Sunrise Bulb-ramp",
        key: "sunrise",
        show: ['duration'],
        defaults: [{
            key: 'duration',
            value: 4 * 60
        }]
    }, {
        selected: false,
        name: "24-hour+ Bulb-ramp",
        key: "24-hour",
        show: ['duration'],
        defaults: [{
            key: 'duration',
            value: 24 * 60
        }]
    }, {
        selected: false,
        name: "Expert Mode: All Features",
        key: "expert",
        show: [],
        defaults: []
    }];

    $scope.previewActive = false;

    var ws;
    var connecting;
    var timelapseImages = {};
    $scope.view = {
        connected: false
    };

    function connect(wsAddress) {
        if (ws || connecting) {
            return;
        } else if (!wsAddress) {
            console.log("-> Looking up websocket address...");
            $http.get('/socket/address', {headers: {'x-view-session': $scope.sid}}).success(function(data) {
                console.log(data);
                if (data && data.address) {
                    connect(data.address);
                } else if(data && data.action == 'login_required') {
                    $scope.openLogin();
                } else {
                    connecting = false;
                }
            }).error(function(err) {
                connecting = false;
            });
            return;
        }

        console.log("Connecting to websocket: " + wsAddress);

        ws = $websocket(wsAddress);
        connecting = false;
        ws.onMessage(function(message) {
            var msg = JSON.parse(message.data);
            console.log("message received: ", msg);

            var callback = function() {};
            if (message._cbId) {
                for (var i = 0; i < callbackList.length; i++) {
                    if (callbackList[i]._cbId == message._cbId) {
                        callback = callbackList[i].callback;
                        callbackList.splice(i, 1);
                        break;
                    }
                }
            }

            switch (msg.type) {
                case 'nodevice':
                    $scope.camera = {};
                    $scope.lastImage = null;
                    $scope.camera.model = '';
                    $scope.camera.connected = false;
                    $scope.view.connected = false;
                    $scope.status = "No VIEW device available. Check that the VIEW is powered on and connected via Wifi";
                    callback($scope.status, null);
                    break;
                case 'camera':
                    $scope.view.connected = true;
                    $scope.camera = {};
                    $scope.lastImage = null;
                    $scope.camera.model = msg.model;
                    $scope.camera.connected = msg.connected;
                    callback(null, $scope.camera);
                    if (msg.connected) {
                        $scope.status = '';
                        setTimeout(function() {
                            sendMessage('get', {
                                key: 'settings'
                            });
                        }, 1000);
                    } else {
                        $scope.status = 'Connect a camera to the VIEW via USB';
                        callback("no camera", null);
                    }
                    break;
                case 'nmx':
                    $scope.nmx = msg.status;
                    callback(null, $scope.nmx);
                case 'move':
                    if (msg.complete) {
                        if(msg.motor == 1)  $scope.moving1 = false;   
                        if(msg.motor == 2)  $scope.moving2 = false;   
                        if(msg.motor == 3)  $scope.moving3 = false;   
                    }
                    callback(null, msg.complete);
                case 'settings':
                    if (!$scope.camera.connected) break;
                    $scope.camera.config = msg.settings;
                    if (msg.settings) {
                        if (msg.settings.lists) $scope.camera.lists = msg.settings.lists;
                        if (msg.settings.shutter) $scope.camera.shutter = msg.settings.shutter;
                        if (msg.settings.iso) $scope.camera.iso = msg.settings.iso;
                        if (msg.settings.aperture) $scope.camera.aperture = msg.settings.aperture;
                        if (msg.settings.stats) {
                            $scope.camera.evMax3 = msg.settings.stats.maxEv * 3;
                            $scope.camera.evMin3 = msg.settings.stats.minEv * 3;
                            $scope.camera.ev = msg.settings.stats.ev;
                            if ($scope.evSetFromApp === false) {
                                $scope.camera.ev3 = $scope.camera.ev * 3;
                            } else if ($scope.evSetFromApp === $scope.camera.ev * 3) {
                                $scope.evSetFromApp = false;
                            }
                        }
                    }
                    callback(null, $scope.camera);
                    break;
                case 'thumbnail':
                    if ($scope.previewActive) sendMessage('preview');
                    $scope.lastImage = msg;
                    callback(null, msg);
                    break;
                case 'status':
                    $scope.status = msg.status ? msg.status : '';
                    callback(null, $scope.status);
                    break;
                case 'intervalometerStatus':
                    $scope.intervalometerStatus = msg.status ? msg.status : {};
                    callback(null, $scope.intervalometerStatus);
                    break;
                case 'timelapse-clips':
                    $scope.clips = msg.clips ? msg.clips : [];
                    callback(null, $scope.clips);
                    break;
                case 'timelapse-images':
                    timelapseImages[msg.index] = msg.images;
                    callback(null, msg);
                    playTimelapse(msg.index);
                    break;
                case 'xmp-to-card':
                    if (msg.error) {
                        $scope.popupMessage("Error", "Failed to save XMPs for TL-" + msg.index + ": " + msg.error);
                        callback(msg.error, msg);
                    } else {
                        $scope.popupMessage("Success", "Saved XMPs for TL-" + msg.index + ". It's safe to remove the SD card now");
                        callback(null, msg);
                    }
                    break;
                default:
                    {
                        if (msg.error) {
                            callback(msg.error, msg);
                        } else {
                            callback(null, msg);
                        }
                    }
            }

        });

        ws.onOpen(function() {
            $scope.connected = 1;
            $scope.view.connected = false;
            $scope.status = '';
            setTimeout(function() {
                sendMessage('auth', {
                    session: $scope.sid
                });
                sendMessage('get', {
                    key: 'camera'
                });
                sendMessage('get', {
                    key: 'nmx'
                });
                setTimeout(function() {
                    if ($state.current.name == "app.view") {
                        $timeout(function() {
                            $scope.getClips();
                        });
                    }
                }, 1000);
                //sendMessage('auth', {
                //    pass: $scope.passwd
                //});
            });
        });

        ws.onClose(function() {
            $scope.camera = {};
            $scope.lastImage = null;
            $scope.camera.model = '';
            $scope.camera.connected = false;
            $scope.view.connected = false;
            $scope.status = "Lost connection to view.tl";
            $scope.connected = -1;
            $timeout(connect, 3000);
            ws = null;
        })

        ws.onError(function(err) {
            console.log("ws error: ", err);
        });
    }
    connect();

    $scope.reconnect = function() {
        connect();
    }

    var callbackList = [];

    function sendMessage(type, object, callback) {
        if (!object) object = {};
        object.type = type;
        if (ws) {
            if (callback) {
                if (callbackList.length > 0) { // manage callback buffer and generate next id
                    var maxId = 1;
                    removeItems = [];
                    for (var i = 0; i < callbackList.length; i++) {
                        cbItem = callbackList[i];
                        if (cbItem.id > maxId) maxId = cbItem.id;
                        if (moment(cbItem.time).isBefore(moment().subtract(15, 'minutes'))) {
                            removeItems.push(i);
                        }
                    }
                    for (var i = 0; i < removeItems.length; i++) {
                        callbackList.splice(i, 1);
                    }
                }
                var cbId = maxId + 1;
                callbackList.push({
                    id: cbId,
                    time: new Date(),
                    callback: callback
                });
                object._cbId = cbId;
            }
            ws.send(JSON.stringify(object));
        } else {
            if (callback) callback("not connected", null);
        }
    }

    setInterval(function() {
        $scope.$apply(function() {
            sendMessage('ping');
        });
    }, 2000);

    $scope.update = function() {
        console.log("Update");
        sendMessage('get', {
            key: 'settings'
        });
    }

    $scope.capture = function() {
        $scope.previewActive = false;
        console.log("Capture");
        sendMessage('capture');
    }

    $scope.getClips = function() {
        sendMessage('timelapse-clips');
    }

    function playTimelapse(index) {
        var tl = null;
        for (i = 0; i < $scope.clips.length; i++) {
            if ($scope.clips[i].index == index) {
                tl = $scope.clips[i];
                break;
            }

        }
        if (tl) {
            tl.playing = true;
            tl.loading = false;
            var frame = 0;
            var intervalHandle = $interval(function() {
                frame++;
                if (frame < tl.frames) {
                    tl.image = timelapseImages[index][frame];
                } else {
                    $interval.cancel(intervalHandle);
                    tl.playing = false;
                }
            }, 1000 / 24);
        }
    }

    $scope.playTimelapse = function(index) {
        if (timelapseImages[index]) {
            playTimelapse(index);
        } else {
            var tl = null;
            for (i = 0; i < $scope.clips.length; i++) {
                if ($scope.clips[i].index == index) {
                    tl = $scope.clips[i];
                    break;
                }

            }
            if (tl && !tl.loading) {
                tl.loading = true;
                console.log("fetching timelapse-images for " + index);
                sendMessage('timelapse-images', {
                    index: index
                });
            }
        }
    }

    $scope.preview = function(status) {
        if (status != null) $scope.previewActive = !status;
        if ($scope.previewActive) {
            $scope.previewActive = false;
        } else {
            $scope.previewActive = true;
            console.log("Preview");
            sendMessage('preview');
        }
    }

    $scope.captureDelay = function(seconds) {
        if (!seconds) seconds = 2;
        $timeout($scope.capture, seconds * 1000);
    }

    $scope.focusMode = false;
    $scope.zoom = function(event) {
        if ($scope.previewActive) {
            $scope.focusMode = !$scope.focusMode;

            var pos = {
                reset: true,
            }
            if ($scope.focusMode && event) {
                var xp = event.offsetX / event.toElement.clientWidth;
                var yp = event.offsetY / event.toElement.clientHeight;

                var pos = {
                    xPercent: xp,
                    yPercent: yp
                }
            }
            sendMessage('zoom', pos);
        }
    }

    $scope.updateParam = function(name) {
        var val;
        if (name == "iso") {
            val = $scope.camera.iso;
        } else if (name == "shutter") {
            val = $scope.camera.shutter;
        } else if (name == "aperture") {
            val = $scope.camera.aperture;
        } else {
            return;
        }

        console.log("Updating " + name + " to " + val);

        sendMessage('set', {
            key: name,
            val: val
        });
    }

    $scope.motor1Pos = 0;
    $scope.motor2Pos = 0;
    $scope.motor3Pos = 0;
    $scope.moveDegrees = 5;
    $scope.move = function(motorId, steps) {
        if (steps) {
            console.log("moving motor" + motorId, steps);
            if(motorId == 1) {
                $scope.moving1 = true;
                $scope.motor1Pos -= steps;
            }
            if(motorId == 2) {
                $scope.moving2 = true;
                $scope.motor2Pos -= steps;
            }
            if(motorId == 3) {
                $scope.moving3 = true;
                $scope.motor3Pos -= steps;
            }
            sendMessage('nmx', {
                key: 'move',
                val: steps,
                motor: motorId
            });
        }
    }

    $scope.focusPos = 0;
    $scope.focus = function(dir, repeat) {
        if (!repeat) repeat = 1;
        if (dir > 0) $scope.focusPos += repeat;
        if (dir < 0) $scope.focusPos -= repeat;
        sendMessage('focus', {
            key: 'manual',
            val: dir,
            repeat: repeat
        });
    }

    $scope.moveType = ['M1', 'M2', 'M3'];
    $scope.moveSteps = [1000, 1000, 1000];
    $scope.moveStepsName = '1000 steps';

    $scope.setupMoveSteps = function(axis) {
        var buttons;
        if($scope.moveType[axis - 1] == 'Pan' || $scope.moveType[axis - 1] == 'Tilt' ) {
            buttons = [{
                text: '1&deg;'
            }, {
                text: '5&deg;'
            }, {
                text: '10&deg;'
            }, {
                text: '15&deg;'
            }]
        } else {
            buttons = [{
                text: '250 steps'
            }, {
                text: '500 steps'
            }, {
                text: '1000 steps'
            }, {
                text: '2500 steps'
            }]
        }
        $ionicActionSheet.show({
            buttons: buttons,
            titleText: 'axis ' + axis + 'move increments',
            buttonClicked: function(index) {
                $scope.moveStepsName = buttons[index].text;
                if($scope.moveType[axis - 1] == 'Pan' || $scope.moveType[axis - 1] == 'Tilt' ) {
                    if (index == 0) $scope.moveSteps[axis - 1] = 1 * 560;
                    if (index == 1) $scope.moveSteps[axis - 1] = 5 * 560;
                    if (index == 2) $scope.moveSteps[axis - 1] = 10 * 560;
                    if (index == 3) $scope.moveSteps[axis - 1] = 15 * 560;
                    return true;
                } else {
                    if (index == 0) $scope.moveSteps[axis - 1] = 250;
                    if (index == 1) $scope.moveSteps[axis - 1] = 500;
                    if (index == 2) $scope.moveSteps[axis - 1] = 1000;
                    if (index == 3) $scope.moveSteps[axis - 1] = 2500;
                    return true;
                }
            }
        });
    }

    $scope.setupMoveType = function(axis) {
        $ionicActionSheet.show({
            buttons: [{
                text: 'Pan'
            }, {
                text: 'Tilt'
            }, {
                text: 'Slide'
            }, {
                text: 'M' + axis
            }],
            titleText: 'Axis ' + axis + ' Function',
            buttonClicked: function(index) {
                if (index == 0) $scope.moveType[axis - 1] = "Pan";
                if (index == 1) $scope.moveType[axis - 1] = "Tilt";
                if (index == 2) $scope.moveType[axis - 1] = "Slide";
                if (index == 3) $scope.moveType[axis - 1] = "M" + axis;
                return true;
            }
        });
    }

    $scope.testBulb = function() {
        sendMessage('test');
    }

    var setEvTimerHandle = null;
    $scope.setEv = function(ev) {
        if (setEvTimerHandle) $timeout.cancel(setEvTimerHandle);
        $scope.evSetFromApp = ev;
        setEvTimerHandle = $timeout(function() {
            console.log("setting ev to ", ev);
            sendMessage('setEv', {
                ev: ev
            });
        }, 300);
    }
    $scope.incEv = function() {
        if ($scope.camera.ev3 < $scope.camera.evMax3) {
            $scope.camera.ev3++;
            $scope.setEv($scope.camera.ev3 / 3);
        }
    }
    $scope.decEv = function() {
        if ($scope.camera.ev3 > $scope.camera.evMin3) {
            $scope.camera.ev3--;
            $scope.setEv($scope.camera.ev3 / 3);
        }
    }

    $scope.incSecondsRange = function(kf) {
        if ($scope.secondsRange.val < TIMING_SLIDER_RANGE) $scope.secondsRange.val++;
        $scope.updateSeconds(kf, $scope.secondsRange.val);
    }
    $scope.decSecondsRange = function(kf) {
        if ($scope.secondsRange.val > 0) $scope.secondsRange.val--;
        $scope.updateSeconds(kf, $scope.secondsRange.val);
    }
    $scope.updateSeconds = function(kf, val) {
        kf.seconds = MAX_KF_SECONDS * Math.pow((val / TIMING_SLIDER_RANGE), (1 / TIMING_CURVE));
        $scope.secondsRange.val = val;
    }

    $scope.setState = function(state) {
        $scope.setup.state = state;
    }
    $scope.setupTimelapse = function(preset) {
        if (preset.selected) {
            $scope.timelapse.mode = preset.key;
        }
        //$scope.setState(1);
    }

    $scope.mode = 'exposure';
    $scope.setMode = function(mode) {
        if (mode != 'focus' && $scope.focusMode) {
            $scope.zoom();
        }
        $scope.mode = mode;
    }

    $scope.runProgram = function(program) {
        program.focusPos = $scope.focusPos;
        program.motor1Pos = $scope.motor1Pos;
        program.motor2Pos = $scope.motor2Pos;
        program.motor3Pos = $scope.motor3Pos;

        if (program.exposureRamping) {
            program.rampMode = 'auto';
            if (program.variableInterval) program.intervalMode = 'auto';
            else program.intervalMode = 'fixed';
        } else {
            program.rampMode = 'fixed';
            program.intervalMode = 'fixed';
        }
        sendMessage('run', {
            program: program
        });
    }

    $scope.stopProgram = function() {
        sendMessage('stop');
    }

    $ionicModal.fromTemplateUrl('templates/modal-exposure.html', {
        scope: $scope,
        animation: 'slide-in-up'
    }).then(function(modal) {
        $scope.modalExposure = modal;
    });
    $scope.currentKf = null;
    $scope.currentKfIndex = null;
    $scope.secondsRange = {
        val: 0
    };
    var MAX_KF_SECONDS = 3600 * 15;
    var TIMING_SLIDER_RANGE = 100;
    var TIMING_CURVE = 1 / 2.5;
    $scope.timingSliderMax = TIMING_SLIDER_RANGE;
    $scope.openExposure = function(kf, index) {
        $scope.currentKf = kf;
        $scope.currentKfIndex = index;
        if (kf) {
            $scope.secondsRange.val = TIMING_SLIDER_RANGE * Math.pow((kf.seconds / MAX_KF_SECONDS), TIMING_CURVE);
            $scope.ev3 = kf.ev * 3;
            if (kf.ev !== null) $scope.setEv(kf.ev);
            if (kf.focus !== null) {
                var focusDiff = kf.focus - $scope.focusPos;
                var dir = focusDiff < 0 ? -1 : 1;
                var repeat = Math.abs(focusDiff);
                if (repeat > 0) $scope.focus(dir, repeat);
            }
            if (kf.motor1 !== null) {
                var motor1Diff = kf.motor1 - $scope.motor1Pos;
                $scope.move(1, 0 - motor1Diff);
            }
            if (kf.motor2 !== null) {
                var motor2Diff = kf.motor2 - $scope.motor2Pos;
                $scope.move(2, 0 - motor2Diff);
            }
            if (kf.motor3 !== null) {
                var motor3Diff = kf.motor3 - $scope.motor3Pos;
                $scope.move(3, 0 - motor3Diff);
            }
        }
        $scope.preview(true);
        $scope.modalExposure.show();
    };
    $scope.closeExposure = function() {
        var delay = 0;
        if ($scope.focusMode) {
            $scope.zoom();
            delay = 1000;
        }
        $timeout(function() {
            $scope.preview(false);
            if ($scope.currentKf) {
                $scope.currentKf.jpeg = $scope.lastImage.jpeg;
            }
        }, delay);
        if ($scope.currentKfIndex == 0) {
            for (var i = 1; i < $scope.timelapse.keyframes.length; i++) {
                $scope.timelapse.keyframes[i].focus -= $scope.focusPos;
                $scope.timelapse.keyframes[i].motor1 -= $scope.motor1Pos;
                $scope.timelapse.keyframes[i].motor2 -= $scope.motor2Pos;
                $scope.timelapse.keyframes[i].motor3 -= $scope.motor3Pos;
            }
            $scope.focusPos = 0;
            $scope.motor1Pos = 0;
            $scope.motor2Pos = 0;
            $scope.motor3Pos = 0;
        }
        $scope.currentKf.focus = $scope.focusPos;
        $scope.currentKf.motor1 = $scope.motor1Pos;
        $scope.currentKf.motor2 = $scope.motor2Pos;
        $scope.currentKf.motor3 = $scope.motor3Pos;
        $scope.currentKf.ev = $scope.camera.ev;
        $scope.modalExposure.hide();
    };
    $scope.addKeyframe = function() {
        if (!$scope.timelapse.keyframes) $scope.timelapse.keyframes = [];
        var lastKf = $scope.timelapse.keyframes[$scope.timelapse.keyframes.length - 1];
        $scope.timelapse.keyframes.push({
            focus: lastKf.focus,
            motor1: lastKf.motor1,
            motor2: lastKf.motor2,
            motor3: lastKf.motor3,
            seconds: 600
        });
    }
    $scope.removeKeyframe = function(index) {
        $scope.timelapse.keyframes.splice(index, 1);
    }


    $ionicModal.fromTemplateUrl('templates/modal-login.html', {
        scope: $scope,
        animation: 'slide-in-up'
    }).then(function(modal) {
        $scope.modalLogin = modal;
    });
    $scope.openLogin = function() {
        if($scope.modalLogin) {
            $scope.loginState = "email";
            $scope.loginBusy = false;
            $scope.modalLogin.show();
        } else {
            $timeout($scope.openLogin, 1000);
        }
    };
    $scope.closeLogin = function() {
        $scope.modalLogin.hide();
    };

    $scope.loginCheckEmail = function(email) {
        $scope.loginBusy = true;

        $http.post('/api/email', {email: email}).success(function(data) {
            console.log(data);
            if (data && data.action) {
                var res = data.action;
                if(res == "login") {
                    $scope.loginState = 'login-password'
                }
                if(res == "register") {
                    $scope.loginState = 'register-subdomain'
                }
                if(res == "error") {
                    $scope.loginState = 'noemail'
                }
            }
            $scope.loginBusy = false;
        }).error(function(err) {
            $scope.loginBusy = false;
        });
    }

    $scope.loginCheckSubdomain = function(subdomain) {
        $scope.loginBusy = true;

        $http.post('/api/subdomain/check', {subdomain: subdomain}).success(function(data) {
            console.log(data);
            if (data && data.action) {
                var res = data.action;
                if(res == "available") {
                    $scope.loginState = 'register-password'
                } else {
                    $scope.loginState = 'register-unavailable'
                }
            }
            $scope.loginBusy = false;
        }).error(function(err) {
            $scope.loginBusy = false;
        });
    }

    $scope.loginRegister = function(email, subdomain, password) {
        $scope.loginBusy = true;

        $http.post('/api/register', {email: email, subdomain: subdomain, password:password}).success(function(data) {
            console.log(data);
            if (data && data.action) {
                var res = data.action;
                if(res == "login") {
                    $scope.closeLogin();
                } else {
                    $scope.loginState = 'register-unavailable'
                }
            }
            $scope.loginBusy = false;
        }).error(function(err) {
            $scope.loginBusy = false;
        });
    }


    $scope.login = function(email, password) {
        $scope.loginBusy = true;

        $http.post('/api/login', {email: email, password:password}).success(function(data) {
            console.log(data);
            if (data && data.action) {
                var res = data.action;
                if(res == "login") {
                    $scope.sid = data.session;
                    localStorageService.set('sid', $scope.sid);
                    $scope.closeLogin();
                    connect();
                } else {
                    $scope.loginState = 'login-failed'
                }
            }
            $scope.loginBusy = false;
        }).error(function(err) {
            $scope.loginBusy = false;
        });
    }

    $scope.addDevice = function(code) {
        $http.post('/api/device/new', {code: code}, {headers: {'x-view-session': $scope.sid}}).success(function(data) {
            console.log(data);
            if (data && data.action) {
                var res = data.action;
                if(res == "device_added") {
                    $scope.popupMessage("Successfully added VIEW device to this account");
                } else {
                    $scope.popupMessage("Failed to add VIEW device. Please try again.");
                }
            }
        }).error(function(err) {
            $scope.popupMessage("Failed to add VIEW device. Please try again.");
        });
    }

    $scope.saveToCard = function(clip) {
        sendMessage('xmp-to-card', {
            index: clip.index
        });
    }

    $scope.showClipOptions = function(clip) {

        // Show the action sheet
        var hideSheet = $ionicActionSheet.show({
            buttons: [{
                text: 'Write XMP folder to SD card'
            }],
            destructiveText: 'Delete Clip',
            titleText: clip.name,
            cancelText: 'Cancel',
            cancel: function() {
                // add cancel code..
            },
            destructiveButtonClicked: function() {
                $scope.confirmDelete(clip);
            },
            buttonClicked: function(index) {
                if (index === 0) {
                    $scope.saveToCard(clip);
                }
                return true;
            }
        });

        // For example's sake, hide the sheet after two seconds
        $timeout(function() {
            hideSheet();
        }, 8000);

    };

    $scope.toggleIntervalMode = function() {
        if ($scope.timelapse.intervalMode == 'fixed') $scope.timelapse.intervalMode = 'auto'
        else $scope.timelapse.intervalMode = 'fixed';
    }

    $scope.passwd = "";

    //Cleanup the modal when we're done with it!
    $scope.$on('$destroy', function() {
        $scope.modalLogin.remove();
        $scope.modalExposure.remove();
    });

    //$scope.setupTimelapse($scope.presets[0]);

}])

;