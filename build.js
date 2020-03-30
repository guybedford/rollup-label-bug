'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var jsBase64 = require('js-base64');
var mozilla = _interopDefault(require('source-map'));
var path = _interopDefault(require('path'));
var fs = _interopDefault(require('fs'));

class PreviousMap {
    constructor(css, opts) {
        this.loadAnnotation(css);
        this.inline = this.startWith(this.annotation, 'data:');

        let prev = opts.map ? opts.map.prev : undefined;
        let text = this.loadMap(opts.from, prev);
        if ( text ) this.text = text;
    }

    consumer() {
        if ( !this.consumerCache ) {
            this.consumerCache = new mozilla.SourceMapConsumer(this.text);
        }
        return this.consumerCache;
    }

    withContent() {
        return !!(this.consumer().sourcesContent &&
                  this.consumer().sourcesContent.length > 0);
    }

    startWith(string, start) {
        if ( !string ) return false;
        return string.substr(0, start.length) === start;
    }

    loadAnnotation(css) {
        let match = css.match(/\/\*\s*# sourceMappingURL=(.*)\s*\*\//);
        if ( match ) this.annotation = match[1].trim();
    }

    decodeInline(text) {
        let uri    = 'data:application/json,';
        let base64 = 'data:application/json;base64,';

        if ( this.startWith(text, uri) ) {
            return decodeURIComponent( text.substr(uri.length) );

        } else if ( this.startWith(text, base64) ) {
            return jsBase64.Base64.decode( text.substr(base64.length) );

        } else {
            let encoding = text.match(/data:application\/json;([^,]+),/)[1];
            throw new Error('Unsupported source map encoding ' + encoding);
        }
    }

    loadMap(file, prev) {
        if ( prev === false ) return false;

        if ( prev ) {
            if ( typeof prev === 'string' ) {
                return prev;
            } else if ( prev instanceof mozilla.SourceMapConsumer ) {
                return mozilla.SourceMapGenerator
                    .fromSourceMap(prev).toString();
            } else if ( prev instanceof mozilla.SourceMapGenerator ) {
                return prev.toString();
            } else if ( typeof prev === 'object' && prev.mappings ) {
                return JSON.stringify(prev);
            } else {
                throw new Error('Unsupported previous source map format: ' +
                    prev.toString());
            }

        } else if ( this.inline ) {
            return this.decodeInline(this.annotation);

        } else if ( this.annotation ) {
            let map = this.annotation;
            if ( file ) map = path.join(path.dirname(file), map);

            this.root = path.dirname(map);
            if ( fs.existsSync && fs.existsSync(map) ) {
                return fs.readFileSync(map, 'utf-8').toString().trim();
            } else {
                return false;
            }
        }
    }
}

let sequence = 0;

class Input {
    constructor(css, opts = { }) {
        this.css = css.toString();

        if ( this.css[0] === '\uFEFF' || this.css[0] === '\uFFFE' ) {
            this.css = this.css.slice(1);
        }

        if ( opts.from ) this.file = path.resolve(opts.from);

        let map = new PreviousMap(this.css, opts, this.id);
        if ( map.text ) {
            this.map = map;
            let file = map.consumer().file;
            if ( !this.file && file ) this.file = this.mapResolve(file);
        }

        if ( this.file ) {
            this.from = this.file;
        } else {
            sequence += 1;
            this.id   = '<input css ' + sequence + '>';
            this.from = this.id;
        }
        if ( this.map ) this.map.file = this.from;
    }

    mapResolve(file) {
        return path.resolve(this.map.consumer().sourceRoot || '.', file);
    }
}

let newline    = '\n'.charCodeAt(0),
    space      = ' '.charCodeAt(0),
    feed       = '\f'.charCodeAt(0),
    tab        = '\t'.charCodeAt(0),
    cr         = '\r'.charCodeAt(0),
    hash       = '#'.charCodeAt(0),
    backslash  = '\\'.charCodeAt(0),
    slash      = '/'.charCodeAt(0),
    openCurly  = '{'.charCodeAt(0),
    closeCurly = '}'.charCodeAt(0),
    asterisk   = '*'.charCodeAt(0),
    wordEnd    = /[ \n\t\r\(\)\{\},:;@!'"\\]|\*(?=\/)|#(?={)/g;

function tokenize(input, l, p) {
    let tokens = [];
    let css    = input.css.valueOf();

    let code, next, lines, last, content, escape,
        nextLine, nextOffset, escaped, escapePos,
        inInterpolant, inComment, inString;

    let length = css.length;
    let offset = -1;
    let line   =  l || 1;
    let pos    =  p || 0;

    
    while ( pos < length ) {
        code = css.charCodeAt(pos);

        if ( code === newline ) {
            offset = pos;
            line  += 1;
        }

        switch ( code ) {
            case space:
            case tab:
            case cr:
            case feed:
                next = pos;
                do {
                    next += 1;
                    code = css.charCodeAt(next);
                    if ( code === newline ) {
                        offset = next;
                        line  += 1;
                    }
                } while ( code === space   ||
                          code === tab     ||
                          code === cr      ||
                          code === feed );

                tokens.push(['space', css.slice(pos, next)]);
                pos = next - 1;
                break;

            case newline:
                tokens.push(['newline', '\n', line, pos - offset]);
                break;

            case closeCurly:
                tokens.push(['endInterpolant', '}', line, pos - offset]);
                break;

            case backslash:
                next   = pos;
                escape = true;
                while ( css.charCodeAt(next + 1) === backslash ) {
                    next  += 1;
                    escape = !escape;
                }
                code = css.charCodeAt(next + 1);
                if ( escape && (code !== slash   &&
                                code !== space   &&
                                code !== newline &&
                                code !== tab     &&
                                code !== cr      &&
                                code !== feed ) ) {
                    next += 1;
                }
                tokens.push(['word', css.slice(pos, next + 1),
                    line, pos  - offset,
                    line, next - offset
                ]);
                pos = next;
                break;

            default:

                if ( code === asterisk && css.charCodeAt(pos + 1) === slash ) {
                    next = pos;
                    pos = next - 1;
                    break loop;
                }

                if ( code === hash && css.charCodeAt(pos + 1) === openCurly ) {
                    tokens.push(['startInterpolant', '#{', line, pos + 1 - offset]);
                    next = pos + 1;

                    let { tokens: t, pos: p } = tokenize$1(input, line, next + 1);
                    tokens = tokens.concat(t);
                    next = p;

                    pos = next;
                    break;
                }

                wordEnd.lastIndex = pos + 1;
                wordEnd.test(css);
                if ( wordEnd.lastIndex === 0 ) {
                    next = css.length - 1;
                } else {
                    next = wordEnd.lastIndex - 2;
                }

                tokens.push(['word', css.slice(pos, next + 1),
                    line, pos  - offset,
                    line, next - offset
                ]);

                pos = next;

                break;
        }

        pos++;
    }

    return { tokens, line, pos, offset };
}

let singleQuote  = "'".charCodeAt(0),
    doubleQuote  = '"'.charCodeAt(0),
    dollar       = '$'.charCodeAt(0),
    hash$1         = '#'.charCodeAt(0),
    backslash$1    = '\\'.charCodeAt(0),
    slash$1        = '/'.charCodeAt(0),
    newline$1      = '\n'.charCodeAt(0),
    space$1        = ' '.charCodeAt(0),
    feed$1         = '\f'.charCodeAt(0),
    tab$1          = '\t'.charCodeAt(0),
    cr$1           = '\r'.charCodeAt(0),
    openBracket  = '('.charCodeAt(0),
    closeBracket = ')'.charCodeAt(0),
    openCurly$1    = '{'.charCodeAt(0),
    closeCurly$1   = '}'.charCodeAt(0),
    semicolon    = ';'.charCodeAt(0),
    asterisk$1     = '*'.charCodeAt(0),
    colon        = ':'.charCodeAt(0),
    at           = '@'.charCodeAt(0),
    comma        = ','.charCodeAt(0),
    plus         = '+'.charCodeAt(0),
    minus        = '-'.charCodeAt(0),
    decComb      = '>'.charCodeAt(0),
    adjComb      = '~'.charCodeAt(0),
    number       = /[+-]?(\d+(\.\d+)?|\.\d+)|(e[+-]\d+)/gi,
    sQuoteEnd    = /(.*?)[^\\](?=((#{)|'))/gm,
    dQuoteEnd    = /(.*?)[^\\](?=((#{)|"))/gm,
    wordEnd$1      = /[ \n\t\r\(\)\{\},:;@!'"\\]|\/(?=\*)|#(?={)/g,
    ident        = /-?([a-z_]|\\[^\\])([a-z-_0-9]|\\[^\\])*/gi;

function tokenize$1(input, l, p) {
    let tokens = [];
    let css    = input.css.valueOf();

    let code, next, quote, lines, last, content, escape,
        nextLine, nextOffset, escaped, escapePos,
        inInterpolant, inComment, inString;

    let length = css.length;
    let offset = -1;
    let line   =  l || 1;
    let pos    =  p || 0;

    loop:
    while ( pos < length ) {
        code = css.charCodeAt(pos);

        if ( code === newline$1 ) {
            offset = pos;
            line  += 1;
        }

        switch ( code ) {
            case space$1:
            case tab$1:
            case cr$1:
            case feed$1:
                next = pos;
                do {
                    next += 1;
                    code = css.charCodeAt(next);
                    if ( code === newline$1 ) {
                        offset = next;
                        line  += 1;
                    }
                } while ( code === space$1   ||
                          code === tab$1     ||
                          code === cr$1      ||
                          code === feed$1 );

                tokens.push(['space', css.slice(pos, next)]);
                pos = next - 1;
                break;

            case newline$1:
                tokens.push(['newline', '\n', line, pos - offset]);
                break;

            case plus:
                tokens.push(['+', '+', line, pos - offset]);
                break;

            case minus:
                tokens.push(['-', '-', line, pos - offset]);
                break;

            case decComb:
                tokens.push(['>', '>', line, pos - offset]);
                break;

            case adjComb:
                tokens.push(['~', '~', line, pos - offset]);
                break;

            case openCurly$1:
                tokens.push(['{', '{', line, pos - offset]);
                break;

            case closeCurly$1:
                if (inInterpolant) {
                    inInterpolant = false;
                    tokens.push(['endInterpolant', '}', line, pos - offset]);
                } else {
                    break loop;
                }
                break;

            case comma:
                tokens.push([',', ',', line, pos - offset]);
                break;

            case dollar:
                tokens.push(['$', '$', line, pos - offset]);
                break;

            case colon:
                tokens.push([':', ':', line, pos - offset]);
                break;

            case semicolon:
                tokens.push([';', ';', line, pos - offset]);
                break;

            case openBracket:
                tokens.push(['(', '(', line, pos - offset]);
                break;

            case closeBracket:
                tokens.push([')', ')', line, pos - offset]);
                break;

            case singleQuote:
            case doubleQuote:
                quote = code === singleQuote ? "'" : '"';
                tokens.push([quote, quote, line, pos - offset]);
                next = pos + 1;

                let { tokens: t, pos: p } = tokenize$2(input, line, next, quote);
                tokens = tokens.concat(t);
                next = p;

                pos = next;
                break;

            case at:
                tokens.push(['@', '@', line, pos - offset]);
                break;

            case backslash$1:
                next   = pos;
                escape = true;
                while ( css.charCodeAt(next + 1) === backslash$1 ) {
                    next  += 1;
                    escape = !escape;
                }
                code = css.charCodeAt(next + 1);
                if ( escape && (code !== space$1   &&
                                code !== newline$1 &&
                                code !== tab$1     &&
                                code !== cr$1      &&
                                code !== feed$1 ) ) {
                    next += 1;
                }
                tokens.push(['word', css.slice(pos, next + 1),
                    line, pos  - offset,
                    line, next - offset
                ]);
                pos = next;
                break;

            default:
                ident.lastIndex = pos;
                number.lastIndex = pos;
                wordEnd$1.lastIndex = pos;

                if ( code === slash$1 && css.charCodeAt(pos + 1) === asterisk$1 ) {
                    inComment = true;
                    tokens.push(['startComment', '/*', line, pos + 1 - offset]);
                    next = pos + 1;

                    let { tokens: t, line: l, pos: p, offset: o } = tokenize(input, line, next + 1);
                    tokens = tokens.concat(t);
                    next = p;
                    line = l;
                    offset = o;

                    pos = next;
                    break;
                }

                if ( code === asterisk$1 && css.charCodeAt(pos + 1) !== slash$1) {
                    tokens.push(['*', '*', line, pos - offset]);
                    break;
                }

                if ( inComment && code === asterisk$1 && css.charCodeAt(pos + 1) === slash$1 ) {
                    inComment = false;
                    tokens.push(['endComment', '*/', line, pos + 1 - offset]);
                    pos += 2;
                    break;
                }

                if ( code === slash$1 && css.charCodeAt(pos + 1) !== slash$1 ) {
                    tokens.push(['/', '/', line, pos - offset]);
                    pos += 2;
                    break;
                }

                if ( code === hash$1 && css.charCodeAt(pos + 1) === openCurly$1 ) {
                    inInterpolant = true;
                    tokens.push(['startInterpolant', '#{', line, pos + 1 - offset]);
                    next = pos + 1;

                    let { tokens: t, pos: p } = tokenize$1(input, line, next + 1);
                    tokens = tokens.concat(t);
                    next = p;

                    pos = next;
                    break;
                }

                if ( code === slash$1 && css.charCodeAt(pos + 1) === slash$1 ) {
                    next = css.indexOf('\n\n', pos + 2);
                    next = next > 0 ? next : css.length;

                    tokens.push(['scssComment', css.slice(pos, next),
                        line, pos  - offset,
                        line, next - offset
                    ]);

                    pos = next;
                    break;
                }

                if ( ident.test(css) && ( ident.lastIndex = pos || 1 ) && ident.exec(css).index === pos ) {
                    next = ident.lastIndex - 1;

                    tokens.push(['ident', css.slice(pos, next + 1),
                        line, pos  - offset,
                        line, next - offset
                    ]);

                    pos = next;
                    break;
                }

                if ( number.test(css) && ( number.lastIndex = pos || 1)  && number.exec(css).index === pos ) {
                    next = number.lastIndex - 1;

                    tokens.push(['number', css.slice(pos, next + 1),
                        line, pos  - offset,
                        line, next - offset
                    ]);

                    pos = next;
                    break;
                }

                wordEnd$1.lastIndex = pos + 1;
                wordEnd$1.test(css);
                if ( wordEnd$1.lastIndex === 0 ) {
                    next = css.length - 1;
                } else {
                    next = wordEnd$1.lastIndex - 2;
                }

                tokens.push(['word', css.slice(pos, next + 1),
                    line, pos  - offset,
                    line, next - offset
                ]);

                pos = next;

                break;
        }

        pos++;
    }

    return { tokens, pos };
}

let singleQuote$1    = "'".charCodeAt(0),
    doubleQuote$1    = '"'.charCodeAt(0),
    newline$2        = '\n'.charCodeAt(0),
    space$2          = ' '.charCodeAt(0),
    feed$2           = '\f'.charCodeAt(0),
    tab$2            = '\t'.charCodeAt(0),
    cr$2             = '\r'.charCodeAt(0),
    hash$2           = '#'.charCodeAt(0),
    backslash$2      = '\\'.charCodeAt(0),
    slash$2          = '/'.charCodeAt(0),
    openCurly$2      = '{'.charCodeAt(0),
    closeCurly$2     = '}'.charCodeAt(0),
    interpolantEnd = /([.\s]*?)[^\\](?=(}))/gm,
    sQuoteEnd$1      = /([.\s]*?)[^\\](?=((#{)|'))/gm,
    dQuoteEnd$1      = /([.\s]*?)[^\\](?=((#{)|"))/gm;

function tokenize$2(input, l, p, quote) {
    let tokens = [];
    let css    = input.css.valueOf();

    let code, next, lines, last, content, escape,
        nextLine, nextOffset, escaped, escapePos,
        inInterpolant, inComment, inString;

    let length = css.length;
    let offset = -1;
    let line   =  l || 1;
    let pos    =  p || 0;

    let quoteEnd = quote === "'" ? sQuoteEnd$1 : dQuoteEnd$1;
    let quoteChar = quote.charCodeAt(0);

    loop:
    while ( pos < length ) {
        code = css.charCodeAt(pos);

        if ( code === newline$2 ) {
            offset = pos;
            line  += 1;
        }

        switch ( code ) {

            case closeCurly$2:
                tokens.push(['endInterpolant', '}', line, pos - offset]);
                break;

            case quoteChar:
                tokens.push([quote, quote, line, pos - offset]);
                break loop;

            case backslash$2:
                next   = pos;
                escape = true;
                while ( css.charCodeAt(next + 1) === backslash$2 ) {
                    next  += 1;
                    escape = !escape;
                }
                code = css.charCodeAt(next + 1);
                if ( escape && (code !== slash$2   &&
                                code !== space$2   &&
                                code !== newline$2 &&
                                code !== tab$2     &&
                                code !== cr$2      &&
                                code !== feed$2 ) ) {
                    next += 1;
                }
                tokens.push(['string', css.slice(pos, next + 1),
                    line, pos  - offset,
                    line, next - offset
                ]);
                pos = next;
                break;

            default:
                if ( code === hash$2 && css.charCodeAt(pos + 1) === openCurly$2 ) {
                    tokens.push(['startInterpolant', '#{', line, pos + 1 - offset]);
                    next = pos + 1;

                    let { tokens: t, pos: p } = tokenize$1(input, line, next + 1);
                    tokens = tokens.concat(t);
                    next = p;

                    pos = next;

                } else {
                    quoteEnd.lastIndex = pos;
                    quoteEnd.test(css);

                    if ( quoteEnd.lastIndex === 0 ) {
                        next = css.length - 1;
                    } else {
                        next = quoteEnd.lastIndex - 1;
                    }

                    tokens.push(['string', css.slice(pos, next + 1),
                        line, pos  - offset,
                        line, next - offset
                    ]);

                    pos = next;
                }

                break;
        }

        pos++;
    }

    return { tokens, pos };
}

let singleQuote$2  = "'".charCodeAt(0),
    doubleQuote$2  = '"'.charCodeAt(0),
    dollar$1       = '$'.charCodeAt(0),
    hash$3         = '#'.charCodeAt(0),
    backslash$3    = '\\'.charCodeAt(0),
    slash$3        = '/'.charCodeAt(0),
    newline$3      = '\n'.charCodeAt(0),
    space$3        = ' '.charCodeAt(0),
    feed$3         = '\f'.charCodeAt(0),
    tab$3          = '\t'.charCodeAt(0),
    cr$3           = '\r'.charCodeAt(0),
    openBracket$1  = '('.charCodeAt(0),
    closeBracket$1 = ')'.charCodeAt(0),
    openCurly$3    = '{'.charCodeAt(0),
    closeCurly$3   = '}'.charCodeAt(0),
    semicolon$1    = ';'.charCodeAt(0),
    asterisk$2     = '*'.charCodeAt(0),
    colon$1        = ':'.charCodeAt(0),
    at$1           = '@'.charCodeAt(0),
    comma$1        = ','.charCodeAt(0),
    plus$1         = '+'.charCodeAt(0),
    minus$1        = '-'.charCodeAt(0),
    decComb$1      = '>'.charCodeAt(0),
    adjComb$1      = '~'.charCodeAt(0),
    number$1       = /[+-]?(\d+(\.\d+)?|\.\d+)|(e[+-]\d+)/gi,
    sQuoteEnd$2    = /(.*?)[^\\](?=((#{)|'))/gm,
    dQuoteEnd$2    = /(.*?)[^\\](?=((#{)|"))/gm,
    wordEnd$2      = /[ \n\t\r\(\)\{\},:;@!'"\\]|\/(?=\*)|#(?={)/g,
    ident$1        = /-?([a-z_]|\\[^\\])([a-z-_0-9]|\\[^\\])*/gi;

function tokenize$3(input, l, p) {
    let tokens = [];
    let css    = input.css.valueOf();

    let code, next, quote, lines, last, content, escape,
        nextLine, nextOffset, escaped, escapePos,
        inInterpolant, inComment, inString;

    let length = css.length;
    let offset = -1;
    let line   =  l || 1;
    let pos    =  p || 0;

    while ( pos < length ) {
        code = css.charCodeAt(pos);

        if ( code === newline$3 ) {
            offset = pos;
            line  += 1;
        }

        switch ( code ) {
            case space$3:
            case tab$3:
            case cr$3:
            case feed$3:
                next = pos;
                do {
                    next += 1;
                    code = css.charCodeAt(next);
                    if ( code === newline$3 ) {
                        offset = next;
                        line  += 1;
                    }
                } while ( code === space$3   ||
                          code === tab$3     ||
                          code === cr$3      ||
                          code === feed$3 );

                tokens.push(['space', css.slice(pos, next)]);
                pos = next - 1;
                break;

            case newline$3:
                tokens.push(['newline', '\n', line, pos - offset]);
                break;

            case plus$1:
                tokens.push(['+', '+', line, pos - offset]);
                break;

            case minus$1:
                tokens.push(['-', '-', line, pos - offset]);
                break;

            case decComb$1:
                tokens.push(['>', '>', line, pos - offset]);
                break;

            case adjComb$1:
                tokens.push(['~', '~', line, pos - offset]);
                break;

            case openCurly$3:
                tokens.push(['{', '{', line, pos - offset]);
                break;

            case closeCurly$3:
                if (inInterpolant) {
                    inInterpolant = false;
                    tokens.push(['endInterpolant', '}', line, pos - offset]);
                } else {
                    tokens.push(['}', '}', line, pos - offset]);
                }
                break;

            case comma$1:
                tokens.push([',', ',', line, pos - offset]);
                break;

            case dollar$1:
                tokens.push(['$', '$', line, pos - offset]);
                break;

            case colon$1:
                tokens.push([':', ':', line, pos - offset]);
                break;

            case semicolon$1:
                tokens.push([';', ';', line, pos - offset]);
                break;

            case openBracket$1:
                tokens.push(['(', '(', line, pos - offset]);
                break;

            case closeBracket$1:
                tokens.push([')', ')', line, pos - offset]);
                break;

            case singleQuote$2:
            case doubleQuote$2:
                quote = code === singleQuote$2 ? "'" : '"';
                tokens.push([quote, quote, line, pos - offset]);
                next = pos + 1;

                let { tokens: t, pos: p } = tokenize$2(input, line, next, quote);
                tokens = tokens.concat(t);
                next = p;

                pos = next;
                break;

            case at$1:
                tokens.push(['@', '@', line, pos - offset]);
                break;

            case backslash$3:
                next   = pos;
                escape = true;
                while ( css.charCodeAt(next + 1) === backslash$3 ) {
                    next  += 1;
                    escape = !escape;
                }
                code = css.charCodeAt(next + 1);
                if ( escape && (code !== space$3   &&
                                code !== newline$3 &&
                                code !== tab$3     &&
                                code !== cr$3      &&
                                code !== feed$3 ) ) {
                    next += 1;
                }
                tokens.push(['word', css.slice(pos, next + 1),
                    line, pos  - offset,
                    line, next - offset
                ]);
                pos = next;
                break;

            default:
                ident$1.lastIndex = pos;
                number$1.lastIndex = pos;
                wordEnd$2.lastIndex = pos;

                if ( code === slash$3 && css.charCodeAt(pos + 1) === asterisk$2 ) {
                    inComment = true;
                    tokens.push(['startComment', '/*', line, pos + 1 - offset]);
                    next = pos + 1;

                    let { tokens: t, line: l, pos: p, offset: o } = tokenize(input, line, next + 1);
                    tokens = tokens.concat(t);
                    next = p;
                    line = l;
                    offset = o;

                    pos = next;
                    break;
                }

                if ( code === asterisk$2 && css.charCodeAt(pos + 1) !== slash$3) {
                    tokens.push(['*', '*', line, pos - offset]);
                    break;
                }

                if ( inComment && code === asterisk$2 && css.charCodeAt(pos + 1) === slash$3 ) {
                    inComment = false;
                    tokens.push(['endComment', '*/', line, pos + 1 - offset]);
                    pos += 2;
                    break;
                }

                if ( code === slash$3 && css.charCodeAt(pos + 1) !== slash$3 ) {
                    tokens.push(['/', '/', line, pos - offset]);
                    break;
                }

                if ( code === hash$3 && css.charCodeAt(pos + 1) === openCurly$3 ) {
                    inInterpolant = true;
                    tokens.push(['startInterpolant', '#{', line, pos + 1 - offset]);
                    next = pos + 1;

                    let { tokens: t, pos: p } = tokenize$1(input, line, next + 1);
                    tokens = tokens.concat(t);
                    next = p;

                    pos = next;
                    break;
                }

                if ( code === slash$3 && css.charCodeAt(pos + 1) === slash$3 ) {
                    next = css.indexOf('\n', pos + 2);
                    next = (next > 0 ? next : css.length) - 1;

                    tokens.push(['scssComment', css.slice(pos, next + 1),
                        line, pos  - offset,
                        line, next - offset
                    ]);

                    pos = next;
                    break;
                }

                if ( ident$1.test(css) && ( ident$1.lastIndex = pos || 1 ) && ident$1.exec(css).index === pos ) {
                    next = ident$1.lastIndex - 1;

                    tokens.push(['ident', css.slice(pos, next + 1),
                        line, pos  - offset,
                        line, next - offset
                    ]);

                    pos = next;
                    break;
                }

                if ( number$1.test(css) && ( number$1.lastIndex = pos || 1 ) && number$1.exec(css).index === pos ) {
                    next = number$1.lastIndex - 1;

                    tokens.push(['number', css.slice(pos, next + 1),
                        line, pos  - offset,
                        line, next - offset
                    ]);

                    pos = next;
                    break;
                }

                wordEnd$2.lastIndex = pos + 1;
                wordEnd$2.test(css);
                if ( wordEnd$2.lastIndex === 0 ) {
                    next = css.length - 1;
                } else {
                    next = wordEnd$2.lastIndex - 2;
                }

                tokens.push(['word', css.slice(pos, next + 1),
                    line, pos  - offset,
                    line, next - offset
                ]);

                pos = next;

                break;
        }

        pos++;
    }

    return tokens;
}

let scss = {};
scss.tokenize = function(css) {
    let input = new Input(css);
    return tokenize$3(input);
};

module.exports = scss;
