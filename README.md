# eMarketeer TypeScript Microservice Commons

A common config for eMarketeer TypeScript microservice

### Contents ###

- Common `ts.config.json`
- Common webpack config
- Common parts of `serverless.yml` including Epsagon configuration
- Common eslint config
- Common jest config

### How to use ###

1. Clone `em-ts-microservice-starter`
2. Rename all occurences of `em-ts-microservice-starter` to whatever your service is going to be named


### Scripts ###

Following commands are available:

- `em-commons lint`
- `em-commons tsc`
- `em-commons jest`
- `em-commons deploy`
- `em-commons invoke-local`

#### invoke-local ####

This command runs a lambda locally. 

Example usage:

`yarn invoke-local -f example-handler  -d "hello world"`

Where `-f` is the function name and `-d` is the request data.

More information on arguments is available here: https://www.serverless.com/framework/docs/providers/aws/cli-reference/invoke-local/


#### release ####
Create a commit following the syntax of https://github.com/semantic-release/semantic-release#commit-message-format
