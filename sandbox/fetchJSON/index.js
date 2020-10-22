const fetch = require('node-fetch');
//Common Fetch functions
module.exports = {
fetchJSON: async (URL, options, fetchoutput) => 
    await fetch(URL,options)
    .then(response => {
        if (fetchoutput)
            fetchoutput.response = response;
        return response;
    })
    .then(response =>
        response.ok
        ? (
            response.status===200||response.status===201
            ? response.json()
            : null)
        : (
            response.status===404
            ? []
            : Promise.reject(response))
       )
    .catch(async response => {
        const json = (await (response.json ? response.json() : null)) || response;

        if(!options)
            options = {method:'GET'};

        const message = `fetchJSON error - ${options.method} - ${URL} : ${JSON.stringify(json)}`;

        return Promise.reject(new Error(message));
    })
};