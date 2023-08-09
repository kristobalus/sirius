import { AxiosRequestConfig, default as axios } from "axios";

import { Resource } from "../models/resource";
import { auth, activateUrl } from "../config/const";

//  max requests at a time per token, to avoid race conditions
const maxConcurrentReqs = 5
//  if a token is unused for 60 minutes, it expires
const maxLastUse = 3600
//  tokens expire after 3 hours
const maxAge = 3600 * 3 - 1
const failDelay = 60 * 30

export interface RateLimit {
    // number of requests
    remaining: number
    // epoch
    reset: number
}

export class Token {
    tok: string
    time: number
    pending: number
    lastUse: number
    resources: { [key: string]: RateLimit }
}

export class TokenService {

    private lastFailedTime: number
    private tokenPool: Map<Resource, Token[]>

    constructor() {
        this.tokenPool = new Map()
    }

    async fetchToken() : Promise<Token> {

        if (Date.now() - this.lastFailedTime < failDelay) {
            throw new Error("rate limited")
        }

        let headers = { "authorization": auth };

        try {
            const response = await axios.post(activateUrl, null, { headers: headers } as AxiosRequestConfig);

            const token = new Token()
            token.tok = response.data["guest_token"]
            token.time = Date.now()
            token.pending = 0
            token.resources = {}

            return token

        } catch (e) {
            console.log("[tokens] fetching token failed: ", e.message);
            if (!e.message.includes("Try again")) {
                console.log("[tokens] fetching tokens paused, resuming in 30 minutes");
            }
            this.lastFailedTime = Date.now()
            return null
        }
    }

    isExpired(token: Token): boolean {
        const time = Date.now()
        return token.time < time - maxAge || token.lastUse < time - maxLastUse
    }

    isLimited(token: Token, resource: Resource): boolean {
        if (token == null || this.isExpired(token)) {
            return true
        }

        if (token.resources[resource] !== undefined) {
            let limit = token.resources[resource]
            return limit.remaining <= 10 && limit.reset > Date.now()
        }

        return false
    }

    isReady(token: Token, resource: Resource): boolean {
        return !(token == null || token.pending > maxConcurrentReqs || this.isLimited(token, resource))
    }

    release(resource: Resource,
            token: Token,
            options: { used?: boolean, invalid?: boolean } = {}) {

        if (token == null) {
            return
        }

        if (options.invalid || this.isExpired(token)) {
            if (options.invalid) {
                console.log("discarding invalid token")
            } else if (this.isExpired(token)) {
                console.log("discarding expired token")
            }

            const tokens = this.tokenPool.get(resource)
            const index = tokens.indexOf(token)
            tokens.splice(index, 1);
        } else if (options.used) {
            token.pending--
        }

        token.lastUse = Date.now()
    }

    async getToken(resource: Resource) : Promise<Token> {

        let result: Token;

        for (const token of this.tokenPool.get(resource) ?? []) {
            if (this.isReady(token, resource)) {
                this.release(resource, token);
                result = token
                break;
            }
        }

        if (!this.isReady(result, resource)) {
            this.release(resource, result);
            result = await this.fetchToken();
            if (!this.tokenPool.get(resource) ) {
                this.tokenPool.set(resource, [])
            }
            if ( result ) {
                this.tokenPool.get(resource).push(result)
                console.log("added new token to pool");
            }
        }

        if (result !== null) {
            result.pending++;
        } else {
            throw new Error("rate limited");
        }

        return result;
    }

    setRateLimit(token: Token, resource: Resource, remaining: number, reset: number)  {
        if ( token.resources[resource] ) {
            let limit = token.resources[resource]
            if ( limit.reset >= reset && limit.remaining < remaining ) {
                return
            }
        }

        token.resources[resource] = { remaining, reset } as RateLimit

        console.log(token)
    }


}
