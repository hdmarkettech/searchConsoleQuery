const moment = require('moment');
const {google} = require('googleapis');
const Airtable = require('airtable');
const async = require('async');
const process = require('process')
const AWS = require('aws-sdk');
const kms = new AWS.KMS()

let airtableApiKey;
let googleOAuth2Client;
let googleOAuth2Secret;
let aToken;
let rToken;

let base;
let oauth2Client;
let webmasters;

let startDate;
let endDate;
const threeDaysAgo = moment().subtract( 3, 'day').format('YYYY-MM-DD');
const oneMonthAgoStart = moment().subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
const oneMonthAgoEnd = moment().subtract(1, 'month').endOf('month').format('YYYY-MM-DD');
const sat = moment().day(-1).format('YYYY-MM-DD');
const prevSun = moment().day(-7).format('YYYY-MM-DD');
let keywordArr;

module.exports.query = (event) => {
    console.log('event', event)
    getCredentials().then(()=>{
        getKeywords().then(()=>{
            setDatesAndQuery(event).then(()=>{
            })
        })
    })
};
async function setDatesAndQuery(event){
    console.log('Setting dates...');
    switch (event.schedule) {
        case 'daily':
            startDate = threeDaysAgo;
            endDate = threeDaysAgo;
            console.log('Getting keywordless daily search stats...')
            await runQuery(null, 'Web');
            await runQuery(null, 'Video');
            await runQuery(null, 'Image');
            break;
        case 'monthly':
            startDate = oneMonthAgoStart;
            endDate = oneMonthAgoEnd;
            console.log('Getting keywordless monthly search stats...')
            await runQuery(null, 'Web');
            await runQuery(null, 'Video');
            await runQuery(null, 'Image');
            break;
        case 'weekly':
            startDate = prevSun;
            endDate = sat;
            await getKeywords();
            console.log('Getting weekly stats for keywords');
            async.eachLimit(keywordArr, 5, (value, done)=>{
                console.log('Web stats for', value.name)
                runQuery(value, 'Web').then(()=>{
                    done()
                });
            }, (err)=>{
                if(err){
                    console.log('err', err)
                }
            })
            async.eachLimit(keywordArr, 5, (value, done)=>{
                console.log('Video stats for', value.name)
                runQuery(value, 'Video').then(()=>{
                    done()
                });
            }, (err)=>{
                if(err){
                    console.log('err', err)
                }
            })
            async.eachLimit(keywordArr, 5, (value, done)=>{
                console.log('Image stats for', value.name)
                runQuery(value, 'Image').then(()=>{
                    done()
                });
            }, (err)=>{
                if(err){
                    console.log('err', err)
                }
            })
            break;
        default:
            return
    }
}

async function getKeywords() {
    console.log('Getting Keywords...')
    keywordArr = [];
    try {
        let promise = new Promise((resolve, reject)=>{
            base('Keywords').select().eachPage( function page(records, fetchNextPage) {
                records.forEach(function (record) {
                    let keywordObj = {
                        id: null,
                        name: null
                    };
                    keywordObj.id = record.getId();
                    keywordObj.name = record.get('Name');
                    keywordArr.push(keywordObj);
                })
                fetchNextPage();
            }, function done(err) {
                if (err) {
                    console.error('keyword airtable', err);
                    reject(err)
                }
                resolve()
            })
        })
        await promise
        console.log('keywordArr.length', keywordArr.length)
    }
    catch (e) {
        console.log('keyword e', e)
    }
}

async function runQuery(keyword, searchType) {
    try{
        const deviceRes = await webmasters.searchanalytics.query({
            siteUrl: 'https://www.hunterdouglas.com',
            requestBody:{
                startDate: startDate,
                endDate: endDate,
                dimensions: keyword ? ["country", "device", "query"] : ["country", "device"],
                dimensionFilterGroups: [{
                    filters: keyword ? [
                        {
                            dimension: 'country',
                            operator: 'equals',
                            expression: 'usa'
                        },
                        {
                            dimension: 'query',
                            operator: 'equals',
                            expression: keyword.name.toLowerCase()
                        }
                    ] : [
                        {
                            dimension: 'country',
                            operator: 'equals',
                            expression: 'usa'
                        }
                    ]
                }],
                searchType: searchType.toLowerCase(),
            },
        });
        const allRes = await webmasters.searchanalytics.query({
            siteUrl: 'https://www.hunterdouglas.com',
            requestBody:{
                startDate: startDate,
                endDate: endDate,
                dimensions: keyword ? ["country", "query"] : ["country"],
                dimensionFilterGroups: [{
                    filters: keyword ? [
                        {
                            dimension: 'country',
                            operator: 'equals',
                            expression: 'usa'
                        },
                        {
                            dimension: 'query',
                            operator: 'equals',
                            expression: keyword.name.toLowerCase()
                        }
                    ] : [
                        {
                            dimension: 'country',
                            operator: 'equals',
                            expression: 'usa'
                        }
                    ]
                }],
                searchType: searchType.toLowerCase(),
            },
        });
        console.log('allRes.data', allRes.data)
        let desktop;
        let tablet;
        let mobile;
        if(deviceRes && deviceRes.data && deviceRes.data.rows){
            deviceRes.data.rows.forEach((value)=>{
                switch (value.keys[1]){
                    case 'MOBILE':
                        mobile = value;
                        break
                    case 'DESKTOP':
                        desktop = value;
                        break;
                    case 'TABLET':
                        tablet = value;
                        break;
                    default:
                }
            })
        }
        console.log('Saving', keyword ? keyword.name : 'keywordless', 'stats to Airtable');
        base('Stats').create({
            "Start": startDate,
            "End": endDate,
            "clicks": allRes.data.rows[0].clicks,
            "clicks-desktop": desktop ? desktop.clicks : 0,
            "clicks-mobile": mobile ? mobile.clicks : 0,
            "clicks-tablet": tablet ? tablet.clicks : 0,
            "position": allRes.data.rows[0].position,
            "position-desktop": desktop ? desktop.position : 0,
            "position-mobile": mobile ? mobile.position : 0,
            "position-tablet": tablet ? tablet.position : 0,
            "impressions": allRes.data.rows[0].impressions,
            "ctr": allRes.data.rows[0].ctr,
            "Keyword": keyword ? [keyword.id] : null,
            "search_type": searchType
        }, function (err, record) {
            if (err) {
                console.error('Airtable Error', err);
            }
            console.log('Done with', keyword ? keyword.name : 'keywordless', record.getId());
        })
    }
    catch (e) {
        console.log('e', e)
    }
}

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
        base = new Airtable({apiKey: airtableApiKey}).base('appAXSzVmVG3wP5bi');
        oauth2Client = new google.auth.OAuth2(
            googleOAuth2Client,
            googleOAuth2Secret,
            'http://localhost:3000/oauth2callback'
        );
        oauth2Client.on('tokens', (tokens) => {
            if (tokens.refresh_token) {
                // store the refresh_token in my database!
                console.log('refresh' ,tokens.refresh_token);
            }
            console.log('access', tokens.access_token);
        });
        oauth2Client.setCredentials({
            access_token: aToken,
            refresh_token: rToken
        });
        webmasters = google.webmasters({
            version: 'v3',
            auth: oauth2Client
        });
        console.log('Credentials set')
    }
    catch (e) {
        console.log('e', e)
    }
}
