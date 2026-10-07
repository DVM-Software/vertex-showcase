# Vertex showcase: notes for the agent

A Three.js film about Vertex AI (expense audit platform). The finished film
is `docs/vertex-showcase.html`. It opens with a double-click and needs no
network. All the engine work is done. What is left is **swapping test
placeholders for real images**. Do not rewrite the engine for that.

## The job: real screenshots and team photos

1. **Screenshots** go in `shots/`, named `<scene id><n>.png` (n = 1, 2, 3 ...
   with no gaps). Scene ids and the app module each stage shows:

   | file prefix   | stage | app module (`module` in src/config.js) |
   |---------------|-------|----------------------------------------|
   | `acquire`     | 1     | Data Acquisition                       |
   | `unify`       | 2     | (none set)                             |
   | `featurize`   | 3     | (none set)                             |
   | `train`       | 4     | ML Models                              |
   | `score`       | 5     | Scoring and Exceptions                 |
   | `decide`      | 6     | Actions                                |
   | `investigate` | 7     | Investigations and Worklist            |
   | `resolve`     | 8     | Executive Dashboard                    |

   `why`, `overview` and `outro` also accept shots (e.g. `overview1.png` for
   the app home page). Several shots for one scene share its screenshot time
   (about 6 s in total) and play in number order.
   If the user gives screenshots with other names, rename them to match
   the stage they show.

2. **Team photos** go in `team/`, named `First_Last_Role_N_lL.png`:
   `L` = org chart row (1 = top), `N` = order in the row, role words joined
   with `_`. Example: `Jane_Doe_Head_of_Procurement_Tech_1_l1.png`. Details
   in `team/README.md`.

3. **Delete every placeholder.** Screenshots say TEST SCREENSHOT, team photos
   are `*_Sample_*` and say TEST PHOTO.

4. Run **`node tools/check.mjs`** (plain Node, no install). It must end with
   "Everything looks right." It also writes `team/team.js`, which the film
   needs to see the team photos. Rerun it after any change in `team/`.

5. Ask the user to open `docs/vertex-showcase.html` and check the stages
   (keys 1 to 9 jump to a stage; `?t=115` in the URL jumps near the end).
   No build is needed: the film loads `shots/` and `team/` from next to
   `docs/` when it opens.

## Only if asked

- **Wording / timing / motto:** `src/config.js` (the `team` scene's `sub` is
  the motto). After any change in `src/`, the film needs `npm install` once
  and then `npm run build`. If npm cannot reach a registry here, say so. Do
  not hand-edit `docs/vertex-showcase.html`, which is generated.
- **One self-contained file** (images packed in, e.g. to email): `npm run
  build` packs whatever is in `shots/` and `team/` into
  `docs/vertex-showcase.html`.
- **Video:** in Chrome press V on the open film (records the tab), or follow
  "Get a video" in README.md.

## Do not

- Do not push real screenshots or team photos to the public GitHub repo this
  came from. They are internal. Keep them local.
- Do not rename scene ids in `src/config.js`. The file names depend on them.
- Do not "fix" the folder lookup to use fetch(). Pages opened from disk
  cannot fetch, so the film loads `<img>` and `<script>` tags on purpose.

## How it works (for debugging)

- `src/main.js`, section "app screenshots": looks for `../shots/<id>.<ext>`,
  then `<id>1`, `<id>2` ... with `<img>` tags, stopping at the first miss. If
  it finds any file in the folder, the folder wins for every scene.
  Otherwise it uses the images packed in at build time (`?bundled` forces
  that).
- Section "the team": loads `../team/team.js` (`window.VERTEX_TEAM`, a list
  of file names), falling back to the packed-in photos.
- `window.__vertex.ready` resolves to `{ shots: {id: count}, team: count }`.
  Check it in the browser console to see what loaded.
