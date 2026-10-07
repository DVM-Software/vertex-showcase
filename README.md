# Vertex AI showcase

A two-minute Three.js film that walks through Vertex AI, the in-house expense
audit platform: why it exists, the eight pipeline stages (Acquire, Unify,
Featurize, Train, Score, Decide, Investigate, Resolve) with real app
screenshots, a closing card, and the Procurement Tech team as an org chart.

## Watch it

Double-click `docs/vertex-showcase.html`. It needs no network and no install.

## Add the real screenshots and team photos

The repo ships with **test placeholders** (every one is marked TEST). Replace
them:

1. **Screenshots** go in `shots/`, named after the scene:
   `acquire1.png`, `acquire2.png`, `unify1.png` ... (details in
   [shots/README.md](shots/README.md)). Several shots for one scene share its
   screenshot time. Each one fills 80% of the screen.
2. **Team photos** go in `team/`, named `First_Last_Role_N_lL.png`, e.g.
   `Jane_Doe_Head_of_Procurement_Tech_1_l1.png` (details in
   [team/README.md](team/README.md)).
3. Run `node tools/check.mjs`. It needs only Node, not `npm install`. It
   writes `team/team.js` (the film reads the team list from it), shows what
   each scene will play, and flags any placeholder you have not replaced.
4. Open `docs/vertex-showcase.html` again. It picks up `shots/` and `team/`
   from next to `docs/`, so there is nothing to build.

To make one self-contained HTML file with the images packed in (for example
to email it), run `npm install` then `npm run build`. Without the folders
next to it, the built file uses the images packed in at build time.

## Change it

Everything you are likely to edit is in `src/config.js`:

- `SCENES`: wording, duration, camera start and end, legend. The `team`
  scene's `sub` is the closing motto.
- `CONFIG.shots`: when screenshots appear in a scene and how much of the
  screen they fill (`fill: 0.8`)
- `CONFIG.team`: org chart reveal timing and people per row
- `CONFIG`: particle count, stream speed, glow, bloom
- `COLORS`, `STAGES`: palette and where each stage sits in space

Screenshot time per scene is `(to - from) x dur`, about 6 s for an 11 s
scene, split evenly between its shots. To give a scene with many shots
more time, raise its `dur`. The film length is the sum of the durations.

`src/main.js` is the engine (scene, stream, nodes, camera, screenshots, org
chart, timeline) and `src/style.css` the layout and type. After changing
anything in `src/`, run `npm run build` to refresh `docs/vertex-showcase.html`.

## Get a video

1. **Press V** in Chrome. Pick this tab in the share prompt. The film
   restarts with the controls hidden, records to the end and downloads the
   video.
2. **Screen capture.** Press H to hide the controls, start Cmd+Shift+5 (or
   the Windows Snipping Tool's video mode), press R. The film fades in from
   black and holds its last frame.
3. **Frame-exact export.** Needs `npm install`, Google Chrome and ffmpeg.

   ```sh
   npm run build
   npm run export                  # 1920x1080 at 60 fps, out/vertex-showcase.mp4
   npm run export -- --scale 2     # 3840x2160
   ```

Keys: Space plays or pauses, arrow keys change scene, 1 to 9 jump to a stage,
R restarts, H hides the controls, V records. URL options: `?clean`, `?paused`,
`?t=45` (start at 45 s), `?bundled` (ignore the folders and use the
images packed in at build time).

## Layout

```
docs/vertex-showcase.html   the film, one file   <- open this
shots/                      app screenshots      <- drop files here
team/                       team photos          <- drop files here
tools/check.mjs             checks both folders, writes team/team.js
src/config.js               copy, timing, colours, cameras  <- edit here
src/main.js                 Three.js engine
src/style.css               layout and type
index.html                  page shell for npm run dev
tools/export.mjs            frame-exact MP4 export
tools/placeholders.json     fingerprints of the test images, used by check.mjs
```

three.js is pinned to 0.128.0 (MIT licence) and installed from npm.
