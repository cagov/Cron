const { queryDataset, getSQL } = require("../common/snowflakeQuery");
const { validateJSON } = require("../common/schemaTester");
const GitHub = require("github-api");

const getConfigGitHub = () => {
  return {
    githubUser: "cagov",
    githubRepo: "covid-static",
    masterBranch: "master",
    targetPath: "data/vaccine-hpi/",
    targetFileName: "vaccine-hpi.json",
    outputFileName: "vaccine-hpi.json",
    branchPrefix: "data-vaccine-hpi-",
    branchCommitMessage: "Update Vaccine HPI Data",
    committer: {
      name: process.env["GITHUB_NAME"],
      email: process.env["GITHUB_EMAIL"],
    },
  };
};

const getConfigDataset = () => {
  return {
    SNOWFLAKE_TOKEN: process.env["SNOWFLAKE_CDTCDPH_VACCINE"],
    SnowFlakeSqlPath: "CDTCDPH_VACCINE/vaccine_hpi/",
    datasetName: "Vaccine HPI",
    SnowFlakeSqlQueryPath: `${SnowFlakeSqlPath}vaccine_hpi`,
    schemaPath: `../SQL/${SnowFlakeSqlPath}schema/`,
    schemaInputPath: `${schemaPath}input/schema.json`,
    schemaInputPath: `${schemaPath}input/schema.json`,
    schemaOutputPath: `${schemaPath}output/schema.json`,
    passingInputFile: `${schemaPath}input/pass/`,
    passingOutputFile: `${schemaPath}output/pass/`,
    metaDataObject: `${schemaPath}meta.json`, // Meta object describing the dataset
  };
};

const nowPacTime = (options) =>
  new Date().toLocaleString("en-CA", {
    timeZone: "America/Los_Angeles",
    ...options,
  });

const todayDateString = () =>
  nowPacTime({ year: "numeric", month: "2-digit", day: "2-digit" });

const todayTimeString = () =>
  nowPacTime({
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).replace(/:/g, "-");

/**
 * Submit new data as pull request to GitHub.
 * @returns Pull Request Q: what's the structure that's expected to be returned here?
 */
const doCovidVaccineHPI = async () => {
  // Load local settings for this function.
  const configGitHub = getConfigGitHub();
  const configDataset = getConfigDataset();

  const gitModule = new GitHub({ token: process.env["GITHUB_TOKEN"] });
  const gitRepo = await gitModule.getRepo(
    configGitHub.githubUser,
    configGitHub.githubRepo
  );

  const pullRequestTitle = `${todayDateString()} ${configDataset.datasetName}`;

  let branch = configGitHub.masterBranch;

  const prs = await gitRepo.listPullRequests({
    base: configGitHub.masterBranch,
  });

  let pullRequest = prs.data.filter((x) => x.title === pullRequestTitle)[0];

  if (pullRequest) {
    // Re-use the pull request if it is still open.
    branch = pullRequest.head.ref;
  }

  // Current processed data object to write to GitHub if valid and different from previous files.
  const dataOutput = await getData();

  // Read content of file from GitHub branch.
  const targetcontent = (
    await gitRepo.getContents(
      branch,
      `${configGitHub.targetPath}${configGitHub.targetFileName}`,
      true
    )
  ).data;

  // Check if file has changed.
  if (JSON.stringify(dataOutput.data) === JSON.stringify(targetcontent.data)) {
    console.log("Data matched: no need to update");
  } else {
    console.log("Data changed: updating");
    if (!pullRequest) {
      // Create new branch
      branch = `${
        configGitHub.branchPrefix
      }-${todayDateString()}-${todayTimeString()}`;
      await gitRepo.createBranch(configGitHub.masterBranch, branch);
    }

    // Write file to GitHub branch.
    await gitRepo.writeFile(
      branch,
      `${configGitHub.targetPath}${configGitHub.targetFileName}`,
      JSON.stringify(dataOutput, null, 2),
      configGitHub.commitMessage,
      { committer: configGitHub.commitMessage, encode: true }
    );

    if (!pullRequest) {
      // Create new pull request.
      pullRequest = (
        await gitRepo.createPullRequest({
          title: pullRequestTitle,
          head: branch,
          base: configGitHub.masterBranch,
        })
      ).data;
    }
  }

  // Approve the pull request.
  if (pullRequest) {
    await gitRepo.mergePullRequest(pullRequest.number, {
      merge_method: "squash",
    });

    await gitRepo.deleteRef(`heads/${pullRequest.head.ref}`);
  }
  return pullRequest;
};

/**
 *
 * @param {*} param0
 * @returns
 */
const getData = async () => {
  
  // Load local settings for this function.
  const configGitHub = getConfigGitHub();
  const configDataset = getConfigDataset();

  // Load data.
  const sqlResults = await queryDataset(
    {
      data: getSQL(`${configDataset.SnowFlakeSqlQueryPath}`),
    },
    configDataset.SNOWFLAKE_TOKEN
  );

  // Validate data.
  validateJSON(
    `${configGitHub.outputFileName} failed validation`,
    sqlResults.data,
    `${configDataset.schemaInputPath}`,
    `${configDataset.passingInputFile}`
  );

  // Process special attributes.
  let LATEST_ADMINISTERED_DATE = new Date("1900-01-01"); // Q: could this be null instead?

  sqlResults.data.forEach((r) => {
    if (LATEST_ADMINISTERED_DATE < r.LATEST_ADMIN_DATE) {
      LATEST_ADMINISTERED_DATE = r.LATEST_ADMIN_DATE;
    }

    delete r.LATEST_ADMIN_DATE;
  });

  // Generate result date object.
  const mappedResults = {
    meta: getMeta({
      {
        LATEST_ADMINISTERED_DATE, // @TODO sync on converting this to lowercase.
        PUBLISHED_DATE: todayDateString(), // @TODO sync on converting this to lowercase.
        // latest_administered_date: LATEST_ADMINISTERED_DATE, // @TODO sync on converting this to lowercase.
        // published_date: todayDateString(), // @TODO sync on converting this to lowercase.
      })
    data: sqlResults.data,
  };

  validateJSON(
    `${configGitHub.outputFileName} failed validation`,
    mappedResults,
    `${configDataset.schemaOutputPath}`,
    `${configDataset.passingOutputFile}`
  );

  return mappedResults;
};

const getMeta = (props) => {
    // Load local settings for this function.
    const configDataset = getConfigDataset();

    let metaFile = configDataset.metaDataObject;
}

module.exports = {
  doCovidVaccineHPI,
};
