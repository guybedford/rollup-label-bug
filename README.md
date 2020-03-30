1. `npm install`
2. `npm run build`
3. `node npm minify`

Error: Unsyntactic break / missing label.

Reason: loop: label has been removed from line 153

**Only applies for --no-treeshake!**

Expected:

```js
    let length = css.length;
    let offset = -1;
    let line   =  l || 1;
    let pos    =  p || 0;

    loop: 
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
```

Actual:
```js
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
```
