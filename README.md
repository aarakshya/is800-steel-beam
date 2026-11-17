# Steel beam design to IS 800:2007

A single-page calculator that checks a steel beam to IS 800:2007 (limit state method) and says whether the section passes or fails. It runs in the browser with no server and no install.

Open `index.html`, or use the GitHub Pages link once Pages is switched on for this repository.

## Sections

About 600 Indian sections:

- I-sections: ISJB, ISLB, ISMB, ISWB, ISHB, ISSC, NPB and WPB
- Channels: ISJC, ISLC, ISMC and ISMPC
- Hollow sections: SHS, RHS (IS 4923) and CHS (IS 1161)
- A welded I-section built from plate sizes you enter
- A built-up section for when no rolled size suits: a rolled I-section with a cover plate on each flange, two channels back to back or toes facing in, or two I-sections side by side

## Section builder

For a welded or built-up section the input panel shows the section to scale and you size it by dragging. On a welded I the side dot sets the flange width and the top dot sets the depth. On a plated I the dots at the plate edges set the plate width, with buttons for the thickness and for a plate equal to the flange width. For twin members you drag either member sideways to change the gap, or set the gap that makes r<sub>y</sub> = r<sub>z</sub>. Mass, area, depth, I<sub>z</sub>, Z<sub>p</sub> and the radii update as you drag. The "lightest section" button also works for built-up sections: it keeps the build-up and steps through the member sizes.

Built-up properties come from the parallel axis theorem and are shown in full in the working. Cover plates are classified as welded outstands beyond the flange tips and as internal elements between the welds. Twin members carry shear in both webs, and lateral-torsional buckling uses α<sub>LT</sub> = 0.49, the welded value. The welds of the cover plates, plate curtailment and the ties that make twin members act together are not designed.

The section data comes from the open [Osdag](https://github.com/osdag-admin/Osdag) database (IIT Bombay), which follows the IS 808, IS 4923 and IS 1161 tables. Four WPB rows whose properties did not agree with their dimensions were left out. A button finds the lightest section of the chosen type that passes every check.

## Loads and supports

- Point loads, uniform line loads (full or partial span), linearly varying loads (triangular or trapezoidal) and applied moments, each set as dead or imposed
- Self weight added automatically, with load factors of 1.5 and 1.5 by default (Table 4)
- Simply supported (with optional overhangs), cantilever, fixed at both ends, propped cantilever, or continuous over two spans

The beam is solved by the stiffness method. Shear and moment come from exact statics, and deflection from the stiffness solution.

## Checks

| Check | Clause |
|---|---|
| Section classification | 3.7.2, Table 2 |
| Web slenderness without stiffeners | 8.6.1.1 |
| Shear, with shear buckling when d/tw > 67ε | 8.4.1, 8.4.2 |
| Bending, laterally supported | 8.2.1.2 |
| Lateral-torsional buckling, effective lengths from Tables 15 and 16 | 8.2.2, 8.3, Annex E |
| Moment with high shear, at every section | 9.2.2 |
| Web bearing and web buckling at supports and point loads | 8.7.4, 8.7.3.1 |
| Deflection under imposed load | 5.6.1, Table 6 |

Each result shows the full working with clause numbers, shear, moment and deflection diagrams, a drawing of the section and a list of items to fix. Results export to PDF and Excel.

## Limits

Not covered: minor-axis or biaxial bending, axial force, torsion (including channels loaded on the web face), slender sections, stiffened webs and bearing stiffener design, holes in the tension flange, fatigue, crane girders and seismic design. C1 defaults to 1.0, which is conservative. The lateral-torsional buckling capacity is applied to both sagging and hogging moments, so for fixed and continuous beams the unsupported length should suit whichever flange is in compression.

## Tests

`tools/engine.js` is the calculation engine on its own. `tools/test.js` checks it against textbook results for simple, fixed, propped, cantilever and two-span beams, point loads, moments, triangular loads and a hand calculation of lateral-torsional buckling, and checks the section builder against hand calculations of a plated ISMB 600 and twin channel and I-sections:

```
cd tools && node test.js
```

## Files

- `index.html`: the app
- `lib/`: jsPDF, jsPDF-AutoTable, SheetJS and the DejaVu font, used for export

Developed by Aarakshya Kandel.
