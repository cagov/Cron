const fetch = require("node-fetch");
const { TimeSeries } = require("calibre");

module.exports = async function(context, myTimer) {
  const getTimeseries = async ({ site, from, to, measurements }) => {
    const results = await TimeSeries.list({ site, from, to, measurements });

    // compare all the measurements, see if they are all the same
    let finalOutput = "<https://example.com|covid19.ca.gov>:\n";
    results.series.forEach(ser => {
      finalOutput += `${ser.name} perf score: ${
        ser.values[ser.values.length - 1]
      }\n`;

      let output = "";
      let foundDiff = false;
      // ser.values[0] = 999;
      ser.values.forEach((v, i) => {
        if (i > 0) {
          if (v === ser.values[i - 1]) {
            // no change
          } else {
            let diff = v - ser.values[i - 1];
            foundDiff = true;
            output = `on ${new Date(
              results.times[i].timestamp
            ).toLocaleString()} the performance score changed by ${diff}\n`;
            if (diff > 0) {
              output = `:star: Congratulations! on ${new Date(
                results.times[i].timestamp
              ).toLocaleString()} the performance score went up by ${diff}\n`;
            } else {
              output = `:flailing-robot: Um... folks... on ${new Date(
                results.times[i].timestamp
              ).toLocaleString()} performance score went down by ${Math.abs(
                diff
              )} :facepalm: \n`;
            }
            finalOutput += output;
          }
        }
      });
      if (!foundDiff) {
        finalOutput +=
          ":simple_smile: no change in score detected over last 24 hours\n";
      }
    });
    // console.log(finalOutput)
    // console.log(JSON.stringify(results, null, 2))

    let body = {
      text: finalOutput,
      blocks: [
        {
          type: "section",
          block_id: "section567",
          text: {
            type: "mrkdwn",
            text: finalOutput
          }
        }
      ]
    };

    fetch(
      "https://hooks.slack.com/services/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",
      {
        method: "post",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" }
      }
    ).then(res => {
      console.log(res);
    });
  };
  const siteSlug = "covid19-ca-gov";
  const to = new Date();
  // our tests run every 6 hours, retrieve the last 1 day of results
  const from = new Date();
  from.setDate(to.getDate() - 1);

  // Filter the metrics to be returned (omitting `measurements` will return all available measurements)
  const measurements = ["lighthousePerformanceScore"];
  getTimeseries({ site: siteSlug, from, to, measurements });
};
