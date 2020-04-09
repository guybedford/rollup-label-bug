'use strict';

function tokenize(input, l, p) {
    
    while ( pos < length ) {
        switch ( code ) {
            default:
                if ( code === asterisk ) {
                    break loop;
                }
                tokenize$1(input, line, next + 1);
                break;
        }

        pos++;
    }

    return { tokens, line, pos, offset };
}

function tokenize$1(input, l, p) {
    loop:
    while ( pos < length ) {
    }
}

function tokenize$2(input, l, p, quote) {
    loop:
    while ( pos < length ) {
        switch ( code ) {
            case quoteChar:
                break loop;
        }
    }
}

module.exports = tokenize$2;
