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
        cache: false,
        url: "/capture",
        views: {
            'menuContent': {
                templateUrl: "templates/capture.html"
            }
        }
    })

    .state('app.timelapse', {
        cache: false,
        url: "/timelapse",
        views: {
            'menuContent': {
                templateUrl: "templates/timelapse.html"
            }
        }
    })

    .state('app.view', {
        cache: false,
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

.controller('AppCtrl', ['$scope', '$timeout', '$http', '$websocket', '$location', '$ionicPopup', '$ionicActionSheet', '$interval', '$ionicModal', '$state', 'localStorageService', '$ionicHistory', '$ionicSideMenuDelegate', '$ionicScrollDelegate', function($scope, $timeout, $http, $websocket, $location, $ionicPopup, $ionicActionSheet, $interval, $ionicModal, $state, localStorageService, $ionicHistory, $ionicSideMenuDelegate, $ionicScrollDelegate) {
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

    /*var previousState = localStorageService.get('state');
    if(previousState != null && typeof previousState == "string" && previousState.match(/^app\./)) {
        console.log("starting at " + previousState);
        $ionicHistory.nextViewOptions({ // I have no idea why this simply does not work
            disableAnimate: true,
            historyRoot: true
        });
        $state.go(previousState);
        $ionicHistory.clearCache();
        $ionicHistory.clearHistory();
    }*/

    var controls = {};
    var joystickEnabled = true;

    function setupJoystickControls() {
        if (!joystickEnabled) return;
        if(controls.joystick) {
            controls.joystick.delete();
            delete controls.joystick;
        }
        if(controls.slider) {
            controls.slider.delete();
            delete controls.slider;
        }
        $timeout(function(){
            var elm = document.getElementById('motionControls');
            var motionControls = angular.element(elm);
            motionControls.empty();
                                
            if($scope.panAvailable || $scope.tiltAvailable) {
                motionControls.append('<canvas id="joystick" width="200px" height="200px"></canvas>');
                controls.joystick = new window.TouchControl('joystick');
                controls.joystick.on('pos', function(x, y) {
                    y = 0 - y;
                    $scope.joystick('pan', x);
                    $scope.joystick('tilt', y);
                    console.log("joystick pos", x, y);
                });
                controls.joystick.on('start', function(x, y) {
                    $scope.$apply(function(){
                        console.log("disabing scroll");
                        $ionicSideMenuDelegate.canDragContent(false);
                        $ionicScrollDelegate.freezeAllScrolls(true);
                        //$ionicScrollDelegate.getScrollView().__enableScrollY = false
                        //$ionicScrollDelegate.getScrollView().options.scrollingY = false;
                    });
                });
                controls.joystick.on('stop', function(x, y) {
                    $scope.$apply(function(){
                        console.log("enabling scroll");
                        for(var k in joystickRepeatTimers) {
                            if(joystickRepeatTimers[k]) $timeout.cancel(joystickRepeatTimers[k]);
                        }
                        $ionicSideMenuDelegate.canDragContent(true);
                        $ionicScrollDelegate.freezeAllScrolls(false);
                        //$ionicScrollDelegate.getScrollView().options.scrollingY = true;
                    });
                });
            }
            if($scope.slideAvailable) {
                motionControls.append('<canvas id="slider" width="250px" height="60px"></canvas>');
                controls.slider = new window.TouchControl('slider');
                controls.slider.on('pos', function(x) {
                    $scope.joystick('slide', x);
                    console.log("slider pos", x);
                });
                controls.slider.on('start', function(x, y) {
                    $scope.$apply(function(){
                        console.log("disabing scroll");
                        $ionicSideMenuDelegate.canDragContent(false);
                        $ionicScrollDelegate.freezeAllScrolls(true);
                        //$ionicScrollDelegate.getScrollView().options.scrollingY = false;
                    });
                });
                controls.slider.on('stop', function(x, y) {
                    $scope.$apply(function(){
                        for(var k in joystickRepeatTimers) {
                            if(joystickRepeatTimers[k]) $timeout.cancel(joystickRepeatTimers[k]);
                        }
                        console.log("enabling scroll");
                        $ionicSideMenuDelegate.canDragContent(true);
                        $ionicScrollDelegate.freezeAllScrolls(false);
                        //$ionicScrollDelegate.getScrollView().options.scrollingY = true;
                    });
                });
            }
        });
    }

    $scope.$on('$stateChangeSuccess', function(event, toState, toParams, fromState, fromParams) {
        console.log("new state:", toState);
        localStorageService.set('state', toState.name);
        if (toState.name == "app.view") {
            $scope.getClips();
        } else if(toState.name == "app.capture") {
            setupJoystickControls();
        }
    });

    $timeout(function(){
        if($state.current.name == 'app.capture') {
            setupJoystickControls();
        }
    }, 2000);

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

    $scope.popupMessage = function(title, message, callback) {
        var confirmPopup = $ionicPopup.show({
            title: title,
            template: message,
            buttons: [{
                text: 'Close',
                onTap: function(e) {
                    callback && callback();
                }
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

    $scope.moveTracking = function(axis, degrees) {
        sendMessage('moveTracking', {axis:axis, degrees:degrees});
        if(!$scope.intervalometerStatus.panDiffNew) $scope.intervalometerStatus.panDiffNew = 0;
        if(!$scope.intervalometerStatus.tiltDiffNew) $scope.intervalometerStatus.tiltDiffNew = 0;
        if(axis == 'Tilt') {
            $scope.intervalometerStatus.tiltDiffNew += degrees;
        }
        if(axis == 'Pan') {
            $scope.intervalometerStatus.panDiffNew += degrees;
        }
    }

    $scope.reconfigureProgram = function(program) {
        retrievedTimelapseProgram = false;
        sendMessage('reconfigureProgram', {program:program});
    }

    window.applicationCache.addEventListener('updateready', confirmReload, false);

    $scope.loginState = "";
    $scope.loginBusy = false;

    $scope.evSetFromApp = false;
    $scope.connected = 0;
    $scope.camera = {
        connected: false
    };

    $scope.timelapse = {
        rampMode: "fixed",
        intervalMode: "fixed",
        interval: 6,
        dayInterval: 10,
        nightInterval: 36,
        frames: 300,
        destination: 'camera',
        nightCompensation: -1,
        isoMax: -6,
        isoMin:  0,
        manualAperture: -5,
        keyframes: [{
            focus: 0,
            ev: "not set",
            motor: {}
        }]
    };
    $scope.setup = {
        state: 0
    };
    $scope.axis = [];

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

    $scope.currentTimelapse = {};

    $scope.scrubber = {
        max: -1,
        pos: 0
    }

    var ws;
    var connecting;
    var timelapseImages = {};
    timelapseImages['current'] = [];
    $scope.view = {
        connected: false
    };

    var retrievedTimelapseProgram = false;
    var timelapseFragments = {};

    function connect(wsAddress) {
        if (ws || connecting) {
            return;
        } else if (!wsAddress) {
            connecting = true;
            console.log("-> Looking up websocket address...");
            $http.get('/socket/address', {headers: {'x-view-session': $scope.sid}}).then(function(response) {
                var data = response.data;
                console.log(data);
                connecting = false;
                if (data && data.address) {
                    connect(data.address);
                } else if(data && data.action == 'login_required') {
                    $scope.openLogin();
                }
            }, function(response) { // error
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
            if (msg._cbId) {
                for (var i = 0; i < callbackList.length; i++) {
                    if (callbackList[i].id == msg._cbId) {
                        //console.log("cb found:", msg._cbId);
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
                    $scope.histogram = [];
                    $scope.camera.model = '';
                    $scope.camera.connected = false;
                    $scope.view.connected = false;
                    $scope.nodevice = true;
                    $scope.status = "No VIEW device available. Check that the VIEW is powered on and connected via Wifi";
                    callback($scope.status, null);
                    break;
                case 'camera':
                    $scope.nodevice = false;
                    $scope.view.connected = true;
                    $scope.camera = {};
                    $scope.lastImage = null;
                    $scope.histogram = [];
                    $scope.camera.model = msg.model;
                    $scope.camera.connected = msg.connected;
                    callback(null, $scope.camera);
                    if (msg.connected) {
                        $scope.status = '';
                        $timeout(function() {
                            sendMessage('get', {
                                key: 'settings'
                            });
                        }, 1000);
                    } else {
                        $scope.status = 'Connect a camera to the VIEW via USB';
                        callback("no camera", null);
                    }
                    break;
                case 'motion':
                    if(msg.available) {
                        $scope.motionAvailable = true;
                        for(var i = 0; i < msg.motors.length; i++) {
                            setupAxis(msg.motors[i]);
                        }
                    } else {
                        $scope.motionAvailable = false;
                        for(var i = 0; i < $scope.axis.length; i++) {
                            $scope.axis[i].connected = false;
                        }
                    }
                    callback(null, $scope.axis);
                    break;
                case 'move':
                    var index = $scope.getAxisIndex(msg.driver + '-' + msg.motor);
                    if (msg.complete && msg.driver && $scope.axis[index]) {
                        $scope.axis[index].moving = false;
                        var moving = false;
                        for(var i = 0; i < $scope.axis.length; i++) {
                            if($scope.axis[i].moving) {
                                moving = true;
                                break;
                            }
                        }
                        $scope.motionMoving = moving;
                        $scope.axis[index].pos = msg.position;
                        if($scope.axis[index].callbacks && $scope.axis[index].callbacks.length > 0) {
                            for(var i = 0; i < $scope.axis[index].callbacks.length; i++) {
                                $scope.axis[index].callbacks[i](msg.position);
                            }
                            $scope.axis[index].callbacks = null;
                        //} else if(!$scope.currentKf && $scope.axis[index].pos == 0) {
                        //    $scope.zeroAxis($scope.axis[index].id);
                        }
                    }
                    callback(null, msg.complete);
                    break;
                case 'focus':
                    console.log("focus callback", msg);
                    if (msg.complete) {
                        $scope.focusMoving = false;
                    }
                    callback(null, msg.complete);
                    break;
                case 'settings':
                    if (!$scope.camera.connected) break;
                    $scope.camera.config = msg.settings;
                    if (msg.settings) {
                        if (msg.settings.lists) $scope.camera.lists = msg.settings.lists;
                        if (msg.settings.shutter) {
                            $scope.camera.shutter = msg.settings.shutter;
                            if($scope.camera.shutter == $scope.camera.shutterNew) {
                                $scope.camera.shutterChanged = false;
                            } else if(!$scope.camera.shutterNew) {
                                $scope.camera.shutterNew = $scope.camera.shutter;
                            } else if($scope.camera.shutterChanged) {
                                updateParams();
                            } else {
                                $scope.camera.shutterNew = $scope.camera.shutter;
                            }
                        } else {
                            $scope.camera.shutterChanged = false;
                            $scope.camera.shutter = "--";
                            $scope.camera.shutterNew = "--";
                        }
                        if (msg.settings.iso) {
                            $scope.camera.iso = msg.settings.iso; 
                            if($scope.camera.iso == $scope.camera.isoNew) {
                                $scope.camera.isoChanged = false;
                            } else if(!$scope.camera.isoNew) {
                                $scope.camera.isoNew = $scope.camera.iso;
                            } else if($scope.camera.isoChanged) {
                                updateParams();
                            } else {
                                $scope.camera.isoNew = $scope.camera.iso;
                            }
                        } else {
                            $scope.camera.isoChanged = false;
                            $scope.camera.iso = "--";
                            $scope.camera.isoNew = "--";
                        }
                        if (msg.settings.aperture) {
                            $scope.camera.aperture = msg.settings.aperture;
                            if($scope.camera.aperture == $scope.camera.apertureNew) {
                                $scope.camera.apertureChanged = false;
                            } else if(!$scope.camera.apertureNew) {
                                $scope.camera.apertureNew = $scope.camera.aperture;
                            } else if($scope.camera.apertureChanged) {
                                updateParams();
                            } else {
                                $scope.camera.apertureNew = $scope.camera.aperture;
                            }
                        } else {
                            $scope.camera.apertureChanged = false;
                            $scope.camera.aperture = "--";
                            $scope.camera.apertureNew = "--";
                        }
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
                        checkUpDown('shutter');
                        checkUpDown('aperture');
                        checkUpDown('iso');

                    }
                    callback(null, $scope.camera);
                    break;
                case 'thumbnail':
                    if ($scope.previewActive) sendMessage('preview');
                    $scope.lastImage = msg;
                    if(!$scope.currentTimelapse.playing && $scope.intervalometerStatus && $scope.intervalometerStatus.running && !$scope.scrubber.inUse) $scope.currentTimelapse.image = $scope.lastImage.jpeg;
                    callback(null, msg);
                    break;
                case 'histogram':
                    $scope.histogram = msg.histogram;
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
                case 'intervalometerError':
                    $scope.intervalometerErrorMessage = msg.msg;
                    $scope.popupMessage("Error", $scope.intervalometerErrorMessage, function() {
                        sendMessage('dismiss-error');
                    });
                    callback(null, $scope.intervalometerErrorMessage);
                    break;
                case 'captureError':
                    $scope.intervalometerErrorMessage = msg.msg;
                    $scope.popupMessage("Error", $scope.intervalometerErrorMessage, function() {
                    });
                    callback(null, $scope.intervalometerErrorMessage);
                    break;
                case 'timelapse-clips':
                    $scope.clips = msg.clips ? msg.clips : [];
                    for(var i = 0; i < $scope.clips.length; i++) {
                        $scope.clips[i].pos = 0;
                        $scope.clips[i].playing = false;
                        $scope.clips[i].max = -1;
                        if(timelapseImages[$scope.clips[i].index]) $scope.clips[i].max = timelapseImages[$scope.clips[i].index].length;
                    }
                    callback(null, $scope.clips);
                    break;
                case 'timelapse-images':
                    if(msg.error) {
                        callback(msg.error);
                    } else if(msg.fragment != null) {
                        if(!timelapseFragments[msg.index]) timelapseFragments[msg.index] = {};
                        timelapseFragments[msg.index][msg.fragment] = msg.images;
                        console.log("adding fragment of " + timelapseFragments[msg.index][msg.fragment].length + "");
                        var complete = true;
                        for(var i = 0; i < msg.fragments; i++) {
                            if(!timelapseFragments[msg.index][i]) {
                                complete = false;
                                break;
                            }
                        }
                        if(complete) {
                            if(msg.index != 'current') timelapseImages[msg.index] = [];
                            for(var i = 0; i < msg.fragments; i++) {
                                timelapseImages[msg.index] = timelapseImages[msg.index].concat(timelapseFragments[msg.index][i]);
                            }
                            timelapseFragments[msg.index] = null;
                            console.log("received all image fragements, count = " + timelapseImages[msg.index].length);
                            callback(null, msg);
                            playTimelapse(msg.index);
                        }
                    } else {
                        if(msg.index == 'current') {
                            timelapseImages[msg.index].concat(msg.images);
                        } else {
                            timelapseImages[msg.index] = msg.images;
                        }
                        callback(null, msg);
                        playTimelapse(msg.index);
                    }
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
                case 'timelapseProgram':
                    if(!retrievedTimelapseProgram && msg.program) {
                        console.log("refreshing program");
                        angular.extend($scope.timelapse, msg.program);
                        retrievedTimelapseProgram = true;
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
            $scope.nodevice = false;
            $scope.status = '';
            setTimeout(function() {
                sendMessage('auth', {
                    session: $scope.sid
                });
                sendMessage('get', {
                    key: 'camera'
                });
                sendMessage('get', {
                    key: 'motion'
                });
                if(!retrievedTimelapseProgram) {
                    sendMessage('get', {
                        key: 'program'
                    });
                }
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
            $scope.nodevice = false;
            $scope.status = "Lost connection to view.tl";
            $scope.connected = -1;
            ws = null;
            $timeout(connect, 3000);
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
                } else {
                    maxId = 0;
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
        //$scope.previewActive = false;
        console.log("Capture");
        sendMessage('capture');
    }

    $scope.captureTest = function() {
        //$scope.previewActive = false;
        $scope.lastImage.expired = true;
        console.log("CaptureTest");
        if($scope.previewActive) $scope.preview(false);
        sendMessage('capture-test');
        if($scope.currentKf) $scope.currentKf.imageCurrent = true;
    }

    $scope.getClips = function() {
        sendMessage('timelapse-clips');
    }

    function playTimelapse(index) {
        var tl = null;
        if(index == 'current') {
            tl = $scope.currentTimelapse;
            $scope.scrubber.max = timelapseImages[index].length - 1;
            console.log("playing current time-lapse");
        } else {
            for (i = 0; i < $scope.clips.length; i++) {
                if ($scope.clips[i].index == index) {
                    tl = $scope.clips[i];
                    break;
                }
            }
        }
        if (tl) {
            tl.max = timelapseImages[index].length - 1;
            tl.playing = true;
            tl.loading = false;
            var frame = 0;
            if($scope.scrubber.pos && $scope.scrubber.pos < $scope.scrubber.max) frame = $scope.scrubber.pos;
            console.log("playing time-lapse with frame count of ", timelapseImages[index].length);
            var intervalHandle = $interval(function() {
                frame++;
                if (tl.playing && frame < timelapseImages[index].length) {
                    tl.image = timelapseImages[index][frame];
                    if(index == 'current') {
                        $scope.scrubber.pos = frame;
                    } else {
                        tl.pos = frame;
                    }
                } else {
                    $interval.cancel(intervalHandle);
                    tl.playing = false;
                    if(index == 'current') resetCurrentImage();
                }
            }, 1000 / 24);
        }
    }

    var resetCurrentImageTimer = null;
    var resetCurrentImage = function(){
        $scope.scrubber.inUse = true;
        if(resetCurrentImageTimer) $timeout.cancel(resetCurrentImageTimer);
        resetCurrentImageTimer = $timeout(function(){
            $scope.scrubber.inUse = false;
            $scope.currentTimelapse.image = $scope.lastImage.jpeg;
            $scope.scrubber.pos = $scope.scrubber.max;
        }, 10000);
    }

    $scope.updateScrubber = function(frame, tl) {
        if(frame >= timelapseImages[tl ? tl.index : 'current'].length) frame = timelapseImages[tl ? tl.index : 'current'].length - 1;
        if(tl) {
            if(tl.pos != frame) tl.pos = frame;
            if(tl.playing) tl.playing = false;
            tl.image = timelapseImages[tl.index][frame];
        } else {
            if($scope.scrubber.pos != frame) $scope.scrubber.pos = frame;
            if($scope.currentTimelapse.playing) $scope.currentTimelapse.playing = false;
            $scope.currentTimelapse.image = timelapseImages['current'][frame];
            resetCurrentImage();
        }
    }

    $scope.decScrubber = function(frame, tl) {
        if(frame > 0) {
            frame--;
            $scope.updateScrubber(frame, tl);
        }
    }

    $scope.incScrubber = function(frame, tl) {
        if(frame < timelapseImages[tl ? tl.index : 'current'].length) {
            frame++;
            $scope.updateScrubber(frame, tl);
        }
    }

    $scope.pauseTimelapse = function(index) {
        var tl;
        for (i = 0; i < $scope.clips.length; i++) {
            if ($scope.clips[i].index == index) {
                tl = $scope.clips[i];
                break;
            }
        }
        if(tl) {
            tl.playing = false;
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

    $scope.pauseCurrent = function() {
        $scope.currentTimelapse.playing = false;
    }

    $scope.playCurrent = function() {
        if(timelapseImages['current'].length < $scope.intervalometerStatus.frames) {
            $scope.currentTimelapse.loading = true;
            sendMessage('current-images', {
                start: timelapseImages['current'] ? timelapseImages['current'].length : 0
            });
        } else {
            playTimelapse('current');
        }
    }

    $scope.preview = function(status) {
        if (status != null) $scope.previewActive = !status;
        if ($scope.previewActive) {
            $scope.previewActive = false;
            sendMessage('previewStop');
        } else {
            $scope.previewActive = true;
            console.log("Preview");
            sendMessage('preview');
        }
        if($scope.currentKf) $scope.currentKf.imageCurrent = true;
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

    $scope.updateParam = function(name, val) {
        if(val == null) {
            if (name == "iso") {
                val = $scope.camera.iso;
            } else if (name == "shutter") {
                val = $scope.camera.shutter;
            } else if (name == "aperture") {
                val = $scope.camera.aperture;
            } else {
                return;
            }
        }

        console.log("Updating " + name + " to " + val);

        sendMessage('set', {
            key: name,
            val: val
        });
    }

    function checkUpDown(param) {
        if($scope.camera.lists && $scope.camera.lists[param]) {
            var list = $scope.camera.lists[param].filter(function(item){
                return item.ev != null;
            });

            for(var i = 0; i < list.length; i++) {
                if($scope.camera[param + 'New'] == list[i].name) {
                    if(i < list.length - 1) {
                        $scope.camera[param + 'Up'] = true;
                    } else {
                        $scope.camera[param + 'Up'] = false;
                    }
                    if(i > 0) {
                        $scope.camera[param + 'Down'] = true;
                    } else {
                        $scope.camera[param + 'Down'] = false;
                    }
                    return;
                }
            }
        }
        $scope.camera[param + 'Up'] = false;
        $scope.camera[param + 'Down'] = false;
    }

    var updateTimer = null;
    function updateParams() {
        updateTimer = $timeout(function(){
            $scope.update();
            updateTimer = null;
        }, 500);
    }

    function paramInfo(param, current) {
        if($scope.camera.lists && $scope.camera.lists[param]) {
            var list = $scope.camera.lists[param].filter(function(item){
                return item.ev != null;
            });
            for(var i = 0; i < list.length; i++) {
                if(current === list[i].name || current === list[i].ev) {
                    return {
                        list: list,
                        index: i,
                        max: list.length - 1,
                        min: 0,
                        name: list[i].name,
                        item: list[i]
                    };
                }
            }
            return {
                list: list,
                index: null,
                max: list.length - 1,
                min: 0,
            }
        }
        return null;
    }

    function paramClick(param, current, direction) {
        var newItem = null;
        if($scope.camera.lists && $scope.camera.lists[param]) {
            var list = $scope.camera.lists[param].filter(function(item){
                return item.ev != null;
            });
            var newItem = list[0];
            for(var i = 0; i < list.length; i++) {
                if(current === list[i].name || current === list[i].ev) {
                    newItem = list[i];
                    if(direction == 'up') {
                        if(i < list.length - 1) {
                            newItem = list[i + 1];
                        }
                    } else {
                        if(i > 0) {
                            newItem = list[i - 1];
                        }
                    }
                    break;
                }
            }
        }
        return newItem;
    }

    $scope.paramListClick = function(object, param, direction) {
        var newObject = paramClick(param, object[param], direction);
        object[param] = newObject.ev;
    }

    $scope.paramListName = function(object, param) {
        var item = paramInfo(param, object[param]);
        if(item) {
            return item.name;
        } else {
            return '--';
        }
    }

    $scope.paramListTop = function(object, param) {
        var item = paramInfo(param, object[param]);
        if(item) {
            if(item.index != null) {
                return (item.index == item.max);
            } else {
                return false;
            }
        } else {
            return true;
        }
    }

    $scope.paramListBottom = function(object, param) {
        var item = paramInfo(param, object[param]);
        if(item) {
            if(item.index != null) {
                return (item.index == item.min);
            } else {
                return false;
            }
        } else {
            return true;
        }
    }

    var paramTimer = {};
    $scope.paramClick = function(param, direction) {
        if($scope.camera.lists && $scope.camera.lists[param]) {
            var newObject = paramClick(param, $scope.camera[param + 'New'], direction);
            var newItem = newObject.name;
            $scope.camera[param + 'New'] = newItem;
            $scope.camera[param + 'Changed'] = true;
            checkUpDown(param);
            if(paramTimer[param]) {
                $timeout.cancel(paramTimer[param]);
                paramTimer[param] = null;
            }
            paramTimer[param] = $timeout(function(){
                paramTimer[param] = null;
                $scope.updateParam(param, newItem);
                if(updateTimer) {
                    $timeout.cancel(updateTimer);
                    updateTimer = null;
                }
                updateParams();
            }, 1500);
            if($scope.currentKf) $scope.currentKf.exposureEdited = true;
            if($scope.currentKf) $scope.currentKf.imageCurrent = false;
        } else {
            return null;
        }
    }

    $scope.getAxisIndex = function(axisId) {
        for(var i = 0; i < $scope.axis.length; i++) {
            if($scope.axis[i].id == axisId) return i; 
        }
        return null;
    }

    $scope.move = function(axisId, steps, noReverse) {
        for(var k in joystickRepeatTimers) {
            if(joystickRepeatTimers[k]) $timeout.cancel(joystickRepeatTimers[k]);
        }
        console.log("moving ", axisId);
        if($scope.currentKf) $scope.currentKf.motionEdited = true;
        if($scope.currentKf) $scope.currentKf.imageCurrent = false;
        var index = $scope.getAxisIndex(axisId);
        if(index === null) return false;
        var parts = axisId.split('-');
        if (steps && parts.length == 2) {
            var driver = parts[0];
            var motor = parts[1];
            if($scope.axis[index].reverse && !noReverse) steps = 0 - steps;
            console.log("moving motor" + axisId, steps);
            $scope.axis[index].moving = true;
            $scope.motionMoving = true;
            //if($scope.currentKf || $scope.axis[index].pos != 0) 
            $scope.axis[index].pos += steps; // will be overwritten by motor driver response
            sendMessage('motion', {
                key: 'move',
                val: steps,
                driver: driver,
                motor: motor
            });
        }
    }

    $scope.atHomePosition = function() {
        for(var i = 0; i < $scope.axis.length; i++) {
            if($scope.axis[i].connected && $scope.axis[i].pos != 0) return false; 
        }
        return true;
    }

    $scope.setHomePosition = function() {
        for(var k in joystickRepeatTimers) {
            if(joystickRepeatTimers[k]) $timeout.cancel(joystickRepeatTimers[k]);
        }
        for(var i = 0; i < $scope.axis.length; i++) {
            if($scope.axis[i].connected && $scope.axis[i].pos != 0) $scope.zeroAxis($scope.axis[i].id); 
        }
    }

    $scope.zeroAxis = function(axisId) {
        var index = $scope.getAxisIndex(axisId);
        if(index === null) return false;
        var parts = axisId.split('-');
        if (parts.length == 2 && $scope.axis[index].connected) {
            console.log("zeroing ", axisId);
            var driver = parts[0];
            var motor = parts[1];
            $scope.axis[index].pos = 0; // will be overwritten by motor driver response
            sendMessage('motion', {
                key: 'zero',
                driver: driver,
                motor: motor
            });
        }
    }

    var joystickTimers = {};
    var joystickRepeatTimers = {};
    $scope.joystick = function(axisName, speed) {
        var index = null;
        var axisId = null;
        var reverse = null;
        for(var i = 0; i < $scope.axis.length; i++) {
            if($scope.axis[i].connected && $scope.axis[i].name.toLowerCase() == axisName.toLowerCase()) {
                index = i;
                axisId = $scope.axis[index].id;
                reverse = $scope.axis[index].reverse;
                break;
            }
        }
        if(index === null) return false;


        if(joystickRepeatTimers[axisName]) $timeout.cancel(joystickRepeatTimers[axisName]);
        joystickRepeatTimers[axisName] = $timeout(function(){
            $scope.joystick(axisName, speed);
        }, 1000);

        if(speed && joystickTimers[axisName]) return false; // rate limit per axis

        if($scope.currentKf) $scope.currentKf.motionEdited = true;
        if($scope.currentKf) $scope.currentKf.imageCurrent = false;

        var sendJoystickCommand = (function(a, s) { return function() {
            console.log("moving ", axisId);
            var parts = a.split('-');
            if (parts.length == 2) {
                var driver = parts[0];
                var motor = parts[1];
                console.log("joystick motor" + a, s);
                sendMessage('motion', {
                    key: 'joystick',
                    val: s * 100 * (reverse ? -1 : 1),
                    driver: driver,
                    motor: motor
                });
            }
        }; })(axisId, speed);

        if(joystickTimers[axisName]) $timeout.cancel(joystickTimers[axisName]);
        joystickTimers[axisName] = $timeout(function(){
            joystickTimers[axisName] = null;
        }, 200);
        sendJoystickCommand();
        if(speed == 0) sendJoystickCommand();
    }

    $scope.focusPos = 0;
    $scope.focus = function(dir, repeat, noUpdate) {
        if (!repeat) repeat = 1;
        if(!noUpdate) {
            if (dir > 0) $scope.focusPos += repeat;
            if (dir < 0) $scope.focusPos -= repeat;
            if($scope.currentKf) $scope.currentKf.focusEdited = true;
            if($scope.currentKf) $scope.currentKf.imageCurrent = false;
        }
        $scope.focusMoving = true;
        sendMessage('focus', {
            key: 'manual',
            val: dir,
            repeat: repeat
        });
        console.log("focusPos:", $scope.focusPos);
    }

    function dbGet(key, callback) {
        sendMessage('dbGet', {
            key: key
        }, function(err, res){
            callback && callback(err, res.val);
            console.log("dbGet result", res);
        });
    }

    function dbSet(key, val, callback) {
        sendMessage('dbSet', {
            key: key,
            val: val
        }, function(err){
            callback && callback(err);
            console.log("dbSet err", err);
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
        if(mode == 'motion') setupJoystickControls();
    }

    $scope.runProgram = function(program) {
        $scope.currentTimelapse = {
            image: $scope.lastImage && $scope.lastImage.jpeg
        }
        timelapseImages['current'] = [];
        $scope.scrubber.max = -1;
        program.focusPos = $scope.focusPos;
        for(var i = 0; i < $scope.axis.length; i++) {
            if($scope.axis[i].connected) program['motor-' + $scope.axis[i].id + 'Pos'] = $scope.axis[i].pos;
        }

        if(!program.tracking) program.tracking = 'none';

        if(program.tracking != 'none') {
            if($scope.panTiltAvailable) {
                program.trackingPanMotor = $scope.panTiltAvailable.pan.driver + $scope.panTiltAvailable.pan.motor + ($scope.panTiltAvailable.pan.reverse ? 'r' : '');
                program.trackingTiltMotor = $scope.panTiltAvailable.tilt.driver + $scope.panTiltAvailable.tilt.motor + ($scope.panTiltAvailable.tilt.reverse ? 'r' : '');
                program.keyframes = [program.keyframes[0]];
            } else {
                program.tracking = 'none';
            }
        }

        //program.rampMode = 'auto';
        //program.intervalMode = 'fixed';

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
    var MAX_KF_SECONDS = 3600 * 24;
    var TIMING_SLIDER_RANGE = 100;
    var TIMING_CURVE = 1 / 2.5;
    $scope.timingSliderMax = TIMING_SLIDER_RANGE;
    $scope.openExposure = function(kf, index) {
        $scope.currentKf = kf;
        if(!$scope.currentKf.focus) $scope.currentKf.focus = 0; 
        $scope.currentKfIndex = index;
        $scope.currentKf.focusEdited = false; 
        $scope.currentKf.motionEdited = false; 
        $scope.currentKf.exposureEdited = false;
        if($scope.mode == 'motion') {
            $timeout(function(){
                setupJoystickControls();
            });
        }
        if (kf) {
            $scope.secondsRange.val = TIMING_SLIDER_RANGE * Math.pow((kf.seconds / MAX_KF_SECONDS), TIMING_CURVE);
            $scope.ev3 = kf.ev * 3;
            //if (kf.ev != null) $scope.setEv(kf.ev);
            //if (kf.focus != null) {
            //    var focusDiff = kf.focus - $scope.focusPos;
            //    var dir = focusDiff < 0 ? -1 : 1;
            //    var repeat = Math.abs(focusDiff);
            //    if (repeat > 0) $scope.focus(dir, repeat);
            //}
            //$scope.motionMoveToKeyframe(kf);
        }
        if($scope.currentKf.imageType != 'test') {
            $scope.preview(true);
        } else {
            $scope.lastImage = {
                jpeg: $scope.currentKf.jpeg,
                imageType: 'test'
            }
        }
        $scope.modalExposure.show();
    };
    $scope.focusMoveToKeyframe = function(keyframe) {
        var focusDiff = $scope.focusCurrentDistance(keyframe);
        var dir = focusDiff < 0 ? -1 : 1;
        var repeat = Math.abs(focusDiff);
        if (repeat > 0) $scope.focus(dir, repeat);
    }
    $scope.focusCurrentDistance = function(keyframe) {
        return keyframe ? keyframe.focus - $scope.focusPos : 0;
    }
    $scope.focusResetKeyframe = function(keyframe) {
        keyframe.focus = $scope.focusPos;
    }

    $scope.motionAtKeyframe = function(keyframe) {
        for(var i = 0; i < $scope.axis.length; i++) {
            if($scope.axis[i].connected && keyframe && $scope.axis[i].pos != keyframe.motor[$scope.axis[i].id]) return false; 
        }
        return true;
    }
    $scope.motionResetKeyframe = function(keyframe) {
        keyframe.motionEdited = true;
        if($scope.currentKf) $scope.currentKf.imageCurrent = false;
        for(var i = 0; i < $scope.axis.length; i++) {
            if($scope.axis[i].connected) {
                var id = $scope.axis[i].id;
                keyframe.motor[id] = $scope.axis[i].pos;
            }
        }
    }
    $scope.motionMoveToKeyframe = function(keyframe) {
        if(!keyframe.motor) keyframe.motor = {};
        for(var i = 0; i < $scope.axis.length; i++) {
            if($scope.axis[i].connected) {
                var id = $scope.axis[i].id;
                if(!keyframe.motor[id]) keyframe.motor[id] = 0;
                var diff = keyframe.motor[id] - $scope.axis[i].pos;
                console.log("moving to keyframe", keyframe.motor[id], ", from", $scope.axis[i].pos, ", move:", diff);
                $scope.move(id, diff, true);
            }
        }
    }
    var validateMotorKeyframes = function() {
        for(var k = 0; k < $scope.timelapse.keyframes.length; k++) { // ensure motor positions are set for all keyframes, even if not edited
            var positions = {};
            for(var i = 0; i < $scope.axis.length; i++) {
                if($scope.axis[i].connected) {
                    var id = $scope.axis[i].id;
                    if(!positions[id]) positions[id] = 0;
                    if(!$scope.timelapse.keyframes[k].motor[id]) {
                        $scope.timelapse.keyframes[k].motor[id] = positions[id];
                    } else {
                        positions[id] = $scope.timelapse.keyframes[k].motor[id];
                    }
                }
            }
        }
    }
    $scope.closeExposure = function() {
        var delay = 0;
        if ($scope.focusMode) {
            $scope.zoom();
            delay = 1000;
        }
        if($scope.currentKf.focusEdited || $scope.currentKf.motionEdited || $scope.currentKf.exposureEdited || ($scope.currentKf && !$scope.currentKf.jpeg)) {
            $timeout(function() {
                $scope.preview(false);
                if ($scope.currentKf && $scope.lastImage) {
                    $scope.currentKf.jpeg = $scope.lastImage.jpeg;
                    $scope.currentKf.imageType = $scope.lastImage.imageType;
                }
            }, delay);
        } else {
            $scope.preview(false);
        }
        if ($scope.currentKfIndex == 0) {
            for (var i = 1; i < $scope.timelapse.keyframes.length; i++) {

                if($scope.currentKf.focusEdited) $scope.timelapse.keyframes[i].focus -= $scope.focusPos;

                if($scope.currentKf.motionEdited) {
                    for(var j = 0; j < $scope.axis.length; j++) {
                        if($scope.axis[j].connected) {
                            var id = $scope.axis[j].id;
                            if($scope.axis[j].moving) {
                                (function(kfIndex, axisIndex){
                                    if(!$scope.axis[j].callbacks) $scope.axis[j].callbacks = [];
                                    $scope.axis[j].callbacks.push(function() {
                                        $scope.timelapse.keyframes[i].motor[id] -= $scope.axis[axisIndex].pos;
                                    });
                                })(i, j);
                            } else {
                                $scope.timelapse.keyframes[i].motor[id] -= $scope.axis[j].pos;
                            }
                        }
                    }
                }
            }
            if($scope.currentKf.focusEdited) $scope.focusPos = 0;

            if($scope.currentKf.motionEdited) {
                for(var i = 0; i < $scope.axis.length; i++) {
                    if($scope.axis[i].moving) {
                        (function(id, i){
                            if(!$scope.axis[i].callbacks) $scope.axis[i].callbacks = [];
                            $scope.axis[i].callbacks.push(function(position) {
                                $scope.zeroAxis(id);
                            });
                        })($scope.axis[i].id, i);
                    } else {
                        $scope.zeroAxis($scope.axis[i].id);
                    }
                    $scope.axis[i].pos = 0;
                }
            }
        }
        if($scope.currentKf.focusEdited) $scope.currentKf.focus = $scope.focusPos;

        if($scope.currentKf.motionEdited) {
            for(var i = 0; i < $scope.axis.length; i++) {
                if($scope.axis[i].connected) {
                    var id = $scope.axis[i].id;
                    $scope.currentKf.motor[id] = $scope.axis[i].pos;
                }
            }
            validateMotorKeyframes();
        }
        $scope.currentKf.ev = $scope.camera.ev;
        $scope.modalExposure.hide();
    };
    $scope.addKeyframe = function() {
        if (!$scope.timelapse.keyframes) $scope.timelapse.keyframes = [{motor:{}}];
        var lastKf = $scope.timelapse.keyframes[$scope.timelapse.keyframes.length - 1];
        var kf = {
            focus: lastKf.focus,
            seconds: 600
        }
        for(var i = 0; i < $scope.axis.length; i++) {
            if($scope.axis[i].connected) {
                var id = $scope.axis[i].id;
                if(!kf.motor) kf.motor = {};
                kf.motor[id] = lastKf.motor[id];
            }
        }
        $scope.timelapse.keyframes.push(kf);
        validateMotorKeyframes();
    }
    $scope.removeKeyframe = function(index) {
        $scope.timelapse.keyframes.splice(index, 1);
    }


    $ionicModal.fromTemplateUrl('templates/modal-motion-setup.html', {
        scope: $scope,
        animation: 'slide-in-up'
    }).then(function(modal) {
        $scope.modalMotionSetup = modal;
    });
    $scope.openMotionSetup = function(axisId) {
        var axisIndex = $scope.getAxisIndex(axisId);
        if(axisIndex === null) return;
        $scope.setupAxis = $scope.axis[axisIndex];
        if($scope.setupAxis.driver == 'GM') {
            $scope.setupAxis.unit = '°';
            $scope.setupAxis.unitSteps = 1;
        }
        $scope.modalMotionSetup.show();
    };
    $scope.closeMotionSetup = function() {
        if($scope.setupAxis.name) $scope.setupAxis.setup = true;
        if($scope.setupAxis.unit == 's') $scope.setupAxis.unitSteps = 1;
        $scope.setupAxis.moveSteps = $scope.setupAxis.unitMove * $scope.setupAxis.unitSteps;
        //localStorageService.set('motion-' + $scope.setupAxis.id, $scope.setupAxis);
        dbSet('motion-' + $scope.setupAxis.id, $scope.setupAxis);
        var axisIndex = $scope.getAxisIndex($scope.setupAxis.id);
        $scope.axis[axisIndex] = $scope.setupAxis;
        $scope.modalMotionSetup.hide();
        checkAxisFunctionsAvailable();
        var mode = $scope.mode;
        $scope.mode = "";
        $timeout(function(){
            $scope.mode = mode;
            $timeout(function(){
                setupJoystickControls();
            });
        });
    };
    function checkAxisFunctionsAvailable() {
        var tilt = false;
        var pan = false;
        var slide = false;
        for(var i = 0; i < $scope.axis.length; i++) {
            if($scope.axis[i].name == 'Pan' && $scope.axis[i].connected) pan = $scope.axis[i];
            if($scope.axis[i].name == 'Tilt' && $scope.axis[i].connected) tilt = $scope.axis[i];
            if($scope.axis[i].name == 'Slide' && $scope.axis[i].connected) slide = $scope.axis[i];
        }
        if(slide) {
            $scope.slideAvailable = slide;
        }
        if(pan) {
            $scope.panAvailable = pan;
        }
        if(tilt) {
            $scope.tiltAvailable = tilt;
        }
        if(pan && tilt) {
            $scope.panTiltAvailable = {pan: pan, tilt: tilt};
        } else {
            $scope.panTiltAvailable = false;
        }
    }
    $scope.changeAxisType = function(type) {
        $scope.setupAxis.name = type;
        if(type == 'Pan' || type == 'Tilt') {
            $scope.setupAxis.unit = '°';
            $scope.setupAxis.unitMove = 5;
            if($scope.setupAxis.driver == 'NMX') {
                if($scope.setupAxis.hardware == 'stager') {
                    $scope.setupAxis.unitSteps = 558.63333334;
                } else if($scope.setupAxis.hardware == 'sapphire') {
                    $scope.setupAxis.unitSteps = 550.81967213;
                }
            } else if($scope.setupAxis.driver == 'GM') {
                $scope.setupAxis.unitSteps = 1;
            }
        } else {
            $scope.setupAxis.unit = 's';
            $scope.setupAxis.unitSteps = 1;
            $scope.setupAxis.unitMove = 500;
        }
    }
    $scope.changeAxisUnit = function(unit) {
        $scope.setupAxis.unit = unit;
    }
    $scope.changeAxisHardware = function(hardware) {
        $scope.setupAxis.hardware = hardware;
        if($scope.setupAxis.hardware == 'stager') {
            $scope.setupAxis.unitSteps = 558.63333334;
        } else if($scope.setupAxis.hardware == 'sapphire') {
            $scope.setupAxis.unitSteps = 550.81967213;
        }
    }
    $scope.changeAxisUnitSteps = function(unitSteps) {
        $scope.setupAxis.unitSteps = unitSteps;
    }
    $scope.changeAxisUnitMove = function(unitMove) {
        $scope.setupAxis.unitMove = unitMove;
    }
    $scope.changeAxisReverse = function(reverse) {
        $scope.setupAxis.reverse = reverse;
    }

    $scope.motionMoving = false;
    function setupAxis(axisInfo) {
        var axisId = axisInfo.driver + '-' + axisInfo.motor;
        console.log("setting up axis: ", axisId);
        //var axis = localStorageService.get('motion-' + axisId);
        dbGet('motion-' + axisId, function(err, axis) {
            console.log("VIEW db err:", err);
            console.log("VIEW db axis:", axis);
            if(!axis) {
                axis = {
                    name: '',
                    unit: 's',
                    unitSteps: 1,
                    unitMove: 500,
                    reverse: false,
                    pos: 0,
                    moving: false,
                    setup: false
                }
            }
            axis.id = axisId;
            axis.motor = axisInfo.motor;
            axis.driver = axisInfo.driver;
            axis.connected = axisInfo.connected;
            axis.pos = axisInfo.position;

            var axisIndex = $scope.getAxisIndex(axisId);
            if(!$scope.axis) $scope.axis = [];        
            if(axisIndex === null) {
                $scope.axis.push(axis);
            } else {
                //axis.pos = $scope.axis[axisIndex].pos;
                axis.moving = false;//$scope.axis[axisIndex].moving;
                $scope.axis[axisIndex] = axis;
            }
            var moving = false;
            for(var i = 0; i < $scope.axis.length; i++) {
                if($scope.axis[i].moving) {
                    moving = true;
                    break;
                }
            }
            $scope.motionMoving = moving;
            checkAxisFunctionsAvailable();

            console.log("$scope.axis", $scope.axis);
        });
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

    $scope.setTimelapse = function(param, val) {
        $scope.timelapse[param] = val;
        console.log("Setting timelapse." + param + " = " + val);
        if(param == 'rampMode') {
            console.log("Sending to reconfigure");
            $scope.reconfigureProgram($scope.timelapse);
        }
    }

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