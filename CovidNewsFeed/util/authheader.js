module.exports = function authheader() {
  return {
    'Authorization' : `Bearer ${process.env["GITHUB_TOKEN"]}`,
    'Content-Type': 'application/json'
  };
};
