module.exports = async function (context) {
    context.res = {
        // status: 200, /* Defaults to 200 */
        body: JSON.stringify(process.env,null,2)
    };
};