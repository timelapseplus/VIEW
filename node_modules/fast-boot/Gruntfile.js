module.exports = function (grunt) {
  grunt.loadNpmTasks('grunt-mocha-test');

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    mochaTest: {
      test: {
        options: {
          reporter: 'spec',
          quiet: false,
          clearRequireCache: false,
          bail: false
        },
        src: ['test/**/*-spec.js']
      }
    }
  });

  grunt.registerTask('test', 'Run tests', ['mochaTest:test']);

};

