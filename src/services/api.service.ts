import { TokenService } from "./token.service";
import {
    auth,
    gqlFeatures,
    graphUserMediaUrl,
    graphUserTweetsAndRepliesUrl,
    graphUserTweetsUrl,
    Headers,
    userSearchUrl,
    userTweetsVariables
} from "../config/const";
import { Resource } from "../models/resource";
import { default as axios } from "axios";
import * as console from "console";
import { Query } from "../models/query";
import { Timeline } from "../models/timeline";

export class ApiService {

    constructor(
        private tokenService: TokenService
    ) {}

    generateHeaders(token = null) {
        return {
            "connection": "keep-alive",
            "authorization": auth,
            "content-type": "application/json",
            "x-guest-token": token ?? "",
            "x-twitter-active-user": "yes",
            "authority": "api.twitter.com",
            "accept-encoding": "gzip",
            "accept-language": "en-US,en;q=0.9",
            "accept": "*/*",
            "DNT": "1"
        };
    }

    private async call(url: string, resource: Resource) {

        try {
            const token = await this.tokenService.getToken(resource)
            if (!token) {
                throw new Error('rate limited');
            }

            try {

                const headers = this.generateHeaders(token.tok); // Assuming genHeaders returns appropriate headers
                const response = await axios.get(url, { headers });

                if (response.status === 503) {
                    throw new Error("Bad client"); // Custom exception handling might be needed
                }

                this.tokenService.release(resource, token, { used: true })

                // Handle the result as needed
                console.log(response.data)

                if ( response.headers[Headers.RateLimitRemaining] ) {
                    const remaining = parseInt(response.headers[Headers.RateLimitRemaining])
                    const reset = parseInt(response.headers[Headers.RateLimitRest])
                    this.tokenService.setRateLimit(token, resource, remaining, reset)
                }

                return response.data

            } catch (error) {
                // Handle the error as needed
                console.error(error);
            }
        } catch (err) {
            console.log(err)
        }
    }

    async getUserSearch(query: Partial<Query>, page = "1") {
        if (query.text.length === 0) {
            return { query: query, beginning: true };
        }

        const url = new URL(userSearchUrl);
        url.searchParams.append("q", query.text);
        url.searchParams.append("skip_status", "1");
        url.searchParams.append("count", "20");
        url.searchParams.append("page", page);

        const result = await this.call(url.toString(), Resource.UserSearch)
        result.query = query;

        if (page.length === 0) {
            result.bottom = "2";
        } else if (/^\d+$/.test(page)) { // Checks if page contains only digits
            result.bottom = (parseInt(page) + 1).toString();
        }

        return result;
    }

    async getGraphUserTweets(id: string, kind: Timeline, after?: string) {
        if (!id) return
        let cursor = after ? `"cursor":"${after}",` : "";
        let variables = userTweetsVariables(id, cursor);

        let url, resource;
        switch (kind) {
            case Timeline.Tweets:
                url = graphUserTweetsUrl;
                resource = Resource.UserTweets;
                break;
            case Timeline.Replies:
                url = graphUserTweetsAndRepliesUrl;
                resource = Resource.UserTweetsAndReplies;
                break;
            case Timeline.Media:
                url = graphUserMediaUrl;
                resource = Resource.UserMedia;
                break;
        }

        const endpoint = new URL(url);
        endpoint.searchParams.append("variables", variables);
        endpoint.searchParams.append("features", JSON.stringify(gqlFeatures));

        console.log(endpoint.toString())

        return await this.call(endpoint.toString(), resource)
    }

}
