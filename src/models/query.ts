

export enum QueryKind {
    posts = "posts",
    replies = "replies",
    media = "media",
    users = "users",
    tweets = "tweets",
    userList = "userList"
}

export interface Query {
    kind: QueryKind
    text: string
    filters: string[]
    includes: string[]
    excludes: string[]
    fromUser: string[]
    since: string
    until: string
    near: string
    sep: string
}
