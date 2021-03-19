const { src,dest,series,parallel,watch } = require('gulp');
const gulpPug = require('gulp-pug');
const gulpReplaceImageSrc = require('gulp-replace-image-src');
const gulpBeautify = require('gulp-beautify');
const gulpInject = require('gulp-inject');
const gulpRemoveHtmlComments = require('gulp-remove-html-comments');
const gulpSass = require('gulp-sass');
gulpSass.compiler = require('node-sass');
const gulpSourcemaps = require('gulp-sourcemaps');
const gulpSassGlob = require('gulp-sass-glob');
const gulpStyleAliases = require('gulp-style-aliases');
const gulpSassVariables = require('gulp-sass-variables');
const gulpSassVars = require('gulp-sass-vars');
const gulpPostcss = require('gulp-postcss');
const gulpAutoprefixer = require('autoprefixer');
const gulpModifyCssUrls = require('gulp-modify-css-urls');
const gulpClean = require('gulp-clean');
const gulpRename = require("gulp-rename");
const browserSync = require('browser-sync').create();
const gulpIf = require('gulp-if');
const gulpIgnore = require('gulp-ignore');
const fs = require('fs');

const isDevelopmentMode = true;
const scssVariables = require('./scssVariables.js');
const bootstrapCDN = 'https://stackpath.bootstrapcdn.com/bootstrap/4.4.1/css/bootstrap.min.css';

function convertPreprocessorToNativeHTML() {
	const injectedCss = src('dist/css/*.css',{
		read: false
	});
	return src('src/index.pug')
	.pipe(gulpPug({
		verbose: isDevelopmentMode
	}))
	.pipe(gulpInject(injectedCss, {
		transform: function (filepath) {
			let correctFilePath = filepath.replace(/\/dist\//i,'');
			let neededFilesRegExp = /[.]css/;
			let isCssFile = neededFilesRegExp.test(correctFilePath);
			if (isCssFile) {
				let frameworkNameTemplate = /bootstrap/;
				let isFrameworkFile = frameworkNameTemplate.test(correctFilePath);
				if (!isDevelopmentMode && isFrameworkFile) {
					return `<link rel="stylesheet" href="${bootstrapCDN}" integrity="sha384-Vkoo8x4CGsO3+Hhxv8T/Q5PaXtkKtu6ug5TOeNV6gBiFeWPGFN9MuhOf23Q9Ifjh" crossorigin="anonymous">`;
				}
				return `<link rel="stylesheet" href="${correctFilePath}">`;
			}
			return gulpInject.transform.apply(gulpInject.transform, arguments);
		}
	}))
	.pipe(gulpRemoveHtmlComments())
	.pipe(gulpReplaceImageSrc({
		prependSrc: 'img/',
		keepOrigin : false
	}))
	.pipe(gulpBeautify.html({
		indent_size: (isDevelopmentMode) ? 4 : 0,
		eol: (isDevelopmentMode) ? "\n" : ""
    	
	}))
	.pipe(dest('dist/'));
}
 

function convertPreprocessorToCssNativeStyles() {
	const plugins = [
        gulpAutoprefixer({overrideBrowserslist: ['last 2 version']})
    ];
    const ignoreCondition = '*.map';
	let localPathTemplate = 'src/scss/';
	return src('src/scss/index.scss')
	.pipe(gulpStyleAliases({
		"@extends" : localPathTemplate + 'extends/*.scss',
		"@functions" : localPathTemplate + 'functions/*.scss',
		"@media_queries" : localPathTemplate + 'media_queries/**/*.scss',
		"@mixins" : localPathTemplate + 'mixins/*.scss',
		"@modules" : localPathTemplate + 'modules/*.scss',
		"@variables" : localPathTemplate + 'variables/*.scss'
	}))
	.pipe(gulpSassGlob())
	.pipe(gulpSassVariables({
		$env: (isDevelopmentMode) ? 'development' : 'production'
	}))
	.pipe(gulpSourcemaps.init())
	.pipe(gulpSass({
		outputStyle: (isDevelopmentMode) ? 'expanded' : 'compressed'
	}).on('error',gulpSass.logError))
	.pipe(gulpRename({
		suffix: (isDevelopmentMode) ? '' : '.min',
	}))
	.pipe(gulpModifyCssUrls({
		modify(url, filePath) {
      	let correctUrl = url.replace(/([.]{2}\/)?[.]{2}\/img\//mi,'');
      	console.log(correctUrl,filePath);
        return correctUrl;
      	},
      prepend: '../img/',
	}))
	.pipe(gulpPostcss(plugins))
	.pipe(gulpSourcemaps.write('.'))
	.pipe(gulpIf(!isDevelopmentMode,gulpIgnore.exclude(ignoreCondition)))
	.pipe(dest('dist/css/'))
	.pipe(browserSync.stream());
}
 
function createScssVariables() {
	return src('src/scss/variables/variables.scss')
	.pipe(gulpSassVars(scssVariables, {
		verbose: isDevelopmentMode
	}))
	.pipe(dest('src/scss/variables/', {
		append: true
	}));
}

function importExternalFrameworks() {
	let commonPath = 'src/libs/bootstrap4.4/'
	let fileName = 'bootstrap.min.css';
	let sourceName = 'bootstrap.min.css.map'
	return src([commonPath + fileName, commonPath + sourceName])
	.pipe(dest('dist/css/'));
}


function browserAutoReload() {
	browserSync.init({
		server: {
			baseDir: './dist',
			port: 3000
		}
	});
	watcher();
}

function watcher() {
	watch(['src/index.pug','src/pugIncludes/**/*.pug'],convertPreprocessorToNativeHTML).on('change', browserSync.reload);
	watch('src/scss/**/*.scss',convertPreprocessorToCssNativeStyles);
	//watch('scssVariables.js',createScssVariables);
}

module.exports.html = convertPreprocessorToNativeHTML;
module.exports.css = convertPreprocessorToCssNativeStyles;
module.exports.create = createScssVariables;
module.exports.libs = importExternalFrameworks;
module.exports.browse = browserAutoReload;