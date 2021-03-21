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

// Not supported plugins on my host currently
// const webp = require('gulp-webp');
// const imagemin2 = require('imagemin');
// const imageminWebp = require('imagemin-webp');

let isDevelopmentMode = true;
const bootstrapCDN = 'https://stackpath.bootstrapcdn.com/bootstrap/4.4.1/css/bootstrap.min.css';

function convertPreprocessorToNativeHTML() {
	const injectedFiles = src(['dist/css/*.css'],{
		read: false
	});
	return src('src/index.pug')
	.pipe(gulpPug({
		verbose: isDevelopmentMode
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
	.pipe(gulpIf(!isDevelopmentMode, cleanCSS()))
	.pipe(gulpSourcemaps.write('.'))
	.pipe(gulpIf(!isDevelopmentMode,gulpIgnore.exclude(ignoreCondition)))
	.pipe(dest('dist/css/'))
	.pipe(browserSync.stream());
}

let scssVariables = {};

function createScssVariables() {
	const filter = gulpFilter(['scssVariables.js'], {restore: true});
	return src(['src/scss/variables/variables.scss','scssVariables.js'])
	.pipe(filter)
	.pipe(through2.obj(function(file, _, cb) {
		const content = file._contents.toString();
		scssVariables = eval(content);
		cb(null);
	}))
	.pipe(filter.restore)
	.pipe(gulpSassVars(scssVariables, {
		verbose: isDevelopmentMode
	}))
	.pipe(dest('src/scss/variables/', {
		overwrite: true
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
	watch('scssVariables.js',createScssVariables);
	watch('src/img/**/*',optimizeImages);
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
	.pipe(dest('dist/font/ttf'))
	.pipe(ttf2woff2())
	.pipe(dest('dist/font/woff2'));
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
module.exports.create = createScssVariables;
module.exports.libs = importExternalFrameworks;
module.exports.browse = browserAutoReload;
module.exports.img = optimizeImages;
module.exports.clean = cleanDistFolder;
module.exports.mode = checkDevMode;
module.exports.fonts = convertFonts;

module.exports.dev = series(
	cleanDistFolder,
	series(createScssVariables,parallel(convertPreprocessorToCssNativeStyles,importExternalFrameworks)),
	optimizeImages,
	convertPreprocessorToNativeHTML,
	browserAutoReload
);

module.exports.build = series(
	checkDevMode,
	cleanDistFolder,
	series(createScssVariables,parallel(convertPreprocessorToCssNativeStyles,importExternalFrameworks)),
	optimizeImages,
	convertPreprocessorToNativeHTML
);
