# IndiePilot

**Your indie game's localization assistant.**

IndiePilot is a free, browser-based localization checker designed to help indie game developers find common translation issues in CSV files.

## Try IndiePilot

https://indiepilot-dev.github.io/IndiePilot/

## Features

- **Missing Translations:** Find empty Japanese translation cells.
- **Variable Mismatches:** Detect missing or inconsistent placeholders such as `{player_name}`.
- **Text Length Checks:** Find Japanese translations that exceed a configurable character limit.
- **CSV Preview:** View your translation data in a table.
- **Analysis Report:** Download detected issues as a CSV report.
- **Sample CSV:** Download an example file to get started.

## How to Use

1. Open IndiePilot using the link above.
2. Download the sample CSV or prepare your own CSV file.
3. Upload your CSV file.
4. Set the maximum character limit.
5. Review the analysis results.
6. Download the analysis report if needed.

## CSV Format

Your CSV file must contain these columns:

`key,English,Japanese`

Example:

```csv
key,English,Japanese
start,Start,開始
save,Save,保存
welcome,Welcome {player_name}!,ようこそ {player_name}！
```

## Current Limitations

- The checker currently focuses on English-to-Japanese localization.
- Text length checks apply to the Japanese column.
- The application does not automatically translate text.

## Built With

- HTML
- CSS
- JavaScript

## Project Status

IndiePilot is an early version of a localization tool for indie game developers. More improvements are planned.
