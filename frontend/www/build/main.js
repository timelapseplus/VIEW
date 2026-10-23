webpackJsonp([0],{

/***/ 109:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return IntervalometerPage; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "d", function() { return UpdateModalContentPage; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "c", function() { return RampingModalContentPage; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "b", function() { return KeyframeModalContentPage; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__angular_core__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_ionic_angular__ = __webpack_require__(23);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__providers_view_view__ = __webpack_require__(39);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3__app_app_component__ = __webpack_require__(58);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4_chart_js__ = __webpack_require__(434);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4_chart_js___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_4_chart_js__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_5_moment__ = __webpack_require__(1);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_5_moment___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_5_moment__);
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};






var IntervalometerPage = (function () {
    function IntervalometerPage(navCtrl, alertCtrl, viewApi, modalCtrl, events) {
        var _this = this;
        this.navCtrl = navCtrl;
        this.alertCtrl = alertCtrl;
        this.viewApi = viewApi;
        this.modalCtrl = modalCtrl;
        this.events = events;
        this.camera = {};
        this.frames = {};
        this.motion = {};
        this.showAxisSetup = false;
        this.axisTypes = {};
        this.axes = {};
        this.intervalometer = {
            program: {},
            status: {}
        };
        this.allowedNonMotorAxes = ['interval', 'focus', 'ev'];
        this.viewMode = "status";
        this.chart = null;
        this.lists = {
            bracketing: [
                { label: 'Single frames', value: 1 },
                { label: 'Multi-exposure Sets', value: 3 }
            ],
            exposureMode: [
                { label: 'Auto Ramping', value: 'auto' },
                { label: 'Preset Value', value: 'preset' },
                { label: 'Lock Exposure', value: 'locked' },
            ],
            intervalMode: [
                { label: 'Auto Variable', value: 'auto' },
                { label: 'Fixed', value: 'fixed' },
            ],
            bracketingFrames: [
                { label: 'sets of 2', value: 2 },
                { label: 'sets of 3', value: 3 },
                { label: 'sets of 4', value: 4 },
                { label: 'sets of 5', value: 5 },
                { label: 'sets of 6', value: 6 },
                { label: 'sets of 7', value: 7 },
                { label: 'sets of 8', value: 8 },
                { label: 'sets of 9', value: 9 },
                { label: 'sets of 10', value: 10 }
            ],
            bracketingStops: [
                { label: '1/3 stop', value: 1 / 3 },
                { label: '2/3 stop', value: 2 / 3 },
                { label: '1 stop', value: 1 },
                { label: '1 1/3 stops', value: 1 + 1 / 3 },
                { label: '1 2/3 stops', value: 1 + 2 / 3 },
                { label: '2 stops', value: 2 },
                { label: '2 1/3 stops', value: 2 + 1 / 3 },
                { label: '2 2/3 stops', value: 2 + 2 / 3 },
                { label: '3 stops', value: 3 },
                { label: '3 1/3 stops', value: 3 + 1 / 3 },
                { label: '3 2/3 stops', value: 3 + 2 / 3 },
                { label: '4 stops', value: 4 }
            ],
            panDirection: [
                { label: 'Left', value: true },
                { label: 'Right', value: false }
            ],
            tiltDirection: [
                { label: 'Up', value: false },
                { label: 'Down', value: true }
            ],
            trackingTarget: [
                { label: 'Follow Sun', value: 'sun' },
                { label: 'Follow Moon', value: 'moon' }
            ],
            trackingAxes: [
                { label: 'Pan Only', value: 'pan' },
                { label: 'Tilt Only', value: 'tilt' },
                { label: 'Pan & Tilt', value: 'pan/tilt' }
            ],
            yesNo: [
                { label: 'Yes', value: 'yes' },
                { label: 'No', value: 'no' }
            ],
            yesNoBool: [
                { label: 'Yes', value: true },
                { label: 'No', value: false }
            ],
            enableDisable: [
                { label: 'Enable', value: true },
                { label: 'Disable', value: false }
            ],
            timeOfDay: [
                { label: '00:00 (12:00a)', value: '00:00' },
                { label: '00:30 (12:30a)', value: '00:30' },
                { label: '01:00 (1:00a)', value: '01:00' },
                { label: '01:30 (1:30a)', value: '01:30' },
                { label: '02:00 (2:00a)', value: '02:00' },
                { label: '02:30 (2:30a)', value: '02:30' },
                { label: '03:00 (3:00a)', value: '03:00' },
                { label: '03:30 (3:30a)', value: '03:30' },
                { label: '04:00 (4:00a)', value: '04:00' },
                { label: '04:30 (4:30a)', value: '04:30' },
                { label: '05:00 (5:00a)', value: '05:00' },
                { label: '05:30 (5:30a)', value: '05:30' },
                { label: '06:00 (6:00a)', value: '06:00' },
                { label: '06:30 (6:30a)', value: '06:30' },
                { label: '07:00 (7:00a)', value: '07:00' },
                { label: '07:30 (7:30a)', value: '07:30' },
                { label: '08:00 (8:00a)', value: '08:00' },
                { label: '08:30 (8:30a)', value: '08:30' },
                { label: '09:00 (9:00a)', value: '09:00' },
                { label: '09:30 (9:30a)', value: '09:30' },
                { label: '10:00 (10:00a)', value: '10:00' },
                { label: '10:30 (10:30a)', value: '10:30' },
                { label: '11:00 (11:00a)', value: '11:00' },
                { label: '11:30 (11:30a)', value: '11:30' },
                { label: '12:00 (12:00p)', value: '12:00' },
                { label: '12:30 (12:30p)', value: '12:30' },
                { label: '13:00 (1:00p)', value: '13:00' },
                { label: '13:30 (1:30p)', value: '13:30' },
                { label: '14:00 (2:00p)', value: '14:00' },
                { label: '14:30 (2:30p)', value: '14:30' },
                { label: '15:00 (3:00p)', value: '15:00' },
                { label: '15:30 (3:30p)', value: '15:30' },
                { label: '16:00 (4:00p)', value: '16:00' },
                { label: '16:30 (4:30p)', value: '16:30' },
                { label: '17:00 (5:00p)', value: '17:00' },
                { label: '17:30 (5:30p)', value: '17:30' },
                { label: '18:00 (6:00p)', value: '18:00' },
                { label: '18:30 (6:30p)', value: '18:30' },
                { label: '19:00 (7:00p)', value: '19:00' },
                { label: '19:30 (7:30p)', value: '19:30' },
                { label: '20:00 (8:00p)', value: '20:00' },
                { label: '20:30 (8:30p)', value: '20:30' },
                { label: '21:00 (9:00p)', value: '21:00' },
                { label: '21:30 (9:30p)', value: '21:30' },
                { label: '22:00 (10:00p)', value: '22:00' },
                { label: '22:30 (10:30p)', value: '22:30' },
                { label: '23:00 (11:00p)', value: '23:00' },
                { label: '23:30 (11:30p)', value: '23:30' },
            ],
            motionOptionsPan: [
                { label: 'Disabled', value: 'disabled' },
                { label: 'Constant Rate', value: 'constant' },
                { label: 'Keyframe', value: 'keyframe' },
                { label: 'Tracking', value: 'tracking' },
            ],
            motionOptionsPolar: [
                { label: 'Disabled', value: 'disabled' },
                { label: 'Constant Rate', value: 'constant' },
                { label: 'Keyframe', value: 'keyframe' },
                { label: 'Polar Tracking', value: 'polar' },
            ],
            motionOptionsTilt: [
                { label: 'Disabled', value: 'disabled' },
                { label: 'Constant Rate', value: 'constant' },
                { label: 'Keyframe', value: 'keyframe' },
                { label: 'Tracking', value: 'tracking' },
            ],
            motionOptionsOther: [
                { label: 'Disabled', value: 'disabled' },
                { label: 'Keyframe', value: 'keyframe' },
            ],
            polarAxes: [
                { label: 'North', value: false },
                { label: 'South', value: true },
            ],
            focusOptions: [
                { label: 'Disabled', value: 'disabled' },
                { label: 'Keyframe', value: 'keyframe' },
            ],
            lrtDirection: [
                { label: 'Automatic (bi-directional)', value: 'auto' },
                { label: 'Sunrise', value: 'sunrise' },
                { label: 'Sunset', value: 'sunset' },
            ],
            delay: [
                { label: '1 minute', value: 60 },
                { label: '5 minutes', value: 300 },
                { label: '10 minutes', value: 600 },
                { label: '20 minutes', value: 600 * 2 },
                { label: '30 minutes', value: 600 * 3 },
                { label: '40 minutes', value: 600 * 4 },
                { label: '50 minutes', value: 600 * 5 },
                { label: '60 minutes', value: 600 * 6 },
                { label: '1 hour 15 minutes', value: 3600 + 60 * 15 },
                { label: '1 hour 30 minutes', value: 3600 + 60 * 30 },
                { label: '1 hour 45 minutes', value: 3600 + 60 * 45 },
                { label: '2 hours', value: 3600 * 2 },
                { label: '2.5 hours', value: 3600 * 2.5 },
                { label: '3 hours', value: 3600 * 3 },
                { label: '3.5 hours', value: 3600 * 3.5 },
                { label: '4 hours', value: 3600 * 4 },
                { label: '4.5 hours', value: 3600 * 4.5 },
                { label: '5 hours', value: 3600 * 5 }
            ],
            manualAperture: [
                { label: "f/1.0", value: -8, },
                { label: "f/1.1", value: -7 - 2 / 3, },
                { label: "f/1.2", value: -7 - 1 / 3, },
                { label: "f/1.4", value: -7, },
                { label: "f/1.6", value: -6 - 2 / 3, },
                { label: "f/1.8", value: -6 - 1 / 3, },
                { label: "f/2.0", value: -6, },
                { label: "f/2.2", value: -5 - 2 / 3, },
                { label: "f/2.5", value: -5 - 1 / 3, },
                { label: "f/2.8", value: -5, },
                { label: "f/3.2", value: -4 - 2 / 3, },
                { label: "f/3.6", value: -4 - 1 / 3, },
                { label: "f/4.0", value: -4, },
                { label: "f/4.5", value: -3 - 2 / 3, },
                { label: "f/5.0", value: -3 - 1 / 3, },
                { label: "f/5.6", value: -3, },
                { label: "f/6.3", value: -2 - 2 / 3, },
                { label: "f/7.1", value: -2 - 1 / 3, },
                { label: "f/8", value: -2, },
                { label: "f/9", value: -1 - 2 / 3, },
                { label: "f/10", value: -1 - 1 / 3, },
                { label: "f/11", value: -1, },
                { label: "f/13", value: -0 - 2 / 3, },
                { label: "f/14", value: -0 - 1 / 3, },
                { label: "f/16", value: 0, },
                { label: "f/18", value: 0 + 1 / 3, },
                { label: "f/20", value: 0 + 2 / 3, },
                { label: "f/22", value: 1, },
                { label: "f/25", value: 2 + 1 / 3, },
                { label: "f/29", value: 2 + 2 / 3, },
                { label: "f/32", value: 3, },
                { label: "f/36", value: 3 + 1 / 3, },
                { label: "f/42", value: 3 + 2 / 3, },
                { label: "f/45", value: 4, },
                { label: "f/50", value: 4 + 1 / 3, },
                { label: "f/57", value: 4 + 2 / 3, },
                { label: "f/64", value: 5, }
            ]
        };
        this.intervalometer = this.viewApi.intervalometer;
        this.camera = this.viewApi.camera;
        this.frames = this.viewApi.timelapse.frames;
        this.motion = this.viewApi.motion;
        if (!this.intervalometer.program.loaded)
            this.intervalometer.getProgram();
        this.intervalometer.getStatus();
        this.motion.get();
        this.updateKeyframeData();
        events.subscribe('intervalometer.program', function () {
            _this.updateKeyframeData();
        });
        events.subscribe('intervalometer.stopped', function () {
            console.log("event: intervalometer stopped");
            _this.intervalometer.getProgram();
            _this.chart = null;
            _this.ionViewDidLoad();
            _this.motion.get();
        });
        events.subscribe('motion.updated', function () {
            console.log("event: motion updated");
            _this.updateKeyframeData();
        });
        events.subscribe('camera.updated', function () {
            console.log("event: motion updated");
            _this.updateKeyframeData();
        });
    }
    IntervalometerPage.prototype.fromNow = function (time, useVerb) {
        var verb = '';
        if (useVerb)
            verb = time > Date.now() ? "is " : "was ";
        return verb + __WEBPACK_IMPORTED_MODULE_5_moment___default()(time).fromNow();
    };
    IntervalometerPage.prototype.utcCode = function (offsetMinutes) {
        var sign = offsetMinutes < 0 ? '-' : '+';
        offsetMinutes = Math.abs(offsetMinutes);
        var m = offsetMinutes % 60;
        var h = (offsetMinutes - m) / 60;
        var ms = m.toString();
        var hs = h.toString();
        if (ms.length < 2)
            ms = '0' + ms;
        if (hs.length < 2)
            hs = '0' + hs;
        return sign + hs + ':' + ms;
    };
    IntervalometerPage.prototype.updateKeyframeData = function () {
        if (this.viewApi.intervalometer.status.running)
            return;
        if (!this.viewApi.intervalometer.program.hasOwnProperty('axes'))
            this.viewApi.intervalometer.program.axes = {};
        this.axes = this.viewApi.intervalometer.program.axes;
        for (var key in this.axes)
            this.axes[key].present = false;
        for (var i = 0; i < this.motion.axis.length; i++) {
            if (!this.axes.hasOwnProperty(this.motion.axis[i].id)) {
                this.axes[this.motion.axis[i].id] = {
                    kf: [{ seconds: 0, position: 0 }],
                    type: 'disabled',
                    present: true
                };
            }
            this.axes[this.motion.axis[i].id].motor = this.motion.axis[i]; // link motor if available
            this.axes[this.motion.axis[i].id].present = this.motion.axis[i].connected;
            this.axes[this.motion.axis[i].id].orientation = this.motion.axis[i].name ? this.motion.axis[i].name.toLowerCase() : "";
        }
        if (!this.axes.hasOwnProperty('focus')) {
            this.axes.focus = {
                kf: [{ seconds: 0, position: this.camera.settings ? this.camera.settings.focusPos : 0 }],
                type: 'disabled',
                pos: this.camera.settings ? this.camera.settings.focusPos : 0
            };
        }
        if (this.camera && this.camera.supports && this.camera.supports.focus) {
            this.axes.focus.present = true;
            this.axes.focus.pos = this.camera.settings ? this.camera.settings.focusPos : 0;
        }
        for (var key in this.axes) {
            if (!this.axes[key].present) {
                this.axes[key] = null;
                delete this.axes[key];
                //console.log("deleted", key);
            }
        }
        var axisPresent = false;
        for (var key in this.axes) {
            //console.log("key", key)
            if (this.axes.hasOwnProperty(key)) {
                axisPresent = true;
                break;
            }
        }
        //console.log("this.motion.axis.length", this.motion.axis.length);
        //console.log("axisPresent", axisPresent);
        //console.log("this.axes", this.axes);
        this.showAxisSetup = axisPresent;
        this.ionViewDidLoad();
        this.updateAxisTypes();
    };
    IntervalometerPage.prototype.updateAxisTypes = function () {
        var _this = this;
        var types = {};
        var colorIndex = 0;
        for (var key in this.axes) {
            types[this.axes[key].type] = true;
            this.axes[key].id = key;
            if (key == 'focus') {
                if (!this.axes[key].pos)
                    this.axes[key].pos = this.camera.settings ? this.camera.settings.focusPos : 0;
            }
            else {
                if (!this.axes[key].pos)
                    this.axes[key].pos = 0;
            }
            this.axes[key].colorIndex = colorIndex;
            colorIndex++;
            if (this.axes[key].type == "tracking") {
                if (!this.axes[key].target)
                    this.axes[key].target = 'moon';
            }
            if (this.axes[key].type == "constant") {
                if (!this.axes[key].rate)
                    this.axes[key].rate = 15;
            }
        }
        this.axisTypes = types;
        setTimeout(function () {
            _this.updateKeyframeChart();
        }, 100);
    };
    IntervalometerPage.prototype.ionViewDidLoad = function () {
        if (!this.chartCanvas)
            return;
        if (this.chart !== null)
            return;
        this.chart = new __WEBPACK_IMPORTED_MODULE_4_chart_js__["Chart"](this.chartCanvas.nativeElement, {
            type: 'line',
            data: this.intervalometer.getChartData(0, false),
            options: {
                animation: false,
                legend: {
                    display: false,
                },
                layout: {
                    padding: {
                        top: 10,
                        bottom: 10
                    }
                },
                scales: {
                    yAxes: [{
                            display: false,
                            ticks: {
                                beginAtZero: true,
                            }
                        }],
                    xAxes: [{
                            type: 'time',
                            distribution: 'linear',
                            time: {
                                round: 'second',
                                displayFormats: {
                                    second: 'H:mm:ss',
                                    minute: 'H:mm',
                                    hour: 'H:mm',
                                    day: 'H:mm'
                                }
                            }
                        }]
                }
            }
        });
    };
    IntervalometerPage.prototype.saveProgram = function (program) {
        this.intervalometer.saveProgram(program, function (err, res) {
            console.log("program saved:", err, res);
        });
    };
    IntervalometerPage.prototype.start = function (program) {
        if (!program)
            program = this.intervalometer.program;
        this.viewMode = "status";
        this.camera.histogram = [];
        this.intervalometer.preview.image = null;
        this.intervalometer.status.running = true;
        this.intervalometer.status.message = "loading...";
        this.camera.status = "";
        for (var key in this.intervalometer.program.axes) {
            console.log("checking axis", key);
            if (this.allowedNonMotorAxes.indexOf(key) !== -1)
                continue;
            var found = false;
            for (var i = 0; i < this.motion.axis.length; i++) {
                if (this.motion.axis[i].id == key && this.motion.axis[i].connected) {
                    //if(this.intervalometer.program.axes[key].motor) this.intervalometer.program.axes[key].reverse = this.motion.axis[i].reverse;
                    found = true;
                    break;
                }
            }
            if (found)
                continue;
            this.intervalometer.program.axes[key] = null;
            delete this.intervalometer.program.axes[key];
            console.log(" -- deleted", key);
        }
        this.intervalometer.start(program);
    };
    IntervalometerPage.prototype.stop = function () {
        var _this = this;
        var confirm = this.alertCtrl.create({
            title: 'Stop time-lapse?',
            message: 'this will stop the currently running time-lapse as soon as the current frame is completed.',
            buttons: [
                {
                    text: 'Cancel',
                    handler: function () {
                        console.log('Stop canceled');
                    }
                },
                {
                    text: 'STOP',
                    handler: function () {
                        _this.intervalometer.stop();
                    }
                }
            ]
        });
        confirm.present();
    };
    IntervalometerPage.prototype.startFrame = function () {
        if (this.viewApi.timelapse.frames.current) {
            if (this.viewApi.intervalometer.preview.playing)
                this.togglePlay();
            this.viewApi.intervalometer.preview.frameIndex = 0;
        }
    };
    IntervalometerPage.prototype.endFrame = function () {
        if (this.viewApi.timelapse.frames.current) {
            if (this.viewApi.intervalometer.preview.playing)
                this.togglePlay();
            this.viewApi.intervalometer.preview.frameIndex = this.viewApi.timelapse.frames.current.length - 1;
        }
    };
    IntervalometerPage.prototype.previousFrame = function () {
        if (this.viewApi.timelapse.frames.current) {
            if (this.viewApi.intervalometer.preview.playing)
                this.togglePlay();
            if (this.viewApi.intervalometer.preview.frameIndex > 0) {
                this.viewApi.intervalometer.preview.frameIndex--;
            }
        }
    };
    IntervalometerPage.prototype.nextFrame = function () {
        if (this.viewApi.timelapse.frames.current) {
            if (this.viewApi.intervalometer.preview.playing)
                this.togglePlay();
            if (this.viewApi.intervalometer.preview.frameIndex < this.viewApi.timelapse.frames.current.length - 1) {
                this.viewApi.intervalometer.preview.frameIndex++;
            }
        }
    };
    IntervalometerPage.prototype.updateFrame = function (event) {
        if (this.viewApi.timelapse.frames.current) {
            //if(clip.playing) this.togglePlay();
            if (this.viewApi.intervalometer.preview.frameIndex >= 0 && this.viewApi.intervalometer.preview.frameIndex < this.viewApi.timelapse.frames.current.length) {
                this.viewApi.intervalometer.preview.image = "data:image/jpeg;base64," + this.viewApi.timelapse.frames.current[this.viewApi.intervalometer.preview.frameIndex];
            }
        }
    };
    IntervalometerPage.prototype.togglePlay = function () {
        var _this = this;
        if (this.viewApi.timelapse.frames.current && this.viewApi.intervalometer.status.frames == this.viewApi.timelapse.frames.current.length) {
            if (this.viewApi.intervalometer.preview.playing) {
                clearInterval(this.intervalHandle);
                this.viewApi.intervalometer.preview.playing = false;
            }
            else {
                this.viewApi.intervalometer.preview.playing = true;
                if (this.viewApi.intervalometer.preview.frameIndex >= this.viewApi.timelapse.frames.current.length - 1)
                    this.viewApi.intervalometer.preview.frameIndex = 0;
                this.intervalHandle = setInterval(function () {
                    if (_this.viewApi.intervalometer.preview.frameIndex >= _this.viewApi.timelapse.frames.current.length - 1)
                        return _this.togglePlay();
                    _this.viewApi.intervalometer.preview.frameIndex++;
                }, 1000 / 30);
            }
        }
        else {
            if (!this.viewApi.intervalometer.preview.loadingFrames)
                this.viewApi.timelapse.getCurrentFrames(function () { _this.togglePlay(); });
        }
    };
    IntervalometerPage.prototype.focusOffset = function (steps) {
        this.viewApi.intervalometer.status.focusDiffNew += steps;
        this.viewApi.intervalometer.moveFocus(steps);
    };
    IntervalometerPage.prototype.moveTracking = function (axis, degrees) {
        this.viewApi.intervalometer.moveTracking(axis, degrees);
        if (!this.intervalometer.status.panDiffNew)
            this.intervalometer.status.panDiffNew = 0;
        if (!this.intervalometer.status.tiltDiffNew)
            this.intervalometer.status.tiltDiffNew = 0;
        if (axis == 'Tilt') {
            this.intervalometer.status.tiltDiffNew += degrees;
        }
        if (axis == 'Pan') {
            this.intervalometer.status.panDiffNew += degrees;
        }
    };
    IntervalometerPage.prototype.sendSchedule = function () {
        var newSchedule = {
            schedMonday: this.intervalometer.program.schedMonday,
            schedTuesday: this.intervalometer.program.schedTuesday,
            schedWednesday: this.intervalometer.program.schedWednesday,
            schedThursday: this.intervalometer.program.schedThursday,
            schedFriday: this.intervalometer.program.schedFriday,
            schedSaturday: this.intervalometer.program.schedSaturday,
            schedSunday: this.intervalometer.program.schedSunday,
            schedStart: this.intervalometer.program.schedStart,
            schedStop: this.intervalometer.program.schedStop
        };
        console.log("updateProgram:", newSchedule);
        this.viewApi.intervalometer.updateProgram(newSchedule);
    };
    IntervalometerPage.prototype.doSelect = function (list, object, key, title, callback) {
        var _this = this;
        var alert = this.alertCtrl.create();
        alert.setTitle(title || "select an option");
        for (var i = 0; i < list.length; i++) {
            var item = list[i];
            alert.addInput({
                type: 'radio',
                label: item.label || item.title || item.name,
                value: item.ev != null ? item.ev : item.value,
                checked: (item.value == object[key])
            });
        }
        alert.addButton('Cancel');
        alert.addButton({
            text: 'Ok',
            handler: function (data) {
                console.log('Radio data:', data);
                object[key] = data;
                if (callback)
                    callback.call(_this);
            }
        });
        alert.present();
    };
    IntervalometerPage.prototype.doSetting = function (list, model, title, set) {
        var _this = this;
        var alert = this.alertCtrl.create();
        alert.setTitle(title || "select an option");
        for (var i = 0; i < list.length; i++) {
            var item = list[i];
            alert.addInput({
                type: 'radio',
                label: item.label || item.title || item,
                value: item,
                checked: ((item.value || item.title || item) == (model.value || model.title || model))
            });
        }
        alert.addButton('Cancel');
        alert.addButton({
            text: 'Ok',
            handler: function (data) {
                console.log('Radio data:', data);
                if (!model)
                    model = {};
                for (var key in data) {
                    model[key] = data[key];
                }
                if (set) {
                    console.log("setting", set, "to", data.value);
                    _this.camera.set(set, data.value);
                }
            }
        });
        alert.present();
    };
    IntervalometerPage.prototype.doNumber = function (name, object, key) {
        var alert = this.alertCtrl.create();
        alert.setTitle(name || "select an option");
        alert.addInput({
            type: 'number',
            value: object[key]
        });
        alert.addButton('Cancel');
        alert.addButton({
            text: 'Ok',
            handler: function (data) {
                console.log('Number data:', data);
                object[key] = data[0];
            }
        });
        alert.present();
    };
    IntervalometerPage.prototype.formatSettingEv = function (list, ev) {
        for (var i = 0; i < list.length; i++) {
            if (list[i].ev == ev) {
                return list[i].name || list[i].title;
            }
        }
        return "---";
    };
    IntervalometerPage.prototype.formatSettingValue = function (list, value) {
        for (var i = 0; i < list.length; i++) {
            if (list[i].value == value) {
                return list[i].label;
            }
        }
        return "---";
    };
    IntervalometerPage.prototype.updateKeyframeChart = function () {
        if (!this.chart)
            return;
        this.chart.data = this.intervalometer.getChartData(0, false);
        this.chart.update();
    };
    IntervalometerPage.prototype.openKeyframe = function (index) {
        var _this = this;
        var modal = this.modalCtrl.create(KeyframeModalContentPage, { keyframeIndex: index });
        modal.onDidDismiss(function (data) {
            _this.updateKeyframeChart();
        });
        modal.present();
    };
    IntervalometerPage.prototype.openUpdate = function (title, item, currentValue, rampable, list) {
        if (typeof currentValue == 'number') {
            currentValue = Math.round(currentValue * 100) / 100; // limit precision
        }
        var modal = this.modalCtrl.create(UpdateModalContentPage, { title: title, item: item, value: currentValue, rampable: rampable, list: list });
        modal.onDidDismiss(function (data) {
        });
        modal.present();
    };
    IntervalometerPage.prototype.openRampingOptions = function () {
        var modal = this.modalCtrl.create(RampingModalContentPage, {});
        modal.onDidDismiss(function (data) {
        });
        modal.present();
    };
    IntervalometerPage.prototype.setup = function (axis) {
        var modal = this.modalCtrl.create(__WEBPACK_IMPORTED_MODULE_3__app_app_component__["b" /* MotionModalContentPage */], { axisId: axis.id });
        modal.present();
    };
    __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_0__angular_core__["ViewChild"])('chart'),
        __metadata("design:type", Object)
    ], IntervalometerPage.prototype, "chartCanvas", void 0);
    IntervalometerPage = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_0__angular_core__["Component"])({
            selector: 'page-intervalometer',template:/*ion-inline-start:"/Users/elijah/VIEW-App/src/pages/intervalometer/intervalometer.html"*/'<ion-header>\n  <ion-navbar>\n    <button ion-button menuToggle>\n      <ion-icon name="menu"></ion-icon>\n    </button>\n    <ion-title>Intervalometer</ion-title>\n  </ion-navbar>\n</ion-header>\n\n<ion-content>\n  <div *ngIf="!intervalometer.status.running">\n\n  <ion-list>\n\n    <ion-list-header>Time-lapse Mode</ion-list-header>\n\n    <ion-item>\n      <ion-segment [(ngModel)]="intervalometer.program.rampMode" color="dark" (ionChange)="intervalometer.reconfigureProgram(intervalometer.program)">\n        <ion-segment-button value="auto">\n          Auto Ramping\n        </ion-segment-button>\n        <ion-segment-button value="fixed">\n          Basic Fixed\n        </ion-segment-button>\n        <ion-segment-button value="eclipse">\n          Eclipse\n        </ion-segment-button>\n      </ion-segment>\n    </ion-item>\n    <ion-item *ngIf="intervalometer.program.rampMode==\'auto\'">\n      <ion-label>Ramping Options</ion-label>\n      <button ion-button outline item-end button-light (click)="openRampingOptions()">{{(intervalometer.program.rampParameters)+\', \'+(intervalometer.program.nightCompensation)+(intervalometer.program.highlightProtection?\', HL\':\'\')}}</button>\n      <!--button ion-button outline item-end button-light (click)="openRampingOptions()">{{(intervalometer.program.rampAlgorithm)+\', \'+(intervalometer.program.rampParameters)+\', \'+(intervalometer.program.nightCompensation)+(intervalometer.program.highlightProtection?\', HL\':\'\')}}</button-->\n    </ion-item>\n\n    <ion-item *ngIf="intervalometer.program.rampMode==\'auto\'&&!camera.apertureAvailable.length&&camera.connected">\n      <ion-label>Manual Aperture</ion-label>\n      <button ion-button outline item-end button-light (click)="doSelect(lists.manualAperture, intervalometer.program, \'manualAperture\', \'Manual Aperture\')">{{formatSettingValue(lists.manualAperture, intervalometer.program.manualAperture)}}</button>\n    </ion-item>\n\n    <ion-list-header *ngIf="intervalometer.program.rampMode!=\'eclipse\'">Interval Settings</ion-list-header>\n\n    <ion-item *ngIf="intervalometer.program.rampMode==\'auto\'">\n      <ion-segment [(ngModel)]="intervalometer.program.intervalMode" color="dark">\n        <ion-segment-button value="fixed">\n          Fixed\n        </ion-segment-button>\n        <ion-segment-button value="auto">\n          Auto Day/Night\n        </ion-segment-button>\n        <ion-segment-button value="aux" *ngIf="!intervalometer.program.schedule">\n          External AUX2\n        </ion-segment-button>\n      </ion-segment>\n    </ion-item>\n\n\n    <!-----------------   eclipse settings -------------------->\n\n    <div *ngIf="intervalometer.program.rampMode==\'eclipse\' && intervalometer.program.exposurePlans">\n      <ion-list inset>\n        <p>\n          {{intervalometer.program.eclipseInfo}}\n        </p>\n        <p>\n          First contact {{fromNow(intervalometer.program.eclipseFirstContact, true)}}\n        </p>\n      </ion-list>\n      <div *ngFor="let plan of intervalometer.program.exposurePlans; let i = index">\n        <ion-list-header>{{plan.name}} <span *ngIf="i>0">{{plan.start|date:\'d MMM h:mm:ss a ZZ\': utcCode(intervalometer.program.utcOffset)}} ({{fromNow(plan.start)}})</span><span *ngIf="i==0">(upon start)</span></ion-list-header>\n\n        <ion-list inset>\n\n          <ion-item>\n            <ion-label>Exposure Mode</ion-label>\n            <button ion-button outline item-end button-light (click)="doSelect(lists.exposureMode, plan, \'mode\', \'Exposure Mode\')">{{plan.mode}}</button>\n          </ion-item>\n\n          <ion-item *ngIf="plan.mode==\'preset\'">\n            <button ion-button outline item-end [disabled]="(camera.shutterAvailable.length) ? 0 : 2" (click)="doSelect(camera.shutterAvailable, plan, \'shutter\', \'Shutter Speed\')">{{formatSettingEv(camera.shutterAvailable, plan.shutter)}}</button>\n            <button ion-button outline item-end [disabled]="(camera.apertureAvailable.length) ? 0 : 2" (click)="doSelect(camera.apertureAvailable, plan, \'aperture\', \'Aperture\')">{{\'f/\'+formatSettingEv(camera.apertureAvailable, plan.aperture)}}</button>\n            <button ion-button outline item-end [disabled]="(camera.isoAvailable.length) ? 0 : 2" (click)="doSelect(camera.isoAvailable, plan, \'iso\', \'ISO\')">{{formatSettingEv(camera.isoAvailable, plan.iso)+\' ISO\'||\'---\'}}</button>\n          </ion-item>\n\n          <ion-item>\n            <ion-label>Interval Mode</ion-label>\n            <button ion-button outline item-end button-light (click)="doSelect(lists.intervalMode, plan, \'intervalMode\', \'Interval Mode\')">{{plan.intervalMode}}</button>\n          </ion-item>\n\n          <ion-item *ngIf="plan.intervalMode==\'auto\' && plan.mode==\'auto\'">\n            <ion-label>Day Interval</ion-label>\n            <button ion-button outline item-end button-light (click)="doNumber(\'Day Interval (seconds)\', plan, \'dayInterval\')">{{plan.dayInterval|number:\'1.0-1\'}} seconds</button>\n          </ion-item>\n          <ion-item *ngIf="plan.intervalMode==\'auto\' && plan.mode==\'auto\'">\n            <ion-label>Night Interval</ion-label>\n            <button ion-button outline item-end button-light (click)="doNumber(\'Night Interval (seconds)\', plan, \'nightInterval\')">{{plan.nightInterval|number:\'1.0-1\'}} seconds</button>\n          </ion-item>\n          <ion-item *ngIf="plan.intervalMode==\'fixed\' || plan.mode!=\'auto\'">\n            <ion-label>Interval</ion-label>\n            <button ion-button outline item-end button-light (click)="doNumber(\'Fixed Interval (seconds)\', plan, \'interval\')">{{plan.interval|number:\'1.0-1\'}} seconds</button>\n          </ion-item>\n\n          <ion-item>\n            <ion-label>Bracketing</ion-label>\n            <button ion-button outline item-end button-light (click)="doSelect(lists.bracketing, plan, \'hdrCount\', \'Bracketing Mode\')">{{plan.hdrCount<2?\'single\':\'multi\'}}</button>\n          </ion-item>\n          <ion-item *ngIf="plan.hdrCount>1">\n            <ion-label>Bracketing Frames</ion-label>\n            <button ion-button outline item-end button-light (click)="doSelect(lists.bracketingFrames, plan, \'hdrCount\', \'Bracketing Frames/Set\')">{{plan.hdrCount}}</button>\n          </ion-item>\n          <ion-item *ngIf="plan.hdrCount>1">\n            <ion-label>Bracketing Stops/Frame</ion-label>\n            <button ion-button outline item-end button-light (click)="doSelect(lists.bracketingStops, plan, \'hdrStops\', \'Bracketing Stops/Frame\')">{{plan.hdrStops|number:\'1.1-1\'}}</button>\n          </ion-item>\n        \n        </ion-list>\n\n      </div>\n    </div>\n\n    <!-----------------  end eclipse settings -------------------->\n\n    <ion-item *ngIf="(intervalometer.program.rampMode==\'auto\' && intervalometer.program.intervalMode==\'auto\')">\n      <ion-label>Day Interval</ion-label>\n      <button ion-button outline item-end button-light (click)="doNumber(\'Day Interval (seconds)\', intervalometer.program, \'dayInterval\')">{{intervalometer.program.dayInterval|number:\'1.0-1\'}} seconds</button>\n    </ion-item>\n    <ion-item *ngIf="(intervalometer.program.rampMode==\'auto\' && intervalometer.program.intervalMode==\'auto\')">\n      <ion-label>Night Interval</ion-label>\n      <button ion-button outline item-end button-light (click)="doNumber(\'Night Interval (seconds)\', intervalometer.program, \'nightInterval\')">{{intervalometer.program.nightInterval|number:\'1.0-1\'}} seconds</button>\n    </ion-item>\n    <ion-item *ngIf="(intervalometer.program.rampMode==\'fixed\' || intervalometer.program.intervalMode==\'fixed\') && intervalometer.program.rampMode!=\'eclipse\'">\n      <ion-label>Interval</ion-label>\n      <button ion-button outline item-end button-light (click)="doNumber(\'Fixed Interval (seconds)\', intervalometer.program, \'interval\')">{{intervalometer.program.interval|number:\'1.0-1\'}} seconds</button>\n    </ion-item>\n\n    <ion-list-header *ngIf="intervalometer.program.rampMode!=\'eclipse\'">Frames &amp; Schedule</ion-list-header>\n\n    <ion-item *ngIf="intervalometer.program.rampMode!=\'eclipse\'">\n      <ion-label>Enable Scheduling</ion-label>\n      <button ion-button outline item-end button-light (click)="doSelect(lists.enableDisable, intervalometer.program, \'scheduled\', \'Enable Scheduling\')">{{intervalometer.program.scheduled?\'enabled\':\'disabled\'}}</button>\n    </ion-item>\n    <ion-item *ngIf="(intervalometer.program.rampMode==\'fixed\' || intervalometer.program.intervalMode==\'fixed\') && !intervalometer.program.scheduled && intervalometer.program.rampMode!=\'eclipse\'">\n      <ion-label>Frames</ion-label>\n      <button ion-button outline item-end button-light (click)="doNumber(\'Frames\', intervalometer.program, \'frames\')">{{intervalometer.program.frames}}</button>\n    </ion-item>\n    <ion-item *ngIf="!(intervalometer.program.rampMode==\'fixed\' || intervalometer.program.intervalMode==\'fixed\') && !intervalometer.program.scheduled && intervalometer.program.rampMode!=\'eclipse\'">\n      <ion-label>Frames</ion-label>\n      <button ion-button outline item-end button-light disabled="2">until stopped</button>\n    </ion-item>\n    <ion-item *ngIf="intervalometer.program.rampMode==\'auto\'">\n      <ion-label>Bracketing</ion-label>\n      <button ion-button outline item-end button-light (click)="doSelect(lists.bracketing, intervalometer.program, \'hdrCount\', \'Bracketing Mode\')">{{intervalometer.program.hdrCount<2?\'single\':\'multi\'}}</button>\n    </ion-item>\n    <ion-item *ngIf="intervalometer.program.hdrCount>1&&intervalometer.program.rampMode==\'auto\'">\n      <ion-label>Bracketing Frames</ion-label>\n      <button ion-button outline item-end button-light (click)="doSelect(lists.bracketingFrames, intervalometer.program, \'hdrCount\', \'Bracketing Frames/Set\')">{{intervalometer.program.hdrCount}}</button>\n    </ion-item>\n    <ion-item *ngIf="intervalometer.program.hdrCount>1&&intervalometer.program.rampMode==\'auto\'">\n      <ion-label>Bracketing Stops/Frame</ion-label>\n      <button ion-button outline item-end button-light (click)="doSelect(lists.bracketingStops, intervalometer.program, \'hdrStops\', \'Bracketing Stops/Frame\')">{{intervalometer.program.hdrStops|number:\'1.1-1\'}}</button>\n    </ion-item>\n\n    <ion-list-header *ngIf="intervalometer.program.scheduled && intervalometer.program.rampMode!=\'eclipse\'">Time-lapse Schedule</ion-list-header>\n\n    <ion-item *ngIf="intervalometer.program.scheduled && intervalometer.program.rampMode!=\'eclipse\'">\n      <button ion-button item-end button-light class="compressed" *ngIf="intervalometer.program.schedMonday" (click)="intervalometer.program.schedMonday=!intervalometer.program.schedMonday">Mo</button>\n      <button ion-button outline item-end button-light class="compressed" *ngIf="!intervalometer.program.schedMonday" (click)="intervalometer.program.schedMonday=!intervalometer.program.schedMonday">Mo</button>\n\n      <button ion-button item-end button-light class="compressed" *ngIf="intervalometer.program.schedTuesday" (click)="intervalometer.program.schedTuesday=!intervalometer.program.schedTuesday">Tu</button>\n      <button ion-button outline item-end button-light class="compressed" *ngIf="!intervalometer.program.schedTuesday" (click)="intervalometer.program.schedTuesday=!intervalometer.program.schedTuesday">Tu</button>\n\n      <button ion-button item-end button-light class="compressed" *ngIf="intervalometer.program.schedWednesday" (click)="intervalometer.program.schedWednesday=!intervalometer.program.schedWednesday">We</button>\n      <button ion-button outline item-end button-light class="compressed" *ngIf="!intervalometer.program.schedWednesday" (click)="intervalometer.program.schedWednesday=!intervalometer.program.schedWednesday">We</button>\n\n      <button ion-button item-end button-light class="compressed" *ngIf="intervalometer.program.schedThursday" (click)="intervalometer.program.schedThursday=!intervalometer.program.schedThursday">Th</button>\n      <button ion-button outline item-end button-light class="compressed" *ngIf="!intervalometer.program.schedThursday" (click)="intervalometer.program.schedThursday=!intervalometer.program.schedThursday">Th</button>\n\n      <button ion-button item-end button-light class="compressed" *ngIf="intervalometer.program.schedFriday" (click)="intervalometer.program.schedFriday=!intervalometer.program.schedFriday">Fr</button>\n      <button ion-button outline item-end button-light class="compressed" *ngIf="!intervalometer.program.schedFriday" (click)="intervalometer.program.schedFriday=!intervalometer.program.schedFriday">Fr</button>\n\n      <button ion-button item-end button-light class="compressed" *ngIf="intervalometer.program.schedSaturday" (click)="intervalometer.program.schedSaturday=!intervalometer.program.schedSaturday">Sa</button>\n      <button ion-button outline item-end button-light class="compressed" *ngIf="!intervalometer.program.schedSaturday" (click)="intervalometer.program.schedSaturday=!intervalometer.program.schedSaturday">Sa</button>\n\n      <button ion-button item-end button-light class="" *ngIf="intervalometer.program.schedSunday" (click)="intervalometer.program.schedSunday=!intervalometer.program.schedSunday">Su</button>\n      <button ion-button outline item-end button-light class="" *ngIf="!intervalometer.program.schedSunday" (click)="intervalometer.program.schedSunday=!intervalometer.program.schedSunday">Su</button>\n    </ion-item>\n\n    <ion-item *ngIf="intervalometer.program.scheduled && intervalometer.program.rampMode!=\'eclipse\'">\n      <ion-label>Daily Start Time</ion-label>\n      <button ion-button outline item-end button-light (click)="doSelect(lists.timeOfDay, intervalometer.program, \'schedStart\', \'Daily Start Time\')">{{intervalometer.program.schedStart || \'08:00\'}}</button>\n    </ion-item>\n\n    <ion-item *ngIf="intervalometer.program.scheduled && intervalometer.program.rampMode!=\'eclipse\'">\n      <ion-label>Daily Stop Time</ion-label>\n      <button ion-button outline item-end button-light (click)="doSelect(lists.timeOfDay, intervalometer.program, \'schedStop\', \'Daily Start Time\')">{{intervalometer.program.schedStop || \'18:00\'}}</button>\n    </ion-item>\n\n\n    <ion-list-header *ngIf="showAxisSetup && !intervalometer.program.scheduled">Motion &amp; Focus</ion-list-header>\n\n    <ion-item *ngIf="camera && camera.supports && camera.supports.focus && intervalometer.program.axes.focus && !intervalometer.program.scheduled">\n      <ion-label>Focus</ion-label>\n      <button ion-button outline item-end button-light (click)="doSelect(lists.focusOptions, intervalometer.program.axes.focus, \'type\', \'Axis Mode\', updateAxisTypes)">{{intervalometer.program.axes.focus.type}}</button>\n    </ion-item>\n\n    <div *ngFor="let a of motion.axis">\n      <ion-item  *ngIf="intervalometer.program.axes[a.id] && !intervalometer.program.scheduled">\n        <ion-label>{{a.id}} ({{a.name}})</ion-label>\n        <button *ngIf="a.motor" ion-button outline  color="primary" (click)="setup(a)" item-start>\n          <ion-icon name="settings"></ion-icon>\n        </button>\n        <button *ngIf="a.name==\'Pan\'&&intervalometer.program.axes[a.id]" ion-button outline item-end button-light (click)="doSelect(lists.motionOptionsPan, intervalometer.program.axes[a.id], \'type\', \'Axis Mode\', updateAxisTypes)">{{intervalometer.program.axes[a.id].type}}</button>\n        <button *ngIf="a.name==\'Polar\'&&intervalometer.program.axes[a.id]" ion-button outline item-end button-light (click)="doSelect(lists.motionOptionsPolar, intervalometer.program.axes[a.id], \'type\', \'Axis Mode\', updateAxisTypes)">{{intervalometer.program.axes[a.id].type}}</button>\n        <button *ngIf="a.name==\'Tilt\'&&intervalometer.program.axes[a.id]" ion-button outline item-end button-light (click)="doSelect(lists.motionOptionsTilt, intervalometer.program.axes[a.id], \'type\', \'Axis Mode\', updateAxisTypes)">{{intervalometer.program.axes[a.id].type}}</button>\n        <button *ngIf="a.name!=\'Pan\'&&a.name!=\'Tilt\'&&a.name!=\'Polar\'&&intervalometer.program.axes[a.id]" ion-button outline item-end button-light (click)="doSelect(lists.motionOptionsOther, intervalometer.program.axes[a.id], \'type\', \'Axis Mode\', updateAxisTypes)">{{intervalometer.program.axes[a.id].type}}</button>\n      </ion-item>\n\n      <ion-list inset *ngIf="intervalometer.program.axes[a.id] && intervalometer.program.axes[a.id].type==\'constant\' && !intervalometer.program.scheduled">\n        <ion-item>\n          <ion-label>Degrees per hour</ion-label>\n          <button ion-button outline item-end button-light (click)="doNumber(\'Degrees per hour\', intervalometer.program.axes[a.id], \'rate\')">{{intervalometer.program.axes[a.id].rate||15}}°/hour</button>\n        </ion-item>\n        <ion-item>\n          <ion-label>Direction</ion-label>\n          <button *ngIf="a.name==\'Pan\'" ion-button outline item-end button-light (click)="doSelect(lists.panDirection, intervalometer.program.axes[a.id], \'reverse\', \'Pan Direction\')">{{intervalometer.program.axes[a.id].reverse?\'left\':\'right\'}}</button>\n          <button *ngIf="a.name==\'Tilt\'" ion-button outline item-end button-light (click)="doSelect(lists.tiltDirection, intervalometer.program.axes[a.id], \'reverse\', \'Tilt Direction\')">{{intervalometer.program.axes[a.id].reverse?\'down\':\'up\'}}</button>\n        </ion-item>\n      </ion-list>\n      <ion-list inset *ngIf="intervalometer.program.axes[a.id] && intervalometer.program.axes[a.id].type==\'tracking\' && !intervalometer.program.scheduled">\n        <ion-item>\n          <ion-label>Follow below horizon?</ion-label>\n          <button ion-button outline item-end button-light (click)="doSelect(lists.yesNoBool, intervalometer.program.axes[a.id], \'trackBelowHorizon\', \'Track below horizon\')">{{intervalometer.program.axes[a.id].trackBelowHorizon?\'yes\':\'no\'}}</button>\n        </ion-item>\n      </ion-list>\n      <ion-list inset *ngIf="intervalometer.program.axes[a.id] && intervalometer.program.axes[a.id].type==\'polar\' && !intervalometer.program.scheduled">\n        <ion-item>\n          <ion-label>Axis Alignment</ion-label>\n          <button ion-button outline item-end button-light (click)="doSelect(lists.polarAxes, intervalometer.program.axes[a.id], \'reverse\', \'Axis Alignment\')">{{intervalometer.program.axes[a.id].reverse?\'South\':\'North\'}}</button>\n        </ion-item>\n      </ion-list>\n    </div>\n\n    <ion-list *ngIf="axisTypes.tracking && !intervalometer.program.scheduled">\n      <ion-item>\n        <ion-label>Tracking Target</ion-label>\n        <button ion-button outline item-end button-light (click)="doSelect(lists.trackingTarget, intervalometer.program, \'trackingTarget\', \'Tracking Target\')">follow {{intervalometer.program.trackingTarget}}</button>\n      </ion-item>\n    </ion-list>\n\n    <div [hidden]="!(axisTypes.keyframe && !intervalometer.program.scheduled)">\n      <ion-item (click)="openKeyframe(0)">\n        <canvas #chart height="100px"></canvas>\n      </ion-item>\n    </div>\n\n\n  </ion-list>\n\n  <ion-grid>\n    <ion-row align-items-center>\n      <ion-col>\n        <div class="text-center"><button ion-button outline small icon-start color="light" [disabled]="(camera.connected && !intervalometer.program.scheduled) ? 0: 2" (click)="doSelect(lists.delay, intervalometer.program, \'delay\', \'Delay Start\', start)"><ion-icon name="timer"></ion-icon>delay</button></div>\n      </ion-col>\n      <ion-col>\n        <div class="text-center"><button ion-button round color="success" [disabled]="camera.connected ? 0: 2" (click)="intervalometer.program.delay=1;start(intervalometer.program)">START</button></div>\n      </ion-col>\n      <ion-col>\n        <div class="text-center"><button ion-button outline small icon-start color="light" (click)="saveProgram(intervalometer.program)"><ion-icon name="checkmark"></ion-icon>save</button></div>\n      </ion-col>\n    </ion-row>\n    <ion-row align-items-center>\n      <ion-col>\n        <div class="text-center"><span *ngIf="!camera.connected">connect camera to enable</span></div>\n      </ion-col>\n    </ion-row>\n  </ion-grid>\n\n\n  </div>\n  <div *ngIf="intervalometer.status.running">\n  \n  <ion-grid>\n    <ion-row>\n      <ion-col>\n        <div *ngIf="!intervalometer.preview.image" style="width: 100%; height: 250px; background-color: #488aff; opacity: 0.25;"></div>\n        <img *ngIf="intervalometer.preview.image" [src]="intervalometer.preview.image" width="100%">\n      </ion-col>\n    </ion-row>\n    <ion-row>\n      <ion-col>\n        <ion-item>\n          <ion-range [(ngModel)]="intervalometer.preview.frameIndex" min="0" max="{{frames.current ? frames.current.length - 1 : 1}}" (ionChange)="updateFrame($event)"></ion-range>\n        </ion-item>\n      </ion-col>\n    </ion-row>\n    <ion-row>\n      <ion-col class="no-padding">\n        <button ion-fab mini color="dark" [disabled]="(intervalometer.preview.loadingFrames || intervalometer.preview.frameIndex == 0) ? 2 : 0" (click)="startFrame()"><ion-icon name="skip-backward"></ion-icon></button>\n      </ion-col>\n      <ion-col class="no-padding">\n        <button ion-fab mini color="dark" [disabled]="(intervalometer.preview.loadingFrames || intervalometer.preview.frameIndex == 0) ? 2 : 0" (click)="previousFrame()"><ion-icon name="rewind"></ion-icon></button>\n      </ion-col>\n      <ion-col class="no-padding">\n        <button ion-fab color="success" [disabled]="intervalometer.preview.loadingFrames ? 2 : 0" (click)="togglePlay()"><ion-icon name="{{intervalometer.preview.playing ? \'pause\' : \'play\'}}" *ngIf="!intervalometer.preview.loadingFrames"></ion-icon><span *ngIf="intervalometer.preview.loadingFrames">{{intervalometer.preview.loadingFramesPercent}}%</span></button>\n      </ion-col>\n      <ion-col class="no-padding">\n        <button ion-fab mini color="dark" [disabled]="(intervalometer.preview.loadingFrames || intervalometer.preview.frameIndex >= frames.current.length - 1) ? 2 : 0" (click)="nextFrame()"><ion-icon name="fastforward"></ion-icon></button>\n      </ion-col>\n      <ion-col class="no-padding">\n        <button ion-fab mini color="dark" [disabled]="(intervalometer.preview.loadingFrames || intervalometer.preview.frameIndex >= frames.current.length - 1) ? 2 : 0" (click)="endFrame()"><ion-icon name="skip-forward"></ion-icon></button>\n      </ion-col>\n    </ion-row>\n\n    <ion-row *ngIf="intervalometer.status.trackingPanEnabled||intervalometer.status.trackingTiltEnabled||camera.supports.focus||intervalometer.program.scheduled">\n      <ion-col>\n        <ion-segment [(ngModel)]="viewMode">\n          <ion-segment-button value="status">\n            Status\n          </ion-segment-button>\n          <ion-segment-button value="motion" *ngIf="intervalometer.status.trackingPanEnabled||intervalometer.status.trackingTiltEnabled||camera.supports.focus">\n            Motion/Focus\n          </ion-segment-button>\n          <ion-segment-button value="schedule" *ngIf="intervalometer.program.scheduled">\n            Schedule\n          </ion-segment-button>\n        </ion-segment>\n      </ion-col>\n    </ion-row>\n\n    <ion-row *ngIf="!viewMode||viewMode==\'status\'">\n      <ion-col>\n        <ion-list no-lines>\n          <ion-item *ngIf="intervalometer.program.rampMode==\'auto\'">\n            <div  *ngFor="let col of camera.histogram" style="width:0.390625%; background-color: #ddd; float: left;" [style.height]="col/6 + \'px\'" [style.margin-top]="48-col/6 + \'px\'"></div>\n          </ion-item>\n          <ion-list-header>\n            Time-lapse Running\n          </ion-list-header>\n          <ion-item>\n            {{intervalometer.status.message}} <span *ngIf="camera.status">|</span> {{camera.status}}\n          </ion-item>\n          <ion-item>\n            {{intervalometer.status.frames}} frames ({{intervalometer.status.frames/30|number:\'1.0-1\'}}s @30fps)\n            <button *ngIf="intervalometer.program.intervalMode==\'fixed\'" ion-button outline item-end (click)="openUpdate(\'Total Frames\', \'frames\', intervalometer.program.frames, false, [])">of {{intervalometer.program.frames}}</button>\n          </ion-item>\n          <ion-item *ngIf="intervalometer.program.rampMode==\'auto\'">\n            Ramping: \n            <button ion-button outline item-end (click)="openUpdate(\'Exposure Mode\', \'rampMode\', intervalometer.status.rampMode, false, [{label: \'Auto Ramping\', value: \'auto\'},{label: \'Fixed/Manual\', value: \'fixed\'}])">{{intervalometer.status.rampMode}}</button>\n            <button *ngIf="intervalometer.status.rampMode==\'auto\'&&intervalometer.status.exposure&&intervalometer.status.exposure.status.manualOffsetEv!=null&&intervalometer.status.dynamicChange" [color]="intervalometer.status.dynamicChange.manualOffsetEv?\'danger\':\'primary\'" ion-button outline item-end (click)="openUpdate(\'Exposure Offset\', \'manualOffsetEv\', intervalometer.status.exposure.status.manualOffsetEv, true, [])">offset {{intervalometer.status.exposure.status.manualOffsetEv|number:\'1.0-1\'}} stops</button>\n            <button *ngIf="intervalometer.status.rampMode==\'fixed\'&&intervalometer.status.dynamicChange" [color]="intervalometer.status.dynamicChange.rampEv?\'danger\':\'primary\'" ion-button outline item-end (click)="openUpdate(\'Manual Ramp\', \'rampEv\', 0, true, [{label: \'+6 stops\', value:-6},{label: \'+5 stops\', value:-5},{label: \'+4 stops\', value:-4},{label: \'+3 stops\', value:-3},{label: \'+2 stops\', value:-2},{label: \'+1 2/3 stops\', value:-1.6666},{label: \'+1 1/3 stops\', value:-1.3333},{label: \'+1 stop\', value:-1},{label: \'+2/3 stop\', value:-0.6666},{label: \'+1/3 stop\', value:-0.3333},{label: \'no change\', value:0},{label: \'-1/3 stop\', value:0.3333},{label: \'-2/3 stop\', value:0.6666},{label: \'-1 stop\', value:1},{label: \'-1 1/3 stops\', value:1.3333},{label: \'-1 2/3 stops\', value:1.6666},{label: \'-2 stops\', value:2},{label: \'-3 stops\', value:3},{label: \'-4 stops\', value:4},{label: \'-5 stops\', value:5},{label: \'-6 stops\', value:6}])">Manual Ramp ({{intervalometer.status.rampEv|number:\'1.0-1\'}} EV)</button>\n          </ion-item>\n          <ion-item *ngIf="intervalometer.status.rampMode==\'auto\'&&intervalometer.status.exposure&&intervalometer.status.exposure.status.dayRefEv!=null&&intervalometer.status.exposure.status.nightRefEv!=null&&intervalometer.status.exposure.status.nightRatio!=null">\n            <button *ngIf="intervalometer.status.dynamicChange" [color]="intervalometer.status.dynamicChange.dayRefEv?\'danger\':\'primary\'" ion-button outline item-start (click)="openUpdate(\'Day Exposure Reference\', \'dayRefEv\', intervalometer.status.exposure.status.dayRefEv, true, [])">day {{intervalometer.status.exposure.status.dayRefEv|number:\'1.0-1\'}}</button>\n            <div style="border-bottom: 1px dashed #555; width: 90%; height: 1.5em; display:block;margin-left:0.6em;top:-0.75em;position:relative;">\n              <div [style.width]="intervalometer.status.exposure.status.nightRatio*100+\'%\'" style="height:0.5em;display:inline-block"></div>\n              <div [style.width]="(1-intervalometer.status.exposure.status.nightRatio)*100+\'%\'" style="border-left: 3px solid #fff;height:0.5em;display:inline-block;top:0.75em;position:relative;"></div>\n            </div>\n            <button *ngIf="intervalometer.status.dynamicChange" [color]="intervalometer.status.dynamicChange.nightRefEv?\'danger\':\'primary\'" ion-button outline item-end (click)="openUpdate(\'Night Exposure Reference\', \'nightRefEv\', intervalometer.status.exposure.status.nightRefEv, true, [])">night {{intervalometer.status.exposure.status.nightRefEv|number:\'1.0-1\'}}</button>\n          </ion-item>\n          <ion-item *ngIf="intervalometer.status.cameraSettings&&intervalometer.status.rampMode==\'auto\'">\n            Exposure: {{intervalometer.status.cameraSettings.shutter}} f/{{intervalometer.status.cameraSettings.aperture}} {{intervalometer.status.cameraSettings.iso}} ISO\n          </ion-item>\n          <ion-item *ngIf="intervalometer.status.cameraSettings&&intervalometer.status.rampMode!=\'auto\'">\n            Exposure:\n            <button ion-button outline item-end [disabled]="(camera.shutterAvailable.length) ? 0 : 2" (click)="doSetting(camera.shutterAvailable, camera.shutter, \'Shutter Speed\', \'shutter\')">{{camera.shutter.title||\'---\'}}</button>\n            <button ion-button outline item-end [disabled]="(camera.apertureAvailable.length) ? 0 : 2" (click)="doSetting(camera.apertureAvailable, camera.aperture, \'Aperture\', \'aperture\')">{{\'f/\'+camera.aperture.title||\'---\'}}</button>\n            <button ion-button outline item-end [disabled]="(camera.isoAvailable.length) ? 0 : 2" (click)="doSetting(camera.isoAvailable, camera.iso, \'ISO\', \'iso\')">{{camera.iso.title+\' ISO\'||\'---\'}}</button>\n          </ion-item>\n\n\n          <ion-item *ngIf="intervalometer.program.intervalMode!=\'fixed\'">\n            Current Interval: {{intervalometer.status.intervalMs/1000|number:\'1.0-1\'}}s\n            <button *ngIf="intervalometer.program.intervalMode!=\'aux\'" ion-button outline item-end (click)="openUpdate(\'Interval Mode\', \'intervalMode\', intervalometer.program.intervalMode, false, [{label: \'Auto Variable\', value: \'auto\'},{label: \'Fixed Interval\', value: \'fixed\'}])">{{intervalometer.program.intervalMode}}</button>\n          </ion-item>\n          <ion-item *ngIf="intervalometer.program.intervalMode==\'fixed\'">\n            Interval: {{intervalometer.status.intervalMs/1000|number:\'1.0-1\'}}s <button *ngIf="intervalometer.status.dynamicChange" [color]="intervalometer.status.dynamicChange.interval?\'danger\':\'primary\'" ion-button outline item-end (click)="openUpdate(\'Interval\', \'interval\', intervalometer.program.interval, true, [])">edit</button>\n            <button *ngIf="intervalometer.program.rampMode==\'auto\'" ion-button outline item-end (click)="openUpdate(\'Interval Mode\', \'intervalMode\', intervalometer.program.intervalMode, false, [{label: \'Auto Variable\', value: \'auto\'},{label: \'Fixed Interval\', value: \'fixed\'}])">{{intervalometer.program.intervalMode}}</button>\n          </ion-item>\n          <ion-item *ngIf="intervalometer.program.intervalMode==\'auto\'">\n            Day Interval: {{intervalometer.program.dayInterval|number:\'1.0-1\'}}s <button *ngIf="intervalometer.status.dynamicChange" [color]="intervalometer.status.dynamicChange.dayInterval?\'danger\':\'primary\'" ion-button outline item-end (click)="openUpdate(\'Day Interval\', \'dayInterval\', intervalometer.program.dayInterval, true, [])">edit</button>\n          </ion-item>\n          <ion-item *ngIf="intervalometer.program.intervalMode==\'auto\'">\n            Night Interval: {{intervalometer.program.nightInterval|number:\'1.0-1\'}}s <button *ngIf="intervalometer.status.dynamicChange" [color]="intervalometer.status.dynamicChange.nightInterval?\'danger\':\'primary\'" ion-button outline item-end (click)="openUpdate(\'Night Interval\',\'nightInterval\', intervalometer.program.nightInterval, true, [])">edit</button>\n          </ion-item>\n        </ion-list>\n      </ion-col>\n    </ion-row>\n\n    <ion-row *ngIf="viewMode==\'motion\'">\n      <ion-card *ngIf="intervalometer.status.trackingPanEnabled||intervalometer.status.trackingTiltEnabled">\n        <ion-col>\n          <ion-row *ngIf="intervalometer.status.trackingPanEnabled">\n            <ion-col text-center>\n              <button ion-button outline color="light" (click)="moveTracking(\'Pan\', -0.5)" [disabled]="intervalometer.status.panDiff!=intervalometer.status.panDiffNew?2:0"><ion-icon name="arrow-back"></ion-icon>&nbsp;0.5°</button>\n            </ion-col>\n            <ion-col text-center>\n              <button ion-button outline color="light" (click)="moveTracking(\'Pan\', -0.1)" [disabled]="intervalometer.status.panDiff!=intervalometer.status.panDiffNew?2:0"><ion-icon name="arrow-back"></ion-icon></button>\n            </ion-col>\n            <ion-col text-center>\n              Tracking<br>\n              Pan 0.1°<br>\n            </ion-col>\n            <ion-col text-center>\n              <button ion-button outline color="light" (click)="moveTracking(\'Pan\', 0.1)" [disabled]="intervalometer.status.panDiff!=intervalometer.status.panDiffNew?2:0"><ion-icon name="arrow-forward"></ion-icon></button>\n            </ion-col>\n            <ion-col text-center>\n              <button ion-button outline color="light" (click)="moveTracking(\'Pan\', 0.5)" [disabled]="intervalometer.status.panDiff!=intervalometer.status.panDiffNew?2:0">0.5°&nbsp;<ion-icon name="arrow-forward"></ion-icon></button>\n            </ion-col>\n          </ion-row>\n          <ion-row *ngIf="intervalometer.status.trackingTiltEnabled">\n            <ion-col text-center>\n              <button ion-button outline color="light" (click)="moveTracking(\'Tilt\', -0.5)" [disabled]="intervalometer.status.tiltDiff!=intervalometer.status.tiltDiffNew?2:0"><ion-icon name="arrow-down"></ion-icon>&nbsp;0.5°</button>\n            </ion-col>\n            <ion-col text-center>\n              <button ion-button outline color="light" (click)="moveTracking(\'Tilt\', -0.1)" [disabled]="intervalometer.status.tiltDiff!=intervalometer.status.tiltDiffNew?2:0"><ion-icon name="arrow-down"></ion-icon></button>\n            </ion-col>\n            <ion-col text-center>\n              Tracking<br>\n              Tilt 0.1°<br>\n            </ion-col>\n            <ion-col text-center>\n              <button ion-button outline color="light" (click)="moveTracking(\'Tilt\', 0.1)" [disabled]="intervalometer.status.tiltDiff!=intervalometer.status.tiltDiffNew?2:0"><ion-icon name="arrow-up"></ion-icon></button>\n            </ion-col>\n            <ion-col text-center>\n              <button ion-button outline color="light" (click)="moveTracking(\'Tilt\', 0.5)" [disabled]="intervalometer.status.tiltDiff!=intervalometer.status.tiltDiffNew?2:0">0.5°&nbsp;<ion-icon name="arrow-up"></ion-icon></button>\n            </ion-col>\n          </ion-row>\n          <ion-row>\n            <ion-col>\n              <p style="color:#DDD">This allows for tracking correction while the time-lapse is running and in tracking mode.</p>\n            </ion-col>\n          </ion-row>\n        </ion-col>\n      </ion-card>\n      <ion-card *ngIf="camera && camera.supports && camera.supports.focus">\n        <ion-col>\n          <ion-row>\n            <ion-col text-center>\n              <button ion-button outline color="light" (click)="focusOffset(-1)"><ion-icon name="skip-backward"></ion-icon></button>\n            </ion-col>\n            <ion-col text-center>\n              Adjust Focus<br>\n              NEAR - FAR<br>\n              <span *ngIf="intervalometer.status.focusDiffNew">Pending: {{intervalometer.status.focusDiffNew > 0 ? \'+\':\'\'}}{{intervalometer.status.focusDiffNew}}</span>\n            </ion-col>\n            <ion-col text-center>\n              <button ion-button outline color="light" (click)="focusOffset(1)"><ion-icon name="skip-forward"></ion-icon></button>\n            </ion-col>\n          </ion-row>\n          <ion-row>\n            <ion-col>\n              <p style="color:#DDD">This allows for focus fine-tuning while the time-lapse is running.  For each time the near or far buttons are pressed, the focus will move by one step after the next frame.</p>\n            </ion-col>\n          </ion-row>\n        </ion-col>\n      </ion-card>\n    </ion-row>\n\n\n    <ion-row *ngIf="viewMode==\'schedule\'">\n      <ion-col text-center>\n        <ion-list no-lines>\n          <ion-item *ngIf="intervalometer.program.scheduled">\n            <button ion-button item-end button-light class="compressed" *ngIf="intervalometer.program.schedMonday" (click)="intervalometer.program.schedMonday=!intervalometer.program.schedMonday;sendSchedule()">Mo</button>\n            <button ion-button outline item-end button-light class="compressed" *ngIf="!intervalometer.program.schedMonday" (click)="intervalometer.program.schedMonday=!intervalometer.program.schedMondaysendSchedule()">Mo</button>\n\n            <button ion-button item-end button-light class="compressed" *ngIf="intervalometer.program.schedTuesday" (click)="intervalometer.program.schedTuesday=!intervalometer.program.schedTuesday;sendSchedule()">Tu</button>\n            <button ion-button outline item-end button-light class="compressed" *ngIf="!intervalometer.program.schedTuesday" (click)="intervalometer.program.schedTuesday=!intervalometer.program.schedTuesday;sendSchedule()">Tu</button>\n\n            <button ion-button item-end button-light class="compressed" *ngIf="intervalometer.program.schedWednesday" (click)="intervalometer.program.schedWednesday=!intervalometer.program.schedWednesday;sendSchedule()">We</button>\n            <button ion-button outline item-end button-light class="compressed" *ngIf="!intervalometer.program.schedWednesday" (click)="intervalometer.program.schedWednesday=!intervalometer.program.schedWednesday;sendSchedule()">We</button>\n\n            <button ion-button item-end button-light class="compressed" *ngIf="intervalometer.program.schedThursday" (click)="intervalometer.program.schedThursday=!intervalometer.program.schedThursday;sendSchedule()">Th</button>\n            <button ion-button outline item-end button-light class="compressed" *ngIf="!intervalometer.program.schedThursday" (click)="intervalometer.program.schedThursday=!intervalometer.program.schedThursday;sendSchedule()">Th</button>\n\n            <button ion-button item-end button-light class="compressed" *ngIf="intervalometer.program.schedFriday" (click)="intervalometer.program.schedFriday=!intervalometer.program.schedFriday;sendSchedule()">Fr</button>\n            <button ion-button outline item-end button-light class="compressed" *ngIf="!intervalometer.program.schedFriday" (click)="intervalometer.program.schedFriday=!intervalometer.program.schedFriday;sendSchedule()">Fr</button>\n\n            <button ion-button item-end button-light class="compressed" *ngIf="intervalometer.program.schedSaturday" (click)="intervalometer.program.schedSaturday=!intervalometer.program.schedSaturday;sendSchedule()">Sa</button>\n            <button ion-button outline item-end button-light class="compressed" *ngIf="!intervalometer.program.schedSaturday" (click)="intervalometer.program.schedSaturday=!intervalometer.program.schedSaturday;sendSchedule()">Sa</button>\n\n            <button ion-button item-end button-light class="" *ngIf="intervalometer.program.schedSunday" (click)="intervalometer.program.schedSunday=!intervalometer.program.schedSunday;sendSchedule()">Su</button>\n            <button ion-button outline item-end button-light class="" *ngIf="!intervalometer.program.schedSunday" (click)="intervalometer.program.schedSunday=!intervalometer.program.schedSunday;sendSchedule()">Su</button>\n          </ion-item>\n\n          <ion-item *ngIf="intervalometer.program.scheduled">\n            <ion-label>Daily Start Time</ion-label>\n            <button ion-button outline item-end button-light (click)="doSelect(lists.timeOfDay, intervalometer.program, \'schedStart\', \'Daily Start Time\');sendSchedule()">{{intervalometer.program.schedStart || \'08:00\'}}</button>\n          </ion-item>\n\n          <ion-item *ngIf="intervalometer.program.scheduled">\n            <ion-label>Daily Stop Time</ion-label>\n            <button ion-button outline item-end button-light (click)="doSelect(lists.timeOfDay, intervalometer.program, \'schedStop\', \'Daily Start Time\');sendSchedule()">{{intervalometer.program.schedStop || \'18:00\'}}</button>\n          </ion-item>\n\n        </ion-list>\n      </ion-col>\n    </ion-row>\n\n    <ion-row>\n      <ion-col>\n        <div class="center" *ngIf="!viewApi.noDevice&&viewApi.connected" style="width:100%;min-width:100%">\n          <small *ngIf="camera.battery">Camera battery: <b>{{camera.battery}}</b>, </small><small> VIEW battery: <b>{{viewApi.battery}}%</b></small>\n        </div>\n        <hr/>\n      </ion-col>\n    </ion-row>\n\n    <ion-row>\n      <ion-col>\n        <div class="text-center"><button ion-button round color="danger" (click)="stop()">STOP</button></div>\n      </ion-col>\n    </ion-row>\n\n  </ion-grid>\n  </div>\n</ion-content>\n'/*ion-inline-end:"/Users/elijah/VIEW-App/src/pages/intervalometer/intervalometer.html"*/
        }),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_1_ionic_angular__["i" /* NavController */], __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["a" /* AlertController */], __WEBPACK_IMPORTED_MODULE_2__providers_view_view__["a" /* ViewProvider */], __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["g" /* ModalController */], __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["c" /* Events */]])
    ], IntervalometerPage);
    return IntervalometerPage;
}());

var UpdateModalContentPage = (function () {
    function UpdateModalContentPage(params, viewCtrl, viewApi, alertCtrl
        //private modalCtrl: ModalController
    ) {
        this.params = params;
        this.viewCtrl = viewCtrl;
        this.viewApi = viewApi;
        this.alertCtrl = alertCtrl;
        this.camera = {};
        this.program = {};
        this.intervalometer = {};
        this.item = "";
        this.value = null;
        this.rampable = false;
        this.list = [];
        this.title = "";
        this.updateObj = { frames: 30 };
        this.rampOptions = [
            { label: 'Apply Immediately', value: 0 },
            { label: 'Apply across 10 frames', value: 10 },
            { label: 'Apply across 20 frames', value: 20 },
            { label: 'Apply across 30 frames', value: 30 },
            { label: 'Apply across 40 frames', value: 40 },
            { label: 'Apply across 50 frames', value: 50 },
            { label: 'Apply across 60 frames', value: 60 },
            { label: 'Apply across 90 frames', value: 90 },
            { label: 'Apply across 120 frames', value: 120 },
            { label: 'Apply across 180 frames', value: 180 },
            { label: 'Apply across 240 frames', value: 240 }
        ];
        this.program = this.viewApi.intervalometer.program;
        this.intervalometer = this.viewApi.intervalometer;
        this.camera = this.viewApi.camera;
        this.item = this.params.get('item');
        this.value = this.params.get('value');
        this.updateObj.value = this.value;
        this.rampable = this.params.get('rampable');
        this.list = this.params.get('list');
        this.title = this.params.get('title');
    }
    UpdateModalContentPage.prototype.doSelect = function (list, object, key, title, callback) {
        var _this = this;
        var alert = this.alertCtrl.create();
        alert.setTitle(title || "select an option");
        for (var i = 0; i < list.length; i++) {
            var item = list[i];
            alert.addInput({
                type: 'radio',
                label: item.label,
                value: item.value,
                checked: (item.value == object[key])
            });
        }
        alert.addButton('Cancel');
        alert.addButton({
            text: 'Ok',
            handler: function (data) {
                console.log('Radio data:', data);
                object[key] = data;
                if (callback)
                    callback.call(_this);
            }
        });
        alert.present();
    };
    UpdateModalContentPage.prototype.doNumber = function (name, object, key) {
        var alert = this.alertCtrl.create();
        alert.setTitle(name || "select an option");
        alert.addInput({
            type: 'number',
            value: object[key]
        });
        alert.addButton('Cancel');
        alert.addButton({
            text: 'Ok',
            handler: function (data) {
                console.log('Number data:', data);
                object[key] = data[0];
            }
        });
        alert.present();
    };
    UpdateModalContentPage.prototype.apply = function () {
        console.log("updating", this.item, "to", this.updateObj.value);
        this.intervalometer.dynamicChange(this.item, this.updateObj.value, this.updateObj.frames);
        this.dismiss();
    };
    UpdateModalContentPage.prototype.dismiss = function () {
        this.viewCtrl.dismiss();
    };
    UpdateModalContentPage = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_0__angular_core__["Component"])({
            selector: 'page-update',template:/*ion-inline-start:"/Users/elijah/VIEW-App/src/pages/intervalometer/update.modal.html"*/'<ion-header>\n  <ion-toolbar>\n    <ion-title>\n      Live Update\n    </ion-title>\n    <ion-buttons start>\n      <button ion-button (click)="dismiss()">\n        <ion-icon name="close"></ion-icon>\n      </button>\n    </ion-buttons>\n  </ion-toolbar>\n</ion-header>\n\n<ion-content no-lines>\n  <ion-grid>\n    <ion-row>\n      <ion-col>\n        <ion-item *ngIf="list.length == 0">\n          <ion-label>{{title}}</ion-label>\n          <button ion-button outline item-end button-light (click)="doNumber(title, updateObj, \'value\')">{{updateObj.value|number:\'1.0-1\'}}</button>\n        </ion-item>\n        <ion-item *ngIf="list.length > 0">\n          <ion-label>{{title}}</ion-label>\n          <button ion-button outline item-end button-light (click)="doSelect(list, updateObj, \'value\', title)">{{updateObj.value}}</button>\n        </ion-item>\n        <ion-item *ngIf="rampable">\n          <ion-label>Apply changes</ion-label>\n          <button ion-button outline item-end button-light (click)="doSelect(rampOptions, updateObj, \'frames\', title)">\n            <span *ngIf="updateObj.frames==0">Immediately</span>\n            <span *ngIf="updateObj.frames>0">over {{updateObj.frames}} frames</span>\n          </button>\n        </ion-item>\n      </ion-col>\n    </ion-row>\n    <ion-row *ngIf=intervalometer.status.dynamicChange[item]>\n      <ion-col>\n        <p>\n          The {{title}} is currently ramping to {{intervalometer.status.dynamicChange[item].endVal}} over the next {{intervalometer.status.dynamicChange[item].endFrame - intervalometer.status.frames}} frames.  Any new changes will replace this schedule and start from the current value of <span *ngIf="list.length > 0">{{value}}</span><span *ngIf="list.length == 0">{{value|number:\'1.0-1\'}}</span>.\n        </p>\n      </ion-col>\n    </ion-row>\n    <ion-row>\n      <ion-col>\n        <br>\n        <button ion-button item-end (click)="apply()" [disabled]="updateObj.value==value?2:0">\n          Apply Change\n        </button>\n        <button ion-button item-end outline (click)="dismiss()">\n          Cancel\n        </button>\n      </ion-col>\n    </ion-row>\n  </ion-grid>\n\n</ion-content>\n'/*ion-inline-end:"/Users/elijah/VIEW-App/src/pages/intervalometer/update.modal.html"*/
        }),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_1_ionic_angular__["j" /* NavParams */],
            __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["m" /* ViewController */],
            __WEBPACK_IMPORTED_MODULE_2__providers_view_view__["a" /* ViewProvider */],
            __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["a" /* AlertController */]
            //private modalCtrl: ModalController
        ])
    ], UpdateModalContentPage);
    return UpdateModalContentPage;
}());

var RampingModalContentPage = (function () {
    function RampingModalContentPage(viewCtrl, viewApi, alertCtrl
        //private modalCtrl: ModalController
    ) {
        this.viewCtrl = viewCtrl;
        this.viewApi = viewApi;
        this.alertCtrl = alertCtrl;
        this.program = {};
        this.isoList = [];
        this.apertureList = [];
        this.shutterList = [];
        this.lists = {
            rampAlgorithm: [
                { label: 'PID Luminance', value: 'lum' },
                { label: 'LRTimelapse', value: 'lrt' }
            ],
            rampParameters: [
                { label: 'Shutter, ISO', value: 'S+I' },
                { label: 'Shutter, ISO (balanced)', value: 'S=I' },
                { label: 'Shutter, ISO, Aperture', value: 'S+I+A' },
                { label: 'Shutter, ISO, Aperture (balanced)', value: 'S=I=A' }
            ],
            nightLuminance: [
                { label: '-3 stops', value: -3 },
                { label: '-2.5 stops', value: -2.5 },
                { label: '-2 stops', value: -2 },
                { label: '-1.5  stops (default)', value: -1.5 },
                { label: '-1 stop', value: -1 },
                { label: '-0.5 stops', value: -0.5 },
                { label: '0 stops', value: 0 },
                { label: '0.5 stops', value: 0.5 },
                { label: '1 stop', value: 1 },
                { label: '1.5 stops', value: 1.5 },
                { label: '2 stops', value: 2 },
            ],
            dayLuminance: [
                { label: '-1.5 stops', value: -1.5 },
                { label: '-1 stop', value: -1 },
                { label: '-0.5 stops', value: -0.5 },
                { label: '0  stops (default)', value: 0 },
                { label: '+0.5 stop', value: 0.5 },
                { label: '+1 stop', value: 1 },
                { label: '+1.5 stops', value: 1.5 },
            ],
        };
        this.program = this.viewApi.intervalometer.program;
        var camera = this.viewApi.camera;
        if (camera.isoAvailable.length) {
            this.isoList = camera.isoAvailable.map(function (item) { return { label: item.title, value: item.ev }; }).filter(function (item) { return item.value != null; });
            this.isoList.unshift({ label: 'no limit', value: null });
        }
        if (camera.apertureAvailable.length) {
            this.apertureList = camera.apertureAvailable.map(function (item) { return { label: item.title, value: item.ev }; }).filter(function (item) { return item.value != null; });
            this.apertureList.unshift({ label: 'no limit', value: null });
        }
        if (camera.shutterAvailable.length) {
            this.shutterList = camera.shutterAvailable.map(function (item) { return { label: item.title, value: item.ev }; }).filter(function (item) { return item.value != null; });
            this.shutterList.unshift({ label: 'no limit', value: null });
        }
    }
    RampingModalContentPage.prototype.mapEv = function (ev, list) {
        if (ev === null)
            return 'no limit';
        ev = Math.floor(ev * 10);
        for (var i = 0; i < list.length; i++) {
            if (list[i].value == null)
                continue;
            if (ev == Math.floor(list[i].value * 10))
                return list[i].label;
        }
        console.log("not found in list:", ev, list);
        return ev;
    };
    RampingModalContentPage.prototype.doSelect = function (list, object, key, title, callback) {
        var _this = this;
        var alert = this.alertCtrl.create();
        alert.setTitle(title || "select an option");
        for (var i = 0; i < list.length; i++) {
            var item = list[i];
            alert.addInput({
                type: 'radio',
                label: item.label,
                value: item.value,
                checked: (item.value === object[key])
            });
        }
        alert.addButton('Cancel');
        alert.addButton({
            text: 'Ok',
            handler: function (data) {
                if (data === "")
                    data = null;
                console.log('Radio data:', data, typeof (data));
                object[key] = data;
                if (callback)
                    callback.call(_this);
            }
        });
        alert.present();
    };
    RampingModalContentPage.prototype.dismiss = function () {
        this.viewCtrl.dismiss();
    };
    RampingModalContentPage = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_0__angular_core__["Component"])({
            selector: 'page-update',template:/*ion-inline-start:"/Users/elijah/VIEW-App/src/pages/intervalometer/ramping.modal.html"*/'<ion-header>\n  <ion-toolbar>\n    <ion-title>\n      Ramping Options\n    </ion-title>\n    <ion-buttons start>\n      <button ion-button (click)="dismiss()">\n        <ion-icon name="close"></ion-icon>\n      </button>\n    </ion-buttons>\n  </ion-toolbar>\n</ion-header>\n\n<ion-content no-lines>\n  <ion-grid>\n    <ion-row>\n      <ion-col>\n        <!--ion-item>\n          <ion-label>Ramping Algorithm</ion-label>\n          <button ion-button outline item-end button-light (click)="doSelect(lists.rampAlgorithm, program, \'rampAlgorithm\', \'Ramping Algorithm\')">{{program.rampAlgorithm}}</button>\n        </ion-item-->\n        <ion-item>\n          <ion-label>Ramp Parameters</ion-label>\n          <button ion-button outline item-end button-light (click)="doSelect(lists.rampParameters, program, \'rampParameters\', \'Ramp Parameters\')">{{program.rampParameters}}</button>\n        </ion-item>\n        <ion-item>\n          <ion-label>Night Luminance Target</ion-label>\n          <button ion-button outline item-end button-light (click)="doSelect(lists.nightLuminance, program, \'nightLuminance\', \'Night Luminance\')">{{program.nightLuminance}}</button>\n        </ion-item>\n        <ion-item>\n          <ion-label>Day Luminance Target</ion-label>\n          <button ion-button outline item-end button-light (click)="doSelect(lists.dayLuminance, program, \'dayLuminance\', \'Day Luminance\')">{{program.dayLuminance}}</button>\n        </ion-item>\n        <ion-item>\n          <ion-label>Highlight Protection</ion-label>\n          <ion-toggle color="primary" [(ngModel)]="program.highlightProtection"></ion-toggle>\n        </ion-item>\n        <ion-item *ngIf="isoList.length">\n          <ion-label>Maximum ISO</ion-label>\n          <button ion-button outline item-end button-light (click)="doSelect(isoList, program, \'isoMax\', \'Maximum ISO\')">{{mapEv(program.isoMax, isoList)}}</button>\n        </ion-item>\n        <ion-item *ngIf="isoList.length">\n          <ion-label>Minimum ISO</ion-label>\n          <button ion-button outline item-end button-light (click)="doSelect(isoList, program, \'isoMin\', \'Mininum ISO\')">{{mapEv(program.isoMin, isoList)}}</button>\n        </ion-item>\n        <ion-item *ngIf="apertureList.length">\n          <ion-label>Maximum Aperture</ion-label>\n          <button ion-button outline item-end button-light (click)="doSelect(apertureList, program, \'apertureMax\', \'Maximum Aperture\')">{{mapEv(program.apertureMax, apertureList)}}</button>\n        </ion-item>\n        <ion-item *ngIf="apertureList.length">\n          <ion-label>Minimum Aperture</ion-label>\n          <button ion-button outline item-end button-light (click)="doSelect(apertureList, program, \'apertureMin\', \'Mininum Aperture\')">{{mapEv(program.apertureMin, apertureList)}}</button>\n        </ion-item>\n        <ion-item *ngIf="shutterList.length">\n          <ion-label>Maximum Shutter</ion-label>\n          <button ion-button outline item-end button-light (click)="doSelect(shutterList, program, \'shutterMax\', \'Maximum Shutter\')">{{mapEv(program.shutterMax, shutterList)}}</button>\n        </ion-item>\n      </ion-col>\n    </ion-row>\n  </ion-grid>\n\n</ion-content>\n'/*ion-inline-end:"/Users/elijah/VIEW-App/src/pages/intervalometer/ramping.modal.html"*/
        }),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_1_ionic_angular__["m" /* ViewController */],
            __WEBPACK_IMPORTED_MODULE_2__providers_view_view__["a" /* ViewProvider */],
            __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["a" /* AlertController */]
            //private modalCtrl: ModalController
        ])
    ], RampingModalContentPage);
    return RampingModalContentPage;
}());

var KeyframeModalContentPage = (function () {
    function KeyframeModalContentPage(params, viewCtrl, viewApi, alertCtrl, modalCtrl, events) {
        var _this = this;
        this.params = params;
        this.viewCtrl = viewCtrl;
        this.viewApi = viewApi;
        this.alertCtrl = alertCtrl;
        this.modalCtrl = modalCtrl;
        this.events = events;
        this.motion = {};
        this.keyframes = [];
        this.camera = {};
        this.axes = {};
        this.axesArray = [];
        this.program = {};
        this.intervalometer = {};
        this.colors = {};
        this.posSeconds = 0;
        this.noUpdatePosSeconds = 0;
        this.xSlide = 0;
        this.f = {
            pos: 0
        };
        this.lengthString = "";
        this.selectionString = "";
        this.motion = this.viewApi.motion;
        if (!this.viewApi.intervalometer.program.axes)
            this.viewApi.intervalometer.program.axes = {};
        this.axes = this.viewApi.intervalometer.program.axes;
        for (var key in this.axes) {
            this.axesArray.push(this.axes[key]);
        }
        this.program = this.viewApi.intervalometer.program;
        this.intervalometer = this.viewApi.intervalometer;
        this.camera = this.viewApi.camera;
        this.colors = this.viewApi.colors;
        setTimeout(function () {
            _this.updateLengthStrings(0, 0);
            _this.refreshChart();
        });
        events.subscribe('motion.updated', function () {
            console.log("event: motion updated");
            _this.refreshChart();
        });
        events.subscribe('camera.updated', function () {
            console.log("event: motion updated");
            _this.refreshChart();
        });
    }
    KeyframeModalContentPage.prototype.doDuration = function (name, object, key) {
        var _this = this;
        var alert = this.alertCtrl.create();
        alert.setTitle(name || "enter a duration");
        if (object === false)
            object = this;
        var val = object[key];
        var s = val % 60;
        val -= s;
        val /= 60;
        var m = val % 60;
        val -= m;
        val /= 60;
        var h = val;
        alert.addInput({
            placeholder: 'hours',
            type: 'number',
            value: h.toString()
        });
        alert.addInput({
            placeholder: 'minutes',
            type: 'number',
            value: m.toString()
        });
        alert.addInput({
            placeholder: 'seconds',
            type: 'number',
            value: s.toString()
        });
        alert.addButton('Cancel');
        alert.addButton({
            text: 'Ok',
            handler: function (data) {
                object[key] = (parseInt(data[0]) || 0) * 3600 + (parseInt(data[1]) || 0) * 60 + (parseInt(data[2]) || 0);
                console.log('Seconds data:', data, object[key]);
                if (_this.posSeconds > _this.program.durationSeconds)
                    _this.posSeconds = _this.program.durationSeconds;
                var posSeconds = _this.posSeconds;
                var newSlidePos = Math.round((_this.posSeconds / _this.program.durationSeconds) * 100);
                console.log("jumping to ", _this.posSeconds, "seconds = ", newSlidePos);
                _this.updateLengthStrings(newSlidePos, (_this.xSlide == newSlidePos) ? 1 : 2);
                _this.xSlide = newSlidePos;
                _this.posSeconds = posSeconds;
                _this.refreshChart();
            }
        });
        alert.present();
    };
    KeyframeModalContentPage.prototype.toggleInterpolation = function (axis) {
        if (axis.interpolation == 'linear') {
            axis.interpolation = 'smooth';
        }
        else {
            axis.interpolation = 'linear';
        }
        this.refreshChart();
    };
    KeyframeModalContentPage.prototype.interpolate = function (method, keyframes, xPos) {
        if (method == 'linear') {
            return this.interpolateLinear(keyframes, xPos);
        }
        else {
            return this.interpolateSmooth(keyframes, xPos);
        }
    };
    KeyframeModalContentPage.prototype.interpolateLinear = function (keyframes, xVal) {
        var xyPoints = keyframes.map(function (kf) {
            return {
                x: kf.seconds,
                y: kf.position || 0
            };
        }).sort(function (a, b) {
            if (a.x < b.x)
                return -1;
            if (a.x > b.x)
                return 1;
            return 0;
        });
        // validate and sort by x
        var p = xyPoints.filter(function (item) {
            return item.x !== undefined && item.y !== undefined;
        }).sort(function (a, b) {
            if (a.x < b.x)
                return -1;
            if (a.x > b.x)
                return 1;
            return 0;
        });
        if (typeof p != 'object' || !p.length)
            return null;
        var limits = { max: p[0].y, min: p[0].y };
        for (var i = 0; i < p.length; i++) {
            if (limits.max < p[i].y)
                limits.max = p[i].y;
            if (limits.min > p[i].y)
                limits.min = p[i].y;
        }
        var res = null;
        for (var i = 0; i < p.length; i++) {
            if (i == 0 && xVal <= p[i].x) {
                res = p[i].y;
                break;
            }
            if (i > 0 && xVal < p[i].x) {
                var xRange = p[i].x - p[i - 1].x;
                var factor = (xVal - p[i - 1].x) / xRange;
                if (factor <= 1.0) {
                    var yRange = p[i].y - p[i - 1].y;
                    res = p[i - 1].y + yRange * factor;
                    break;
                }
            }
            if (i == p.length - 1 && xVal >= p[i].x) {
                res = p[i].y;
                break;
            }
        }
        // safety check
        if (res > limits.max)
            res = limits.max;
        if (res < limits.min)
            res = limits.min;
        return res;
    };
    KeyframeModalContentPage.prototype.interpolateSmooth = function (keyframes, xPos) {
        var smoothStep = function (x) {
            return x * x * (3 - 2 * x);
        };
        var pointSlope = function (index, dataPoints) {
            var slope = 0;
            if (index > 0 && index < dataPoints.length - 1) {
                if ((dataPoints[index - 1].y < dataPoints[index].y && dataPoints[index].y < dataPoints[index + 1].y) || (dataPoints[index - 1].y > dataPoints[index].y && dataPoints[index].y > dataPoints[index + 1].y)) {
                    var xSpan = dataPoints[index].x - dataPoints[index - 1].x;
                    var ySpan = dataPoints[index].y - dataPoints[index - 1].y;
                    var slope1 = ySpan / xSpan;
                    xSpan = dataPoints[index + 1].x - dataPoints[index].x;
                    ySpan = dataPoints[index + 1].y - dataPoints[index].y;
                    var slope2 = ySpan / xSpan;
                    var t = (dataPoints[index].x - dataPoints[index - 1].x) / (dataPoints[index + 1].x - dataPoints[index - 1].x);
                    slope = (slope1 * (1 - t)) + (slope2 * t);
                }
            }
            return slope;
        };
        var smooth = function (xyPoints, xVal) {
            var lastIndex = null;
            var nextIndex = null;
            for (var i = 0; i < xyPoints.length; i++) {
                if (lastIndex == null || xyPoints[i].x <= xVal)
                    lastIndex = i;
                if (xyPoints[i].x > xVal) {
                    nextIndex = i;
                    break;
                }
            }
            if (nextIndex == null)
                nextIndex = xyPoints.length - 1;
            var tSpan = (xyPoints[nextIndex].x - xyPoints[lastIndex].x);
            if (tSpan == 0)
                return xyPoints[lastIndex].y;
            var t = (xVal - xyPoints[lastIndex].x) / tSpan;
            var tS = smoothStep(t);
            var lastSlope = pointSlope(lastIndex, xyPoints);
            var nextSlope = pointSlope(nextIndex, xyPoints);
            var lastVal = xyPoints[lastIndex].y;
            var nextVal = xyPoints[nextIndex].y;
            var d1 = 1;
            var d2 = 1;
            if (Math.abs(nextVal - lastVal) > 0 && lastSlope > 0)
                d1 = (lastSlope * tSpan) / Math.abs(nextVal - lastVal);
            if (Math.abs(nextVal - lastVal) > 0 && nextSlope > 0)
                d2 = (nextSlope * tSpan) / Math.abs(nextVal - lastVal);
            var y1 = lastVal + (lastSlope * t * tSpan) / (1 + d1 * t);
            var y2 = nextVal - (nextSlope * (1 - t) * tSpan) / (1 + d2 * (1 - t));
            if (y1 > Math.max(lastVal, nextVal))
                y1 = Math.max(lastVal, nextVal);
            if (y2 > Math.max(lastVal, nextVal))
                y2 = Math.max(lastVal, nextVal);
            if (y1 < Math.min(lastVal, nextVal))
                y1 = Math.min(lastVal, nextVal);
            if (y2 < Math.min(lastVal, nextVal))
                y2 = Math.min(lastVal, nextVal);
            var y = (y1 * (1 - tS)) + (y2 * tS);
            return y;
        };
        var points = keyframes.map(function (kf) {
            return {
                x: kf.seconds,
                y: kf.position || 0
            };
        }).sort(function (a, b) {
            if (a.x < b.x)
                return -1;
            if (a.x > b.x)
                return 1;
            return 0;
        });
        return smooth(points, xPos);
    };
    KeyframeModalContentPage.prototype.updateLengthStrings = function (percent, noUpdatePosSeconds) {
        if (!percent)
            percent = 0;
        var h = Math.floor(this.program.durationSeconds / 3600);
        var m = Math.floor((this.program.durationSeconds - h * 3600) / 60);
        var s = this.program.durationSeconds % 60;
        this.lengthString = "";
        if (h > 0)
            this.lengthString = h.toString() + "h";
        if (m < 10)
            this.lengthString += "0";
        this.lengthString += m.toString() + "m";
        if (!h || s) {
            if (s < 10)
                this.lengthString += "0";
            this.lengthString += s.toString() + "s";
        }
        if (!noUpdatePosSeconds && !this.noUpdatePosSeconds)
            this.posSeconds = Math.round(this.program.durationSeconds * (percent / 100));
        h = Math.floor(this.posSeconds / 3600);
        m = Math.floor((this.posSeconds - h * 3600) / 60);
        s = this.posSeconds % 60;
        this.selectionString = "";
        if (h > 0)
            this.selectionString = h.toString() + "h";
        if (m < 10)
            this.selectionString += "0";
        this.selectionString += m.toString() + "m";
        if (s < 10)
            this.selectionString += "0";
        this.selectionString += s.toString() + "s";
        this.noUpdatePosSeconds = noUpdatePosSeconds == 2 ? 1 : 0;
    };
    KeyframeModalContentPage.prototype.refreshChart = function () {
        for (var m in this.axes) {
            if (this.axes[m].type != 'keyframe')
                continue;
            if (!this.axes[m].kf)
                this.axes[m].kf = [];
            this.axes[m].prevKeyframe = null;
            this.axes[m].nextKeyframe = null;
            this.axes[m].selected = false;
            this.axes[m].atStartOrEnd = false;
            this.axes[m].canMove = true;
            var tolorance = 0;
            if (this.axes[m].motor && this.axes[m].motor.unitSteps)
                tolorance = this.axes[m].motor.unitSteps / 100;
            for (var i = 0; i < this.axes[m].kf.length; i++) {
                if (Math.round((this.axes[m].kf[i].seconds / this.program.durationSeconds) * 100) == Math.round((this.posSeconds / this.program.durationSeconds) * 100)) {
                    this.axes[m].selected = true;
                    this.posSeconds = this.axes[m].kf[i].seconds;
                    this.updateLengthStrings(this.xSlide, 1);
                    var posDiff = Math.abs(Math.round(this.axes[m].motor ? this.axes[m].motor.pos : this.axes[m].pos) - Math.round(this.axes[m].kf[i].position));
                    if (posDiff <= tolorance) {
                        this.axes[m].atPos = true;
                        this.axes[m].canMove = false;
                    }
                    else {
                        this.axes[m].atPos = false;
                    }
                    if (this.posSeconds == this.program.durationSeconds || this.posSeconds == 0)
                        this.axes[m].atStartOrEnd = true;
                }
                else {
                    var interpolatedPosition = this.interpolate(this.axes[m].interpolation, this.axes[m].kf, this.posSeconds);
                    var posDiff = Math.abs(Math.round(this.axes[m].motor ? this.axes[m].motor.pos : this.axes[m].pos) - Math.round(interpolatedPosition));
                    if (posDiff <= tolorance) {
                        this.axes[m].canMove = false;
                    }
                    if (Math.round(this.axes[m].kf[i].seconds) < this.posSeconds && (this.axes[m].prevKeyframe === null || this.axes[m].kf[i].seconds > this.axes[m].prevKeyframe))
                        this.axes[m].prevKeyframe = this.axes[m].kf[i].seconds;
                    if (Math.round(this.axes[m].kf[i].seconds) > this.posSeconds && (this.axes[m].nextKeyframe === null || this.axes[m].kf[i].seconds < this.axes[m].nextKeyframe))
                        this.axes[m].nextKeyframe = this.axes[m].kf[i].seconds;
                }
            }
        }
        if (this.chart) {
            this.chart.data = this.intervalometer.getChartData(this.posSeconds, true);
            this.chart.update();
        }
    };
    KeyframeModalContentPage.prototype.updateX = function (x) {
        var newSlidePos = Math.round((x / this.program.durationSeconds) * 100);
        console.log("jumping to ", x, "seconds = ", newSlidePos);
        this.updateLengthStrings(newSlidePos, (this.xSlide == newSlidePos) ? 1 : 2);
        this.xSlide = newSlidePos;
        this.posSeconds = x;
        this.refreshChart();
    };
    KeyframeModalContentPage.prototype.moveToCurrent = function (axisId) {
        var _this = this;
        var currentPos = this.axes[axisId].motor ? this.axes[axisId].motor.pos : this.axes[axisId].pos;
        var targetPos = null;
        for (var i = 0; i < this.axes[axisId].kf.length; i++) {
            if (Math.round(this.axes[axisId].kf[i].seconds) == this.posSeconds) {
                targetPos = this.axes[axisId].kf[i].position;
                break;
            }
        }
        if (targetPos === null) {
            targetPos = this.interpolate(this.axes[axisId].interpolation, this.axes[axisId].kf, this.posSeconds);
        }
        console.log("moving", axisId, "from", currentPos, "to", targetPos);
        var steps = targetPos - currentPos;
        if (axisId == 'focus') {
            if (!this.axes[axisId].pos)
                this.axes[axisId].pos = 0;
            this.axes[axisId].pos += steps;
            this.camera.focus(Math.sign(steps), Math.abs(steps), true, function (err, position) {
                _this.axes[axisId].pos = position;
                console.log(axisId + " position " + position);
                _this.refreshChart();
            });
        }
        else if (this.axes[axisId].motor) {
            this.motion.move(axisId, steps, true, function (err, position) {
                console.log(axisId + " position " + position);
                console.log("this.motion.axis", _this.motion.axis);
                _this.refreshChart();
            });
        }
    };
    KeyframeModalContentPage.prototype.moveAxis = function (axisId, speed) {
        var _this = this;
        if (axisId == 'focus') {
            var steps = speed;
            if (!this.axes[axisId].pos)
                this.axes[axisId].pos = 0;
            this.axes[axisId].pos += steps;
            this.camera.focus(Math.sign(steps), Math.abs(steps), true, function (err, position) {
                _this.axes[axisId].pos = position;
                console.log(axisId + " position " + position);
                _this.refreshChart();
            });
        }
        else if (this.axes[axisId].motor) {
            speed /= 10;
            if (speed < -1)
                speed = -1;
            if (speed > 1)
                speed = 1;
            console.log("moving", axisId, "at speed", speed);
            this.motion.moveConstant(axisId, speed, function (err, position) {
                console.log(axisId + " position " + position);
                console.log("this.motion.axis", _this.motion.axis);
                _this.refreshChart();
            });
        }
    };
    KeyframeModalContentPage.prototype.setHomePos = function () {
        return; // experiement with not starting at zero -- important for Ronin
        //let moved = false;
        //for(let axisId in this.axes) {
        //  if(this.axes[axisId].kf && this.axes[axisId].kf.length > 0 && this.axes[axisId].type == 'keyframe' && axisId != 'focus') { // focus position doesn't get reset
        //    let homePos = this.axes[axisId].kf[0].position;
        //    if(homePos != 0) {
        //      for (let i = 0; i < this.axes[axisId].kf.length; i++) {
        //        this.axes[axisId].kf[i].position -= homePos;
        //      }
        //      moved = true;
        //      let curPos = this.axes[axisId].motor ? this.axes[axisId].motor.pos : this.axes[axisId].pos;
        //      let newPos = curPos - homePos;
        //      if(this.axes[axisId].motor) {
        //        this.motion.setAxisPosition(axisId, newPos);
        //        console.log("updating", axisId, "position to", newPos);
        //        this.motion.axis[this.motion.getAxisIndex(axisId)].pos = newPos;
        //      } else {
        //        this.axes[axisId].pos = newPos;
        //      }
        //    }
        //  }
        //}
    };
    KeyframeModalContentPage.prototype.addKeyframe = function (axisId) {
        this.axes[axisId].kf.push({
            seconds: this.posSeconds,
            position: (this.axes[axisId].motor ? this.axes[axisId].motor.pos : this.axes[axisId].pos) || 0
        });
        this.setHomePos();
        this.refreshChart();
    };
    KeyframeModalContentPage.prototype.removeKeyframe = function (axisId) {
        for (var i = 0; i < this.axes[axisId].kf.length; i++) {
            if (Math.round(this.axes[axisId].kf[i].seconds) == this.posSeconds) {
                this.axes[axisId].kf.splice(i, 1);
            }
        }
        this.refreshChart();
    };
    KeyframeModalContentPage.prototype.updateKeyframe = function (axisId) {
        console.log("updateKeyframe", axisId);
        for (var i = 0; i < this.axes[axisId].kf.length; i++) {
            if (Math.round(this.axes[axisId].kf[i].seconds) == this.posSeconds) {
                this.axes[axisId].kf[i].position = (this.axes[axisId].motor ? this.axes[axisId].motor.pos : this.axes[axisId].pos) || 0;
                console.log("updateKeyframe -- found", axisId);
                this.setHomePos();
                break;
            }
        }
        this.refreshChart();
    };
    KeyframeModalContentPage.prototype.setup = function (axis) {
        var modal = this.modalCtrl.create(__WEBPACK_IMPORTED_MODULE_3__app_app_component__["b" /* MotionModalContentPage */], { axisId: axis.id });
        modal.present();
    };
    KeyframeModalContentPage.prototype.ionViewDidLoad = function () {
        this.chart = new __WEBPACK_IMPORTED_MODULE_4_chart_js__["Chart"](this.chartCanvas.nativeElement, {
            type: 'line',
            data: this.intervalometer.getChartData(this.posSeconds, true),
            options: {
                animation: false,
                legend: {
                    display: false,
                },
                layout: {
                    padding: {
                        top: 10,
                        bottom: 10
                    }
                },
                scales: {
                    yAxes: [{
                            display: false,
                            ticks: {
                                beginAtZero: true,
                            }
                        }],
                    xAxes: [{
                            type: 'time',
                            distribution: 'linear',
                            time: {
                                round: 'second',
                                displayFormats: {
                                    second: 'H:mm:ss',
                                    minute: 'H:mm',
                                    hour: 'H:mm',
                                    day: 'H:mm'
                                }
                            }
                        }]
                }
            }
        });
    };
    KeyframeModalContentPage.prototype.dismiss = function () {
        if (this.camera.lv)
            this.camera.liveview();
        this.viewCtrl.dismiss();
    };
    __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_0__angular_core__["ViewChild"])('chart'),
        __metadata("design:type", Object)
    ], KeyframeModalContentPage.prototype, "chartCanvas", void 0);
    KeyframeModalContentPage = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_0__angular_core__["Component"])({
            selector: 'page-keyframe',template:/*ion-inline-start:"/Users/elijah/VIEW-App/src/pages/intervalometer/keyframe.modal.html"*/'<ion-header>\n  <ion-toolbar>\n    <ion-title>\n      Keyframe Setup\n    </ion-title>\n    <ion-buttons start>\n      <button ion-button (click)="dismiss()">\n        <ion-icon name="close"></ion-icon>\n      </button>\n    </ion-buttons>\n  </ion-toolbar>\n</ion-header>\n\n<ion-content no-lines>\n  <ion-grid>\n    <ion-row>\n      <ion-col col-1 class="no-padding-except-top">\n        <button ion-button small outline block item-end color="primary" *ngIf="!camera.lv" [disabled]="camera.connected ? 0 : 2" (click)="camera.liveview()">LV</button>\n        <button ion-button small block item-end color="primary" *ngIf="camera.lv" [disabled]="camera.connected ? 0 : 2" (click)="camera.liveview()">LV</button>\n        <button ion-button small outline block  color="primary" item-end [disabled]="camera.connected ? 0 : 2" (click)="camera.captureTest()">\n          <ion-icon name="camera"></ion-icon>\n        </button>\n        <br>\n        <button ion-button small outline block  color="primary" item-end [disabled]="camera.connected ? 0 : 2" (click)="camera.setEvDown()">\n          <ion-icon name="add"></ion-icon>\n        </button>\n        <button ion-button small outline block  color="primary" item-end [disabled]="camera.connected ? 0 : 2" (click)="camera.setEvUp()">\n          <ion-icon name="remove"></ion-icon>\n        </button>\n      </ion-col>\n      <ion-col col-11 style="padding-left: 0.75em;">\n        <!--img [src]="\'data:image/jpeg;base64,\' + keyframe.jpeg" width="100%"-->\n        <img *ngIf="camera.image.jpeg" [src]="camera.image.jpeg" width="100%">\n        <div *ngIf="!camera.image.jpeg" style="width: 100%; height: 150px; background-color: #488aff; opacity: 0.25;"></div>\n      </ion-col>\n    </ion-row>\n    <ion-row>\n      <ion-col col-8>\n        <canvas #chart height="160px"></canvas>\n      </ion-col>\n      <ion-col col-4 class="center-text">\n          <small>Total Duration\n          <button ion-button outline small color="positive" (click)="doDuration(\'Set the total duration\', program, \'durationSeconds\')" [disabled]="(program.intervalMode == \'fixed\' && program.frames > 0 && program.frames != Infinity) ? 2 : 0">\n            {{lengthString}}\n          </button><br>\n          Current Selection<br>\n          <button ion-button outline small color="positive" (click)="doDuration(\'Set the selected point\', false, \'posSeconds\')">\n            {{selectionString}}\n          </button>\n          </small>\n      </ion-col>\n    </ion-row>\n    <ion-row>\n      <ion-col>\n        <ion-item no-padding>\n          <ion-range [(ngModel)]="xSlide" (ionChange)="updateLengthStrings(xSlide, 0);refreshChart()" min="0" max="100" step="1"></ion-range>\n        </ion-item>\n        <ion-scroll scrollY="true" style="height: 300px">\n\n          <!-- MOTOR KEYFRAMES -->\n          <ion-list *ngFor="let a of axesArray">\n            <ion-list-header *ngIf="a.type==\'keyframe\'">\n              <ion-badge *ngIf="a.motor" [style.background-color]="colors.first[a.colorIndex]">{{a.motor.name}}</ion-badge> <span *ngIf="a.motor&&!a.motor.moving">{{(a.motor.pos / a.motor.unitSteps)|number:\'1.0-0\'}}{{a.motor.unit}}</span>\n              <ion-badge *ngIf="!a.motor" [style.background-color]="colors.first[a.colorIndex]">{{a.id}}</ion-badge> <span *ngIf="!a.motor">{{a.pos}}</span>\n\n              <button ion-button clear color="primary" item-start *ngIf="!a.hidden" (click)="a.hidden=true">\n                <ion-icon name="arrow-down"></ion-icon>\n              </button>\n              <button ion-button clear color="primary" item-start *ngIf="a.hidden" (click)="a.hidden=false">\n                <ion-icon name="arrow-forward"></ion-icon>\n              </button>\n\n              <button *ngIf="a.motor" ion-button outline  color="primary" (click)="setup(a)" item-start>\n                <ion-icon name="settings"></ion-icon>\n              </button>\n\n              <button *ngIf="a.id==\'focus\'&&a.hidden" ion-button small outline color="light" item-end [disabled]="(!intervalometer.status.running && camera.connected && !camera.focusMoving) ? 0: 2" (click)="moveAxis(a.id, -1)">\n                <ion-icon name="skip-backward"></ion-icon>\n              </button>\n              <button *ngIf="a.id==\'focus\'&&a.hidden" ion-button small outline color="light" item-end [disabled]="(!intervalometer.status.running && camera.connected && !camera.focusMoving) ? 0: 2" (click)="moveAxis(a.id, 1)">\n                <ion-icon name="skip-forward"></ion-icon>\n              </button>\n\n              <button ion-button small color="primary" item-end (touchstart)="moveAxis(a.id, -50)" (touchend)="moveAxis(a.id, 0)" *ngIf="a.motor&&a.hidden&&a.motor.name!=\'Tilt\'">\n                &nbsp;<ion-icon name="arrow-round-back"></ion-icon>&nbsp;\n              </button>\n              <button ion-button small color="primary" item-end (touchstart)="moveAxis(a.id, 50)" (touchend)="moveAxis(a.id, 0)" *ngIf="a.motor&&a.hidden&&a.motor.name!=\'Tilt\'">\n                &nbsp;<ion-icon name="arrow-round-forward"></ion-icon>&nbsp;\n              </button>\n\n              <button ion-button small color="primary" item-end (touchstart)="moveAxis(a.id, 50)" (touchend)="moveAxis(a.id, 0)" *ngIf="a.motor&&a.hidden&&a.motor.name==\'Tilt\'">\n                &nbsp;<ion-icon name="arrow-round-down"></ion-icon>&nbsp;\n              </button>\n              <button ion-button small color="primary" item-end (touchstart)="moveAxis(a.id, -50)" (touchend)="moveAxis(a.id, 0)" *ngIf="a.motor&&a.hidden&&a.motor.name==\'Tilt\'">\n                &nbsp;<ion-icon name="arrow-round-up"></ion-icon>&nbsp;\n              </button>\n\n              <button ion-button outline  color="primary" item-end (click)="toggleInterpolation(a)" *ngIf="!a.hidden && a.interpolation == \'linear\'">\n                <ion-icon name="analytics"></ion-icon>\n              </button>\n              <button ion-button color="primary" item-end (click)="toggleInterpolation(a)" *ngIf="!a.hidden && a.interpolation != \'linear\'">\n                <ion-icon name="analytics"></ion-icon>\n              </button>\n\n              <button ion-button outline  color="primary" item-end [disabled]="a.prevKeyframe===null?2:0" (click)="updateX(a.prevKeyframe)" *ngIf="!a.hidden">\n                <ion-icon name="arrow-back"></ion-icon>\n              </button>\n              <button *ngIf="!a.selected" ion-button outline  color="primary" item-end (click)="addKeyframe(a.id)">\n                <ion-icon name="radio-button-off"></ion-icon>\n              </button>\n              <button *ngIf="a.selected&&a.atPos" ion-button outline  color="primary" item-end (click)="removeKeyframe(a.id)" [disabled]="a.atPos&&!a.atStartOrEnd?0:2">\n                <ion-icon name="radio-button-on"></ion-icon>\n              </button>\n              <button ion-button outline color="danger" item-end (click)="updateKeyframe(a.id)" *ngIf="a.selected&&!a.atPos">\n                <ion-icon name="radio-button-on"></ion-icon>\n              </button>\n\n              <button ion-button outline  color="primary" item-end [disabled]="a.nextKeyframe===null?2:0" (click)="updateX(a.nextKeyframe)" *ngIf="!a.hidden">\n                <ion-icon name="arrow-forward"></ion-icon>\n              </button>\n\n            </ion-list-header>\n            <ion-item no-lines *ngIf="!a.hidden&&a.type==\'keyframe\'">\n              <ion-grid no-padding>\n                <ion-row no-padding>\n                  <ion-col no-padding *ngIf="a.motor">\n                    <ion-item no-padding *ngIf="a.motor.name!=\'Tilt\'">\n                      <ion-range [(ngModel)]="a.move" (ionChange)="moveAxis(a.id, a.move)" no-padding min="-10" max="10" step="1" (ionBlur)="a.move=0">\n                        <ion-icon range-left name="arrow-round-back"></ion-icon>\n                        <ion-icon range-right name="arrow-round-forward"></ion-icon>\n                      </ion-range>\n                    </ion-item>\n                    <ion-item no-padding *ngIf="a.motor.name==\'Tilt\'">\n                      <ion-range [(ngModel)]="a.move" (ionChange)="moveAxis(a.id, (0 - a.move))" no-padding min="-10" max="10" step="1" (ionBlur)="a.move=0">\n                        <ion-icon range-left name="arrow-round-down"></ion-icon>\n                        <ion-icon range-right name="arrow-round-up"></ion-icon>\n                      </ion-range>\n                    </ion-item>\n                  </ion-col>\n                  <ion-col no-padding *ngIf="a.id==\'focus\'">\n                    <button class="focus-button" ion-button small outline color="light" item-start [disabled]="(!intervalometer.status.running && camera.connected && !camera.focusMoving) ? 0: 2" (click)="moveAxis(a.id, -10)"><ion-icon name="rewind"></ion-icon></button>\n                    <button class="focus-button" ion-button small outline color="light" item-start [disabled]="(!intervalometer.status.running && camera.connected && !camera.focusMoving) ? 0: 2" (click)="moveAxis(a.id, -1)"><ion-icon name="skip-backward"></ion-icon></button>\n                    <button class="focus-button" ion-button small outline color="light" item-start [disabled]="(!intervalometer.status.running && camera.connected && !camera.focusMoving) ? 0: 2" (click)="moveAxis(a.id, 1)"><ion-icon name="skip-forward"> </ion-icon></button>\n                    <button class="focus-button" ion-button small outline color="light" item-start [disabled]="(!intervalometer.status.running && camera.connected && !camera.focusMoving) ? 0: 2" (click)="moveAxis(a.id, 10)"><ion-icon name="fastforward"></ion-icon></button>\n                  </ion-col>\n                  <ion-col col-4 no-padding>\n                    <button ion-button outline small color="positive" item-end (click)="moveToCurrent(a.id)" [disabled]="a.canMove?0:2">\n                      MOVE\n                    </button>\n                  </ion-col>\n                </ion-row>\n              </ion-grid>\n            </ion-item>\n          </ion-list>\n\n\n        </ion-scroll>\n      </ion-col>\n    </ion-row>\n  </ion-grid>\n\n</ion-content>\n'/*ion-inline-end:"/Users/elijah/VIEW-App/src/pages/intervalometer/keyframe.modal.html"*/
        }),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_1_ionic_angular__["j" /* NavParams */],
            __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["m" /* ViewController */],
            __WEBPACK_IMPORTED_MODULE_2__providers_view_view__["a" /* ViewProvider */],
            __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["a" /* AlertController */],
            __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["g" /* ModalController */],
            __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["c" /* Events */]])
    ], KeyframeModalContentPage);
    return KeyframeModalContentPage;
}());

//# sourceMappingURL=intervalometer.js.map

/***/ }),

/***/ 123:
/***/ (function(module, exports) {

function webpackEmptyAsyncContext(req) {
	// Here Promise.resolve().then() is used instead of new Promise() to prevent
	// uncatched exception popping up in devtools
	return Promise.resolve().then(function() {
		throw new Error("Cannot find module '" + req + "'.");
	});
}
webpackEmptyAsyncContext.keys = function() { return []; };
webpackEmptyAsyncContext.resolve = webpackEmptyAsyncContext;
module.exports = webpackEmptyAsyncContext;
webpackEmptyAsyncContext.id = 123;

/***/ }),

/***/ 165:
/***/ (function(module, exports) {

function webpackEmptyAsyncContext(req) {
	// Here Promise.resolve().then() is used instead of new Promise() to prevent
	// uncatched exception popping up in devtools
	return Promise.resolve().then(function() {
		throw new Error("Cannot find module '" + req + "'.");
	});
}
webpackEmptyAsyncContext.keys = function() { return []; };
webpackEmptyAsyncContext.resolve = webpackEmptyAsyncContext;
module.exports = webpackEmptyAsyncContext;
webpackEmptyAsyncContext.id = 165;

/***/ }),

/***/ 211:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return CameraPage; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__angular_core__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_ionic_angular__ = __webpack_require__(23);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__providers_view_view__ = __webpack_require__(39);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3__app_app_component__ = __webpack_require__(58);
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};





var CameraPage = (function () {
    function CameraPage(navCtrl, alertCtrl, viewApi, modalCtrl) {
        this.navCtrl = navCtrl;
        this.alertCtrl = alertCtrl;
        this.viewApi = viewApi;
        this.modalCtrl = modalCtrl;
        this.camera = {};
        this.motion = {};
        this.intervalometer = {};
        this.viewMode = 'camera';
        this.camera = this.viewApi.camera;
        this.motion = this.viewApi.motion;
        this.intervalometer = this.viewApi.intervalometer;
        this.motion.get();
    }
    CameraPage.prototype.setupMotion = function (axisId) {
        var modal = this.modalCtrl.create(__WEBPACK_IMPORTED_MODULE_3__app_app_component__["b" /* MotionModalContentPage */], { axisId: axisId });
        modal.present();
    };
    CameraPage.prototype.zeroMotion = function (axisId) {
        this.motion.setAxisPosition(axisId, 0);
    };
    CameraPage.prototype.doSelect = function (list, model, title, set) {
        var _this = this;
        var alert = this.alertCtrl.create();
        alert.setTitle(title || "select an option");
        for (var i = 0; i < list.length; i++) {
            var item = list[i];
            alert.addInput({
                type: 'radio',
                label: item.label || item.title || item,
                value: item,
                checked: ((item.value || item.title || item) == (model.value || model.title || model))
            });
        }
        alert.addButton('Cancel');
        alert.addButton({
            text: 'Ok',
            handler: function (data) {
                console.log('Radio data:', data);
                for (var key in model) {
                    model[key] = data[key];
                }
                if (set) {
                    console.log("setting", set, "to", data.value);
                    _this.camera.set(set, data.value);
                }
            }
        });
        alert.present();
    };
    CameraPage = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_0__angular_core__["Component"])({
            selector: 'page-camera',template:/*ion-inline-start:"/Users/elijah/VIEW-App/src/pages/camera/camera.html"*/'<ion-header>\n  <ion-navbar>\n    <button ion-button menuToggle>\n      <ion-icon name="menu"></ion-icon>\n    </button>\n    <ion-title>Camera</ion-title>\n  </ion-navbar>\n</ion-header>\n\n<ion-content>\n  <ion-grid>\n    <ion-row>\n      <ion-col>\n        <!--video src="http://192.168.7.42:9000" width="100%" ></video-->\n        <img *ngIf="camera.image.jpeg" [src]="camera.image.jpeg" width="100%">\n        <div *ngIf="!camera.image.jpeg" style="width: 100%; height: 200px; background-color: #488aff; opacity: 0.25;"></div>\n      </ion-col>\n    </ion-row>\n    <ion-row>\n      <ion-col>\n        <div class="right"><button ion-fab mini color="{{camera.delay ? \'primary\' : \'dark\'}}" [disabled]="(!intervalometer.status.running && camera.connected) ? 0: 2" (click)="camera.captureDelay()">2s</button></div>\n      </ion-col>\n      <ion-col>\n        <div class="center"><button ion-fab color="success" [disabled]="(!intervalometer.status.running && camera.connected) ? 0: 2" (click)="camera.capture()"><ion-icon name="camera"></ion-icon></button></div>\n      </ion-col>\n      <ion-col>\n        <div class="left"><button ion-fab mini color="{{camera.lv ? \'primary\' : \'dark\'}}" [disabled]="(!intervalometer.status.running && camera.connected) ? 0: 2" (click)="camera.liveview()">LV</button></div>\n      </ion-col>\n    </ion-row>\n    <ion-row>\n      <ion-col>\n        <div class="center" *ngIf="!viewApi.noDevice&&viewApi.connected">\n          {{camera.status}}\n        </div>\n        <hr/>\n      </ion-col>\n    </ion-row>\n    <ion-row>\n      <ion-col>\n        <ion-segment [(ngModel)]="viewMode">\n          <ion-segment-button value="camera">\n            Exposure\n          </ion-segment-button>\n          <ion-segment-button value="focus">\n            Focus\n          </ion-segment-button>\n          <ion-segment-button value="motion">\n            Motion\n          </ion-segment-button>\n        </ion-segment>\n      </ion-col>\n    </ion-row>\n    <ion-row>\n      <ion-col>\n        <hr/>\n      </ion-col>\n    </ion-row>\n\n    <ion-row *ngIf="viewMode==\'camera\'">\n      <ion-col col-4 text-center>\n        <sup ion-text color="primary" text-uppercase>shutter</sup><br>\n        <button ion-button no-margin color="light" [disabled]="(!intervalometer.status.running && camera.shutterAvailable.length) ? 0 : 2" outline (click)="doSelect(camera.shutterAvailable, camera.shutter, \'Shutter Speed\', \'shutter\')">{{camera.shutter.title||\'---\'}}&nbsp;<ion-icon name="arrow-dropdown" *ngIf="camera.shutterAvailable.length"></ion-icon></button>\n      </ion-col>\n      <ion-col col-4 text-center>\n        <sup ion-text color="primary" text-uppercase>aperture</sup><br>\n        <button ion-button no-margin color="light" [disabled]="(!intervalometer.status.running && camera.apertureAvailable.length) ? 0 : 2" outline (click)="doSelect(camera.apertureAvailable, camera.aperture, \'Aperture\', \'aperture\')">{{camera.aperture.title||\'---\'}}&nbsp;<ion-icon name="arrow-dropdown" *ngIf="camera.apertureAvailable.length"></ion-icon></button>\n      </ion-col>\n      <ion-col col-4 text-center>\n        <sup ion-text color="primary" text-uppercase>iso</sup><br>\n        <button ion-button no-margin color="light" [disabled]="(!intervalometer.status.running && camera.isoAvailable.length) ? 0 : 2" outline (click)="doSelect(camera.isoAvailable, camera.iso, \'ISO\', \'iso\')">{{camera.iso.title||\'---\'}}&nbsp;<ion-icon name="arrow-dropdown" *ngIf="camera.isoAvailable.length"></ion-icon></button>\n      </ion-col>\n    </ion-row>\n\n    <ion-row *ngIf="viewMode==\'focus\'">\n      <ion-col text-center>\n        <button ion-button outline color="light" [disabled]="(!intervalometer.status.running && camera.connected && !camera.focusMoving) ? 0: 2" (click)="camera.focus(-1, 10, true)"><ion-icon name="rewind"></ion-icon></button>\n        <button ion-button outline color="light" [disabled]="(!intervalometer.status.running && camera.connected && !camera.focusMoving) ? 0: 2" (click)="camera.focus(-1, 1, true)"><ion-icon name="skip-backward"></ion-icon></button>\n        <button ion-button outline color="light" [disabled]="(!intervalometer.status.running && camera.connected && !camera.focusMoving) ? 0: 2" (click)="camera.focus(1, 1, true)"><ion-icon name="skip-forward"></ion-icon></button>\n        <button ion-button outline color="light" [disabled]="(!intervalometer.status.running && camera.connected && !camera.focusMoving) ? 0: 2" (click)="camera.focus(1, 10, true)"><ion-icon name="fastforward"></ion-icon></button>\n      </ion-col>\n    </ion-row>\n\n    <div *ngIf="viewMode==\'motion\'">\n    <ion-row *ngIf="!motion.available">\n      <ion-col text-center>\n        No VIEW-controllable motion hardware is currently connected.\n      </ion-col>\n    </ion-row>\n    <ion-row *ngIf="motion.available">\n      <ion-col >\n        <ion-list *ngFor="let a of motion.axis">\n\n          <ion-list-header *ngIf="a.connected">\n            <ion-badge>{{a.name}}</ion-badge> <span *ngIf="!a.moving">{{(a.pos / a.unitSteps)|number:\'1.0-0\'}}{{a.unit}}</span>\n            <button [disabled]="intervalometer.status.running ? 2 : 0" ion-button outline  color="primary" (click)="setupMotion(a.id)" item-start>\n              <ion-icon name="settings"></ion-icon>\n            </button>\n            <button [disabled]="(intervalometer.status.running || a.pos == 0 || a.moving) ? 2 : 0" ion-button outline  color="primary" (click)="zeroMotion(a.id)" item-end>\n              set zero\n            </button>\n          </ion-list-header>\n\n          <ion-item *ngIf="a.connected">\n            <ion-grid no-padding>\n              <ion-row no-padding>\n                <ion-col no-padding>\n                  <ion-item no-padding *ngIf="a.name!=\'Tilt\'">\n                    <ion-range [disabled]="intervalometer.status.running ? 2 : 0" [(ngModel)]="a.move" (ionChange)="motion.moveConstant(a.id, a.move/10)" no-padding min="-10" max="10" step="1" (ionBlur)="a.move=0">\n                      <ion-icon range-left name="arrow-round-back"></ion-icon>\n                      <ion-icon range-right name="arrow-round-forward"></ion-icon>\n                    </ion-range>\n                  </ion-item>\n                  <ion-item no-padding *ngIf="a.name==\'Tilt\'">\n                    <ion-range [disabled]="intervalometer.status.running ? 2 : 0" [(ngModel)]="a.move" (ionChange)="motion.moveConstant(a.id, (0-a.move)/10)" no-padding min="-10" max="10" step="1" (ionBlur)="a.move=0">\n                      <ion-icon range-left name="arrow-round-down"></ion-icon>\n                      <ion-icon range-right name="arrow-round-up"></ion-icon>\n                    </ion-range>\n                  </ion-item>\n                </ion-col>\n              </ion-row>\n            </ion-grid>\n          </ion-item>\n\n        </ion-list>\n      </ion-col>\n\n    </ion-row>\n    </div>\n\n    <ion-row>\n      <ion-col>\n        <div class="center" *ngIf="!viewApi.noDevice&&viewApi.connected" style="width:100%;min-width:100%">\n          <small *ngIf="camera.battery">Camera battery: <b>{{camera.battery}}</b>, </small><small> VIEW battery: <b>{{viewApi.battery}}%</b></small>\n        </div>\n        <hr/>\n      </ion-col>\n    </ion-row>\n \n    <ion-row>\n      <ion-col col-12>\n        <ion-list>\n          <button ion-item *ngFor="let image of camera.lastImages" (click)="camera.image.jpeg=image.jpeg">\n            <ion-thumbnail item-start>\n              <img [src]="image.jpeg">\n            </ion-thumbnail>\n            <h2>{{image.shutter.title}} f/{{image.aperture.title}} ISO {{image.iso.title}}</h2>\n            <p>{{image.time|timeAgo}}</p>\n          </button>\n        </ion-list>\n      </ion-col>\n    </ion-row>\n\n  </ion-grid>\n</ion-content>\n\n\n'/*ion-inline-end:"/Users/elijah/VIEW-App/src/pages/camera/camera.html"*/
        }),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_1_ionic_angular__["i" /* NavController */], __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["a" /* AlertController */], __WEBPACK_IMPORTED_MODULE_2__providers_view_view__["a" /* ViewProvider */], __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["g" /* ModalController */]])
    ], CameraPage);
    return CameraPage;
}());

//# sourceMappingURL=camera.js.map

/***/ }),

/***/ 337:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "b", function() { return ClipsPage; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return ClipsModalContentPage; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__angular_core__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_ionic_angular__ = __webpack_require__(23);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__providers_view_view__ = __webpack_require__(39);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3__intervalometer_intervalometer__ = __webpack_require__(109);
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};




var ClipsPage = (function () {
    function ClipsPage(navCtrl, navParams, viewApi, modalCtrl, alertCtrl) {
        this.navCtrl = navCtrl;
        this.navParams = navParams;
        this.viewApi = viewApi;
        this.modalCtrl = modalCtrl;
        this.alertCtrl = alertCtrl;
        viewApi.timelapse.getClips();
        this.timelapse = viewApi.timelapse;
    }
    ClipsPage.prototype.open = function (index) {
        console.log("index", index);
        var modal = this.modalCtrl.create(ClipsModalContentPage, { clipIndex: index });
        modal.present();
    };
    ClipsPage.prototype.showConfirmDelete = function (clip) {
        var _this = this;
        var confirm = this.alertCtrl.create({
            title: 'Delete ' + clip.name + '?',
            message: 'This will remove preview thumbnails and data from the VIEW, but not delete any RAW image files',
            buttons: [
                {
                    text: 'Cancel',
                    handler: function () {
                        console.log('Delete canceled');
                    }
                },
                {
                    text: 'DELETE',
                    handler: function () {
                        console.log('Deleting ' + clip.index);
                        _this.viewApi.timelapse.deleteClip(clip.index);
                    }
                }
            ]
        });
        confirm.present();
    };
    ClipsPage = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_0__angular_core__["Component"])({
            selector: 'page-clips',template:/*ion-inline-start:"/Users/elijah/VIEW-App/src/pages/clips/clips.html"*/'<ion-header>\n  <ion-navbar>\n    <button ion-button menuToggle>\n      <ion-icon name="menu"></ion-icon>\n    </button>\n    <ion-title>Time-lapse Clips</ion-title>\n  </ion-navbar>\n</ion-header>\n\n<ion-content>\n  <div class="center" *ngIf="(!timelapse.clips || timelapse.clips.length == 0) && viewApi.status.fetchingClips" style="padding-top:3em;">\n    Loading clips...\n  </div>\n  <ion-list>\n    <ion-item-sliding *ngFor="let clip of timelapse.clips; let i = index">\n      <button ion-item (click)="open(i)">\n        <ion-thumbnail item-start>\n          <img [src]="\'data:image/jpeg;base64,\' + clip.image">\n        </ion-thumbnail>\n        <h2>{{clip.name}}</h2>\n        <p>{{clip.frames}} frames</p>\n      </button>\n      <ion-item-options side="right">\n        <button ion-button color="danger" (click)="showConfirmDelete(clip)">\n          <ion-icon name="trash"></ion-icon>\n          Delete\n        </button>\n      </ion-item-options>\n    </ion-item-sliding>\n  </ion-list>\n</ion-content>\n'/*ion-inline-end:"/Users/elijah/VIEW-App/src/pages/clips/clips.html"*/
        }),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_1_ionic_angular__["i" /* NavController */], __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["j" /* NavParams */], __WEBPACK_IMPORTED_MODULE_2__providers_view_view__["a" /* ViewProvider */], __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["g" /* ModalController */], __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["a" /* AlertController */]])
    ], ClipsPage);
    return ClipsPage;
}());

var ClipsModalContentPage = (function () {
    function ClipsModalContentPage(params, viewCtrl, viewApi, alertCtrl, appCtrl) {
        this.params = params;
        this.viewCtrl = viewCtrl;
        this.viewApi = viewApi;
        this.alertCtrl = alertCtrl;
        this.appCtrl = appCtrl;
        this.intervalometer = {
            program: {},
            status: {}
        };
        console.log("clipIndex", this.params.get('clipIndex'));
        this.clip = viewApi.timelapse.clips[this.params.get('clipIndex')];
        this.intervalometer = this.viewApi.intervalometer;
        this.image = this.clip.image;
        this.frames = this.viewApi.timelapse.frames;
        this.clip.frameIndex = 0;
        if (!this.clip.info)
            this.viewApi.timelapse.getClipInfo(this.clip.name);
        if (!this.viewApi.timelapse.frames[this.clip.index] && !this.clip.loadingFrames)
            this.viewApi.timelapse.getClipFrames(this.clip.index);
    }
    ClipsModalContentPage.prototype.startFrame = function (clip) {
        if (this.viewApi.timelapse.frames[clip.index]) {
            if (clip.playing)
                this.togglePlay(clip);
            clip.frameIndex = 0;
            //this.image = this.viewApi.timelapse.frames[this.clip.index][clip.frameIndex];
        }
    };
    ClipsModalContentPage.prototype.endFrame = function (clip) {
        if (this.viewApi.timelapse.frames[clip.index]) {
            if (clip.playing)
                this.togglePlay(clip);
            clip.frameIndex = this.viewApi.timelapse.frames[this.clip.index].length - 1;
            //this.image = this.viewApi.timelapse.frames[this.clip.index][clip.frameIndex];
        }
    };
    ClipsModalContentPage.prototype.previousFrame = function (clip) {
        if (this.viewApi.timelapse.frames[clip.index]) {
            if (clip.playing)
                this.togglePlay(clip);
            if (clip.frameIndex > 0) {
                clip.frameIndex--;
                //this.image = this.viewApi.timelapse.frames[this.clip.index][clip.frameIndex];
            }
        }
    };
    ClipsModalContentPage.prototype.nextFrame = function (clip) {
        if (this.viewApi.timelapse.frames[clip.index]) {
            if (clip.playing)
                this.togglePlay(clip);
            if (clip.frameIndex < this.viewApi.timelapse.frames[this.clip.index].length - 1) {
                clip.frameIndex++;
                //this.image = this.viewApi.timelapse.frames[this.clip.index][clip.frameIndex];
            }
        }
    };
    ClipsModalContentPage.prototype.updateFrame = function (clip, event) {
        if (this.viewApi.timelapse.frames[clip.index]) {
            //if(clip.playing) this.togglePlay(clip);
            if (clip.frameIndex >= 0 && clip.frameIndex < this.viewApi.timelapse.frames[this.clip.index].length) {
                this.image = this.viewApi.timelapse.frames[this.clip.index][clip.frameIndex];
            }
        }
    };
    ClipsModalContentPage.prototype.togglePlay = function (clip) {
        var _this = this;
        if (this.viewApi.timelapse.frames[clip.index]) {
            if (clip.playing) {
                clearInterval(this.intervalHandle);
                clip.playing = false;
            }
            else {
                clip.playing = true;
                if (clip.frameIndex >= this.viewApi.timelapse.frames[this.clip.index].length - 1)
                    clip.frameIndex = 0;
                this.intervalHandle = setInterval(function () {
                    //this.image = this.viewApi.timelapse.frames[this.clip.index][clip.frameIndex];
                    if (clip.frameIndex >= _this.viewApi.timelapse.frames[_this.clip.index].length - 1)
                        return _this.togglePlay(clip);
                    clip.frameIndex++;
                }, 1000 / 30);
            }
        }
    };
    ClipsModalContentPage.prototype.logReport = function (clip) {
        var _this = this;
        var reportPrompt = this.alertCtrl.create({
            title: 'Send report for ' + clip.name,
            buttons: [
                {
                    text: 'Cancel',
                    handler: function () {
                        console.log('Report canceled');
                    }
                },
                {
                    text: 'SEND',
                    handler: function (data) {
                        console.log('Sending report for ' + clip.index);
                        _this.viewApi.timelapse.sendReport(clip.name, function (title, message) {
                            var res = _this.alertCtrl.create({
                                title: title,
                                message: message,
                                buttons: [
                                    {
                                        text: 'OK',
                                    }
                                ]
                            });
                            res.present();
                        });
                    }
                }
            ]
        });
        reportPrompt.present();
    };
    ClipsModalContentPage.prototype.showConfirmLoad = function (clip) {
        var _this = this;
        var confirm = this.alertCtrl.create({
            title: 'Load ' + clip.name + '?',
            message: 'This will load the settings from this time-lapse into a new time-lapse setup, replacing any existing settings.',
            buttons: [
                {
                    text: 'Cancel',
                    handler: function () {
                        console.log('Load canceled');
                    }
                },
                {
                    text: 'LOAD',
                    handler: function () {
                        console.log('Loading ' + clip.index);
                        _this.viewApi.intervalometer.saveProgram(clip.info.program);
                        _this.viewCtrl.dismiss();
                        _this.appCtrl.getRootNav().push(__WEBPACK_IMPORTED_MODULE_3__intervalometer_intervalometer__["a" /* IntervalometerPage */]);
                    }
                }
            ]
        });
        confirm.present();
    };
    ClipsModalContentPage.prototype.showConfirmDelete = function (clip) {
        var _this = this;
        var confirm = this.alertCtrl.create({
            title: 'Delete ' + clip.name + '?',
            message: 'This will remove preview thumbnails and data from the VIEW, but not delete any RAW image files',
            buttons: [
                {
                    text: 'Cancel',
                    handler: function () {
                        console.log('Delete canceled');
                    }
                },
                {
                    text: 'DELETE',
                    handler: function () {
                        console.log('Deleting ' + clip.index);
                        _this.viewApi.timelapse.deleteClip(clip.index);
                        _this.viewCtrl.dismiss();
                    }
                }
            ]
        });
        confirm.present();
    };
    ClipsModalContentPage.prototype.dismiss = function () {
        this.viewCtrl.dismiss();
    };
    ClipsModalContentPage = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_0__angular_core__["Component"])({
            selector: 'page-clips',template:/*ion-inline-start:"/Users/elijah/VIEW-App/src/pages/clips/modal.html"*/'<ion-header>\n  <ion-toolbar>\n    <ion-title>\n      {{clip.name}}\n    </ion-title>\n    <ion-buttons start>\n      <button ion-button (click)="dismiss()">\n        <ion-icon name="close"></ion-icon>\n      </button>\n    </ion-buttons>\n  </ion-toolbar>\n</ion-header>\n\n<ion-content no-lines>\n  <ion-grid>\n    <ion-row>\n      <ion-col>\n        <img [src]="\'data:image/jpeg;base64,\' + image" width="100%">\n      </ion-col>\n    </ion-row>\n    <ion-row>\n      <ion-col>\n        <ion-item>\n          <ion-range [(ngModel)]="clip.frameIndex" min="0" max="{{frames[clip.index] ? frames[clip.index].length - 1 : 1}}" (ionChange)="updateFrame(clip, $event)"></ion-range>\n        </ion-item>\n      </ion-col>\n    </ion-row>\n    <ion-row>\n      <ion-col class="no-padding">\n        <button ion-fab mini color="dark" [disabled]="(clip.loadingFrames || clip.frameIndex == 0) ? 2 : 0" (click)="startFrame(clip)"><ion-icon name="skip-backward"></ion-icon></button>\n      </ion-col>\n      <ion-col class="no-padding">\n        <button ion-fab mini color="dark" [disabled]="(clip.loadingFrames || clip.frameIndex == 0) ? 2 : 0" (click)="previousFrame(clip)"><ion-icon name="rewind"></ion-icon></button>\n      </ion-col>\n      <ion-col class="no-padding">\n        <button ion-fab color="success" [disabled]="clip.loadingFrames ? 2 : 0" (click)="togglePlay(clip)"><ion-icon name="{{clip.playing ? \'pause\' : \'play\'}}" *ngIf="!clip.loadingFrames"></ion-icon><span *ngIf="clip.loadingFrames">{{clip.loadingFramesPercent}}%</span></button>\n      </ion-col>\n      <ion-col class="no-padding">\n        <button ion-fab mini color="dark" [disabled]="(clip.loadingFrames || clip.frameIndex >= frames[clip.index].length - 1) ? 2 : 0" (click)="nextFrame(clip)"><ion-icon name="fastforward"></ion-icon></button>\n      </ion-col>\n      <ion-col class="no-padding">\n        <button ion-fab mini color="dark" [disabled]="(clip.loadingFrames || clip.frameIndex >= frames[clip.index].length - 1) ? 2 : 0" (click)="endFrame(clip)"><ion-icon name="skip-forward"></ion-icon></button>\n      </ion-col>\n    </ion-row>\n\n    <ion-row>\n      <ion-col>\n        <ion-list *ngIf="clip.info" no-lines>\n          <ion-list-header>\n            {{clip.name}} Details\n            <button ion-button outline item-end color="primary" [disabled]="(!intervalometer.status.running && clip.info && clip.info.program) ? 0: 2" (click)="showConfirmLoad(clip)"><ion-icon name="copy"></ion-icon></button>\n            <button ion-button outline item-end color="danger" (click)="showConfirmDelete(clip)"><ion-icon name="trash"></ion-icon></button>\n          </ion-list-header>\n          <ion-item>\n            {{clip.info.date | date:\'medium\'}}\n          </ion-item>\n          <ion-item>\n            {{clip.frames}} frames ({{clip.frames/30|number:\'1.0-1\'}}s at 30fps)\n          </ion-item>\n          <ion-item *ngIf="clip.info.status && clip.info.status.cameraSettings">\n            Start exposure: {{clip.info.status.cameraSettings.shutter}} f/{{clip.info.status.cameraSettings.aperture}} {{clip.info.status.cameraSettings.iso}} ISO\n          </ion-item>\n          <ion-item *ngIf="clip.info.program">\n            Interval: \n            <span *ngIf="clip.info.program.intervalMode==\'fixed\'">fixed at {{clip.info.program.interval}}s</span>\n            <span *ngIf="clip.info.program.intervalMode==\'auto\'">(auto) day {{clip.info.program.dayInterval}}s, night {{clip.info.program.nightInterval}}s</span>\n            <span *ngIf="clip.info.program.intervalMode==\'aux2\'">external trigger via AUX2 port</span>\n          </ion-item>\n        </ion-list>        \n      </ion-col>\n    </ion-row>\n\n\n    <ion-row *ngIf="clip.info && clip.info.logfile">\n      <ion-col>\n        <p>\n          Problems?  Get help by <a href="#" (click)="logReport(clip)">sending a log report</a>.\n        </p>\n      </ion-col>\n    </ion-row>\n\n  </ion-grid>\n\n</ion-content>\n'/*ion-inline-end:"/Users/elijah/VIEW-App/src/pages/clips/modal.html"*/
        }),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_1_ionic_angular__["j" /* NavParams */],
            __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["m" /* ViewController */],
            __WEBPACK_IMPORTED_MODULE_2__providers_view_view__["a" /* ViewProvider */],
            __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["a" /* AlertController */],
            __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["b" /* App */]])
    ], ClipsModalContentPage);
    return ClipsModalContentPage;
}());

//# sourceMappingURL=clips.js.map

/***/ }),

/***/ 338:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return SettingsPage; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__angular_core__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_ionic_angular__ = __webpack_require__(23);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__providers_view_view__ = __webpack_require__(39);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3__app_app_component__ = __webpack_require__(58);
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};




var SettingsPage = (function () {
    function SettingsPage(viewApi, modalCtrl) {
        this.viewApi = viewApi;
        this.modalCtrl = modalCtrl;
    }
    SettingsPage.prototype.pairNew = function () {
        console.log("opening pairing modal...");
        var modal = this.modalCtrl.create(__WEBPACK_IMPORTED_MODULE_3__app_app_component__["c" /* PairModalContentPage */], {});
        modal.present();
    };
    SettingsPage.prototype.setupMotion = function () {
        console.log("opening motion modal...");
        var modal = this.modalCtrl.create(__WEBPACK_IMPORTED_MODULE_3__app_app_component__["b" /* MotionModalContentPage */], {});
        modal.present();
    };
    SettingsPage.prototype.logout = function () {
        this.viewApi.logout();
    };
    SettingsPage = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_0__angular_core__["Component"])({
            selector: 'page-settings',template:/*ion-inline-start:"/Users/elijah/VIEW-App/src/pages/settings/settings.html"*/'<ion-header>\n  <ion-navbar>\n    <button ion-button menuToggle>\n      <ion-icon name="menu"></ion-icon>\n    </button>\n    <ion-title>Settings</ion-title>\n  </ion-navbar>\n</ion-header>\n\n<ion-content>\n  <ion-list>\n\n    <button ion-item (click)="pairNew()" *ngIf="viewApi.loggedIn">\n      <ion-icon name="add-circle" item-start></ion-icon>\n      Pair new VIEW device\n    </button>\n    \n    <!--button ion-item (click)="ndFilters()">\n      <ion-icon name="color-filter" item-start></ion-icon>\n      ND Filter Setup\n    </button-->\n\n    <button ion-item (click)="setupMotion()">\n      <ion-icon name="cog" item-start></ion-icon>\n      Configure Motion\n    </button>\n\n    <ion-list-header></ion-list-header>\n    <button ion-item (click)="logout()" *ngIf="viewApi.loggedIn">\n      <ion-icon name="log-out" item-start></ion-icon>\n      Logout {{viewApi.accountEmail}}\n    </button>\n    \n  </ion-list>\n</ion-content>\n'/*ion-inline-end:"/Users/elijah/VIEW-App/src/pages/settings/settings.html"*/
        }),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_2__providers_view_view__["a" /* ViewProvider */], __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["g" /* ModalController */]])
    ], SettingsPage);
    return SettingsPage;
}());

//# sourceMappingURL=settings.js.map

/***/ }),

/***/ 341:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
Object.defineProperty(__webpack_exports__, "__esModule", { value: true });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__angular_platform_browser_dynamic__ = __webpack_require__(342);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1__app_module__ = __webpack_require__(361);


Object(__WEBPACK_IMPORTED_MODULE_0__angular_platform_browser_dynamic__["a" /* platformBrowserDynamic */])().bootstrapModule(__WEBPACK_IMPORTED_MODULE_1__app_module__["a" /* AppModule */]);
//# sourceMappingURL=main.js.map

/***/ }),

/***/ 361:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* unused harmony export MyErrorHandler */
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return AppModule; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__angular_platform_browser__ = __webpack_require__(37);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1__angular_core__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2_ionic_angular__ = __webpack_require__(23);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3__angular_common_http__ = __webpack_require__(205);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4__ionic_storage__ = __webpack_require__(206);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_5__app_component__ = __webpack_require__(58);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_6__pages_camera_camera__ = __webpack_require__(211);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_7__pages_intervalometer_intervalometer__ = __webpack_require__(109);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_8__pages_clips_clips__ = __webpack_require__(337);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_9__pages_settings_settings__ = __webpack_require__(338);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_10__ionic_native_status_bar__ = __webpack_require__(207);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_11__ionic_native_splash_screen__ = __webpack_require__(210);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_12__ionic_pro__ = __webpack_require__(339);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_12__ionic_pro___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_12__ionic_pro__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_13_time_ago_pipe_index__ = __webpack_require__(480);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_13_time_ago_pipe_index___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_13_time_ago_pipe_index__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_14__providers_view_view__ = __webpack_require__(39);
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};













//import {TimeAgoPipe} from 'time-ago-pipe';


var IonicPro = __WEBPACK_IMPORTED_MODULE_12__ionic_pro__["Pro"].init('5d0a65db', {
    appVersion: "0.0.1"
});
var MyErrorHandler = (function () {
    function MyErrorHandler(injector) {
        try {
            this.ionicErrorHandler = injector.get(__WEBPACK_IMPORTED_MODULE_2_ionic_angular__["e" /* IonicErrorHandler */]);
        }
        catch (e) {
            // Unable to get the IonicErrorHandler provider, ensure 
            // IonicErrorHandler has been added to the providers list below
        }
    }
    MyErrorHandler.prototype.handleError = function (err) {
        IonicPro.monitoring.handleNewError(err);
        // Remove this if you want to disable Ionic's auto exception handling
        // in development mode.
        this.ionicErrorHandler && this.ionicErrorHandler.handleError(err);
    };
    MyErrorHandler = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_1__angular_core__["Injectable"])(),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_1__angular_core__["Injector"]])
    ], MyErrorHandler);
    return MyErrorHandler;
}());

var AppModule = (function () {
    function AppModule() {
    }
    AppModule = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_1__angular_core__["NgModule"])({
            declarations: [
                __WEBPACK_IMPORTED_MODULE_5__app_component__["d" /* ViewApp */],
                __WEBPACK_IMPORTED_MODULE_6__pages_camera_camera__["a" /* CameraPage */],
                __WEBPACK_IMPORTED_MODULE_7__pages_intervalometer_intervalometer__["a" /* IntervalometerPage */],
                __WEBPACK_IMPORTED_MODULE_8__pages_clips_clips__["b" /* ClipsPage */],
                __WEBPACK_IMPORTED_MODULE_9__pages_settings_settings__["a" /* SettingsPage */],
                __WEBPACK_IMPORTED_MODULE_8__pages_clips_clips__["a" /* ClipsModalContentPage */],
                __WEBPACK_IMPORTED_MODULE_5__app_component__["a" /* LoginModalContentPage */],
                __WEBPACK_IMPORTED_MODULE_5__app_component__["c" /* PairModalContentPage */],
                __WEBPACK_IMPORTED_MODULE_5__app_component__["b" /* MotionModalContentPage */],
                __WEBPACK_IMPORTED_MODULE_7__pages_intervalometer_intervalometer__["b" /* KeyframeModalContentPage */],
                __WEBPACK_IMPORTED_MODULE_7__pages_intervalometer_intervalometer__["d" /* UpdateModalContentPage */],
                __WEBPACK_IMPORTED_MODULE_7__pages_intervalometer_intervalometer__["c" /* RampingModalContentPage */]
            ],
            imports: [
                __WEBPACK_IMPORTED_MODULE_0__angular_platform_browser__["a" /* BrowserModule */],
                __WEBPACK_IMPORTED_MODULE_3__angular_common_http__["b" /* HttpClientModule */],
                __WEBPACK_IMPORTED_MODULE_2_ionic_angular__["f" /* IonicModule */].forRoot(__WEBPACK_IMPORTED_MODULE_5__app_component__["d" /* ViewApp */], {}, {
                    links: []
                }),
                __WEBPACK_IMPORTED_MODULE_4__ionic_storage__["a" /* IonicStorageModule */].forRoot(),
                __WEBPACK_IMPORTED_MODULE_13_time_ago_pipe_index__["TimeAgoPipeModule"]
            ],
            bootstrap: [__WEBPACK_IMPORTED_MODULE_2_ionic_angular__["d" /* IonicApp */]],
            entryComponents: [
                __WEBPACK_IMPORTED_MODULE_5__app_component__["d" /* ViewApp */],
                __WEBPACK_IMPORTED_MODULE_6__pages_camera_camera__["a" /* CameraPage */],
                __WEBPACK_IMPORTED_MODULE_7__pages_intervalometer_intervalometer__["a" /* IntervalometerPage */],
                __WEBPACK_IMPORTED_MODULE_8__pages_clips_clips__["b" /* ClipsPage */],
                __WEBPACK_IMPORTED_MODULE_9__pages_settings_settings__["a" /* SettingsPage */],
                __WEBPACK_IMPORTED_MODULE_8__pages_clips_clips__["a" /* ClipsModalContentPage */],
                __WEBPACK_IMPORTED_MODULE_5__app_component__["a" /* LoginModalContentPage */],
                __WEBPACK_IMPORTED_MODULE_5__app_component__["c" /* PairModalContentPage */],
                __WEBPACK_IMPORTED_MODULE_5__app_component__["b" /* MotionModalContentPage */],
                __WEBPACK_IMPORTED_MODULE_7__pages_intervalometer_intervalometer__["b" /* KeyframeModalContentPage */],
                __WEBPACK_IMPORTED_MODULE_7__pages_intervalometer_intervalometer__["d" /* UpdateModalContentPage */],
                __WEBPACK_IMPORTED_MODULE_7__pages_intervalometer_intervalometer__["c" /* RampingModalContentPage */]
            ],
            providers: [
                __WEBPACK_IMPORTED_MODULE_10__ionic_native_status_bar__["a" /* StatusBar */],
                __WEBPACK_IMPORTED_MODULE_11__ionic_native_splash_screen__["a" /* SplashScreen */],
                { provide: __WEBPACK_IMPORTED_MODULE_1__angular_core__["ErrorHandler"], useClass: __WEBPACK_IMPORTED_MODULE_2_ionic_angular__["e" /* IonicErrorHandler */] },
                __WEBPACK_IMPORTED_MODULE_14__providers_view_view__["a" /* ViewProvider */],
                __WEBPACK_IMPORTED_MODULE_3__angular_common_http__["b" /* HttpClientModule */],
                __WEBPACK_IMPORTED_MODULE_2_ionic_angular__["e" /* IonicErrorHandler */],
                [{ provide: __WEBPACK_IMPORTED_MODULE_1__angular_core__["ErrorHandler"], useClass: MyErrorHandler }]
            ]
        })
    ], AppModule);
    return AppModule;
}());

//# sourceMappingURL=app.module.js.map

/***/ }),

/***/ 39:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return ViewProvider; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__angular_common_http__ = __webpack_require__(205);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1__angular_core__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2_ionic_angular__ = __webpack_require__(23);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3_queueing_subject__ = __webpack_require__(419);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3_queueing_subject___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_3_queueing_subject__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4_rxjs_websockets__ = __webpack_require__(420);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4_rxjs_websockets___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_4_rxjs_websockets__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_5_rxjs_add_operator_share__ = __webpack_require__(422);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_5_rxjs_add_operator_share___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_5_rxjs_add_operator_share__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_6_rxjs_add_operator_timeout__ = __webpack_require__(423);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_6_rxjs_add_operator_timeout___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_6_rxjs_add_operator_timeout__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_7_moment__ = __webpack_require__(1);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_7_moment___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_7_moment__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_8__ionic_storage__ = __webpack_require__(206);
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};









var ViewProvider = (function () {
    function ViewProvider(http, events, storage) {
        var _this = this;
        this.http = http;
        this.events = events;
        this.storage = storage;
        this.sessionKey = "";
        this.accountEmail = "";
        this.status = { fetchingClips: false };
        this.connected = false;
        this.charging = false;
        this.battery = 0;
        this.loggedIn = false;
        this.attempts = 1;
        this.remoteUrl = 'https://app.view.tl';
        this.localUrl = 'http://10.0.0.1';
        this.localNetwork = false;
        this.url = this.remoteUrl;
        this.timelapseFragments = {};
        this.focusTimer = null;
        this.joystickTimers = {};
        this.joystickRepeatTimers = {};
        this.pingIntervalHandle = null;
        this.colors = {
            first: [
                'rgba(255, 99, 132, 0.8)',
                'rgba(54, 162, 235, 0.8)',
                'rgba(255, 206, 86, 0.8)',
                'rgba(75, 192, 192, 0.8)',
                'rgba(153, 102, 255, 0.8)',
                'rgba(255, 159, 64, 0.8)'
            ],
            second: [
                'rgba(255, 99, 132, 0.3)',
                'rgba(54, 162, 235, 0.3)',
                'rgba(255, 206, 86, 0.3)',
                'rgba(75, 192, 192, 0.3)',
                'rgba(153, 102, 255, 0.3)',
                'rgba(255, 159, 64, 0.3)'
            ]
        };
        this.camera = {
            set: function (key, val) {
                _this.send("set", { key: key, val: val }, null);
            },
            setEv: function (ev) {
                _this.send("setEv", { ev: ev }, null);
            },
            setEvUp: function () {
                _this.send("setEvUp", null, null);
            },
            setEvDown: function () {
                _this.send("setEvDown", null, null);
            },
            capture: function () {
                _this.send("capture", null, null);
            },
            captureTest: function () {
                _this.send("capture-test", null, null);
            },
            focus: function (dir, repeat, noUpdate, callback) {
                if (!repeat)
                    repeat = 1;
                if (!noUpdate) {
                    if (dir > 0)
                        _this.camera.focusPos += parseInt(repeat);
                    if (dir < 0)
                        _this.camera.focusPos -= parseInt(repeat);
                    //if($scope.currentKf) $scope.currentKf.focusEdited = true;
                    //if($scope.currentKf) $scope.currentKf.imageCurrent = false;
                }
                if (_this.focusTimer)
                    clearTimeout(_this.focusTimer);
                _this.focusTimer = setTimeout(function () {
                    _this.camera.focusMoving = false;
                }, 10000);
                _this.camera.focusMoving = true;
                _this.send('focus', {
                    key: 'manual',
                    val: dir,
                    repeat: repeat
                }, function (err, res) {
                    _this.camera.focusMoving = false;
                    if (res && res.position != null) {
                        if (parseInt(res.position) != NaN)
                            _this.camera.focusPos = parseInt(res.position);
                    }
                    callback && callback(err, _this.camera.focusPos);
                });
            },
            captureDelay: function () {
                _this.camera.status = "waiting on timer...";
                _this.camera.delay = true;
                setTimeout(function () {
                    _this.camera.delay = false;
                    _this.send("capture", null, null);
                }, 2000);
            },
            liveview: function () {
                if (_this.camera.lv) {
                    console.log("stopping liveview...");
                    _this.camera.lv = false;
                    _this.send("previewStop", null, null);
                }
                else {
                    console.log("starting liveview...");
                    _this.send('preview', null, null);
                    //this.send("previewStream", null, null);
                    _this.camera.lv = true;
                }
            },
            settings: {},
            supports: { focus: false, liveview: false },
            histogram: [],
            image: {},
            shutter: {},
            shutterAvailable: [],
            iso: {},
            isoAvailable: [],
            aperture: {},
            apertureAvailable: [],
            connected: false,
            lastImages: [],
            lv: false,
            delay: false,
            status: "camera not connected",
            focusMoving: false,
            focusPos: 0,
            battery: ""
        };
        this.timelapse = {
            clips: [],
            frames: {
                current: []
            },
            getClips: function () {
                if (!_this.status.fetchingClips) {
                    _this.status.fetchingClips = true;
                    _this.send('timelapse-clips', null, null);
                }
            },
            getClipInfo: function (name) {
                _this.send('timelapse-clip-info', { name: name }, null);
            },
            sendReport: function (name, callback) {
                _this.send('clip-log-report', { name: name }, function (err, data) {
                    var title = err ? 'Error Sending' : 'Report Submitted';
                    var message = err || data.message;
                    callback && callback(title, message);
                });
            },
            deleteClip: function (index) {
                _this.send('delete-clip', { index: index }, null);
                for (var i = 0; i < _this.timelapse.clips.length; i++) {
                    if (_this.timelapse.clips[i].index == index) {
                        _this.timelapse.clips.splice(i, 1);
                        break;
                    }
                }
            },
            getClipFrames: function (index) {
                _this.send('timelapse-images', { index: index }, null);
                for (var i = 0; i < _this.timelapse.clips.length; i++) {
                    if (_this.timelapse.clips[i].index == index) {
                        _this.timelapse.clips[i].loadingFrames = true;
                        _this.timelapse.clips[i].loadingFramesPercent = 0;
                        break;
                    }
                }
            },
            getCurrentFrames: function (callback) {
                _this.send('current-images', { start: _this.timelapse.frames.current.length }, null);
                _this.intervalometer.preview.loadingFrames = true;
                _this.intervalometer.preview.loadingFramesPercent = 0;
                _this.intervalometer.preview.callback = callback;
            }
        };
        this.intervalometer = {
            program: { loaded: false },
            preview: {
                frameIndex: 0
            },
            status: {
                running: false,
                dynamicChange: {}
            },
            getProgram: function () {
                _this.send('get', { key: 'program' }, null);
            },
            saveProgram: function (program, callback) {
                _this.send('save-program', { program: program }, callback);
            },
            reconfigureProgram: function (program, callback) {
                _this.send('reconfigureProgram', { program: program }, callback);
            },
            getStatus: function () {
                _this.send('get', { key: 'status' }, null);
            },
            start: function (program) {
                _this.timelapseFragments.current = {};
                var m = __WEBPACK_IMPORTED_MODULE_7_moment___default()();
                _this.send('run', { program: program, date: m.valueOf() + m.utcOffset() * 60 * 1000 }, null);
            },
            stop: function () {
                _this.send('stop', null, null);
            },
            moveFocus: function (steps) {
                _this.send('moveFocus', { steps: steps }, null);
            },
            moveTracking: function (axis, degrees) {
                _this.send('moveTracking', { axis: axis, degrees: degrees }, null);
            },
            updateProgram: function (updates) {
                _this.send('updateProgram', { updates: updates }, null);
            },
            dynamicChange: function (parameter, newValue, frames) {
                _this.send('dynamicChange', { parameter: parameter, newValue: newValue, frames: frames }, null);
            },
            getChartData: function (posSeconds, includePos) {
                var now = __WEBPACK_IMPORTED_MODULE_7_moment___default()().startOf('day');
                if (!_this.intervalometer.program) {
                    return {
                        datasets: [],
                        labels: []
                    };
                }
                if (!_this.intervalometer.program.durationSeconds)
                    _this.intervalometer.program.durationSeconds = 1800;
                if (_this.intervalometer.program.intervalMode == 'fixed' && _this.intervalometer.program.frames > 0 && _this.intervalometer.program.frames != Infinity) {
                    _this.intervalometer.program.durationSeconds = _this.intervalometer.program.interval * _this.intervalometer.program.frames;
                }
                if (!_this.intervalometer.program.axes)
                    _this.intervalometer.program.axes = {};
                for (var m in _this.intervalometer.program.axes) {
                    if (!_this.intervalometer.program.axes.hasOwnProperty(m))
                        continue;
                    if (_this.intervalometer.program.axes[m].type != "keyframe")
                        continue;
                    if (!_this.intervalometer.program.axes[m].kf)
                        _this.intervalometer.program.axes[m].kf = [];
                    if (m == "focus" && _this.camera.focusPos != null)
                        _this.intervalometer.program.axes[m].pos = _this.camera.focusPos;
                    var min = null;
                    var max = null;
                    var currentPos = ((_this.intervalometer.program.axes[m].motor ? _this.intervalometer.program.axes[m].motor.pos : _this.intervalometer.program.axes[m].pos) || 0);
                    var maxPos = currentPos;
                    for (var i = 0; i < _this.intervalometer.program.axes[m].kf.length; i++) {
                        var point = _this.intervalometer.program.axes[m].kf[i];
                        if (point.seconds > _this.intervalometer.program.durationSeconds)
                            continue;
                        if (min === null || point.seconds < min)
                            min = point.seconds;
                        if (max === null || point.seconds > max) {
                            max = point.seconds;
                            maxPos = point.position;
                        }
                    }
                    if (min > 0) {
                        _this.intervalometer.program.axes[m].kf.push({ seconds: 0, position: currentPos });
                    }
                    if (max < _this.intervalometer.program.durationSeconds) {
                        _this.intervalometer.program.axes[m].kf.push({ seconds: _this.intervalometer.program.durationSeconds, position: maxPos });
                    }
                    _this.intervalometer.program.axes[m].kf = _this.intervalometer.program.axes[m].kf.filter(function (item) {
                        return item.seconds <= _this.intervalometer.program.durationSeconds;
                    });
                }
                var axisGap = -1.5;
                var datasets = [];
                var x = __WEBPACK_IMPORTED_MODULE_7_moment___default()().startOf('day').add(posSeconds, 'seconds');
                var index = 0;
                var _loop_1 = function (m) {
                    var axis = _this.intervalometer.program.axes[m];
                    if (axis.type == 'keyframe') {
                        console.log("this.intervalometer.program.axes[" + m + "].", _this.intervalometer.program.axes[m]);
                        var currentPos = ((axis.motor ? axis.motor.pos : axis.pos) || 0);
                        var minPos_1 = axis.kf.reduce(function (min, a) { if (a.position < min)
                            return a.position;
                        else
                            return min; }, currentPos);
                        var maxPos_1 = axis.kf.reduce(function (max, a) { if (a.position > max)
                            return a.position;
                        else
                            return max; }, currentPos);
                        var spanPos_1 = (maxPos_1 - minPos_1);
                        if (spanPos_1 < 1)
                            spanPos_1 = 1;
                        if (includePos) {
                            var point = (minPos_1 == maxPos_1) ? 0 : (currentPos - minPos_1) / spanPos_1;
                            if (axis.motor && axis.motor.name == 'Tilt')
                                point = 1 - point;
                            datasets.push({
                                label: 'current' + m,
                                fill: false,
                                pointStyle: 'cross',
                                radius: 6,
                                data: [
                                    { x: x, y: point + index * axisGap }
                                ],
                                borderColor: _this.colors.first[axis.colorIndex],
                                backgroundColor: _this.colors.first[axis.colorIndex]
                            });
                            console.log("current", m, point, "max", maxPos_1, "current", currentPos);
                        }
                        var mData = axis.kf.sort(function (a, b) {
                            if (a.seconds > b.seconds)
                                return 1;
                            if (a.seconds < b.seconds)
                                return -1;
                            return 0;
                        }).map(function (item) {
                            var point = (minPos_1 == maxPos_1) ? 0 : (item.position - minPos_1) / spanPos_1;
                            if (axis.motor && axis.motor.name == 'Tilt')
                                point = 1 - point;
                            return {
                                x: __WEBPACK_IMPORTED_MODULE_7_moment___default()(now).add((item.seconds || 0), 'seconds'),
                                y: point + index * axisGap
                            };
                        });
                        datasets.push({
                            label: m,
                            fill: false,
                            cubicInterpolationMode: 'monotone',
                            lineTension: _this.intervalometer.program.axes[m].interpolation == 'linear' ? 0 : 1,
                            data: mData,
                            backgroundColor: _this.colors.first[_this.intervalometer.program.axes[m].colorIndex],
                            borderColor: _this.colors.second[_this.intervalometer.program.axes[m].colorIndex]
                        });
                        console.log("keyframe", m, mData);
                        index++;
                    }
                };
                for (var m in _this.intervalometer.program.axes) {
                    _loop_1(m);
                }
                var chartData = {
                    datasets: datasets,
                    labels: []
                };
                console.log('chartData', chartData);
                return chartData;
            }
        };
        this.motion = {
            available: false,
            moving: false,
            slideAvailable: false,
            panAvailable: false,
            tiltAvailable: false,
            panTiltAvailable: false,
            axis: [],
            get: function () {
                _this.send('get', { key: 'motion' }, null);
            },
            move: function (axisId, steps, noReverse, callback) {
                //for(var k in joystickRepeatTimers) {
                //    if(joystickRepeatTimers[k]) $timeout.cancel(joystickRepeatTimers[k]);
                //}
                console.log("moving ", axisId);
                //if($scope.currentKf) $scope.currentKf.motionEdited = true;
                //if($scope.currentKf) $scope.currentKf.imageCurrent = false;
                var index = _this.motion.getAxisIndex(axisId);
                if (index === null)
                    return false;
                var parts = axisId.split('-');
                if (steps && parts.length == 2) {
                    var driver = parts[0];
                    var motor = parts[1];
                    if (_this.motion.axis[index].reverse && !noReverse)
                        steps = 0 - steps;
                    console.log("moving motor" + axisId, steps);
                    _this.motion.axis[index].moving = true;
                    _this.motion.moving = true;
                    //if($scope.currentKf || $scope.axis[index].pos != 0) 
                    _this.motion.axis[index].pos += steps; // will be overwritten by motor driver response
                    _this.send('motion', {
                        key: 'move',
                        val: steps,
                        driver: driver,
                        motor: motor
                    }, function (err, res) {
                        if (res.complete && res.position != null || err) {
                            //console.log(axisId, "move complete, running callback", callback);
                            callback && callback(err, res.position);
                        }
                    });
                }
            },
            moveConstant: function (axisId, speed, callback) {
                console.log("moveConstant", axisId, speed); //, callback);
                var index = _this.motion.getAxisIndex(axisId);
                if (index === null)
                    return false;
                if (_this.joystickRepeatTimers[axisId])
                    clearTimeout(_this.joystickRepeatTimers[axisId]);
                if (speed) {
                    _this.motion.axis[index].moving = true;
                    _this.motion.moving = true;
                    _this.joystickRepeatTimers[axisId] = setTimeout(function () {
                        _this.motion.moveConstant(axisId, speed, callback);
                    }, 600);
                }
                if (speed && _this.joystickTimers[axisId])
                    return false; // rate limit per axis
                //if($scope.currentKf) $scope.currentKf.motionEdited = true;
                //if($scope.currentKf) $scope.currentKf.imageCurrent = false;
                var f = function (a, s, r, cb) {
                    return function () {
                        //console.log("moving ", axisId);
                        var parts = a.split('-');
                        if (parts.length == 2) {
                            var driver = parts[0];
                            var motor = parts[1];
                            //console.log("joystick motor" + a, s);
                            _this.send('motion', {
                                key: 'joystick',
                                val: s * 100 * (r ? -1 : 1),
                                driver: driver,
                                motor: motor
                            }, function (err, res) {
                                console.log("err", err, "res", res, "speed", s);
                                if (res.complete && res.position || err) {
                                    //console.log(axisId, "move complete, running callback", cb);
                                    //this.motion.axis[this.motion.getAxisIndex(axisId)].moving = (s == 0);
                                    cb && cb(err, res.position);
                                }
                            });
                        }
                    };
                };
                var sendJoystickCommand = f(axisId, speed, _this.motion.axis[index].reverse, callback);
                if (_this.joystickTimers[axisId])
                    clearTimeout(_this.joystickTimers[axisId]);
                _this.joystickTimers[axisId] = setTimeout(function () {
                    _this.joystickTimers[axisId] = null;
                }, 200);
                sendJoystickCommand();
                if (speed == 0)
                    sendJoystickCommand();
            },
            setAxisPosition: function (axisId, position, callback) {
                var index = _this.motion.getAxisIndex(axisId);
                if (index === null)
                    return false;
                var parts = axisId.split('-');
                if (position != null && parts.length == 2) {
                    var driver = parts[0];
                    var motor = parts[1];
                    _this.motion.axis[index].pos = position;
                    _this.send('motion', {
                        key: 'setPosition',
                        position: position,
                        driver: driver,
                        motor: motor
                    }, function (err, res) {
                        if (res.complete && res.position || err) {
                            callback && callback(err, res.position);
                        }
                    });
                }
            },
            calibrate: function (axisId, callback) {
                var index = _this.motion.getAxisIndex(axisId);
                if (index === null)
                    return false;
                var parts = axisId.split('-');
                if (parts.length == 2) {
                    var driver = parts[0];
                    var motor = parts[1];
                    _this.send('motion', {
                        key: 'calibrate',
                        driver: driver,
                        motor: motor
                    }, function (err, res) {
                        callback && callback(err, res.backlash);
                    });
                }
            },
            cancelCalibration: function (axisId) {
                var index = _this.motion.getAxisIndex(axisId);
                if (index === null)
                    return false;
                var parts = axisId.split('-');
                if (parts.length == 2) {
                    var driver = parts[0];
                    var motor = parts[1];
                    _this.send('motion', {
                        key: 'cancelCalibration',
                        driver: driver,
                        motor: motor
                    }, function (err) {
                    });
                }
            },
            setBacklash: function (axisId, backlashSteps, callback) {
                var index = _this.motion.getAxisIndex(axisId);
                if (index === null)
                    return false;
                var parts = axisId.split('-');
                if (parts.length == 2) {
                    var driver = parts[0];
                    var motor = parts[1];
                    console.log("setting backlash to", backlashSteps, "for", axisId);
                    _this.send('motion', {
                        key: 'setBacklash',
                        driver: driver,
                        motor: motor,
                        backlash: backlashSteps
                    }, function (err, res) {
                        console.log("complete -- set backlash to", backlashSteps, "for", axisId);
                        callback && callback(err, res.backlash);
                    });
                }
            },
            setupAxis: function (axisInfo) {
                var axisId = axisInfo.driver + '-' + axisInfo.motor;
                console.log("setting up axis: ", axisId);
                //var axis = localStorageService.get('motion-' + axisId);
                var setupAxisObject = function (err, axis) {
                    if (!axis) {
                        axis = {
                            name: '',
                            unit: 's',
                            unitSteps: 1,
                            unitMove: 500,
                            reverse: false,
                            pos: 0,
                            moving: false,
                            setup: false
                        };
                    }
                    axis.id = axisId;
                    axis.motor = axisInfo.motor;
                    axis.driver = axisInfo.driver;
                    axis.connected = axisInfo.connected;
                    axis.pos = axisInfo.position;
                    axis.orientation = axisInfo.orientation;
                    axis.backlash = axisInfo.backlash || 0;
                    axis.backlash = Math.round(axis.backlash * 100) / 100;
                    if (axisInfo.orientation == 'pan')
                        axis.name = 'Pan';
                    if (axisInfo.orientation == 'tilt')
                        axis.name = 'Tilt';
                    var axisIndex = _this.motion.getAxisIndex(axisId);
                    if (axisIndex === null) {
                        _this.motion.axis.push(axis);
                    }
                    else {
                        //axis.pos = $scope.axis[axisIndex].pos;
                        axis.moving = false; //$scope.axis[axisIndex].moving;
                        _this.motion.axis[axisIndex] = axis;
                    }
                    var moving = false;
                    for (var i = 0; i < _this.motion.axis.length; i++) {
                        if (_this.motion.axis[i].moving) {
                            moving = true;
                            break;
                        }
                    }
                    _this.motion.moving = moving;
                    _this.motion.checkAxisFunctionsAvailable();
                    _this.events.publish('motion.updated');
                    console.log("$scope.axis", _this.motion.axis);
                };
                if (axisInfo.connected) {
                    _this.db.get('motion-' + axisId, function (err, axis) {
                        console.log("VIEW db err:", err);
                        console.log("VIEW db axis:", axis);
                        setupAxisObject(err, axis);
                    });
                }
                else {
                    setupAxisObject(null, null);
                }
            },
            getAxisIndex: function (axisId) {
                for (var i = 0; i < _this.motion.axis.length; i++) {
                    if (_this.motion.axis[i].id == axisId)
                        return i;
                }
                return null;
            },
            checkAxisFunctionsAvailable: function () {
                var tilt = false;
                var pan = false;
                var slide = false;
                _this.motion.axis = _this.motion.axis.filter(function (x) { return x.connected; });
                for (var i = 0; i < _this.motion.axis.length; i++) {
                    if (_this.motion.axis[i].name == 'Pan' && _this.motion.axis[i].connected)
                        pan = _this.motion.axis[i];
                    if (_this.motion.axis[i].name == 'Tilt' && _this.motion.axis[i].connected)
                        tilt = _this.motion.axis[i];
                    if (_this.motion.axis[i].name == 'Slide' && _this.motion.axis[i].connected)
                        slide = _this.motion.axis[i];
                }
                if (slide) {
                    _this.motion.slideAvailable = slide;
                }
                if (pan) {
                    _this.motion.panAvailable = pan;
                }
                if (tilt) {
                    _this.motion.tiltAvailable = tilt;
                }
                if (pan && tilt) {
                    _this.motion.panTiltAvailable = { pan: pan, tilt: tilt };
                }
                else {
                    _this.motion.panTiltAvailable = false;
                }
            },
            openMotionSetup: function (axisId) {
                _this.events.publish('openMotionSetup', axisId);
            },
        };
        this.db = {
            get: function (key, callback) {
                _this.send('dbGet', {
                    key: key
                }, function (err, res) {
                    callback && callback(err, res.val);
                    console.log("dbGet test -> ", res.key, res.val ? res.val.id : res.val);
                    console.log("dbGet result", res);
                });
            },
            set: function (key, val, callback) {
                _this.send('dbSet', {
                    key: key,
                    val: val
                }, function (err) {
                    callback && callback(err);
                    console.log("dbSet err", err);
                });
            }
        };
        this.callbackList = [];
        this.offlineQueue = [];
        this.noDevice = false;
        console.log('Hello ViewProvider Provider');
        this.storage.get('accountEmail').then(function (email) {
            _this.accountEmail = email || "";
        });
        this.storage.get('sessionKey').then(function (key) {
            _this.sessionKey = key;
            _this.storage.get('localNetwork').then(function (local) {
                _this.localNetwork = !!local;
                _this.connect();
            });
        });
    }
    ViewProvider.prototype.send = function (type, message, callback) {
        // If the websocket is not connected then the QueueingSubject will ensure
        // that messages are queued and delivered when the websocket reconnects.
        // A regular Subject can be used to discard messages sent when the websocket
        // is disconnected.
        if (!message)
            message = {};
        if (!this.messages) {
            this.offlineQueue.push({
                type: type,
                message: message,
                callback: callback
            });
            return;
        }
        message.type = type;
        if (callback) {
            var maxId = 0;
            if (this.callbackList.length > 0) {
                var removeItems = [];
                for (var i = 0; i < this.callbackList.length; i++) {
                    var cbItem = this.callbackList[i];
                    if (cbItem.id > maxId)
                        maxId = cbItem.id;
                    if (__WEBPACK_IMPORTED_MODULE_7_moment___default()(cbItem.time).isBefore(__WEBPACK_IMPORTED_MODULE_7_moment___default()().subtract(15, 'minutes'))) {
                        removeItems.push(i);
                    }
                }
                for (var i = 0; i < removeItems.length; i++) {
                    this.callbackList.splice(removeItems[i] - i, 1);
                }
            }
            var cbId = maxId + 1;
            this.callbackList.push({
                id: cbId,
                time: new Date(),
                callback: callback
            });
            message._cbId = cbId;
        }
        this.inputStream.next(JSON.stringify(message));
    };
    ViewProvider.prototype.httpOptions = function () {
        var headers = {
            'Access-Control-Allow-Origin': '*'
        };
        if (this.sessionKey) {
            headers['x-view-session'] = this.sessionKey;
        }
        return { headers: new __WEBPACK_IMPORTED_MODULE_0__angular_common_http__["c" /* HttpHeaders */](headers) };
    };
    ViewProvider.prototype.resetCamera = function () {
        this.camera.shutter = { title: '---', value: null };
        this.camera.aperture = { title: '---', value: null };
        this.camera.iso = { title: '---', value: null };
        this.camera.shutterAvailable = [];
        this.camera.apertureAvailable = [];
        this.camera.isoAvailable = [];
        this.camera.image = {};
        this.camera.lv = false;
        this.camera.delay = false;
        this.camera.battery = "";
        this.camera.status = "camera not connected";
    };
    ViewProvider.prototype.connectWs = function (address) {
        if (this.messages)
            return;
        // Using share() causes a single websocket to be created when the first
        // observer subscribes. This socket is shared with subsequent observers
        // and closed when the observer count falls to zero.
        this.messages = __WEBPACK_IMPORTED_MODULE_4_rxjs_websockets___default()(address, this.inputStream = new __WEBPACK_IMPORTED_MODULE_3_queueing_subject__["QueueingSubject"]()).messages.share();
    };
    ViewProvider.prototype.getSocketUrl = function () {
        var _this = this;
        var self = this;
        if (this.localNetwork)
            this.url = this.localUrl;
        else
            this.url = this.remoteUrl;
        console.log("connecting using URL:", this.url);
        return new Promise(function (resolve, reject) {
            self.http.get(_this.url + '/socket/address', _this.httpOptions()).timeout(5000)
                .subscribe(function (res) {
                resolve(res);
            }, function (err) {
                reject(err);
            });
        });
    };
    ViewProvider.prototype.addDevice = function (code) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.http.post(_this.url + '/api/device/new', { code: code }, _this.httpOptions())
                .subscribe(function (res) {
                //if(res.action == 'device_added') {
                resolve(res);
                //} else {
                //    reject("Failed to add VIEW device. Please try again.");
                //}
            }, function (err) {
                reject(err);
            });
        });
    };
    ViewProvider.prototype.resetPasswordRequest = function (email) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.http.post(_this.url + '/api/password_reset_request', { email: email }, _this.httpOptions())
                .subscribe(function (res) {
                resolve(res);
            }, function (err) {
                reject(err);
            });
        });
    };
    ViewProvider.prototype.resetPassword = function (email, code, password) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.http.post(_this.url + '/api/password_reset', { email: email, code: code, password: password }, _this.httpOptions())
                .subscribe(function (res) {
                if (res.action == 'login' && res.session) {
                    _this.sessionKey = res.session;
                    _this.accountEmail = email;
                    _this.storage.set('accountEmail', _this.accountEmail);
                    _this.storage.set('sessionKey', _this.sessionKey);
                    _this.connect();
                }
                resolve(res);
            }, function (err) {
                reject(err);
            });
        });
    };
    ViewProvider.prototype.login = function (email, password) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.http.post(_this.url + '/api/login', { email: email, password: password }, _this.httpOptions())
                .subscribe(function (res) {
                if (res.action == 'login' && res.session) {
                    _this.sessionKey = res.session;
                    _this.accountEmail = email;
                    _this.storage.set('accountEmail', _this.accountEmail);
                    _this.storage.set('sessionKey', _this.sessionKey);
                    _this.connect();
                }
                resolve(res);
            }, function (err) {
                reject(err);
            });
        });
    };
    ViewProvider.prototype.logout = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.loggedIn = false;
            _this.noDevice = false;
            _this.sessionKey = "";
            _this.accountEmail = "";
            _this.storage.set('accountEmail', _this.accountEmail);
            _this.storage.set('sessionKey', _this.sessionKey);
            _this.socketSubscription.unsubscribe();
            resolve();
            _this.connect();
        });
    };
    ViewProvider.prototype.register = function (email, name, password) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.http.post(_this.url + '/api/register', { email: email, name: name, password: password }, _this.httpOptions())
                .subscribe(function (res) {
                if (res.action == 'login' && res.session) {
                    _this.sessionKey = res.session;
                    _this.accountEmail = email;
                    _this.storage.set('accountEmail', _this.accountEmail);
                    _this.storage.set('sessionKey', _this.sessionKey);
                    _this.connect();
                }
                resolve(res);
            }, function (err) {
                reject(err);
            });
        });
    };
    ViewProvider.prototype.checkEmail = function (email) {
        var _this = this;
        var self = this;
        return new Promise(function (resolve, reject) {
            self.http.post(_this.url + '/api/email', { email: email }, _this.httpOptions())
                .subscribe(function (res) {
                resolve(res);
            }, function (err) {
                reject(err);
            });
        });
    };
    ViewProvider.prototype.connect = function () {
        var _this = this;
        this.connected = false;
        this.noDevice = false;
        this.resetCamera();
        this.getSocketUrl().then(function (res) {
            console.log("socket res:", res);
            _this.attempts = 1;
            if (res && res.address) {
                _this.storage.set('localNetwork', _this.localNetwork);
                _this.connectWs(res.address);
                _this.socketSubscription = _this.messages.subscribe(function (messageStr) {
                    var message = JSON.parse(messageStr);
                    console.log('received message from server: ', message);
                    if (!_this.connected) {
                        if (_this.localNetwork)
                            _this.loggedIn = false;
                        else
                            _this.loggedIn = true;
                        _this.events.publish('connected', 'successfully connected!');
                        _this.connected = true;
                        for (var i = 0; i < _this.offlineQueue.length; i++) {
                            _this.send(_this.offlineQueue[i].type, _this.offlineQueue[i].message, _this.offlineQueue[i].callback);
                        }
                        _this.offlineQueue = [];
                    }
                    var callback = function (err, res) {
                        if (message._cbId) {
                            for (var i = 0; i < _this.callbackList.length; i++) {
                                if (_this.callbackList[i].id == message._cbId) {
                                    //console.log("cb found:", msg._cbId);
                                    var cb = _this.callbackList[i].callback;
                                    _this.callbackList.splice(i, 1);
                                    return cb.call(_this, err, res);
                                }
                            }
                            console.log("failed to find callback id", message._cbId, "in", _this.callbackList);
                        }
                    };
                    if (message.type == 'nodevice') {
                        if (!_this.noDevice) {
                            _this.noDevice = true;
                            _this.events.publish('nodevice', true);
                        }
                    }
                    else if (message.type != 'pong') {
                        if (_this.noDevice) {
                            _this.noDevice = false;
                            _this.events.publish('nodevice', false);
                        }
                    }
                    switch (message.type) {
                        case 'motion':
                            if (message.available && message.motors) {
                                _this.motion.available = true;
                                for (var i = 0; i < message.motors.length; i++) {
                                    _this.motion.setupAxis(message.motors[i]);
                                }
                            }
                            else {
                                _this.motion.available = false;
                                for (var i = 0; i < _this.motion.axis.length; i++) {
                                    _this.motion.axis[i].connected = false;
                                }
                                _this.events.publish('motion.updated');
                            }
                            break;
                        case 'move':
                            var index = _this.motion.getAxisIndex(message.driver + '-' + message.motor);
                            if (message.complete && message.driver && _this.motion.axis[index]) {
                                _this.motion.axis[index].moving = (message.position == null);
                                var moving = false;
                                for (var i = 0; i < _this.motion.axis.length; i++) {
                                    if (_this.motion.axis[i].moving) {
                                        moving = true;
                                        break;
                                    }
                                }
                                _this.motion.moving = moving;
                                if (message.position != null)
                                    _this.motion.axis[index].pos = message.position;
                                if (_this.motion.axis[index].callbacks && _this.motion.axis[index].callbacks.length > 0) {
                                    for (var i = 0; i < _this.motion.axis[index].callbacks.length; i++) {
                                        _this.motion.axis[index].callbacks[i](message.position);
                                    }
                                    _this.motion.axis[index].callbacks = null;
                                }
                                callback(null, message);
                            }
                            break;
                        case 'camera':
                            _this.camera.connected = message.connected;
                            if (message.connected) {
                                _this.camera.status = message.model + " connected";
                                _this.camera.supports = message.supports;
                                _this.events.publish('camera.updated');
                                _this.send("get", { key: 'settings' }, null);
                            }
                            else {
                                _this.resetCamera();
                                _this.events.publish('camera.updated');
                            }
                        case 'settings':
                            if (message.settings && message.settings.lists && message.settings.lists.shutter) {
                                _this.camera.shutterAvailable = message.settings.lists.shutter.map(function (item) { return { title: item.name, value: item.cameraName, ev: item.ev }; });
                            }
                            if (message.settings && message.settings.lists && message.settings.lists.aperture) {
                                _this.camera.apertureAvailable = message.settings.lists.aperture.map(function (item) { return { title: item.name, value: item.cameraName, ev: item.ev }; });
                            }
                            if (message.settings && message.settings.lists && message.settings.lists.iso) {
                                _this.camera.isoAvailable = message.settings.lists.iso.map(function (item) { return { title: item.name, value: item.cameraName, ev: item.ev }; });
                            }
                            if (message.settings && message.settings.shutter) {
                                var search = _this.camera.shutterAvailable.filter(function (item) { return item.title == message.settings.shutter; });
                                if (search.length > 0)
                                    _this.camera.shutter = Object.assign({}, search[0]);
                            }
                            if (message.settings && message.settings.aperture) {
                                var search = _this.camera.apertureAvailable.filter(function (item) { return item.title == message.settings.aperture; });
                                if (search.length > 0)
                                    _this.camera.aperture = Object.assign({}, search[0]);
                            }
                            if (message.settings && message.settings.iso) {
                                var search = _this.camera.isoAvailable.filter(function (item) { return item.title == message.settings.iso; });
                                if (search.length > 0)
                                    _this.camera.iso = Object.assign({}, search[0]);
                            }
                            if (message.settings && message.settings.focusPos != null) {
                                _this.camera.focusPos = parseInt(message.settings.focusPos);
                                if (isNaN(_this.camera.focusPos))
                                    _this.camera.focusPos = 0;
                            }
                            if (message.settings && message.settings.battery != null && message.settings.battery != false) {
                                _this.camera.battery = message.settings.battery;
                                if (!isNaN(parseInt(_this.camera.battery))) {
                                    console.log("using number for camera battery:", _this.camera.battery, parseInt(_this.camera.battery));
                                    _this.camera.battery = Math.round(parseFloat(_this.camera.battery)).toString() + "%";
                                }
                            }
                            else {
                                _this.camera.battery = "";
                            }
                            _this.camera.settings = message.settings;
                            _this.events.publish('camera.updated');
                            break;
                        case 'histogram':
                            _this.camera.histogram = message.histogram;
                            break;
                        case 'thumbnail':
                            message.jpeg = "data:image/jpeg;base64," + message.jpeg;
                            _this.camera.image = message;
                            if (message.imageType == 'thumbnail') {
                                message.shutter = Object.assign({}, _this.camera.shutter);
                                message.iso = Object.assign({}, _this.camera.iso);
                                message.aperture = Object.assign({}, _this.camera.aperture);
                                message.time = new Date();
                                if (!_this.camera.lastImages)
                                    _this.camera.lastImages = [];
                                _this.camera.lastImages.unshift(Object.assign({}, message));
                                if (_this.camera.lastImages.length > 5)
                                    _this.camera.lastImages = _this.camera.lastImages.slice(0, 5);
                                if (_this.intervalometer.status.running && !_this.intervalometer.preview.playing)
                                    _this.intervalometer.preview.image = _this.camera.image.jpeg;
                            }
                            else if (message.imageType == 'preview') {
                                if (_this.camera.lv) {
                                    console.log("fetching next lv frame");
                                    _this.send('preview', null, null);
                                }
                            }
                            else if (message.imageType == 'test') {
                                _this.intervalometer.preview.image = _this.camera.image.jpeg;
                            }
                            break;
                        case 'battery':
                            _this.battery = message.percentage ? Math.round(parseFloat(message.percentage)) : 0;
                            _this.charging = message.charging ? true : false;
                            break;
                        case 'status':
                            clearTimeout(_this.statusTimer);
                            _this.camera.status = message.status ? message.status : '';
                            _this.statusTimer = setTimeout(function () {
                                _this.camera.status = "";
                            }, 30000);
                            break;
                        case 'timelapse-clips':
                            _this.status.fetchingClips = false;
                            var clips = message.clips ? message.clips : [];
                            if (clips.length != _this.timelapse.clips.length) {
                                _this.timelapse.clips = clips;
                                for (var i = 0; i < _this.timelapse.clips.length; i++) {
                                    _this.timelapse.clips[i].pos = 0;
                                    _this.timelapse.clips[i].playing = false;
                                    _this.timelapse.clips[i].max = -1;
                                    if (_this.timelapse.frames[_this.timelapse.clips[i].index])
                                        _this.timelapse.clips[i].max = _this.timelapse.frames[_this.timelapse.clips[i].index].length;
                                }
                            }
                            break;
                        case 'timelapse-clip-info':
                            for (var i = 0; i < _this.timelapse.clips.length; i++) {
                                if (_this.timelapse.clips[i].name.toLowerCase() == message.info.name.toLowerCase()) {
                                    message.info.date = new Date(message.info.date);
                                    _this.timelapse.clips[i].info = message.info;
                                    break;
                                }
                            }
                            break;
                        case 'timelapse-images':
                            if (message.error) {
                                //callback(message.error);
                            }
                            else if (message.fragment != null) {
                                if (!_this.timelapseFragments[message.index])
                                    _this.timelapseFragments[message.index] = {};
                                _this.timelapseFragments[message.index][message.fragment] = message.images;
                                console.log("adding fragment of " + _this.timelapseFragments[message.index][message.fragment].length + "");
                                var complete = true;
                                var missing = 0;
                                for (var i = 0; i < message.fragments; i++) {
                                    if (!_this.timelapseFragments[message.index][i]) {
                                        complete = false;
                                        missing++;
                                    }
                                }
                                if (complete) {
                                    if (message.index != 'current')
                                        _this.timelapse.frames[message.index] = [];
                                    for (var i = 0; i < message.fragments; i++) {
                                        _this.timelapse.frames[message.index] = _this.timelapse.frames[message.index].concat(_this.timelapseFragments[message.index][i]);
                                    }
                                    _this.timelapseFragments[message.index] = null;
                                    console.log("received all image fragements, count = " + _this.timelapse.frames[message.index].length);
                                    if (message.index == 'current') {
                                        _this.intervalometer.preview.loadingFrames = false;
                                        _this.intervalometer.preview.loadingFramesPercent = 100;
                                        if (_this.intervalometer.preview.callback) {
                                            _this.intervalometer.preview.callback();
                                            _this.intervalometer.preview.callback = null;
                                        }
                                    }
                                    else {
                                        for (var i = 0; i < _this.timelapse.clips.length; i++) {
                                            if (_this.timelapse.clips[i].index == message.index) {
                                                _this.timelapse.clips[i].loadingFrames = false;
                                                _this.timelapse.clips[i].loadingFramesPercent = 100;
                                                if (_this.intervalometer.preview.callback) {
                                                    _this.intervalometer.preview.callback();
                                                    _this.intervalometer.preview.callback = null;
                                                }
                                                break;
                                            }
                                        }
                                    }
                                }
                                else {
                                    var percent = Math.round((message.fragments - missing) / message.fragments * 100);
                                    if (message.index == 'current') {
                                        _this.intervalometer.preview.loadingFramesPercent = percent;
                                    }
                                    else {
                                        for (var i = 0; i < _this.timelapse.clips.length; i++) {
                                            if (_this.timelapse.clips[i].index == message.index) {
                                                _this.timelapse.clips[i].loadingFramesPercent = percent;
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                            else {
                                if (message.index == 'current') {
                                    _this.timelapse.frames[message.index].concat(message.images);
                                    _this.intervalometer.preview.loadingFrames = false;
                                    _this.intervalometer.preview.loadingFramesPercent = 100;
                                    if (_this.intervalometer.preview.callback) {
                                        _this.intervalometer.preview.callback();
                                        _this.intervalometer.preview.callback = null;
                                    }
                                }
                                else {
                                    _this.timelapse.frames[message.index] = message.images;
                                    for (var i = 0; i < _this.timelapse.clips.length; i++) {
                                        if (_this.timelapse.clips[i].index == message.index) {
                                            _this.timelapse.clips[i].loadingFrames = false;
                                            _this.timelapse.clips[i].loadingFramesPercent = 100;
                                            break;
                                        }
                                    }
                                }
                            }
                            break;
                        case 'timelapseProgram':
                            if (message.program) {
                                if (message.program.axes) {
                                    for (var m in message.program.axes) {
                                        if (message.program.axes.hasOwnProperty(m)) {
                                            var axis = message.program.axes[m];
                                            if (axis.kf) {
                                                var kf = [];
                                                for (var i in axis.kf) {
                                                    if (axis.kf.hasOwnProperty(i)) {
                                                        kf.push(axis.kf[i]);
                                                    }
                                                }
                                                axis.kf = kf;
                                            }
                                        }
                                    }
                                }
                                _this.intervalometer.program = message.program;
                                _this.intervalometer.program.loaded = true;
                                _this.events.publish('intervalometer.program');
                            }
                            break;
                        case 'intervalometerStatus':
                            var wasRunning = _this.intervalometer.status.running;
                            if (message.status)
                                _this.intervalometer.status = message.status;
                            if (wasRunning && !_this.intervalometer.status.running)
                                _this.events.publish('intervalometer.stopped');
                            break;
                        case 'error':
                            message.message = message.error;
                            _this.events.publish('error', message);
                            break;
                        case 'captureError':
                            message.message = "an error occurred during capture (" + (message.msg || message.error) + ")";
                            _this.events.publish('error', message);
                            break;
                        case 'intervalometerError':
                            _this.events.publish('error', message);
                            break;
                        default:
                            {
                                if (message.error) {
                                    callback(message.error, message);
                                }
                                else {
                                    callback(null, message);
                                }
                            }
                    }
                }, function (error) {
                    if (_this.connected)
                        _this.events.publish('disconnected', 'disconnected: trying to reconnect');
                    _this.connected = false;
                    console.log("ERROR (observable):", error);
                    //this.messages.unsubscribe();
                    _this.messages = null;
                    setTimeout(function () { _this.connect(); }, 500);
                }, function () {
                    if (_this.connected)
                        _this.events.publish('disconnected', 'disconnected: trying to reconnect');
                    _this.connected = false;
                    console.log("COMPLETE (observable)");
                    //this.messages.unsubscribe();
                    _this.messages = null;
                    setTimeout(function () { _this.connect(); }, 3000);
                });
                if (_this.pingIntervalHandle)
                    clearInterval(_this.pingIntervalHandle);
                _this.pingIntervalHandle = setInterval(function () {
                    _this.send("ping", null, null);
                }, 5000);
                if (_this.sessionKey) {
                    _this.send("auth", { session: _this.sessionKey }, null);
                }
                _this.send("get", { key: 'camera' }, null);
                _this.send("get", { key: 'battery' }, null);
            }
            else if (res.action == 'login_required') {
                console.log("login_required");
                _this.events.publish('login_required');
            }
        }, function (err) {
            if (_this.attempts < 2)
                _this.events.publish('disconnected', 'disconnected: no network connection');
            _this.connected = false;
            _this.localNetwork = !_this.localNetwork;
            console.log("socket err:", err);
            if (_this.attempts < 30)
                _this.attempts *= 2;
            else
                _this.attempts = 30;
            setTimeout(function () { _this.connect(); }, 1000 * _this.attempts);
        });
    };
    ViewProvider = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_1__angular_core__["Injectable"])(),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_0__angular_common_http__["a" /* HttpClient */], __WEBPACK_IMPORTED_MODULE_2_ionic_angular__["c" /* Events */], __WEBPACK_IMPORTED_MODULE_8__ionic_storage__["b" /* Storage */]])
    ], ViewProvider);
    return ViewProvider;
}());

//# sourceMappingURL=view.js.map

/***/ }),

/***/ 433:
/***/ (function(module, exports, __webpack_require__) {

var map = {
	"./af": 213,
	"./af.js": 213,
	"./ar": 214,
	"./ar-dz": 215,
	"./ar-dz.js": 215,
	"./ar-kw": 216,
	"./ar-kw.js": 216,
	"./ar-ly": 217,
	"./ar-ly.js": 217,
	"./ar-ma": 218,
	"./ar-ma.js": 218,
	"./ar-sa": 219,
	"./ar-sa.js": 219,
	"./ar-tn": 220,
	"./ar-tn.js": 220,
	"./ar.js": 214,
	"./az": 221,
	"./az.js": 221,
	"./be": 222,
	"./be.js": 222,
	"./bg": 223,
	"./bg.js": 223,
	"./bm": 224,
	"./bm.js": 224,
	"./bn": 225,
	"./bn.js": 225,
	"./bo": 226,
	"./bo.js": 226,
	"./br": 227,
	"./br.js": 227,
	"./bs": 228,
	"./bs.js": 228,
	"./ca": 229,
	"./ca.js": 229,
	"./cs": 230,
	"./cs.js": 230,
	"./cv": 231,
	"./cv.js": 231,
	"./cy": 232,
	"./cy.js": 232,
	"./da": 233,
	"./da.js": 233,
	"./de": 234,
	"./de-at": 235,
	"./de-at.js": 235,
	"./de-ch": 236,
	"./de-ch.js": 236,
	"./de.js": 234,
	"./dv": 237,
	"./dv.js": 237,
	"./el": 238,
	"./el.js": 238,
	"./en-au": 239,
	"./en-au.js": 239,
	"./en-ca": 240,
	"./en-ca.js": 240,
	"./en-gb": 241,
	"./en-gb.js": 241,
	"./en-ie": 242,
	"./en-ie.js": 242,
	"./en-nz": 243,
	"./en-nz.js": 243,
	"./eo": 244,
	"./eo.js": 244,
	"./es": 245,
	"./es-do": 246,
	"./es-do.js": 246,
	"./es-us": 247,
	"./es-us.js": 247,
	"./es.js": 245,
	"./et": 248,
	"./et.js": 248,
	"./eu": 249,
	"./eu.js": 249,
	"./fa": 250,
	"./fa.js": 250,
	"./fi": 251,
	"./fi.js": 251,
	"./fo": 252,
	"./fo.js": 252,
	"./fr": 253,
	"./fr-ca": 254,
	"./fr-ca.js": 254,
	"./fr-ch": 255,
	"./fr-ch.js": 255,
	"./fr.js": 253,
	"./fy": 256,
	"./fy.js": 256,
	"./gd": 257,
	"./gd.js": 257,
	"./gl": 258,
	"./gl.js": 258,
	"./gom-latn": 259,
	"./gom-latn.js": 259,
	"./gu": 260,
	"./gu.js": 260,
	"./he": 261,
	"./he.js": 261,
	"./hi": 262,
	"./hi.js": 262,
	"./hr": 263,
	"./hr.js": 263,
	"./hu": 264,
	"./hu.js": 264,
	"./hy-am": 265,
	"./hy-am.js": 265,
	"./id": 266,
	"./id.js": 266,
	"./is": 267,
	"./is.js": 267,
	"./it": 268,
	"./it.js": 268,
	"./ja": 269,
	"./ja.js": 269,
	"./jv": 270,
	"./jv.js": 270,
	"./ka": 271,
	"./ka.js": 271,
	"./kk": 272,
	"./kk.js": 272,
	"./km": 273,
	"./km.js": 273,
	"./kn": 274,
	"./kn.js": 274,
	"./ko": 275,
	"./ko.js": 275,
	"./ky": 276,
	"./ky.js": 276,
	"./lb": 277,
	"./lb.js": 277,
	"./lo": 278,
	"./lo.js": 278,
	"./lt": 279,
	"./lt.js": 279,
	"./lv": 280,
	"./lv.js": 280,
	"./me": 281,
	"./me.js": 281,
	"./mi": 282,
	"./mi.js": 282,
	"./mk": 283,
	"./mk.js": 283,
	"./ml": 284,
	"./ml.js": 284,
	"./mr": 285,
	"./mr.js": 285,
	"./ms": 286,
	"./ms-my": 287,
	"./ms-my.js": 287,
	"./ms.js": 286,
	"./mt": 288,
	"./mt.js": 288,
	"./my": 289,
	"./my.js": 289,
	"./nb": 290,
	"./nb.js": 290,
	"./ne": 291,
	"./ne.js": 291,
	"./nl": 292,
	"./nl-be": 293,
	"./nl-be.js": 293,
	"./nl.js": 292,
	"./nn": 294,
	"./nn.js": 294,
	"./pa-in": 295,
	"./pa-in.js": 295,
	"./pl": 296,
	"./pl.js": 296,
	"./pt": 297,
	"./pt-br": 298,
	"./pt-br.js": 298,
	"./pt.js": 297,
	"./ro": 299,
	"./ro.js": 299,
	"./ru": 300,
	"./ru.js": 300,
	"./sd": 301,
	"./sd.js": 301,
	"./se": 302,
	"./se.js": 302,
	"./si": 303,
	"./si.js": 303,
	"./sk": 304,
	"./sk.js": 304,
	"./sl": 305,
	"./sl.js": 305,
	"./sq": 306,
	"./sq.js": 306,
	"./sr": 307,
	"./sr-cyrl": 308,
	"./sr-cyrl.js": 308,
	"./sr.js": 307,
	"./ss": 309,
	"./ss.js": 309,
	"./sv": 310,
	"./sv.js": 310,
	"./sw": 311,
	"./sw.js": 311,
	"./ta": 312,
	"./ta.js": 312,
	"./te": 313,
	"./te.js": 313,
	"./tet": 314,
	"./tet.js": 314,
	"./th": 315,
	"./th.js": 315,
	"./tl-ph": 316,
	"./tl-ph.js": 316,
	"./tlh": 317,
	"./tlh.js": 317,
	"./tr": 318,
	"./tr.js": 318,
	"./tzl": 319,
	"./tzl.js": 319,
	"./tzm": 320,
	"./tzm-latn": 321,
	"./tzm-latn.js": 321,
	"./tzm.js": 320,
	"./uk": 322,
	"./uk.js": 322,
	"./ur": 323,
	"./ur.js": 323,
	"./uz": 324,
	"./uz-latn": 325,
	"./uz-latn.js": 325,
	"./uz.js": 324,
	"./vi": 326,
	"./vi.js": 326,
	"./x-pseudo": 327,
	"./x-pseudo.js": 327,
	"./yo": 328,
	"./yo.js": 328,
	"./zh-cn": 329,
	"./zh-cn.js": 329,
	"./zh-hk": 330,
	"./zh-hk.js": 330,
	"./zh-tw": 331,
	"./zh-tw.js": 331
};
function webpackContext(req) {
	return __webpack_require__(webpackContextResolve(req));
};
function webpackContextResolve(req) {
	var id = map[req];
	if(!(id + 1)) // check for number or string
		throw new Error("Cannot find module '" + req + "'.");
	return id;
};
webpackContext.keys = function webpackContextKeys() {
	return Object.keys(map);
};
webpackContext.resolve = webpackContextResolve;
module.exports = webpackContext;
webpackContext.id = 433;

/***/ }),

/***/ 58:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "d", function() { return ViewApp; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return LoginModalContentPage; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "c", function() { return PairModalContentPage; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "b", function() { return MotionModalContentPage; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__angular_core__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_ionic_angular__ = __webpack_require__(23);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__ionic_native_status_bar__ = __webpack_require__(207);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3__ionic_native_splash_screen__ = __webpack_require__(210);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4__pages_camera_camera__ = __webpack_require__(211);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_5__pages_intervalometer_intervalometer__ = __webpack_require__(109);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_6__pages_clips_clips__ = __webpack_require__(337);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_7__pages_settings_settings__ = __webpack_require__(338);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_8__providers_view_view__ = __webpack_require__(39);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_9__ionic_pro__ = __webpack_require__(339);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_9__ionic_pro___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_9__ionic_pro__);
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};











var ViewApp = (function () {
    function ViewApp(platform, statusBar, splashScreen, events, viewApi, modalCtrl, alertCtrl, toastCtrl) {
        var _this = this;
        this.platform = platform;
        this.statusBar = statusBar;
        this.splashScreen = splashScreen;
        this.events = events;
        this.viewApi = viewApi;
        this.modalCtrl = modalCtrl;
        this.alertCtrl = alertCtrl;
        this.toastCtrl = toastCtrl;
        this.rootPage = __WEBPACK_IMPORTED_MODULE_4__pages_camera_camera__["a" /* CameraPage */];
        this.initializeApp();
        // used for an example of ngFor and navigation
        this.pages = [
            { title: 'Camera', component: __WEBPACK_IMPORTED_MODULE_4__pages_camera_camera__["a" /* CameraPage */], icon: 'camera' },
            { title: 'Intervalometer', component: __WEBPACK_IMPORTED_MODULE_5__pages_intervalometer_intervalometer__["a" /* IntervalometerPage */], icon: 'timer' },
            { title: 'Time-lapse Clips', component: __WEBPACK_IMPORTED_MODULE_6__pages_clips_clips__["b" /* ClipsPage */], icon: 'film' },
            { title: 'Settings', component: __WEBPACK_IMPORTED_MODULE_7__pages_settings_settings__["a" /* SettingsPage */], icon: 'settings' }
        ];
        var alert = null;
        var hasPerformedSync = false;
        events.subscribe('error', function (err) {
            var wait = 0;
            if (alert) {
                alert.dismiss();
                alert = null;
                wait = 500;
            }
            setTimeout(function () {
                alert = _this.alertCtrl.create({
                    title: 'ERROR',
                    subTitle: err.message || err.msg || 'unknown error',
                    buttons: ['Close']
                });
                alert.present();
            }, wait);
        });
        var toast = null;
        var newToast = null;
        var autoDismissedNoDevice = true;
        events.subscribe('login_required', function () {
            console.log('login_required event captured');
            var modal = _this.modalCtrl.create(LoginModalContentPage, {});
            if (toast) {
                autoDismissedNoDevice = true;
                console.log('Setting autoDismissedNoDevice = ', autoDismissedNoDevice);
                toast.dismiss('system');
                toast = null;
            }
            modal.present();
        });
        events.subscribe('disconnected', function (msg) {
            var wait = 0;
            if (toast) {
                autoDismissedNoDevice = true;
                console.log('Setting autoDismissedNoDevice = ', autoDismissedNoDevice);
                toast.dismiss('system');
                toast = null;
                wait = 1000;
            }
            newToast = _this.toastCtrl.create({
                message: msg,
                position: 'bottom',
                cssClass: 'error-toast'
            });
            setTimeout(function () {
                newToast.present();
                toast = newToast;
            }, wait);
        });
        events.subscribe('connected', function (msg) {
            var wait = 0;
            if (toast) {
                autoDismissedNoDevice = true;
                console.log('Setting autoDismissedNoDevice = ', autoDismissedNoDevice);
                toast.dismiss('system');
                toast = null;
                wait = 1000;
            }
            newToast = _this.toastCtrl.create({
                message: msg,
                position: 'bottom',
                duration: 3000,
            });
            setTimeout(function () {
                newToast.present();
                toast = newToast;
            }, wait);
            console.log("Connected! Logged in: ", _this.viewApi.loggedIn);
            if (!hasPerformedSync && _this.viewApi.loggedIn) {
                hasPerformedSync = true;
                console.log("Checking for version update... (new)");
                _this.runVersionUpdate();
            }
        });
        events.subscribe('nodevice', function (status) {
            var wait = 0;
            if (toast) {
                autoDismissedNoDevice = true;
                console.log('Setting autoDismissedNoDevice = ', autoDismissedNoDevice);
                toast.dismiss('system');
                toast = null;
                wait = 1000;
            }
            if (!status)
                return; // device added
            newToast = _this.toastCtrl.create({
                message: "No VIEW device connected.  Connect a paired device to wifi to access or pair a new device.",
                position: 'bottom',
                showCloseButton: true,
                closeButtonText: 'Add new VIEW'
            });
            setTimeout(function () {
                newToast.onDidDismiss(function (_null, role) {
                    console.log("modal dismissed, autoDismissedNoDevice:", autoDismissedNoDevice, role);
                    if (_this.viewApi.noDevice && _this.viewApi.connected && _this.viewApi.loggedIn && role == 'close') {
                        console.log('Adding VIEW device...');
                        var modal = _this.modalCtrl.create(PairModalContentPage, {});
                        modal.present();
                    }
                });
                autoDismissedNoDevice = false;
                console.log('Setting autoDismissedNoDevice = ', autoDismissedNoDevice);
                newToast.present();
                toast = newToast;
            }, wait);
        });
    }
    ViewApp.prototype.runVersionUpdate = function () {
        return __awaiter(this, void 0, void 0, function () {
            var currentVersion, resp, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("Checking for version update (async)...");
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, __WEBPACK_IMPORTED_MODULE_9__ionic_pro__["Pro"].deploy.getCurrentVersion()];
                    case 2:
                        currentVersion = _a.sent();
                        console.log("Current version: ", currentVersion);
                        return [4 /*yield*/, __WEBPACK_IMPORTED_MODULE_9__ionic_pro__["Pro"].deploy.sync({ updateMethod: 'background' })];
                    case 3:
                        resp = _a.sent();
                        if (!currentVersion || !resp) {
                            console.log("Error occurred during update:", "version data not available");
                        }
                        else {
                            if (currentVersion.versionId !== resp.versionId) {
                                console.log("Update check complete, new version will load on next boot");
                                // We found an update, and are in process of redirecting you since you put auto!
                            }
                            else {
                                console.log("Update check complete, no update available");
                                // No update available
                            }
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        err_1 = _a.sent();
                        console.log("Error occurred during update:", err_1);
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    ViewApp.prototype.initializeApp = function () {
        var _this = this;
        this.platform.ready().then(function () {
            // Okay, so the platform is ready and our plugins are available.
            // Here you can do any higher level native things you might need.
            __WEBPACK_IMPORTED_MODULE_9__ionic_pro__["Pro"].deploy.configure({
                'appId': '5d0a65db',
                'channel': 'Production'
            });
            _this.statusBar.styleBlackTranslucent();
            _this.splashScreen.hide();
        });
    };
    ViewApp.prototype.openPage = function (page) {
        // Reset the content nav to have just this page
        // we wouldn't want the back button to show in this scenario
        this.nav.setRoot(page.component);
    };
    __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_0__angular_core__["ViewChild"])(__WEBPACK_IMPORTED_MODULE_1_ionic_angular__["h" /* Nav */]),
        __metadata("design:type", __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["h" /* Nav */])
    ], ViewApp.prototype, "nav", void 0);
    ViewApp = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_0__angular_core__["Component"])({template:/*ion-inline-start:"/Users/elijah/VIEW-App/src/app/app.html"*/'<ion-menu [content]="content">\n  <ion-header>\n    <ion-toolbar>\n      <ion-title><img src="assets/imgs/view-text.png" style="margin-top: 0.5em;height:2em;"></ion-title>\n    </ion-toolbar>\n  </ion-header>\n\n  <ion-content>\n    <ion-list no-lines>\n      <button menuClose ion-item *ngFor="let p of pages" (click)="openPage(p)">\n        <ion-icon name="{{p.icon}}"></ion-icon> {{p.title}}\n      </button>\n    </ion-list>\n  </ion-content>\n  <ion-footer>\n    <p>\n      <small style="color:#ccc;padding:1em;">VIEW Intervalometer Remote App</small><br>\n      <small style="color:#ccc;padding:1em;">Version 1.2 - b20200122</small><br>\n      <small style="color:#ccc;padding:1em;">Requires VIEW firmware v1.8-beta98 or newer</small><br>\n      <small style="color:#ccc;padding:1em;">©2020 Elijah Parker / Timelapse+</small><br>\n      <small style="color:#ccc;padding:1em;"><a href="https://www.timelapseplus.com">timelapseplus.com</a>  <a href="http://docs.view.tl">docs.view.tl</a></small><br>\n    </p>\n  </ion-footer>\n\n\n</ion-menu>\n\n<!-- Disable swipe-to-go-back because it\'s poor UX to combine STGB with side menus -->\n<ion-nav [root]="rootPage" #content swipeBackEnabled="false"></ion-nav>'/*ion-inline-end:"/Users/elijah/VIEW-App/src/app/app.html"*/
        }),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_1_ionic_angular__["k" /* Platform */], __WEBPACK_IMPORTED_MODULE_2__ionic_native_status_bar__["a" /* StatusBar */], __WEBPACK_IMPORTED_MODULE_3__ionic_native_splash_screen__["a" /* SplashScreen */], __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["c" /* Events */], __WEBPACK_IMPORTED_MODULE_8__providers_view_view__["a" /* ViewProvider */], __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["g" /* ModalController */], __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["a" /* AlertController */], __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["l" /* ToastController */]])
    ], ViewApp);
    return ViewApp;
}());

var LoginModalContentPage = (function () {
    function LoginModalContentPage(viewCtrl, viewApi, toastCtrl, alertCtrl) {
        this.viewCtrl = viewCtrl;
        this.viewApi = viewApi;
        this.toastCtrl = toastCtrl;
        this.alertCtrl = alertCtrl;
    }
    LoginModalContentPage.prototype.submit = function (mode, name, email, password, password1, password2) {
        if (mode == 'register') {
            this.register(name, email, password1, password2);
            return false;
        }
        else {
            this.login(email, password);
            return false;
        }
    };
    LoginModalContentPage.prototype.register = function (name, email, password1, password2) {
        var _this = this;
        var toast = this.toastCtrl.create({
            message: "Creating account for " + email + "...",
            position: 'bottom',
        });
        if (password1 && password1.length > 5) {
            if (password1 == password2) {
                toast.present();
                this.viewApi.register(email, name, password1).then(function (res) {
                    if (toast) {
                        console.log("dismissing toast...");
                        toast.dismiss();
                    }
                    console.log("registration res", res);
                    if (res.action == 'login') {
                        _this.viewCtrl.dismiss();
                    }
                    else if (res.action == 'login_failed') {
                        console.log("message:", res.message);
                        toast = _this.toastCtrl.create({
                            message: res.message,
                            position: 'bottom',
                            cssClass: 'error-toast',
                            duration: 5000,
                        });
                        toast.present();
                    }
                }, function () {
                    if (toast) {
                        toast.dismiss();
                    }
                    toast = _this.toastCtrl.create({
                        message: "Error contacting server - please try again later",
                        position: 'bottom',
                        cssClass: 'error-toast',
                        showCloseButton: true,
                    });
                    toast.present();
                });
            }
            else {
                toast = this.toastCtrl.create({
                    message: "Passwords do not match",
                    position: 'bottom',
                    cssClass: 'error-toast',
                    duration: 5000,
                    showCloseButton: true,
                });
                toast.present();
            }
        }
        else {
            toast = this.toastCtrl.create({
                message: "Password must be at least 5 characters long",
                position: 'bottom',
                cssClass: 'error-toast',
                duration: 5000,
                showCloseButton: true,
            });
            toast.present();
        }
    };
    LoginModalContentPage.prototype.login = function (email, password) {
        var _this = this;
        var toast = this.toastCtrl.create({
            message: "Logging in as " + email + "...",
            position: 'bottom',
        });
        toast.present();
        this.viewApi.login(email, password).then(function (res) {
            if (toast) {
                console.log("dismissing toast...");
                toast.dismiss();
            }
            console.log("login res", res);
            if (res.action == 'login') {
                _this.viewCtrl.dismiss();
            }
            else if (res.action == 'login_failed') {
                console.log("message:", res.message);
                toast = _this.toastCtrl.create({
                    message: res.message,
                    position: 'bottom',
                    cssClass: 'error-toast',
                    duration: 5000,
                });
                toast.present();
            }
        }, function () {
            if (toast) {
                toast.dismiss();
            }
            toast = _this.toastCtrl.create({
                message: "Error contacting server - please try again later",
                position: 'bottom',
                cssClass: 'error-toast',
                showCloseButton: true,
            });
            toast.present();
        });
    };
    LoginModalContentPage.prototype.resetPasswordPrompt = function (email) {
        var _this = this;
        var alert = this.alertCtrl.create();
        alert.setTitle("Account Email");
        alert.addInput({
            placeholder: 'email address',
            value: email,
            type: 'email',
        });
        alert.addButton('Cancel');
        alert.addButton({
            text: 'Ok',
            handler: function (data) {
                _this.doPasswordReset(data[0]);
            }
        });
        alert.present();
    };
    LoginModalContentPage.prototype.showResetDialog = function (email) {
        var _this = this;
        var toast = null;
        var alert = this.alertCtrl.create();
        alert.setTitle("Reset password (code sent to email)");
        alert.addInput({
            placeholder: 'code (from email)',
            type: 'number',
        });
        alert.addInput({
            placeholder: 'new password',
            type: 'password',
        });
        alert.addInput({
            placeholder: 'confirm password',
            type: 'password',
        });
        alert.addButton('Cancel');
        alert.addButton({
            text: 'Ok',
            handler: function (data) {
                var code = data[0];
                var password1 = data[1];
                var password2 = data[2];
                if (password1 != password2) {
                    toast = _this.toastCtrl.create({
                        message: "Error: passwords do not match",
                        position: 'bottom',
                        cssClass: 'error-toast',
                        duration: 5000,
                    });
                    toast.present();
                    _this.showResetDialog(email);
                }
                else {
                    toast = _this.toastCtrl.create({
                        message: "Resetting password...",
                        position: 'bottom',
                    });
                    _this.viewApi.resetPassword(email, code, password1).then(function (res) {
                        if (toast) {
                            toast.dismiss();
                        }
                        if (res.action == 'login') {
                            toast = _this.toastCtrl.create({
                                message: "Password reset, logged in!",
                                duration: 5000,
                                showCloseButton: true,
                                position: 'bottom',
                            });
                            _this.viewCtrl.dismiss();
                        }
                        else if (res.action == 'register') {
                            console.log("message:", res.message);
                            toast = _this.toastCtrl.create({
                                message: res.message,
                                position: 'bottom',
                                cssClass: 'error-toast',
                                duration: 5000,
                            });
                            toast.present();
                        }
                    }, function () {
                        if (toast) {
                            toast.dismiss();
                        }
                        toast = _this.toastCtrl.create({
                            message: "Error contacting server - please try again later",
                            position: 'bottom',
                            cssClass: 'error-toast',
                            showCloseButton: true,
                        });
                        toast.present();
                    });
                }
            }
        });
        alert.present();
    };
    LoginModalContentPage.prototype.doPasswordReset = function (email) {
        var _this = this;
        var toast = this.toastCtrl.create({
            message: "Checking account for " + email + "...",
            position: 'bottom',
        });
        toast.present();
        this.viewApi.resetPasswordRequest(email).then(function (res) {
            if (toast) {
                toast.dismiss();
            }
            console.log("login res", res);
            if (res.action == 'reset') {
                _this.showResetDialog(email);
            }
            else if (res.action == 'register') {
                console.log("message:", res.message);
                toast = _this.toastCtrl.create({
                    message: res.message,
                    position: 'bottom',
                    cssClass: 'error-toast',
                    duration: 5000,
                });
                toast.present();
            }
        }, function () {
            if (toast) {
                toast.dismiss();
            }
            toast = _this.toastCtrl.create({
                message: "Error contacting server - please try again later",
                position: 'bottom',
                cssClass: 'error-toast',
                showCloseButton: true,
            });
            toast.present();
        });
    };
    LoginModalContentPage = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_0__angular_core__["Component"])({template:/*ion-inline-start:"/Users/elijah/VIEW-App/src/app/login.modal.html"*/'<ion-header>\n  <ion-toolbar>\n    <ion-title>\n      Login / Register\n    </ion-title>\n  </ion-toolbar>\n</ion-header>\n\n<ion-content no-lines>\n  <form><!-- (submit)="submit(mode, name, email, password, password1, password2)">-->\n  <ion-grid>\n    <ion-row>\n      <ion-col *ngIf="mode!=\'register\'">\n        <p>\n          Please login with your app.view.tl account email and password.\n        </p>\n        <p>\n          If you don\'t yet have an account, <a href="#" (click)="mode=\'register\'">register here</a>\n        </p>\n        <p>\n          Forgot password? <a href="#" (click)="resetPasswordPrompt(email)">click here to reset</a>\n        </p>\n      </ion-col>\n      <ion-col *ngIf="mode==\'register\'">\n        <p>\n          Complete the form below to create your new account.\n        </p>\n        <p>\n          If already have an account, <a href="#" (click)="mode=\'login\'">login here</a>\n        </p>\n      </ion-col>\n    </ion-row>\n    <ion-row>\n      <ion-col>\n        <ion-list>\n\n          <ion-item *ngIf="mode==\'register\'">\n            <ion-label stacked>Full Name</ion-label>\n            <ion-input type="text" [(ngModel)]="name" name="name"></ion-input>\n          </ion-item>\n\n          <ion-item>\n            <ion-label stacked>Email</ion-label>\n            <ion-input type="email" [(ngModel)]="email" name="email"></ion-input>\n          </ion-item>\n\n          <ion-item *ngIf="mode!=\'register\'">\n            <ion-label stacked>Password</ion-label>\n            <ion-input type="password" [(ngModel)]="password" name="password"></ion-input>\n          </ion-item>\n\n          <ion-item *ngIf="mode==\'register\'">\n            <ion-label stacked>Password</ion-label>\n            <ion-input type="password" [(ngModel)]="password1" name="password1"></ion-input>\n          </ion-item>\n          <ion-item *ngIf="mode==\'register\'">\n            <ion-label stacked>Confirm Password</ion-label>\n            <ion-input type="password" [(ngModel)]="password2" name="password2"></ion-input>\n          </ion-item>\n\n        </ion-list>\n      </ion-col>\n    </ion-row>\n\n    <ion-row>\n      <ion-col *ngIf="mode!=\'register\'">\n        <button ion-button (click)="login(email, password)">Login</button>\n      </ion-col>\n      <ion-col *ngIf="mode==\'register\'">\n        <button ion-button (click)="register(name, email, password1, password2)">Create Account</button>\n      </ion-col>\n    </ion-row>\n  </ion-grid>\n  </form>\n</ion-content>\n'/*ion-inline-end:"/Users/elijah/VIEW-App/src/app/login.modal.html"*/
        }),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_1_ionic_angular__["m" /* ViewController */],
            __WEBPACK_IMPORTED_MODULE_8__providers_view_view__["a" /* ViewProvider */],
            __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["l" /* ToastController */],
            __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["a" /* AlertController */]])
    ], LoginModalContentPage);
    return LoginModalContentPage;
}());

var PairModalContentPage = (function () {
    function PairModalContentPage(viewCtrl, viewApi, toastCtrl) {
        this.viewCtrl = viewCtrl;
        this.viewApi = viewApi;
        this.toastCtrl = toastCtrl;
        this.toast = null;
        console.log("PairModalContentPage initialized");
    }
    PairModalContentPage.prototype.dismiss = function () {
        if (this.toast) {
            this.toast.dismiss();
        }
        this.viewApi.noDevice = false;
        this.viewCtrl.dismiss();
    };
    PairModalContentPage.prototype.pair = function (code) {
        var _this = this;
        this.toast = this.toastCtrl.create({
            message: "Pairing device...",
            position: 'bottom',
        });
        this.toast.present();
        this.viewApi.addDevice(code).then(function (res) {
            if (_this.toast) {
                _this.toast.dismiss();
            }
            console.log("login res", res);
            if (res.action == 'device_added') {
                _this.viewCtrl.dismiss();
            }
            else {
                console.log("message:", res.message);
                _this.toast = _this.toastCtrl.create({
                    message: res.message,
                    position: 'bottom',
                    cssClass: 'error-toast',
                    duration: 10000,
                });
                _this.toast.present();
            }
        }, function () {
            if (_this.toast) {
                _this.toast.dismiss();
            }
            _this.toast = _this.toastCtrl.create({
                message: "Error contacting server - please try again later",
                position: 'bottom',
                cssClass: 'error-toast',
                showCloseButton: true,
            });
            _this.toast.present();
        });
    };
    PairModalContentPage = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_0__angular_core__["Component"])({template:/*ion-inline-start:"/Users/elijah/VIEW-App/src/app/pair.modal.html"*/'<ion-header>\n  <ion-toolbar>\n    <ion-title>\n      Pair VIEW device\n    </ion-title>\n    <ion-buttons start>\n      <button ion-button (click)="dismiss()">\n        <ion-icon name="close"></ion-icon>\n      </button>\n    </ion-buttons>\n  </ion-toolbar>\n</ion-header>\n\n<ion-content no-lines>\n  <ion-grid>\n    <ion-row>\n      <ion-col>\n        Connect the VIEW to WiFi Internet, then go to Information->Registration &amp; App on the VIEW.  Once it has an Internet connection, it will display a code for pairing.  Enter that code here to pair the VIEW with your app account.\n      </ion-col>\n    </ion-row>\n    <ion-row>\n      <ion-col>\n        <ion-list>\n\n          <ion-item>\n            <ion-label fixed>Device Code</ion-label>\n            <ion-input type="number" [(ngModel)]="code"></ion-input>\n          </ion-item>\n\n        </ion-list>\n      </ion-col>\n    </ion-row>\n\n    <ion-row>\n      <ion-col>\n        <button ion-button (click)="pair(code)" [disabled]="code && code.length == 6 ? 0 : 2">Add VIEW</button>\n      </ion-col>\n    </ion-row>\n  </ion-grid>\n\n</ion-content>\n'/*ion-inline-end:"/Users/elijah/VIEW-App/src/app/pair.modal.html"*/
        }),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_1_ionic_angular__["m" /* ViewController */],
            __WEBPACK_IMPORTED_MODULE_8__providers_view_view__["a" /* ViewProvider */],
            __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["l" /* ToastController */]])
    ], PairModalContentPage);
    return PairModalContentPage;
}());

var MotionModalContentPage = (function () {
    function MotionModalContentPage(params, viewCtrl, viewApi, alertCtrl, events) {
        var _this = this;
        this.params = params;
        this.viewCtrl = viewCtrl;
        this.viewApi = viewApi;
        this.alertCtrl = alertCtrl;
        this.events = events;
        this.axes = [];
        this.motion = {};
        this.toast = null;
        this.axisId = null;
        this.calibrating = false;
        this.axisId = params.get('axisId');
        if (this.axisId) {
            this.axes = this.viewApi.motion.axis.filter(function (a) { return a.id == _this.axisId; });
        }
        else {
            this.motion = this.viewApi.motion;
            this.motion.get();
            this.events.subscribe('motion.updated', function () {
                _this.axes = _this.viewApi.motion.axis || [];
                _this.motion = _this.viewApi.motion;
            });
        }
        console.log("MotionModalContentPage initialized", this.axes);
    }
    MotionModalContentPage.prototype.calibrate = function (axis) {
        var _this = this;
        if (axis && axis.id) {
            this.calibrating = true;
            this.viewApi.motion.calibrate(axis.id, function (err, backlash) {
                _this.calibrating = false;
                if (!err && backlash)
                    axis.backlash = Math.round(backlash * 100) / 100;
                if (err) {
                    var alert_1 = _this.alertCtrl.create({
                        title: 'Calibration failed',
                        subTitle: err,
                        buttons: ['Close']
                    });
                    alert_1.present();
                }
            });
        }
    };
    MotionModalContentPage.prototype.doNumber = function (name, object, key, callback) {
        var _this = this;
        var alert = this.alertCtrl.create();
        alert.setTitle(name || "enter value");
        alert.addInput({
            type: 'number',
            value: object[key]
        });
        alert.addButton('Cancel');
        alert.addButton({
            text: 'Ok',
            handler: function (data) {
                console.log('Number data:', data);
                object[key] = data[0];
                if (callback)
                    callback.call(_this, object, key);
            }
        });
        alert.present();
    };
    MotionModalContentPage.prototype.saveBacklash = function (axis) {
        this.viewApi.motion.setBacklash(axis.id, axis.backlash);
    };
    MotionModalContentPage.prototype.cancelCalibration = function (axis) {
        if (axis && axis.id) {
            this.viewApi.motion.cancelCalibration(axis.id);
        }
    };
    MotionModalContentPage.prototype.dismiss = function () {
        for (var i = 0; i < this.axes.length; i++) {
            this.updateHardware(this.axes[i]);
            this.updateType(this.axes[i]);
            this.axes[i].setup = true;
            if (this.axes[i].unit == 's')
                this.axes[i].unitSteps = 1;
            this.viewApi.db.set('motion-' + this.axes[i].id, this.axes[i]);
            console.log("saving motion setup:", this.axes[i]);
            this.motion.axis = this.axes;
        }
        if (this.toast) {
            this.toast.dismiss();
        }
        this.viewApi.noDevice = false;
        this.viewCtrl.dismiss();
    };
    MotionModalContentPage.prototype.updateRatios = function (axis) {
        var gearRatio = 1;
        if (!axis.motorRatio)
            axis.motorRatio = '19:1';
        if (axis.driver == 'NMX') {
            if (axis.hardware == 'stager') {
                if (axis.motorRatio == '5:1') {
                    gearRatio = 5;
                }
                else if (axis.motorRatio == '27:1') {
                    gearRatio = 27;
                }
                else {
                    gearRatio = 19 + 9 / 19;
                }
                gearRatio *= (3 + 3 / 11); // add Stage-R ratio;
                //axis.unitSteps = 558.63333334;
            }
            else if (axis.hardware == 'sapphire') {
                gearRatio = 60;
                // axis.unitSteps = 550.81967213;
            }
            else if (axis.hardware == 'cognisys') {
                gearRatio = 80;
            }
            else {
                return; // don't update anything if not Stage-R or Sapphire
            }
        }
        else {
            return; // don't update anything if not NMX
        }
        axis.unitSteps = (200 * 16 * gearRatio) / 360;
    };
    MotionModalContentPage.prototype.updateHardware = function (axis) {
        console.log("updating hardware", axis);
        this.updateRatios(axis);
    };
    MotionModalContentPage.prototype.updateType = function (axis) {
        console.log("updating driver", axis);
        if (axis.name == 'Pan' || axis.name == 'Tilt' || axis.name == 'Polar') {
            axis.unit = '°';
            if (axis.driver == 'NMX') {
                this.updateRatios(axis);
            }
            else if (axis.driver == 'GM') {
                axis.unitSteps = 1;
            }
        }
        else {
            axis.unit = 's';
            axis.unitSteps = 1;
        }
    };
    MotionModalContentPage = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_0__angular_core__["Component"])({template:/*ion-inline-start:"/Users/elijah/VIEW-App/src/app/motion.modal.html"*/'<ion-header>\n  <ion-toolbar>\n    <ion-title>\n      Motion Setup\n    </ion-title>\n    <ion-buttons start>\n      <button ion-button (click)="dismiss()">\n        <ion-icon name="close"></ion-icon>\n      </button>\n    </ion-buttons>\n  </ion-toolbar>\n</ion-header>\n\n<ion-content no-lines>\n  <ion-grid>\n    <ion-row *ngIf="!axes || axes.length == 0">\n      <ion-col>\n        <p>\n          No VIEW-controllable motion equipment is connected.  To connect, enable Bluetooth on the VIEW and power on the motion equipment.  Once connected, the axes will be appear here.\n        </p>\n      </ion-col>\n    </ion-row>\n\n    <ion-row *ngFor="let a of axes">\n      <ion-col>\n        <ion-list>\n\n          <ion-list-header>{{a.id}}: {{a.name}}</ion-list-header>\n\n          <ion-item *ngIf="a.driver==\'NMX\'">\n            <ion-label>Motion Hardware</ion-label>\n            <ion-select [(ngModel)]="a.hardware" (ionChange)="updateHardware(a)">\n              <ion-option value="sapphire">Sapphire</ion-option>\n              <ion-option value="stager">Stage-R</ion-option>\n              <ion-option value="cognisys">Cognisys Pan/Tilt</ion-option>\n              <ion-option value="other">Other</ion-option>\n            </ion-select>\n          </ion-item>\n\n          <ion-item *ngIf="a.driver==\'NMX\'&&a.hardware==\'other\'">\n            <ion-label>Axis Function</ion-label>\n            <ion-select [(ngModel)]="a.name" (ionChange)="updateType(a)">\n              <ion-option value="Pan">Pan</ion-option>\n              <ion-option value="Tilt">Tilt</ion-option>\n              <ion-option value="Slide">Slide</ion-option>\n              <ion-option value="Focus">Focus</ion-option>\n              <ion-option value="#{{a.motor}}">#{{a.motor}}</ion-option>\n            </ion-select>\n          </ion-item>\n          <ion-item *ngIf="a.driver==\'ST4\'&&a.motor>2">\n            <ion-label>Axis Function</ion-label>\n            <ion-select [(ngModel)]="a.name" (ionChange)="updateType(a)">\n              <ion-option value="Slide">Slide</ion-option>\n              <ion-option value="Focus">Focus</ion-option>\n              <ion-option value="#{{a.motor}}">#{{a.motor}}</ion-option>\n            </ion-select>\n          </ion-item>\n          <ion-item *ngIf="a.driver==\'NMX\'&&(a.hardware==\'sapphire\'||a.hardware==\'cognisys\')">\n            <ion-label>Axis Function</ion-label>\n            <ion-select [(ngModel)]="a.name" (ionChange)="updateType(a)">\n              <ion-option value="Pan">Pan</ion-option>\n              <ion-option value="Tilt">Tilt</ion-option>\n            </ion-select>\n          </ion-item>\n          <ion-item *ngIf="a.driver==\'NMX\'&&a.hardware==\'stager\'">\n            <ion-label>Motor Gearbox</ion-label>\n            <ion-select [(ngModel)]="a.motorRatio" (ionChange)="updateRatios(a)">\n              <ion-option value="19:1">19:1</ion-option>\n              <ion-option value="27:1">27:1</ion-option>\n              <ion-option value="5:1">5:1</ion-option>\n            </ion-select>\n          </ion-item>\n          <ion-item *ngIf="a.driver==\'NMX\'&&a.hardware==\'stager\'">\n            <ion-label>Axis Function</ion-label>\n            <ion-select [(ngModel)]="a.name" (ionChange)="updateType(a)">\n              <ion-option value="Pan">Pan</ion-option>\n              <ion-option value="Tilt">Tilt</ion-option>\n              <ion-option value="Polar">Polar</ion-option>\n            </ion-select>\n          </ion-item>\n          <ion-item *ngIf="a.driver==\'GM\'&&!a.orientation">\n            <ion-label>Axis Function</ion-label>\n            <ion-select [(ngModel)]="a.name" (ionChange)="updateType(a)">\n              <ion-option value="Pan">Pan</ion-option>\n              <ion-option value="Tilt">Tilt</ion-option>\n            </ion-select>\n          </ion-item>\n\n          <ion-item *ngIf="a.driver==\'NMX\'&&a.hardware==\'other\' || (a.driver==\'ST4\' && a.motor>2)">\n            <ion-label>Axis Unit</ion-label>\n            <ion-select [(ngModel)]="a.unit">\n              <ion-option value="s">Steps</ion-option>\n              <ion-option value="°">Degrees</ion-option>\n              <ion-option value="in">Inches</ion-option>\n              <ion-option value="cm">Centimeters</ion-option>\n              <ion-option value="m">Meters</ion-option>\n            </ion-select>\n          </ion-item>\n\n          <ion-item *ngIf="!(a.unit==\'s\'||a.driver==\'GM\'||a.hardware!=\'other\') || (a.driver==\'ST4\' && a.motor>2 && a.unit != \'s\')">\n            <ion-label fixed>Steps / Unit</ion-label>\n            <ion-input item-end type="number" [(ngModel)]="a.unitSteps"></ion-input>\n          </ion-item>\n\n          <ion-item>\n            <ion-label>Reverse Direction</ion-label>\n            <ion-toggle color="light" [(ngModel)]="a.reverse"></ion-toggle>\n          </ion-item>\n\n          <ion-item *ngIf="a.driver!=\'ST4\'">\n            <ion-label fixed>Backlash</ion-label>\n            <button ion-button item-end outline (click)="doNumber(\'backlash \'+(a.driver==\'GM\'?\'degrees\':\'steps\'), a, \'backlash\', saveBacklash)">{{a.backlash}}</button>\n          </ion-item>\n\n          <ion-item *ngIf="a.driver==\'NMX\'">\n            <ion-label>Calibrate Backlash</ion-label>\n            <button *ngIf="!calibrating" ion-button item-end outline (click)="calibrate(a)">calibrate</button>\n            <button *ngIf="calibrating" ion-button item-end color="danger" outline (click)="cancelCalibration(a)">cancel</button>\n          </ion-item>\n\n        </ion-list>\n      </ion-col>\n    </ion-row>\n\n  </ion-grid>\n\n</ion-content>\n'/*ion-inline-end:"/Users/elijah/VIEW-App/src/app/motion.modal.html"*/
        }),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_1_ionic_angular__["j" /* NavParams */],
            __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["m" /* ViewController */],
            __WEBPACK_IMPORTED_MODULE_8__providers_view_view__["a" /* ViewProvider */],
            __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["a" /* AlertController */],
            __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["c" /* Events */]])
    ], MotionModalContentPage);
    return MotionModalContentPage;
}());

//# sourceMappingURL=app.component.js.map

/***/ })

},[341]);
//# sourceMappingURL=main.js.map