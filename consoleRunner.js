import { createInterface } from 'readline';
import { URL } from 'url';
import request from 'request';

const readline = createInterface({
    input: process.stdin,
    output: process.stdout
});

const POSTCODES_BASE_URL = 'https://api.postcodes.io';
const TFL_BASE_URL = 'https://api.tfl.gov.uk';

export default class ConsoleRunner {

    promptForPostcode() {
        return new Promise((resolve) => {
            readline.question('\nEnter your postcode: ', function (postcode) {
                readline.close();
                resolve(postcode);
            });
        });
    }

    displayStopPoints(stopPoints) {
        stopPoints.forEach(point => {
            console.log(point.commonName);
        });
        if (stopPoints.length === 0) {
            console.log("Sorry, no stop points found.");
        }
    }

    buildUrl(url, endpoint, parameters) {
        const requestUrl = new URL(endpoint, url);
        parameters.forEach(param => requestUrl.searchParams.append(param.name, param.value));
        return requestUrl.href;
    }

    makeGetRequest(baseUrl, endpoint, parameters) {
        const url = this.buildUrl(baseUrl, endpoint, parameters);
        return new Promise((resolve, reject) => {
            request.get(url, (err, response, body) => {
                if (err) {
                    console.log(err)
                    reject(err);
                }
                if (response.statusCode !== 200) {
                    console.log(response.statusCode);
                    reject(response.statusCode);
                }
                resolve(body);
            });
        })
    }

    getLocationForPostCode(postcode) {
        return new Promise((resolve, reject) => {
            this.makeGetRequest(POSTCODES_BASE_URL, `postcodes/${postcode}`, [])
                .then((responseBody) => {
                    const jsonBody = JSON.parse(responseBody);
                    if (!jsonBody) { reject("Failed to parse location"); }
                    resolve({ latitude: jsonBody.result.latitude, longitude: jsonBody.result.longitude });
                })
                .catch((err) => {reject(`Unable to get location. Error: ${err}`)});
        })
    }

    getNearestStopPoints(latitude, longitude, count) {
        return new Promise((resolve, reject) => {
            this.makeGetRequest(
                TFL_BASE_URL,
                `StopPoint`,
                [
                    {name: 'stopTypes', value: 'NaptanPublicBusCoachTram'},
                    {name: 'lat', value: latitude},
                    {name: 'lon', value: longitude},
                    {name: 'radius', value: 1000},
                    {name: 'app_id', value: '' /* Enter your app id here */},
                    {name: 'app_key', value: '' /* Enter your app key here */}
                ])
                .then((responseBody) => {
                        const stopPoints = JSON.parse(responseBody).stopPoints.map(function(entity) {
                            return { naptanId: entity.naptanId, commonName: entity.commonName };
                        }).slice(0, count);
                        resolve(stopPoints);
                    })
                .catch(err => reject(`Unable to get stop points. Error: ${err}`));
        })

    }

    async run() {
        try {
            const that = this;
            const userInput = await that.promptForPostcode();
            const postcode = userInput.replace(/\s/g, '');
            const location = await that.getLocationForPostCode(postcode);
            const stopPoints = await that.getNearestStopPoints(location.latitude, location.longitude, 5);
            that.displayStopPoints(stopPoints);
        } catch (error) {
            console.log(error)
        }
    }
}