# Prediction Debug

Flowra includes a developer-facing **Prediction Debug** panel on the `/insights` route. It exposes the inputs and model-selection results used for the active profile's next-period prediction. It is a diagnostic aid for developers and testers, not a medical interpretation or a user-facing prediction explanation.

## When the panel is available

The panel is available only in a development build:

```bash
npm start
# or
npm run develop
```

Open `http://localhost:4200/insights` for `npm start`, or `http://localhost:3033/insights` for `npm run develop`, select the profile to inspect, and expand **Prediction Debug** near the bottom of the page.

The panel is deliberately hidden when `environment.production` is `true`. It is therefore not shown in normal `npm run build` output, Android release APK/AAB files, or production GitHub builds. This keeps internal diagnostic details out of the normal app experience.

The collapsed panel can appear before a prediction is available. In that case the JSON still explains why the engine could not produce a prediction.

## When a prediction becomes available

Flowra calculates cycle lengths between confirmed period starts. A usable prediction normally requires:

- an active profile whose reproductive stage permits predictions;
- at least three confirmed period starts, which produce two usable completed cycle lengths;
- cycle lengths in the current prediction epoch;
- no user exclusion or validation rule that removes too many cycles.

Predictions are paused before menarche, during pregnancy, and for menopause-related stages. Postpartum predictions remain paused until at least one post-childbirth cycle length is available. Flowra uses at most the latest 18 usable cycle lengths.

A cycle is excluded when its starting period was excluded by the user, it duplicates the following start date, or its calculated length is outside the validation range of 10 to 180 days.

## How to use it

1. Run a development build and open `/insights`.
2. Select the profile in the app header.
3. Expand **Prediction Debug**.
4. Compare `cyclesUsed` with that profile's confirmed period-start history.
5. Check `cyclesExcluded` when an expected cycle is absent.
6. Compare `candidateOutputs`, then inspect `modelScores` and `winner` to understand model selection.
7. Add, correct, or exclude a period entry and return to the panel. The signal-based store recomputes the result without reloading the page.

## Debug fields

| Field              | Meaning                                                                                                                       |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `cyclesUsed`       | Ordered usable cycle lengths in days, limited to the most recent 18.                                                          |
| `cyclesExcluded`   | Period IDs omitted from calculation and the reason for each omission.                                                         |
| `candidateOutputs` | Each eligible model's proposed next cycle length before the final clamp and rounding.                                         |
| `modelScores`      | Walk-forward backtest accuracy values for models with enough history to test. Lower MAE and median absolute error are better. |
| `winner`           | The selected model, or a two-model ensemble when their backtest results are sufficiently close.                               |
| `windowRadius`     | Days added before and after the most-likely date to form the prediction window. More uncertainty creates a wider window.      |

The candidate models become eligible at different history levels:

- **Recent median**, **Recency weighted mean**, and **EWMA**: 2 usable cycles.
- **Robust median blend**: 3 usable cycles.
- **Trend**: 8 usable cycles.

Backtest scores do not appear until there is enough later history to test a model against outcomes. With only the minimum history, Flowra can return a prediction using the first eligible model even though `modelScores` is still empty.

## Reading model scores

Each model score includes:

- `mae`: mean absolute error in days;
- `medianAbsoluteError`: the typical absolute error with less sensitivity to outliers;
- `rmse`: an error measure that penalizes larger misses more heavily;
- `withinOneDay`, `withinTwoDays`, and `withinThreeDays`: fractions of backtested predictions within those limits;
- `bias`: signed average error, where a consistently positive or negative value indicates systematic timing error;
- `predictions`: number of historical predictions included in the score.

The engine ranks models by `mae + medianAbsoluteError`. It may combine the best two models when the second model has at least two backtested predictions and its combined score is within 0.75 days of the best score.

## Common cases

### `cyclesUsed` is empty

Confirm that the profile has confirmed period starts and that the profile's reproductive stage permits prediction. Two starts create only one completed cycle, which is still insufficient for a prediction.

### A cycle appears under `cyclesExcluded`

Use its period ID and reason to identify the source record. Correct an accidental duplicate or invalid date. Keep a deliberate user exclusion in place rather than altering it merely to obtain a prediction.

### `candidateOutputs` exists but `modelScores` is empty

The available history is enough for a candidate to calculate an output but not enough for walk-forward backtesting. This is expected with short histories.

### The prediction window is wide

The radius grows with observed variation and historical errors. It also has wider minimums for limited history and is widened for adolescent, early-post-menarche, and perimenopause stages. The radius is capped at 21 days.

## Privacy and limitations

The panel reads the same on-device data as the rest of Flowra and does not upload it. However, screenshots or copied JSON may contain period record IDs and sensitive cycle characteristics. Remove identifying details before sharing diagnostics.

Prediction Debug helps validate program behavior only. It must not be used to diagnose a condition, establish pregnancy risk, or replace advice from a qualified healthcare professional.
