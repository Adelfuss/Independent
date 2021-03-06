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
const through2 = require('through2');
const gulpFilter = require('gulp-filter');
const imagemin = require('gulp-imagemin');
const cleanCSS = require('gulp-clean-css');
const ttf2woff2 = require('gulp-ttf2woff2');
const fileinclude = require('gulp-file-include');
const uncommentIt = require('gulp-uncomment-it');
const file = require('gulp-file');
const fs = require('fs');

// Not supported plugins on my host currently
// const webp = require('gulp-webp');
// const imagemin2 = require('imagemin');
// const imageminWebp = require('imagemin-webp');

let isDevelopmentMode = true;
const bootstrapCDN = 'https://stackpath.bootstrapcdn.com/bootstrap/4.4.1/css/bootstrap.min.css';
let scssVariables = {};
let pugVariables = {};

function convertPreprocessorToNativeHTML() {
	const injectedFiles = src(['dist/css/*.css'],{
		read: false
	});
	return src('src/index.pug')
	.pipe(gulpPug({
		verbose: isDevelopmentMode,
		basedir: 'src/pugIncludes',
		doctype: 'html',
		globals: ['global']
	}))
	.pipe(gulpInject(injectedFiles, {
		removeTags: true,
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
	.pipe(gulpIf(!isDevelopmentMode,uncommentIt()))
	.pipe(gulpIf(!isDevelopmentMode,fileinclude({
		prefix: '@@',
      	basepath: './'
	})))
	.pipe(gulpRemoveHtmlComments())
	.pipe(gulpReplaceImageSrc({
		prependSrc: 'img/',
		keepOrigin : true
	}))
	.pipe(gulpBeautify.html({
		indent_size: (isDevelopmentMode) ? 4 : 0,
		eol: (isDevelopmentMode) ? "\n" : ""
    	
	}))
	.pipe(dest('dist/'));
}
 

function compilePugVariables(cb) {
	try {
		const data = fs.readFileSync('pugVariables.js', 'utf8');
		pugVariables = eval(data);
		for(key in pugVariables) {
			global[key] = pugVariables[key];
		}
	  } catch (err) {
		console.error(err);
	  }
	cb();
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
		"@variables" : localPathTemplate + 'variables/*.scss',
		"@base" : localPathTemplate + 'base/*.scss'
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
		let correctUrl = url.replace(/([.]{2}\/){1,}?(img)?(fonts)?\//mi,'');
      	console.log(correctUrl,filePath);
		if (correctUrl.includes('.ttf') || correctUrl.includes('.woff2')) {
			return `http://localhost:3000/fonts/${correctUrl}`; 
		}
		return `http://localhost:3000/img/${correctUrl}`;
      	}
	}))
	.pipe(gulpPostcss(plugins))
	.pipe(gulpIf(!isDevelopmentMode, cleanCSS()))
	.pipe(gulpSourcemaps.write('.'))
	.pipe(gulpIf(!isDevelopmentMode,gulpIgnore.exclude(ignoreCondition)))
	.pipe(dest('dist/css/'))
	.pipe(browserSync.stream());
}


function createScssVariables() {
	let fileContent = '';
	const filter = gulpFilter(['scssVariables.js'], {restore: true});
	return src(['scssVariables.js'])
	.pipe(filter)
	.pipe(through2.obj(function(file, _, cb) {
		const content = file._contents.toString();
		//scssVariables = eval(content);
		cb();
	}))
	.pipe(filter.restore)
	.pipe(file('src/scss/variables/buffered_variables.scss', fileContent, { src: true }))
	.pipe(gulpSassVars(scssVariables, {
		verbose: isDevelopmentMode
	}))
	.pipe(gulpRename({ basename: '_variables'}))
	.pipe(dest('.'), {
		overwrite: true
	});
}

function preCompiling(cb) {
	try {
		const data = fs.readFileSync('scssVariables.js', 'utf8');
		scssVariables = eval(data);
	  } catch (err) {
		console.error(err);
	  }
	cb();
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
	watch('scssVariables.js',series(preCompiling,createScssVariables));
	watch('src/img/**/*',optimizeImages);
	watch('pugVariables.js', series(compilePugVariables, convertPreprocessorToNativeHTML));
}

function optimizeImages() {
	return src('src/img/**/*')
	.pipe(imagemin([
    imagemin.gifsicle({interlaced: true}),
    imagemin.mozjpeg({quality: 75, progressive: true}),
    imagemin.optipng({optimizationLevel: 5}),
    imagemin.svgo({
        plugins: [
            {removeViewBox: true},
            {cleanupIDs: false}
        ]
    })
	]))
	.pipe(dest('dist/img/'));
}

function convertFonts() {
	return src('src/fonts/*.ttf')
	.pipe(ttf2woff2())
	.pipe(dest('dist/fonts/'));
}

function cleanDistFolder() {
	return src('dist/', {
		read: false
	})
	.pipe(gulpClean())
	.pipe(dest('dist'));
}

function checkDevMode(cb) {
	isDevelopmentMode = false;
	cb();
}


// Not supported on my host plugins currently

// async function  convertToWebp() {
// 	await imagemin2(['src/img/**/*'], {
// 		destination: 'dist/img/',
// 		plugins: [
// 			imageminWebp({quality: 50})
// 		]
// 	});
// 	console.log('Images optimized');
// }

module.exports.html = convertPreprocessorToNativeHTML;
module.exports.css = convertPreprocessorToCssNativeStyles;
module.exports.create = series(preCompiling,createScssVariables);
module.exports.libs = importExternalFrameworks;
module.exports.browse = browserAutoReload;
module.exports.img = optimizeImages;
module.exports.clean = cleanDistFolder;
module.exports.fonts = convertFonts;

module.exports.dev = series(
	cleanDistFolder,
	series(preCompiling,createScssVariables,parallel(convertPreprocessorToCssNativeStyles,importExternalFrameworks)),
	optimizeImages,
	convertFonts,
	series(compilePugVariables,convertPreprocessorToNativeHTML),
	browserAutoReload
);

module.exports.build = series(
	checkDevMode,
	cleanDistFolder,
	series(preCompiling,createScssVariables,parallel(convertPreprocessorToCssNativeStyles,importExternalFrameworks)),
	optimizeImages,
	convertFonts,
	series(compilePugVariables,convertPreprocessorToNativeHTML)
);
