const Apify = require('apify');

const { log } = Apify.utils;
const sourceUrl = 'https://www.moh.gov.bh/COVID19';
const LATEST = 'LATEST';

Apify.main(async () => {
    const requestQueue = await Apify.openRequestQueue();
    const kvStore = await Apify.openKeyValueStore('COVID-19-BAHRAIN');
    const dataset = await Apify.openDataset('COVID-19-BAHRAIN-HISTORY');

    await requestQueue.addRequest({ url: sourceUrl });
    const crawler = new Apify.CheerioCrawler({
        requestQueue,
        useApifyProxy: true,
        apifyProxyGroups: ['SHADER'],
        handlePageTimeoutSecs: 60 * 2,
        handlePageFunction: async ({ $ }) => {
            log.info('Page loaded.');
            const now = new Date();

            const tested = parseInt($($('#tbl1 tr').get(1)).find("td span").text().trim(), 10)
            const stableExisting = parseInt($($($('#tbl1 tr').get(4)).find("td").get(0)).find("span").text().trim(), 10)
            const undercareExisting = parseInt($($($('#tbl1 tr').get(4)).find("td").get(1)).find("span").text().trim(), 10)
            const stable84 = parseInt($($($('#tbl1 tr').get(4)).find("td").get(2)).find("span").text().trim(), 10)
            const undercare84 = parseInt($($($('#tbl1 tr').get(4)).find("td").get(3)).find("span").text().trim(), 10)

            const data = {
                tested,
                infected: undercareExisting + undercare84 + stableExisting + stable84,
                underCare: undercareExisting + undercare84,
                stable: stableExisting + stable84,
                sourceUrl,
                lastUpdatedAtApify: new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, now.getMinutes())).toISOString(),
                readMe: 'https://apify.com/tugkan/covid-bh',
            };

            // Compare and save to history
            const latest = await kvStore.getValue(LATEST) || {};
            delete latest.lastUpdatedAtApify;
            const actual = Object.assign({}, data);
            delete actual.lastUpdatedAtApify;

            await Apify.pushData({...data});

            if (JSON.stringify(latest) !== JSON.stringify(actual)) {
                log.info('Data did change :( storing new to dataset.');
                await dataset.pushData(data);
            }

            await kvStore.setValue(LATEST, data);
            log.info('Data stored, finished.');
        },

        // This function is called if the page processing failed more than maxRequestRetries+1 times.
        handleFailedRequestFunction: async ({ request }) => {
            console.log(`Request ${request.url} failed twice.`);
        },
    });

    // Run the crawler and wait for it to finish.
    await crawler.run();

    console.log('Crawler finished.');
});
