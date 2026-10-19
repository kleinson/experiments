# Experiments

Small, working, open-source explorations by Andreas Kleiner. Each experiment
lives in its own self-contained folder with its own dependencies, tests and
licence.

| Experiment                    | What it is                                                                                                                                                  | Licence |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| [SeaTreasures](SeaTreasures/) | A sea-shell simulator: five species at true size, see-through and cut-open views, and a whole sourced life from egg to the beach. Plus a SwiftUI companion. | MIT     |

`experiments.json` lists every experiment for galleries such as the portfolio.

To run one, open its folder and follow its README, for example:

```sh
cd SeaTreasures
npm ci
npm run dev -- --port 5174 --strictPort
```
