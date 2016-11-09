module.exports = function(grunt) {

  // Project tasks configuration
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    jsbeautifier: {
      options: {
        config: './.jsbeautifyrc'
      },
      files : ['config/**/*.json', 'js/app/**/*.js']
    },

    jshint: {
      options: {
        jshintrc: true
      },
      src: ['config/**/*.json', 'js/app/**/*.js']
    }
  });

  // Load grunt plugins
  grunt.loadNpmTasks('grunt-jsbeautifier');
  grunt.loadNpmTasks('grunt-contrib-jshint');

  // Default tasks
  grunt.registerTask('default', ['jsbeautifier', 'jshint']);
};
