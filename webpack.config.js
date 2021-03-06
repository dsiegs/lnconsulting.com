//Plugins
var async = require('async');
var fs = require('fs');
var pathUtil = require('path');
var marked = require('marked');
var jade = require('jade');
var minify = require('html-minifier').minify;
var minifyOptions = {
  removeComments: true,
  collapseWhitespace: true,
  collapseBooleanAttributes: true,
  removeAttributeQuotes: true,
  removeEmptyAttributes: true,
  //removeEmptyElements: true,
}


//Plugins
var ExtractTextPlugin = require("extract-text-webpack-plugin");
var CopyWebpackPlugin = require('copy-webpack-plugin');

var notJadeContent = [];
module.exports = {
  //enable source-maps
  devtool: 'source-map',

  module: {
    loaders: [
      { test: /\.html$/, loader: "html-loader" },
      { test: /\.css$/,
       //loader: "style-loader!css-loader"
       loader: ExtractTextPlugin.extract("style-loader", "css-loader")
      },
      { test: /\.less$/, loader: "style-loader!css-loader!less-loader"},
      {
        test: /\.(jpe?g|png|gif|svg)$/i,
        loaders: [
          'file?hash=sha512&digest=hex&name=[hash].[ext]',
          'image-webpack?bypassOnDebug&optimizationLevel=7&interlaced=false'
        ]
      }
    ],
  },

  entry: {
    'site-generator': 'static-site-loader!./content',
    'frontend': './assets/js/index.js',
    'styles': './assets/styles/index.js'
  },

  output: {
    filename: "[name].js",
    chunkFilename: "[id].js",
    path: 'built',
    libraryTarget: 'umd'
  },

  externals: {
    // require("jquery") is external and available
    //  on the global var jQuery
    "jquery": "jQuery"
  },

  plugins: [
    new ExtractTextPlugin("[name].css", { allChunks: true }),
    new CopyWebpackPlugin([
      //Copy folders in wholesale
      { from: 'assets/files', to: 'files' },
    ]),
  ],

  devServer: {
    contentBase: "./built",
  },

  staticSiteLoader: {
    //perform any preprocessing tasks you might need here.
    preProcess: function(source, path) {
      //watch the content directory for changes
      this.addContextDependency(path);

    //Define our template path
      var templatePath = 'templates/default.jade';

      //watch the template for changes
      this.addDependency(templatePath);

      //Compile the template for use later
      this.template = jade.compileFile(templatePath, { pretty: false });
    },
    //Test if a file should be processed or not, should return true or false;
    testToInclude: function(path, stats, absPath) {
      return pathUtil.extname(path) === '.md' || pathUtil.extname(path) === '.jade';
    },
    //allows you to rewrite the url path that this will be uploaded to
    rewriteUrlPath: function(path, stats, absPath) {
      var extensionSize;
      if (pathUtil.extname(path) === '.md') {
        extensionSize = -3;
      } else {
        extensionSize = -5;
        this.addDependency(absPath);
      }

      //strip out the extension
      var urlPath = path.slice(0, extensionSize);

      //rewrite /index to be just /, making index.md files become the folder index properly
      urlPath = urlPath.replace('index', '');

      //store these for later
      if (extensionSize === -3) {
        notJadeContent.push(urlPath);
      }

      return urlPath;
    },

    processFile: function(file, content) {
      if (pathUtil.extname(file.absPath) === '.md') { //this is a regular markdown file
        //Assemeble some meta data to use in template
        //match pico header info
        //see https://github.com/picocms/Pico/blob/v1.0.0-beta.2/lib/Pico.php#L760
        var picoCMSMetaPattern = /^\/\*(([\s\S])*?)\*\//;
        var meta = {};
        var temp = content.match(picoCMSMetaPattern);
        temp[1].split(/\r?\n/).forEach(function(value) {
          var row = value.split(':');
          meta[row[0]] = row[1];
        });

        //use compiled template to produce html file
        var fileContents = this.template({
          title: meta.Title,
          description: meta.Description,
          content: marked(content.replace(picoCMSMetaPattern, '')),
        });

        return fileContents;
      } else {
        // new jade file type
        return jade.render(content, {
          pretty: false,
          filename: file.absPath,
        });
      }
    },
  },
};
