// getting testing tips from https://ponyfoo.com/articles/testing-javascript-modules-with-tape

var proxyquire = require('proxyquire');
// use proxyquire to replace specific required functions with my own mocked versions, I will replace the request module below with something that returns my string

var test = require('tape');
// use tape to run the tests

let cacheBody = `<!doctype html>
<body>
<table id="MSOZoneCell_WebPartWPQ4">
<tr>
<th class="ms-rteTableFirstCol-default" rowspan="1" colspan="1" style="width: 100%;">
<h4 class="ms-rteElement-H4B">
  <a href="/Programs/OPA/Pages/NR20-023.aspx">​​State Health &amp; Emergency Officials Announce Latest COVID-19 Facts&nbsp;
  </a>
</h4>
<p style="line-height: 1.6; color: #777777;">March 15, 2020 -&nbsp;<span lang="EN">The California Department of Public Health today announced the most recent statistics on COVID-19.&nbsp;</span></p></th>
</tr>
</table>
</body>
</html>`;

test('cdph can parse the site HTML', async function (t) {
  // arrange
  var requestStub = function (url, callback) {
    callback(null,{},cacheBody);
  };
  const cdph = proxyquire('../../sources/cdph.js', {
    'request': requestStub
  });
  
  // act
  let result = null;
  await cdph(function(res) {
    console.log(res)
    if(res.length > 0) {
      result = 'success';
    }
  }, function(res) {});

  // assert
  t.equal(result, 'success');
  t.end();
});