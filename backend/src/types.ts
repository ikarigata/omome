import type { APIGatewayProxyEventV2, Context } from 'aws-lambda'

export type HonoEnv = {
  Bindings: {
    event: APIGatewayProxyEventV2
    lambdaContext: Context
  }
  Variables: {
    userId: string
  }
}
