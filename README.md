# Functionality #

## `CovidTranslationPrApproval` ##


Scans the [Covid19 repo](https://github.com/cagov/covid19/pulls) for translation PRs and merges them.

### Merging Criteria ###
1. Targeting the `Master` branch.
1. Has the `Translated Content` label.
1. PR is NOT `draft`.
1. PR is `open`.
1. PR is `mergeable`.
1. All checks have passed.
1. All changed files are in the `pages/translated-posts` path.
1. All updates are free of non-printable characters, with some exceptions for Arabic control.

PR branches are deleted on merge.

## `AutoApprover` ##

Scans the [Covid Static Data repo](https://github.com/cagov/covid-static-data/pulls) for automation PRs and merges them.

### Rollup Phase ###
- Combines PRs that are labeled for rollup.
- Any PRs labeled `Add to Rollup` will be combined into a PR labeled `Rollup`.
- All labels will be copied from the original PR to the rollup PR.
- The original PR will be closed and the branch deleted.
- The Rollup PR will be re-used as long as it is open.

### ASAP Label Phase ###
- Any PR with a `Publish at xxx` label that references a time that has passed, but not more than 15 minutes, will be labeled `Publish ASAP`.

### Merge Phase ###
- Any PR labeled `Publish ASAP` will be merged
  - Except if it is NOT `mergeable`.
  - Except if it is labeled `Do Not Publish`.
- Any PR that could not be merged because of exceptions will be reported as `skipped`.
- A report of merges and skipped PRs will be sent to Slack.


# Development

To develop in VSCode install <a href="https://docs.microsoft.com/en-us/azure/azure-functions/functions-run-local?tabs=macos%2Ccsharp%2Cbash#v2">azure functions core tools</a>

This will allow you to run commands like ```func new``` which will take you through a command line wizard to scaffold a new function.

## Debugging

A good way to execute a single function locally is to launch it from the debugger in VSCode

The functions available to launch this way are setup in the ```.vscode/launch.json``` file. When dealing with timer trigger functions you can point directly at the function index.js file so it won't try to help debug your cron expression but will run the function itself.

You can insert breakpoints and run specific functions locally this way.

If you aren't using the debugger and are starting the entire project locally you are running the risk of some timer trigger function executing based on your local system clock. This project contains many functions. If it is started locally outside of debug mode all of them will activate and begin listening for triggers.
