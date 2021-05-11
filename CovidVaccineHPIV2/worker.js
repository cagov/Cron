const { queryDataset, getSQL } = require('../common/snowflakeQuery');
const { validateJSON } = require('../common/schemaTester');
const GitHub = require('github-api');
const PrLabels = ['Automatic Deployment','Publish at 9:15 a.m. ☀️'];
const githubUser = 'cagov';
const githubRepo = 'covid-static-data';
const committer = {
  name: process.env["GITHUB_NAME"],
  email: process.env["GITHUB_EMAIL"]
};
const targetBranch = 'main';
const SnowFlakeSqlPath = 'CDTCDPH_VACCINE/vaccine_hpi_v2/';
const targetPath = 'data/vaccine-hpi/v2/';
const targetFileName = 'vaccine-hpi.json';
const schemaPath = `../SQL/${SnowFlakeSqlPath}schema/`;

const nowPacTime = options => new Date().toLocaleString("en-CA", { timeZone: "America/Los_Angeles", ...options });
const todayDateString = () => nowPacTime({ year: 'numeric', month: '2-digit', day: '2-digit' });
const todayTimeString = () => nowPacTime({ hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/:/g, '-');

const doCovidVaccineHPIV2 = async () => {
  const gitModule = new GitHub({ token: process.env["GITHUB_TOKEN"] });
  const gitRepo = await gitModule.getRepo(githubUser, githubRepo);
  const gitIssues = await gitModule.getIssues(githubUser,githubRepo);

  const branchPrefix = 'data-vaccine-hpi-v2-';
  const commitMessage = 'Update Vaccine HPI Data';
  const PrTitle = `${todayDateString()} Vaccine HPI`;
  let branch = targetBranch;

  const prs = await gitRepo.listPullRequests({
    base: targetBranch
  });
  let Pr = prs.data.filter(x => x.title === PrTitle)[0];

  if (Pr) { //reuse the PR if it is still open
    branch = Pr.head.ref;
  }

  const dataOutput = await getData();
  const targetcontent = (await gitRepo.getContents(branch, `${targetPath}${targetFileName}`, true)).data;
  if (JSON.stringify(dataOutput.data) === JSON.stringify(targetcontent.data)) {
    console.log('data matched - no need to update');
  } else {
    console.log('data changed - updating');

    if (!Pr) {
      //new branch
      branch = `${branchPrefix}-${todayDateString()}-${todayTimeString()}`;
      await gitRepo.createBranch(targetBranch, branch);
    }

    await gitRepo.writeFile(branch, `${targetPath}${targetFileName}`, JSON.stringify(dataOutput, null, 2), commitMessage, { committer, encode: true });

    if (!Pr) {
      //new Pr
      Pr = (await gitRepo.createPullRequest({
        title: PrTitle,
        head: branch,
        base: targetBranch
      }))
        .data;

      //Label the Pr
      await gitIssues.editIssue(Pr.number,{
          labels: PrLabels
      });
    }
  }
  return Pr;
};


const getData = async () => {
  const sqlResults = await queryDataset(
    {
      data: getSQL(`${SnowFlakeSqlPath}vaccine_hpi`),
      doses: getSQL(`${SnowFlakeSqlPath}vaccine_doses`)
    }
    , process.env["SNOWFLAKE_CDTCDPH_VACCINE"]
  );

  // validateJSON('vaccine-hpi.json failed input validation', sqlResults.data,`${schemaPath}input/schema.json`,`${schemaPath}input/pass/`);

  let LATEST_ADMINISTERED_DATE = new Date("1900-01-01");
  sqlResults.data.forEach(r => {
    if (LATEST_ADMINISTERED_DATE < r.LATEST_ADMIN_DATE) {
      LATEST_ADMINISTERED_DATE = r.LATEST_ADMIN_DATE;
    }
    sqlResults.doses.forEach(doses => {
      if (doses.HPIQUARTILE === r.HPIQUARTILE) {
        r.COMBINED_DOSES = doses["COUNT(VAX_EVENT_ID)"];
      }
    });

    delete r.LATEST_ADMIN_DATE;
  });

  const mappedResults = {
    meta: {
      LATEST_ADMINISTERED_DATE,
      PUBLISHED_DATE: todayDateString()
    },
    data: sqlResults.data
  };

  validateJSON('vaccine-hpi.json failed output validation', mappedResults, `${schemaPath}output/schema.json`, `${schemaPath}output/pass/`);

  return mappedResults;
};

module.exports = {
  doCovidVaccineHPIV2
};
