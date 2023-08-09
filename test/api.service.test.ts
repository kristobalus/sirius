import { ApiService } from "../src/services/api.service";
import { TokenService } from "../src/services/token.service";
import { Timeline } from "../src/models/timeline";


describe('ApiService', function() {

    it('getUserSearch', async () => {
        const tokenService = new TokenService()
        const apiService = new ApiService(tokenService)
        const result = await apiService.getUserSearch({ text: "elonmusk" })
        console.log(result)
    })

    it('getGraphUserTweets', async () => {
        const tokenService = new TokenService()
        const apiService = new ApiService(tokenService)
        const result = await apiService.getGraphUserTweets("44196397", Timeline.Tweets)
        console.log(JSON.stringify(result))
    })

})
