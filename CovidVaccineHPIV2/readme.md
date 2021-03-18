# Covid Vaccine HPI V2

This service provides data for vaccines delivered by HPI both for the partially/fully vaccinated people chart and the total doses chart shown on the /vaccines page.

Charts in staging refer to this new file location in the staging branch of covid-static.

The production charts should use the new file location on files.covid19

## Change notes
This new SQL uses improved views with cleaner data provided by CDPH so we changed to V2 version of the service

The output json uses a different field structure which is clearer because we are no longer referring to first_dose which doesn't make sense with the single dose vaccine from J&J.

Because the output json is different and we want to keep it that way this new version of the service writes to a v2 file location.

# TimerTrigger - JavaScript

The `TimerTrigger` makes it incredibly easy to have your functions executed on a schedule. This sample demonstrates a simple use case of calling your function every 5 minutes.

## How it works

For a `TimerTrigger` to work, you provide a schedule in the form of a [cron expression](https://en.wikipedia.org/wiki/Cron#CRON_expression)(See the link for full details). A cron expression is a string with 6 separate expressions which represent a given schedule via patterns. The pattern we use to represent every 5 minutes is `0 */5 * * * *`. This, in plain text, means: "When seconds is equal to 0, minutes is divisible by 5, for any hour, day of the month, month, day of the week, or year".

## Learn more

<TODO> Documentation