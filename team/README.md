# Team photos

The last scene draws these photos as an org chart, with the closing motto
under it.

Name each photo `First_Last_Role_N_lL.png`:

```
Jane_Doe_Head_of_Procurement_Tech_1_l1.png     level 1, first
Sam_Lee_Engineering_Manager_1_l2.png           level 2, first
Ana_Ruiz_Product_Owner_2_l2.png                level 2, second
Raj_Patel_Data_Engineer_1_l3.png               level 3, first
```

- `lL` is the row: `l1` at the top, then `l2`, `l3` and so on.
- `N` is the left-to-right order within that row.
- Everything between the last name and `N` is the role. Underscores become
  spaces, so `Head_of_Procurement_Tech` reads "Head of Procurement Tech".
- Use one word each for first and last name. Join double names with a
  hyphen: `Mary-Ann_Smith-Jones_...`.
- `.png`, `.jpg`, `.jpeg` or `.webp`. Square photos with the face in the
  upper middle crop best (they are shown as circles).
- A row with more than 9 people wraps onto a second line (`CONFIG.team.perRow`
  in `src/config.js`).

**After any change here, run `node tools/check.mjs`.** A page opened from
disk cannot list a folder, so the film reads the list of photos from
`team.js`, which that command writes. Without that step, new photos do not
show.

The photos here now are **test placeholders** (marked TEST PHOTO). Delete
them all when you add the real ones.
