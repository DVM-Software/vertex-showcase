# Screenshots

Each file here plays during the scene whose id starts its name. The number
sets the order:

```
acquire1.png   acquire2.png        Stage 1  Acquire
unify1.png                         Stage 2  Unify
featurize1.png                     Stage 3  Featurize
train1.png                         Stage 4  Train
score1.png                         Stage 5  Score
decide1.png                        Stage 6  Decide
investigate1.png                   Stage 7  Investigate
resolve1.png                       Stage 8  Resolve
```

Rules:

- Scene id in lower case, then 1, 2, 3 ... with no gaps, then `.png`,
  `.jpg`, `.jpeg` or `.webp` in lower case. The film stops looking at the
  first missing number: with `acquire1` and `acquire3`, only `acquire1`
  shows.
- A scene with one shot shows it for about 6 seconds. Two shots get about
  3 seconds each, three about 2 seconds each.
- Every shot is scaled to fill 80% of the screen. Shots at 1920x1080 or
  larger in a 16:9 shape look best.
- Other scenes take shots too: `why1.png`, `overview1.png`, `outro1.png`.
- A stage with no file simply shows no screenshot.

The files here now are **test placeholders**. Replace or delete every one,
then run `node tools/check.mjs`. It flags any placeholder that is left.
