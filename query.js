'use strict';
const moment = require('moment');

let airtableApiKey;
let googleOAuth2Client;
let googleOAuth2Secret;
let aToken;
let rToken;

let base;

const oneMonthAgo = moment().subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
const oneMonthAgo2 = moment().subtract(1, 'month').endOf('month').format('YYYY-MM-DD');
const dateOfMonth = moment().date();
const sat = moment().day(-1).format('YYYY-MM-DD');
const prevSun = moment().day(-7).format('YYYY-MM-DD');
console.log('Start Date (Sunday before last):', prevSun);
console.log('End Date (Last Saturday):', sat);
console.log('oneMonthAgo', oneMonthAgo)
console.log('oneMonthAgo2', oneMonthAgo2)
console.log('dateOfMonth', dateOfMonth)

module.exports.query = async event => {
};
async function getCredentials(){
    console.log('Getting credentials...')
    const encrypted = [
        process.env['AIRTABLEAPIKEY'],
        process.env['GOOGLEOAUTH2CLIENT'],
        process.env['GOOGLEOAUTH2SECRET'],
        process.env['GOOGLEACCESSTOKEN'],
        process.env['GOOGLEREFRESHTOKEN']
    ];
    try {
        await async.eachSeries(encrypted, (value, cb)=>{
            kms.decrypt({ CiphertextBlob: Buffer.from(value, 'base64') }, (err, data) => {
                if (err) {
                    console.log('Decrypt error:', err);
                    cb()
                    return callback(err);
                }
                if(value === process.env['AIRTABLEAPIKEY']){
                    airtableApiKey = data.Plaintext.toString('ascii');
                }
                if(value === process.env['GOOGLEOAUTH2CLIENT']){
                    googleOAuth2Client = data.Plaintext.toString('ascii');
                }
                if(value === process.env['GOOGLEOAUTH2SECRET']){
                    googleOAuth2Secret = data.Plaintext.toString('ascii');
                }
                if(value === process.env['GOOGLEACCESSTOKEN']){
                    aToken = data.Plaintext.toString('ascii');
                }
                if(value === process.env['GOOGLEREFRESHTOKEN']){
                    rToken = data.Plaintext.toString('ascii');
                }
                cb()
            });
        })
        Airtable.configure({
            endpointUrl: 'https://api.airtable.com',
            apiKey: airtableApiKey
        });
        base = Airtable.base('appAXSzVmVG3wP5bi');
        const oauth2Client = new google.auth.OAuth2(
            googleOAuth2Client,
            googleOAuth2Secret,
            'http://localhost:3000/oauth2callback'
        );
        oauth2Client.setCredentials({
            access_token: "ya29.Il-7Bxid0caNhmSSOCJPYcvwMe0TbYebtNYJCZoT1edffarKIgYUCpjmRlMtPHS51MP3U6T8R6CGrOu16nX5xLej_vDCDbTSveSdH0p5Vpp5mzBRhQBezJxprBDKLcCXPg",
            refresh_token: "1//04gGifi4VkLYmCgYIARAAGAQSNwF-L9IrLPzVaZO7TKFrujge78Hfe3y4dl1YX9W826NZOKr2RzGlyWPFebRLsK0hWrQ0JRcFOmM"
        });
        webmasters = google.webmasters({
            version: 'v3',
            auth: oauth2Client
        });
        console.log('Credentials Got')
    }
    catch (e) {
        console.log('e', e)
    }
}
