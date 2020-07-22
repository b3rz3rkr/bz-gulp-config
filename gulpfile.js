//requirements
const
    gulp = require('gulp'),
    environments = require('gulp-environments'),
    webpackStream = require('webpack-stream'),
    webpack = require('webpack'),
    pug = require('gulp-pug'),
    htmlPrettify = require('gulp-pretty-html'),
    sass = require('gulp-sass'),
    autoprefixer = require('gulp-autoprefixer'),
    sourcemaps = require('gulp-sourcemaps'),
    imagemin = require('gulp-imagemin'),
    fonter = require('gulp-fonter'),
    ttf2woff2 = require('gulp-ttf2woff2'),
    del = require('del'),
    browserSync = require('browser-sync').create(),
    path = require('path'),
    fs = require('fs');

const
    development = environments.development,
    production = environments.production,
    reload = browserSync.reload;

//configs
const
    pathRoot = './',
    pathBuild = `${pathRoot}build/${production() ? 'prod/' : 'dev/'}`,
    pathSource = `${pathRoot}src/`,
    projectFolder = path.basename(__dirname),
    paths = {
        build: {
            js: `${pathBuild}js/`,
            style: `${pathBuild}css/`,
            img: `${pathBuild}img/`,
            fonts: `${pathBuild}fonts/`,
            manifest: `${pathBuild}`,
            php: `${pathBuild}`,
            videos: `${pathBuild}video/`
        },
        src: {
            html: `${pathSource}pages/*.pug`,
            js: `${pathSource}js/main.js`,
            style: `${pathSource}scss/*.scss`,
            img: `${pathSource}img/**/*`,
            fonts: `${pathSource}fonts/**/*`,
            manifest: `${pathSource}manifest/**/*`,
            php: `${pathSource}**/*.php`,
            localizations: `${pathSource}localizations/`,
            videos: `${pathSource}video/**/*`
        },
        watch: {
            html: `${pathSource}pages/**/*.pug`,
            js: `${pathSource}js/**/*.js`,
            style: `${pathSource}scss/**/*.scss`,
            img: `${pathSource}img/**/*.*`,
            fonts: `${pathSource}fonts/**/*.*`,
            manifest: `${pathSource}manifest/**/*`,
            php: `${pathSource}**/*.php`,
            localizations: `${pathSource}localizations/*`,
            videos: `${pathSource}video/**/*`
        },
        clean: pathBuild
    },
    webpackConfig = {
        entry: {
            main: paths.src.js
        },
        output: {
            filename: '[name].js'
        },
        watch: true,
        mode: production() ? 'production' : 'development',
        devtool: development() ? 'source-map' : false,

        //Internal or external jQuery plugin
        /*
        externals: {
            jquery: 'jQuery'
        }
        */
        /*
        plugins: [
            new webpack.ProvidePlugin({
                $: 'jquery',
                jQuery: 'jquery',
                'window.jQuery': 'jquery'
            })
        ]
        */
    },
    imageminPlugins = production() ? [
        imagemin.gifsicle(),
        imagemin.jpegtran(),
        imagemin.optipng(),
        imagemin.svgo({
            plugins: [
                {removeHiddenElems: false}
            ]
        })] : [];

//locales
const
    requireUncached = module => {
        delete require.cache[require.resolve(module)];
        return require(module);
    },

    getLocalizationNames = localesDir => {
        const list = [];
        fs.readdirSync(localesDir).forEach(file => list.push(path.parse(file).name));
        return list;
    },

    getLocalizations = locales => {
        const localizations = {};

        locales.forEach(locale => {
            const filePath = `${paths.src.localizations + locale}.json`;
            try {
                localizations[locale] = requireUncached(filePath);
            } catch (error) {
                console.log(`Error in localization file ${filePath}`);
            }
        });
        return localizations;
    },

    validateLocalizations = (locales, localization) => {
        const pathArray = [];
        locales.forEach(locale => {
                if (localization[locale]) {
                    pathArray.push(locale);
                }
            }
        );
        return pathArray;
    };

//gulp functions
const
    watch = () => {
        gulp.watch(paths.watch.style, styles);
        gulp.watch(paths.watch.html, templates);
        gulp.watch(paths.watch.localizations, templates);
        gulp.watch(paths.watch.img, images);
        gulp.watch(paths.watch.fonts, fonts);
        gulp.watch(paths.watch.manifest, manifest);
        gulp.watch(paths.watch.php, php);
        gulp.watch(paths.watch.videos, videos);
    },

    server = () => {
        browserSync.init({
            proxy: projectFolder + pathBuild
        });
        browserSync.watch([`${pathBuild}**/*.*`, `!${pathBuild}**/*.css`, `!${pathBuild}**/*.map`], reload);
    },

    clear = () => del(pathBuild),

    templates = () => {
        return new Promise((callback) => {
            const locales = getLocalizationNames(paths.src.localizations),
                localization = getLocalizations(locales),
                validLocales = validateLocalizations(locales, localization);
            validLocales.forEach(locale => {
                localization[locale]['locales'] = validLocales;
                gulp.src(paths.src.html)
                    .pipe(pug({
                        locals: localization[locale]
                    }))
                    .on('error', (error) => {
                        console.log(error);
                    })
                    .pipe(development(htmlPrettify({
                        extra_liners: ['!--', 'head', 'body', '/html'],
                        wrap_attributes: 'auto',
                        wrap_line_length: 120
                    })))
                    .pipe(gulp.dest(pathBuild + 'html/' + locale));
            });
            callback();
        });
    },

    styles = () => {
        return gulp.src(paths.src.style, {allowEmpty: true})
            .pipe(development(sourcemaps.init()))
            .pipe(sass.sync({
                outputStyle: production() ? 'compressed' : 'expanded',
                includePaths: require('scss-resets').includePaths
            }).on('error', sass.logError))
            .pipe(autoprefixer({
                cascade: false
            }))
            .pipe(development(sourcemaps.write('./')))
            .pipe(gulp.dest(paths.build.style))
            .pipe(browserSync.stream({match: '**/*.css'}));
    },

    scripts = () => {
        return new Promise((callback) => {
            gulp.src(paths.src.js)
                .pipe(webpackStream(webpackConfig, webpack))
                .pipe(gulp.dest(paths.build.js));
            callback();
        });
    },

    images = () => {
        return gulp.src(paths.src.img)
            .pipe(imagemin(imageminPlugins, {
                verbose: true
            }))
            .pipe(gulp.dest(paths.build.img));
    },

    fonts = () => {
        return gulp.src(paths.src.fonts)
            .pipe(fonter({
                formats: ['woff', 'ttf']
            }))
            .pipe(gulp.dest(paths.build.fonts));
    },

    woff2 = () => {
        return gulp.src(`${paths.build.fonts}*.ttf`)
            .pipe(ttf2woff2())
            .pipe(gulp.dest(paths.build.fonts));
    },

    manifest = () => {
        return gulp.src(paths.src.manifest)
            .pipe(gulp.dest(paths.build.manifest));
    },

    php = () => {
        return gulp.src(paths.src.php)
            .pipe(gulp.dest(paths.build.php));
    },
    videos = () => {
        return gulp.src(paths.src.videos)
            .pipe(gulp.dest(paths.build.videos));
    };

gulp.task('default', gulp.series(
    clear,
    gulp.parallel(
        php,
        templates,
        styles,
        scripts,
        images,
        fonts,
        manifest,
        videos
    ),
    woff2,
    gulp.parallel(
        server,
        watch
    )
));

exports.templates = templates;
exports.styles = styles;
exports.scripts = scripts;
exports.images = images;
exports.fonts = fonts;
exports.manifest = manifest;
exports.clear = clear;