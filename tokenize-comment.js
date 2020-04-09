import tokenizeInterpolant from './tokenize-interpolant';

export default function tokenize(input, l, p) {
    loop:
    while ( pos < length ) {
        switch ( code ) {
            default:
                if ( code === asterisk ) {
                    break loop;
                }
                tokenizeInterpolant(input, line, next + 1);
                break;
        }

        pos++;
    }

    return { tokens, line, pos, offset };
}
