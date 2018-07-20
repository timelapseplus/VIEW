exports.timelapseMenu = "Welcome to the VIEW Intervalometer!  The Time-lapse menu is the intervalometer, where you setup a simple time-lapse or automatic exposure ramp.\n To leave this help screen, press the top button on the right.  Then, press the knob or the middle button on the right to enter the Time-lapse menu.";

exports.captureMenu = "The Capture menu puts the camera into live-view mode and captures photos to the camera's memory card when the knob is pressed. Turning the knob will adjust the exposure.  Pressing the middle button will enter focus mode, where the knob will then adjust focus if supported. \n At present, the Capture menu only works with Canon and Nikon cameras.";

exports.clipsMenu = "This is where you can playback your time-lapse clips, even while they're still recording. \nPress the bottom right button to show options for the selected clip.  \nTo save XMP data to an SD card while in the Time-lapse Clips menu, insert an SD card, press the bottom right button, then select 'Write XMPs to SD card' to save the XMPs for the selected clip.";

exports.settingsMenu = "Various settings including WiFi and software updates can be found here. \n  More options and settings are planned to be added soon.";

exports.wifiMenu = "Enable/disable WiFi and manage WiFi connections.  WiFi must be enabled and connected to update the VIEW software.";

exports.chargeIndicatorMenu = "Use this setting to enable or disable the charge indicator light on the left side of the VIEW, right above the micro-USB charging port.  \nIf disabled, the light will never be illuminated.  \nIf enabled (default), the light will blink while charging, remain on while connected with a full battery, and always be off if external power is not connected.";

exports.softwareMenu = "Update to the latest software for the VIEW here. You can also roll back to previous versions.  \nNote that updating to a new version can take as long as 30 minutes to complete.  Rolling back to previous versions should not take more than a minute.";

exports.wifiConnectMenu = "Use this to browse nearby access points.  Connect to an access point by selecting it and pressing the knob or the middle button on the right.  \nYou will be prompted for a password if it is a secure network.  Passwords are automatically stored and the the VIEW will attempt to connect to the previous network on the next power on. \nNote that connecting to an access point will disable the TL+VIEW local access point.";

exports.wifiEnableMenu = "This will power on and enable the WiFi interface.  Enabling WiFi decreases battery life by about 30%.";

exports.wifiDisableMenu = "This will disable and power off the WiFi interface.  Disabling WiFi increases battery life by about 30%.  \nNote: bluetooth is also disabled when WiFi is disabled.";

exports.wifiApMenu = "This enables the TL+VIEW access point, allowing remote control from a smartphone, tablet or computer.  It's currently not possibly to both enable the access point and connect to an outside access point, so enabling this will disconnect any other connection. \nOnce the TL+VIEW access point is enabled, connect to the access point from a web-cable device (e.g., smartphone) and open http://10.0.0.1/ in the web browser.";

exports.wifiConnect = "Pressing the knob or middle right button will connect to the selected access point and prompt for a password if needed.  Passwords are automatically stored for reconnecting.  If the TL+VIEW access point is enabled, it will be disabled before connecting to the selected access point.";

exports.softwareHelpHeader = "Pressing the knob or middle right button will install the currently selected software version.  If the version is already downloaded, it will quickly load, but new versions can take up to 30 minutes to download and install.";

exports.exposureMenu = "This puts the camera in live-view mode and allows adjusting of the exposure via the knob.  Press the top right button to exit. \nNote: This feature is still in development and is very limited. It only works with Canon and Nikon cameras at present.  It will cause Sony cameras to crash and require a power cycle.  A fix will be released soon, but in the meantime do not use this for cameras other than Canon and Nikon.  Instead, simply setup the focus and exposure from the camera directly.";

exports.rampingOptions = "This determines the time-lapse mode: \"Basic - Fixed\" for standard time-lapse with no exposure change, or \"Auto Ramping\" for fully automatic exposure ramping.";

exports.framesOptions = "Number of frames to capture before stopping.  Switch to \"Auto Ramping\" Time-lapse Mode to have it continue until stopped.";

exports.intervalOptions = "This setting determines the interval type - Fixed or Variable.  A fixed interval is constant throughout the entire time-lapse, where a variable interval has a Day setting and a Night setting, and the interval is ramped between them based on the exposure value.  This can be useful for having a shorter interval during sunset (so it appears to last longer), then longer interval for the night exposures, and again short for sunrise.";

exports.destinationOptions = "The VIEW can save images from the time-lapse sequence to the camera's memory card or to an SD card in the VIEW.  It's recommended to use an SD card in the VIEW (option \"Save to SD\") for easier post-processing since the XMP files will be automatically saved along side the RAW images.  \nThen, to import them into Lightroom, select the SD card as a folder in the Lightroom import dialog (the lower left part, as opposed to \"devices\" on the upper-left) and find the time-lapse folder within the drive.  The images imported will have the exposure correction already applied for deflickering, so make sure not to change the exposure (this means don't use the \"Previous\" button!).  Any other setting is ok to change.";

exports.nightInterval = "This is the interval length (the time from the start of one exposure to the start of the next) in seconds to use during the night.  It will automatically be ramped to/from the day interval.  \nA recommended night interval to start with is 40 seconds, as this allows for a full 30-second exposure with some processing time (setting the camera to 30s actually is a 32 second exposure).";

exports.dayInterval = "This is the interval length (the time from the start of one exposure to the start of the next) in seconds to use during the daylight.  It will automatically be ramped to/from the night interval. \nA recommended day interval to start with is 8 seconds, starting about an hour before sunset. \nCurrently, it's not recommended to use intervals less than 4 seconds for regular time-lapse and not less than 6 seconds for automatic ramping. I'm working to decrease these limits soon.";

exports.interval = "This is the interval length (the time from the start of one exposure to the start of the next) in seconds.\nCurrently, it's not recommended to use intervals less than 4 seconds for regular time-lapse and not less than 6 seconds for automatic ramping. I'm working to decrease these limits soon.";

exports.startTimelapse = "Are all the settings correct?  This will get it started!  Once it's going, you can navigate to other menus, view the time-lapse, or if you let the screen go blank for a little while, wave your hand across the front of the screen twice to activate a hands-free preview of the time-lapse while its running.";

exports.eraseAllSettingsMenu = "Warning! This will erase all stored settings, including time-lapse settings, wifi passwords, and saved time-lapse clips.";

exports.wifiPassword = "Enter the WiFi password here. Use the lower-right button to select the character mode (uppercase, lowercase, number, etc). Use the knob to scroll through the characters options for the current mode.\nPress the knob to advance the cursor, press and hold the knob while turning to move the cursor.\nWhen complete, press the middle right button to save and connect, or use the top right to cancel.";

exports.btEnableMenu = "This will enable Bluetooth and allow automatically connecting to a nearby NMX motion controller (this functionality is still limited and in development).  The VIEW must first either be connected to a wifi access point (Connect to Network) or have the built-in access point enabled (Enable built-in AP).";

exports.btDisableMenu = "This disables Bluetooth.";

exports.connectCamera = "Connect the camera via USB to enable the time-lapse menu.  If the camera is already connected, try unplugging it and plugging it back in.  Sony cameras must have USB mode set to \"PC Connect\" to work with the VIEW.";

exports.rampingOptionsMenu = "In this menu you can customize how the VIEW performs automatic exposure ramping.  More options will be added soon.";

exports.rampingNightCompensation = "Target exposure compensation for night exposures.  This determines the exposure level during automatic ramping for the night (relative to during the day). A value of -1 is recommended so that night appears appropriately \"dark\".  Above 0 would be overexposed; less than 0 underexposed.";

exports.saveXMPs = "This saves the XMP files to a folder on the inserted SD card (XMP files contain settings for Lightroom). \n The XMP files within the folder will have the same names as the image file and will need to be copied to the same folder as the images and then imported into Lightroom. \n Or, if the images are already in Lightroom, copy the XMP files into the existing image folder and then in Lightroom, select all the images and right-click, select Metadata -> Read Metadata from Files.\n Note that none of this is necessary if the time-lapse destination setting was set to SD card - the XMPs will already have been saved with the images and will import together in Lightroom.";

exports.appCode = "The VIEW is connected to the internet and trying to authenticate with view.tl, a service for remotely monitoring and controlling the VIEW via the internet. \n To activate, open http://app.view.tl on your phone and login or register, then press \"Add Device\" and enter the code shown here on the VIEW screen. \n You will then be able to use view.tl to access your VIEW device remotely when it's connected to the internet.";

exports.developerModeMenu = "When enabled, Developer Mode enables pre-release software updates. THIS IS NOT RECOMMENDED unless you're doing software development with the VIEW, as pre-release updates could brick your device (it's always fixable, but will take some work). \nDeveloper Mode may also enable other development-related functions in the future.";

exports.autoPowerOffMenu = "Sets or disables automatic power off (in minutes).  Regardless of the setting, the VIEW will not power down in the following situations:\n- While a phone is connected\n- If it's connected to view.tl\n- If it is plugged in to charge\n- If a time-lapse is running";

exports.interfaceSettingsMenu = "User interface settings for colors & LEDs & gesture sensor are found here.";

exports.gestureEnableMenu = "Enables/Disables the gesture sensor for non-contact review of time-lapse while running.";

exports.colorThemeMenu = "Sets the colors used for the VIEW display interface.";

exports.buttonModeMenu = "Configures the button backlights while powered on.  During boot, the power button will always be illuminated.  Once booted, the backlights are configured as defined by this setting.  The default is for them all to be off (disabled)";

exports.deleteClip = "This removes all time-lapse data for the selected clip.  This includes the thumbnail previews and data used for generating XMPs.  It does NOT remove any previously saved XMPs or RAW images from the camera or SD card.";

exports.writeXMPs = "Writes XMP files to the SD card for the selected clip.  The XMP files can be merged with the RAW images to provide flicker-free processing in Lightroom. \nThis is not necessary if the time-lapse destination had been set to the SD card originally.";

exports.updateCameraLibrary = "This updates the camera support library, libgphoto2, to provide support for the latest camera bodies.  This can take some time, but it runs in the background.  It's not not to have the camera connected while updating the camera library.  A message will appear once it's complete or if there are problems.\nIf it's interrupted while updating, it will prompt to complete the process next time it's connected to WiFi.\nTechnical info: it's downloading the latest source up to the most recently tested commit hash directly from github and compiling and installing it locally.  A little crazy (and slow), but it works and is reliable.";

exports.timelapseStatus = "This screen shows the status of the running time-lapse.\n-Press the cancel button to return to the main menu (the time-lapse will keep running)\n- Press the enter button to playback the time-lapse up to the current frame\n- Press the menu button to show the option to stop the time-lapse\nThe line across the bottom third displays the interval status. The red portion is when the shutter is open, the blue is the buffer and processing time, and the gray is the remainder of the interval.  The white mark which moves across shows the current position in time across the interval.";

exports.shutterMax = "The maximum shutter speed to ramp up to during auto ramping (once this max is reached, the ISO will be increased instead)";

exports.isoMax = "The maximum ISO to ramp up to during auto ramping (note that this will limit the ramping range)";

exports.isoMin = "The minimum ISO to use during auto ramping (note that this will limit the ramping range)";

exports.sendLogsMenu = "This will prepare the current log file (since power on) to send for review by Elijah Parker as an aid for development and bugfixing.  It will either be sent immediately or next time it's connected to the internet via WiFi.  The logs will be associated with your email address so you may be contacted when there is a resolution or if more info is needed.\nThe log file is compressed before sending and large logs can take as long as 10 minutes to compress, so if the VIEW is unresponsive, please give it some time.";

exports.sendClipLog = "This will prepare the log file from the selected time-lapse to send for review by Elijah Parker as an aid for development and bugfixing.  It will either be sent immediately or next time it's connected to the internet via WiFi.  The logs will be associated with your email address so you may be contacted when there is a resolution or if more info is needed.\nThe log file is compressed before sending and large logs can take as long as 10 minutes to compress, so if the VIEW is unresponsive, please give it some time.";

exports.logFilesUploaded = "The logs files have been successfully uploaded for review.  Thank you for your help in improving the VIEW!";

exports.errorReportReasonMenu = "Please select the reason for sending the log that best matches the issues you've experienced.  This will help us know what to look for in the report.  If unsure, just select 'other'.  Thanks for your feedback!";

exports.logsQueued = "The log file has been queued for upload and will be sent now or when a wifi connection is next available.  Thank you for your feedback - we will work resolve any issues as soon as possible.  Once it's uploaded, you'll get an email. Please reply with any additional details.  Thanks!";

exports.useTimelapseSetup = "This will load the settings used for this clip as a new time-lapse setup.  Selecting it will update the current time-lapse setup and open the Time-lapse menu.";

exports.sendCameraReport = "This will run a few tests on the camera and record the results in an extensive debug log for camera support troubleshooting.  The log will then be sent to Elijah Parker for review.";

exports.manualAperture = "Set the lens aperture here if you're using a manual lens, lens-twist, or unsupported lens.  This aids in the calculation of absolute exposure values for day/night ramping.";

exports.powerInfo = "This displays the current power consumption and battery info.  It is only updated when first opened.";

exports.gpsInfo = "This displays the current GPS status and position info.  It is only updated when first opened.";

exports.sunAndMoon = "This displays the current sun and moon info based on the current GPS readings.  It is only updated when first opened.";

exports.infoMenu = "Various system, power, GPS and sun/moon info (if available) can be found here";

exports.gpsEnableMenu = "Enables/disables GPS module.  Disabling the GPS improves battery life.";

exports.systemInfo = "System and version information";

exports.apertureMin = "The minimum aperture (widest opening, e.g., f/2.8) setting to use when ramping exposure.\nIt's recommended to limit the minimum to one stop above wide open to avoid a change in vignetting which is difficult to correct in post.";

exports.apertureMax = "The maximum aperture (smallest opening, e.g., f/16) setting to use when ramping exposure.\nIt's recommended to limit the maximum aperture to about f/8 to avoid flicker caused by irregularities at a smaller aperture setting.";

exports.rampParameters = "Camera parameters used for ramping.\n- Shutter, ISO (S+I):\n Ramps using shutter and ISO (not aperture)\n- Sh, ISO (balanced) (S=I)\n Ramps shutter and ISO together, causing a more gradual change in shutter speed.\n- Sh, Aperture, ISO (S+A+I)\n Ramps using all parameters, including aperture.";

exports.playbackCamera = "Plays the time-lapse clip as captured by the secondary camera";

exports.registrationInfo = "Info and instructions for pairing with app.view.tl";

exports.cameraSelection = "Selects the primary camera used for setup and exposure tracking during ramping with multiple cameras.  Other cameras will mirror the primary camera's settings.";

exports.audioAlertsMenu = "Configure audio alerts for popup errors and time-lapse completion";

exports.writeSpreadsheet = "Writes a spreadsheet file to the SD card with technical data from the clip";

exports.wifiAccessPointName = "This sets the name (SSID) of the built-in access point.\n  Use the lower-right button to select the character mode (uppercase, lowercase, number, etc). Use the knob to scroll through the characters options for the current mode.\nPress the knob to advance the cursor, press and hold the knob while turning to move the cursor.\nWhen complete, press the middle right button to save, or use the top right to cancel.";

exports.wifiAccessPointPassword = "This sets the password for the built-in access point.\n  Use the lower-right button to select the character mode (uppercase, lowercase, number, etc). Use the knob to scroll through the characters options for the current mode.\nPress the knob to advance the cursor, press and hold the knob while turning to move the cursor.\nWhen complete, press the middle right button to save, or use the top right to cancel.";

exports.setAccessPointName = "This sets the name (SSID) of the built-in access point.";

exports.setAccessPointPassword = "This sets the password for the built-in access point.";

exports.installFromSdCard = "To install firmware from an SD card instead of over wifi, download the latest firmware zip file from the github releases page (github.com/timelapseplus/VIEW/releases), save it to the root folder of an SD card and insert it in the VIEW, then run 'Install from SD card' from the Software Version section.";

exports.rampingAlgorithmLRTimelapse = "This auto-ramping method is developed by Gunther Wegner for use with LRTimelapse post-processing and does not require XMP files from the VIEW when processed with LRTimelapse"

exports.rampingAlgorithmLuminance = "This the default auto-ramping method, developed by Elijah Parker using PID control based on the luminance of the images"

exports.rampingAlgorithmGps = "This an experimental auto ramping algorithm based strictly on the sun position as calculated by GPS data and not on luminance or histogram"

exports.rampingAlgorithm = "Determines the method used for auto ramping"

exports.trackingOptions = "With an NMX connected, this can be set to follow the sun or the moon relative to the starting position";

exports.trackingPanMotor = "Select the motor for panning (left and right) when tracking. To disable panning when tracking, select 'none'.";

exports.trackingTiltMotor = "Select the motor for tilting (up and down) when tracking. To disable tilting when tracking, select 'none'.";

exports.setCoordinates = "Set custom coordinates for use without GPS or for testing for other locations";

exports.setTime = "Set the current time in 24-hour UTC (GMT+0000).  Note that this is also automatically set when connected to the internet as well as by the GPS when enabled.";

exports.setDate = "Set the current date in UTC (GMT+0000).  Note that this is also automatically set when connected to the internet as well as by the GPS when enabled.";

exports.eclipseInfo = "Info about the next upcoming solar eclipse.";

exports.highlightProtection = "A feature added in v1.8 to quickly decrease exposure if clipping is detected during ramping in order to preserve highlights.  Applicable only to the PID Luminance ramping method.";

exports.motionSetupMenu = "Configure and manage 3rd-party motion hardware";

exports.nmxMotorOptionsAutodetect = "Attempt to autodetect motor attachment - doesn't always work, especially if the power supply to the NMX is above 12v.";

exports.nmxMotorOptionsDisable = "Disable motor on the NMX.  This axis will not appear for keyframe programming.";

exports.nmxMotorOptionsEnable = "Enable motor on the NMX.  This axis will appear available for keyframe programming, regardless of whether a motor is attached or not.";

exports.nmxMotorAttachment = "Manually enable/disable motors connected to NMX";

exports.configureNMX = "Configure the NMX motion controller by Dynamic Perception (connects via Bluetooth or USB)";

exports.lrtDirection = "Direction for exposure ramping.  Note that this applies only to the LRTimelapse ramping algorithm.  The PID Luminance algorithm (default) is always auto bi-directional."
