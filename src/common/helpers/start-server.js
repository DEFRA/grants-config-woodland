import { config } from '#/config.js'
import { createServer } from '#/server.js'
import { storeConfigVersionAndInformBroker } from '@defra/grants-config-utils'

export async function startServer() {
  const server = await createServer()
  await server.start()

  server.logger.info('Server started successfully')
  server.logger.info(
    `Access your backend on http://localhost:${config.get('port')}`
  )

  await storeConfigVersionAndInformBroker(server.logger.child({}))

  return server
}
